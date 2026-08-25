import jsQR from 'jsqr';
import {
  AnswerSheetTemplate,
  BubbleOption,
  Exam,
  ExamSubmission,
  ExamVariant,
  ImageQualityMetrics,
  QuestionConfig,
  RecognitionZone,
  RecognizedAnswer,
  Student
} from '../types';

export interface OMRProcessingOptions {
  fillThreshold?: number;       // Default ~0.20
  uncertainThreshold?: number;  // Default ~0.14
  minMargin?: number;           // Default ~0.10 margin between top and runner-up
}

export interface BubbleAnalysisResult {
  fillRatio: number;
  coreFillRatio: number;
  contrastScore: number;
  localBgLum: number;
  cropDataUrl: string;
}

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Helper to load an Image object from URL / Base64 string
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Không thể tải tệp hình ảnh: ' + e));
    img.src = src;
  });
}

/**
 * Evaluates image quality (Blur / Sharpness and Lighting / Exposure)
 */
export function assessImageQuality(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): {
  blurScore: number;
  isSharp: boolean;
  brightnessScore: number;
  isWellLit: boolean;
} {
  try {
    const sampleW = Math.min(width, 400);
    const sampleH = Math.min(height, 560);
    const startX = Math.round((width - sampleW) / 2);
    const startY = Math.round((height - sampleH) / 2);

    const imgData = ctx.getImageData(startX, startY, sampleW, sampleH);
    const data = imgData.data;

    let lumSum = 0;
    let lumSqSum = 0;
    const totalPixels = sampleW * sampleH;
    const gray = new Float32Array(totalPixels);

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[p] = l;
      lumSum += l;
      lumSqSum += l * l;
    }

    const meanLum = lumSum / totalPixels;
    const lumVariance = (lumSqSum / totalPixels) - (meanLum * meanLum);

    let laplacianSum = 0;
    let laplacianSqSum = 0;
    let lapCount = 0;

    for (let y = 1; y < sampleH - 1; y += 2) {
      const row = y * sampleW;
      for (let x = 1; x < sampleW - 1; x += 2) {
        const c = gray[row + x];
        const val =
          gray[row - sampleW + x] +
          gray[row + sampleW + x] +
          gray[row + x - 1] +
          gray[row + x + 1] -
          4 * c;

        laplacianSum += val;
        laplacianSqSum += val * val;
        lapCount++;
      }
    }

    const meanLap = lapCount > 0 ? laplacianSum / lapCount : 0;
    const lapVariance = lapCount > 0 ? (laplacianSqSum / lapCount) - (meanLap * meanLap) : 0;

    const rawBlurScore = Math.min(100, Math.round(Math.sqrt(lapVariance) * 4.2));
    const isSharp = rawBlurScore >= 30;

    const brightnessScore = Math.min(100, Math.max(0, Math.round((meanLum / 255) * 100)));
    const isWellLit = meanLum >= 55 && meanLum <= 245 && lumVariance > 150;

    return {
      blurScore: Math.max(40, rawBlurScore),
      isSharp,
      brightnessScore,
      isWellLit
    };
  } catch {
    return {
      blurScore: 85,
      isSharp: true,
      brightnessScore: 85,
      isWellLit: true
    };
  }
}

/**
 * Solve 8x8 Linear System using Gaussian Elimination with Partial Pivoting
 * to find the Projective Transform (Homography) Matrix mapping Destination -> Source
 */
function solve8x8(A: number[][], B: number[]): number[] | null {
  const n = 8;
  const M: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    M[i] = [...A[i], B[i]];
  }

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(M[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) return null; // Singular matrix

    if (maxRow !== col) {
      const temp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = temp;
    }

    const pivot = M[col][col];
    for (let j = col; j <= n; j++) {
      M[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = M[row][col];
        if (Math.abs(factor) > 1e-12) {
          for (let j = col; j <= n; j++) {
            M[row][j] -= factor * M[col][j];
          }
        }
      }
    }
  }

  const result: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = M[i][n];
  }
  return result;
}

/**
 * Computes the 3x3 Inverse Homography matrix that maps Destination (Canvas) points to Source (Photo) points
 * Destination points: [TL, TR, BR, BL]
 * Source points:      [TL, TR, BR, BL]
 */
function computeInverseHomography(
  dstQuad: [Point2D, Point2D, Point2D, Point2D],
  srcQuad: [Point2D, Point2D, Point2D, Point2D]
): number[] | null {
  const A: number[][] = [];
  const B: number[] = [];

  for (let i = 0; i < 4; i++) {
    const dx = dstQuad[i].x;
    const dy = dstQuad[i].y;
    const sx = srcQuad[i].x;
    const sy = srcQuad[i].y;

    // Mapping: (dx, dy) -> (sx, sy)
    // Row 1: dx*h00 + dy*h01 + h02 - sx*dx*h20 - sx*dy*h21 = sx
    A.push([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]);
    B.push(sx);

    // Row 2: dx*h10 + dy*h11 + h12 - sy*dx*h20 - sy*dy*h21 = sy
    A.push([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]);
    B.push(sy);
  }

  const h = solve8x8(A, B);
  if (!h) return null;
  // [h00, h01, h02, h10, h11, h12, h20, h21, h22=1]
  return [...h, 1];
}

/**
 * Performs full 4-point Perspective Warping & Rectification via Bilinear Interpolation
 */
function warpPerspectiveBilinear(
  srcCtx: CanvasRenderingContext2D,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  srcQuad: [Point2D, Point2D, Point2D, Point2D],
  dstQuad: [Point2D, Point2D, Point2D, Point2D]
): HTMLCanvasElement {
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = dstW;
  dstCanvas.height = dstH;
  const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true })!;

  const invH = computeInverseHomography(dstQuad, srcQuad);
  if (!invH) {
    // Fallback simple stretch
    dstCtx.drawImage(srcCtx.canvas, 0, 0, dstW, dstH);
    return dstCanvas;
  }

  const srcImgData = srcCtx.getImageData(0, 0, srcW, srcH);
  const srcData = srcImgData.data;
  const dstImgData = dstCtx.createImageData(dstW, dstH);
  const dstData = dstImgData.data;

  const [h00, h01, h02, h10, h11, h12, h20, h21] = invH;

  for (let y = 0; y < dstH; y++) {
    const dstRowOffset = y * dstW * 4;
    const u0 = h01 * y + h02;
    const v0 = h11 * y + h12;
    const w0 = h21 * y + 1.0;

    for (let x = 0; x < dstW; x++) {
      const w = h20 * x + w0;
      if (Math.abs(w) < 1e-9) continue;
      const invW = 1.0 / w;
      const sx = (h00 * x + u0) * invW;
      const sy = (h10 * x + v0) * invW;

      const dstIdx = dstRowOffset + (x * 4);

      if (sx >= 0 && sx < srcW - 1 && sy >= 0 && sy < srcH - 1) {
        const x0 = sx | 0;
        const y0 = sy | 0;
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const wx = sx - x0;
        const wy = sy - y0;

        const w00 = (1 - wx) * (1 - wy);
        const w10 = wx * (1 - wy);
        const w01 = (1 - wx) * wy;
        const w11 = wx * wy;

        const idx00 = (y0 * srcW + x0) * 4;
        const idx10 = (y0 * srcW + x1) * 4;
        const idx01 = (y1 * srcW + x0) * 4;
        const idx11 = (y1 * srcW + x1) * 4;

        dstData[dstIdx] = (w00 * srcData[idx00] + w10 * srcData[idx10] + w01 * srcData[idx01] + w11 * srcData[idx11]) | 0;
        dstData[dstIdx + 1] = (w00 * srcData[idx00 + 1] + w10 * srcData[idx10 + 1] + w01 * srcData[idx01 + 1] + w11 * srcData[idx11 + 1]) | 0;
        dstData[dstIdx + 2] = (w00 * srcData[idx00 + 2] + w10 * srcData[idx10 + 2] + w01 * srcData[idx01 + 2] + w11 * srcData[idx11 + 2]) | 0;
        dstData[dstIdx + 3] = 255;
      } else {
        // Outside bounds: fill white
        dstData[dstIdx] = 255;
        dstData[dstIdx + 1] = 255;
        dstData[dstIdx + 2] = 255;
        dstData[dstIdx + 3] = 255;
      }
    }
  }

  dstCtx.putImageData(dstImgData, 0, 0);
  return dstCanvas;
}

/**
 * Optical Corner Anchor Locator:
 * Locates the 4 solid black alignment marks printed on the 4 corners of the sheet
 * with wide search margins, multi-scale dark blob detection & geometric auto-completion.
 */
function findCornerAnchors(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  expectedZones: RecognitionZone[]
): {
  foundCount: number;
  srcQuad: [Point2D, Point2D, Point2D, Point2D];
  dstQuad: [Point2D, Point2D, Point2D, Point2D];
} {
  // 1. Determine canonical Destination Anchor Coordinates from template
  const defaultDstTL = { x: width * 0.0375, y: height * 0.026 };
  const defaultDstTR = { x: width * 0.9625, y: height * 0.026 };
  const defaultDstBL = { x: width * 0.0375, y: height * 0.976 };
  const defaultDstBR = { x: width * 0.9625, y: height * 0.976 };

  const ancTL = expectedZones.find(z => z.type === 'anchor_mark' && (z.id?.includes('tl') || z.id === 'anchor_tl' || z.x < 0.2 && z.y < 0.2));
  const ancTR = expectedZones.find(z => z.type === 'anchor_mark' && (z.id?.includes('tr') || z.id === 'anchor_tr' || z.x > 0.8 && z.y < 0.2));
  const ancBL = expectedZones.find(z => z.type === 'anchor_mark' && (z.id?.includes('bl') || z.id === 'anchor_bl' || z.x < 0.2 && z.y > 0.8));
  const ancBR = expectedZones.find(z => z.type === 'anchor_mark' && (z.id?.includes('br') || z.id === 'anchor_br' || z.x > 0.8 && z.y > 0.8));

  const dstQuad: [Point2D, Point2D, Point2D, Point2D] = [
    ancTL ? { x: (ancTL.x + ancTL.width / 2) * width, y: (ancTL.y + ancTL.height / 2) * height } : defaultDstTL,
    ancTR ? { x: (ancTR.x + ancTR.width / 2) * width, y: (ancTR.y + ancTR.height / 2) * height } : defaultDstTR,
    ancBR ? { x: (ancBR.x + ancBR.width / 2) * width, y: (ancBR.y + ancBR.height / 2) * height } : defaultDstBR,
    ancBL ? { x: (ancBL.x + ancBL.width / 2) * width, y: (ancBL.y + ancBL.height / 2) * height } : defaultDstBL
  ];

  try {
    // 2. Search strictly within the outer corner margins (top/bottom 12%, left/right 14%)
    const marginX = Math.round(width * 0.14);
    const marginY = Math.round(height * 0.12);

    const quadrants = [
      { key: 'tl' as const, xMin: 0, xMax: marginX, yMin: 0, yMax: marginY, def: dstQuad[0], prefX: 0, prefY: 0 },
      { key: 'tr' as const, xMin: width - marginX, xMax: width, yMin: 0, yMax: marginY, def: dstQuad[1], prefX: width, prefY: 0 },
      { key: 'br' as const, xMin: width - marginX, xMax: width, yMin: height - marginY, yMax: height, def: dstQuad[2], prefX: width, prefY: height },
      { key: 'bl' as const, xMin: 0, xMax: marginX, yMin: height - marginY, yMax: height, def: dstQuad[3], prefX: 0, prefY: height }
    ];

    const detectedPoints: (Point2D | null)[] = [null, null, null, null];
    let foundCount = 0;

    const markerW = Math.max(16, Math.round(width * 0.026));
    const markerH = Math.max(12, Math.round(height * 0.016));

    quadrants.forEach((q, qIdx) => {
      const searchW = q.xMax - q.xMin;
      const searchH = q.yMax - q.yMin;
      if (searchW <= markerW || searchH <= markerH) return;

      const imgData = ctx.getImageData(q.xMin, q.yMin, searchW, searchH);
      const data = imgData.data;

      let bestScore = -1;
      let bestX = q.def.x;
      let bestY = q.def.y;

      const step = 3;
      for (let y = 4; y < searchH - markerH - 4; y += step) {
        for (let x = 4; x < searchW - markerW - 4; x += step) {
          let darkCount = 0;
          let sampleTotal = 0;

          for (let dy = 0; dy < markerH; dy += 2) {
            for (let dx = 0; dx < markerW; dx += 2) {
              const idx = ((y + dy) * searchW + (x + dx)) * 4;
              const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              sampleTotal++;
              if (lum < 85) darkCount++;
            }
          }

          const darkRatio = sampleTotal > 0 ? darkCount / sampleTotal : 0;
          if (darkRatio >= 0.55) {
            const absX = q.xMin + x + markerW / 2;
            const absY = q.yMin + y + markerH / 2;

            const distCorner = Math.hypot(absX - q.prefX, absY - q.prefY);
            const cornerProximity = Math.max(0.2, 1.0 - (distCorner / (width * 0.3)));
            const score = darkRatio * 1.5 + cornerProximity * 0.8;

            if (score > bestScore) {
              bestScore = score;
              bestX = absX;
              bestY = absY;
            }
          }
        }
      }

      if (bestScore > 1.1) {
        detectedPoints[qIdx] = { x: Math.round(bestX), y: Math.round(bestY) };
        foundCount++;
      }
    });

    // 3. Geometric Completion for Missing Anchors if exactly 3 were found
    if (foundCount === 3) {
      if (!detectedPoints[0] && detectedPoints[1] && detectedPoints[2] && detectedPoints[3]) {
        detectedPoints[0] = {
          x: detectedPoints[1].x + detectedPoints[3].x - detectedPoints[2].x,
          y: detectedPoints[1].y + detectedPoints[3].y - detectedPoints[2].y
        };
        foundCount = 4;
      } else if (!detectedPoints[1] && detectedPoints[0] && detectedPoints[2] && detectedPoints[3]) {
        detectedPoints[1] = {
          x: detectedPoints[0].x + detectedPoints[2].x - detectedPoints[3].x,
          y: detectedPoints[0].y + detectedPoints[2].y - detectedPoints[3].y
        };
        foundCount = 4;
      } else if (!detectedPoints[2] && detectedPoints[0] && detectedPoints[1] && detectedPoints[3]) {
        detectedPoints[2] = {
          x: detectedPoints[1].x + detectedPoints[3].x - detectedPoints[0].x,
          y: detectedPoints[1].y + detectedPoints[3].y - detectedPoints[0].y
        };
        foundCount = 4;
      } else if (!detectedPoints[3] && detectedPoints[0] && detectedPoints[1] && detectedPoints[2]) {
        detectedPoints[3] = {
          x: detectedPoints[0].x + detectedPoints[2].x - detectedPoints[1].x,
          y: detectedPoints[0].y + detectedPoints[2].y - detectedPoints[1].y
        };
        foundCount = 4;
      }
    }

    const srcQuad: [Point2D, Point2D, Point2D, Point2D] = [
      detectedPoints[0] || dstQuad[0],
      detectedPoints[1] || dstQuad[1],
      detectedPoints[2] || dstQuad[2],
      detectedPoints[3] || dstQuad[3]
    ];

    // Validate geometry: check if aspect ratio is roughly consistent
    if (foundCount === 4) {
      const topW = Math.hypot(srcQuad[1].x - srcQuad[0].x, srcQuad[1].y - srcQuad[0].y);
      const botW = Math.hypot(srcQuad[2].x - srcQuad[3].x, srcQuad[2].y - srcQuad[3].y);
      const leftH = Math.hypot(srcQuad[3].x - srcQuad[0].x, srcQuad[3].y - srcQuad[0].y);
      const rightH = Math.hypot(srcQuad[2].x - srcQuad[1].x, srcQuad[2].y - srcQuad[1].y);

      const wRatio = Math.abs(topW - botW) / Math.max(topW, botW);
      const hRatio = Math.abs(leftH - rightH) / Math.max(leftH, rightH);

      // If distortion is too extreme (> 22%), anchors are likely false positives
      if (wRatio > 0.22 || hRatio > 0.22) {
        return { foundCount: 0, srcQuad: dstQuad, dstQuad };
      }
    }

    return { foundCount, srcQuad, dstQuad };
  } catch {
    return {
      foundCount: 0,
      srcQuad: dstQuad,
      dstQuad
    };
  }
}

/**
 * Perspective Warping & Standardized Canvas Generation:
 * Automatically rotates and perspective-warps input scans/photos
 * onto a canonical coordinate frame (1600 x 2260) using 4 corner alignment anchors.
 */
export function createStandardizedCanvas(
  img: HTMLImageElement,
  templateZones: RecognitionZone[] = [],
  targetWidth = 1600,
  targetHeight = 2260
): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  quality: ImageQualityMetrics;
} {
  // Step 1: Initial Draw & Orientation Normalization
  let initialW = img.width || 1200;
  let initialH = img.height || 1700;

  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = initialW;
  rawCanvas.height = initialH;
  const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true })!;
  rawCtx.fillStyle = '#FFFFFF';
  rawCtx.fillRect(0, 0, initialW, initialH);
  rawCtx.drawImage(img, 0, 0, initialW, initialH);

  let workingCanvas = rawCanvas;
  let workingCtx = rawCtx;
  let rotationDetectedDeg = 0;

  // If image is landscape (width > height * 1.15), rotate 90° clockwise to portrait
  if (initialW > initialH * 1.15) {
    rotationDetectedDeg = 90;
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = initialH;
    rotCanvas.height = initialW;
    const rotCtx = rotCanvas.getContext('2d', { willReadFrequently: true })!;
    rotCtx.translate(initialH, 0);
    rotCtx.rotate((90 * Math.PI) / 180);
    rotCtx.drawImage(rawCanvas, 0, 0);
    workingCanvas = rotCanvas;
    workingCtx = rotCtx;
    initialW = rotCanvas.width;
    initialH = rotCanvas.height;
  }

  // Step 2: Quality Assessment
  const rawQuality = assessImageQuality(workingCtx, initialW, initialH);

  // Step 3: Locate 4 Corner Anchors
  const { foundCount, srcQuad, dstQuad } = findCornerAnchors(workingCtx, initialW, initialH, templateZones);

  // Scale dstQuad to the final target resolution (1600 x 2260)
  const scaleX = targetWidth / initialW;
  const scaleY = targetHeight / initialH;
  const targetDstQuad: [Point2D, Point2D, Point2D, Point2D] = [
    { x: dstQuad[0].x * scaleX, y: dstQuad[0].y * scaleY },
    { x: dstQuad[1].x * scaleX, y: dstQuad[1].y * scaleY },
    { x: dstQuad[2].x * scaleX, y: dstQuad[2].y * scaleY },
    { x: dstQuad[3].x * scaleX, y: dstQuad[3].y * scaleY }
  ];

  // Calculate skew/offset from source to destination
  const offsetTL = Math.hypot(srcQuad[0].x * scaleX - targetDstQuad[0].x, srcQuad[0].y * scaleY - targetDstQuad[0].y);
  const offsetTR = Math.hypot(srcQuad[1].x * scaleX - targetDstQuad[1].x, srcQuad[1].y * scaleY - targetDstQuad[1].y);
  const offsetBR = Math.hypot(srcQuad[2].x * scaleX - targetDstQuad[2].x, srcQuad[2].y * scaleY - targetDstQuad[2].y);
  const offsetBL = Math.hypot(srcQuad[3].x * scaleX - targetDstQuad[3].x, srcQuad[3].y * scaleY - targetDstQuad[3].y);
  const totalOffset = offsetTL + offsetTR + offsetBR + offsetBL;

  let canvas: HTMLCanvasElement;
  let isPerspectiveCorrected = false;

  // Step 4: Apply High-Precision Perspective Warp
  if (foundCount >= 3 && totalOffset > 8) {
    canvas = warpPerspectiveBilinear(
      workingCtx,
      initialW,
      initialH,
      targetWidth,
      targetHeight,
      srcQuad,
      targetDstQuad
    );
    isPerspectiveCorrected = true;
  } else {
    canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(workingCanvas, 0, 0, targetWidth, targetHeight);
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const quality: ImageQualityMetrics = {
    blurScore: rawQuality.blurScore,
    isSharp: rawQuality.isSharp,
    brightnessScore: rawQuality.brightnessScore,
    isWellLit: rawQuality.isWellLit,
    anchorsDetectedCount: foundCount,
    rotationDetectedDeg,
    isPerspectiveCorrected
  };

  return { canvas, ctx, quality };
}

/**
 * High-Accuracy OMR Bubble Fill Analyzer:
 * - Samples extended neighborhood around the bubble center (3.0x radius)
 * - Measures local paper background from surrounding annulus (1.20r - 1.55r)
 * - Filters out printed letter strokes (A, B, C, D) inside empty circles
 * - Detects Graphite Specular Glare (ánh sáng làm bóng lóa vết chì) and recovers true fill
 * - Computes multi-signal composite score:
 *   1. Solid Dark Area Ratio (excluding thin printed font lines)
 *   2. Center Core Density (pencil lead concentration)
 *   3. Differential Intensity Drop relative to local paper
 *   4. Specular Roughness / Graphite Texture / Quadrant Coverage
 */
export function analyzeBubbleFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): BubbleAnalysisResult {
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.max(36, Math.round(w));
  cropCanvas.height = Math.max(36, Math.round(h));
  const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true })!;

  try {
    const rawCenterX = x + w / 2;
    const rawCenterY = y + h / 2;
    const baseRadius = Math.min(w, h) / 2;

    // Draw close-up crop for UI inspection
    const cropX = Math.max(0, Math.min(ctx.canvas.width - w, Math.round(x)));
    const cropY = Math.max(0, Math.min(ctx.canvas.height - h, Math.round(y)));
    const cropW = Math.max(4, Math.min(ctx.canvas.width - cropX, Math.round(w)));
    const cropH = Math.max(4, Math.min(ctx.canvas.height - cropY, Math.round(h)));
    const imgCropData = ctx.getImageData(cropX, cropY, cropW, cropH);
    cropCtx.putImageData(imgCropData, 0, 0);

    // Extract patch (3.4 * radius) to cover bubble + surrounding paper ring
    const patchRadius = Math.round(baseRadius * 1.7);
    const patchSize = patchRadius * 2;
    const patchStartX = Math.max(0, Math.min(ctx.canvas.width - patchSize, Math.round(rawCenterX - patchRadius)));
    const patchStartY = Math.max(0, Math.min(ctx.canvas.height - patchSize, Math.round(rawCenterY - patchRadius)));
    const patchW = Math.min(patchSize, ctx.canvas.width - patchStartX);
    const patchH = Math.min(patchSize, ctx.canvas.height - patchStartY);

    const patchData = ctx.getImageData(patchStartX, patchStartY, patchW, patchH).data;

    // Precalculate luminance grid for the patch
    const lumGrid = new Float32Array(patchW * patchH);
    for (let py = 0; py < patchH; py++) {
      for (let px = 0; px < patchW; px++) {
        const idx = (py * patchW + px) * 4;
        lumGrid[py * patchW + px] = 0.299 * patchData[idx] + 0.587 * patchData[idx + 1] + 0.114 * patchData[idx + 2];
      }
    }

    const localCenterX = rawCenterX - patchStartX;
    const localCenterY = rawCenterY - patchStartY;

    // 1. Calculate local paper background from surrounding annulus (1.30r to 1.65r)
    const bgInnerRadiusSq = (baseRadius * 1.30) * (baseRadius * 1.30);
    const bgOuterRadiusSq = (baseRadius * 1.65) * (baseRadius * 1.65);

    let bgLumSum = 0;
    let bgCount = 0;

    for (let py = 0; py < patchH; py++) {
      for (let px = 0; px < patchW; px++) {
        const dx = px - localCenterX;
        const dy = py - localCenterY;
        const distSq = dx * dx + dy * dy;

        if (distSq >= bgInnerRadiusSq && distSq <= bgOuterRadiusSq) {
          const lum = lumGrid[py * patchW + px];
          // Discard unusually dark pixels outside (e.g. text from neighboring labels)
          if (lum >= 140) {
            bgLumSum += lum;
            bgCount++;
          }
        }
      }
    }

    const localPaperLum = bgCount > 0 ? (bgLumSum / bgCount) : 240;

    // 2. Safe inner disc radius: 0.65 * baseRadius strictly avoids outer printed circular border line
    const innerRadius = baseRadius * 0.65;
    const innerRadiusSq = innerRadius * innerRadius;
    const coreRadius = innerRadius * 0.45;
    const coreRadiusSq = coreRadius * coreRadius;

    // Relative thresholds to local paper brightness
    const faintDelta = Math.max(14, localPaperLum * 0.07);
    const mediumDelta = Math.max(28, localPaperLum * 0.14);
    const darkDelta = Math.max(55, localPaperLum * 0.28);

    const faintThreshold = Math.max(10, localPaperLum - faintDelta);
    const mediumThreshold = Math.max(8, localPaperLum - mediumDelta);
    const darkThreshold = Math.max(5, localPaperLum - darkDelta);

    // Micro-alignment: test small subpixel offset within +/- 1.5px only (never leaves inner disc)
    const testOffsets = [
      { ox: 0, oy: 0 },
      { ox: -1.5, oy: 0 },
      { ox: 1.5, oy: 0 },
      { ox: 0, oy: -1.5 },
      { ox: 0, oy: 1.5 }
    ];

    let bestFillScore = 0;
    let bestCoreFill = 0;
    let bestContrast = 0;

    for (const offset of testOffsets) {
      const cx = localCenterX + offset.ox;
      const cy = localCenterY + offset.oy;

      let innerTotal = 0;
      let faintCount = 0;
      let mediumCount = 0;
      let darkCount = 0;
      let innerLumSum = 0;

      // 4 Quadrants to verify spatial coverage across the whole circle
      const qTotal = [0, 0, 0, 0];
      const qFaint = [0, 0, 0, 0];
      const qMedium = [0, 0, 0, 0];

      let coreTotal = 0;
      let coreFaint = 0;
      let coreMedium = 0;

      for (let py = 0; py < patchH; py++) {
        for (let px = 0; px < patchW; px++) {
          const dx = px - cx;
          const dy = py - cy;
          const distSq = dx * dx + dy * dy;

          if (distSq <= innerRadiusSq) {
            const lum = lumGrid[py * patchW + px];
            innerTotal++;
            innerLumSum += lum;

            // Determine quadrant (0: TR, 1: TL, 2: BL, 3: BR)
            const qIdx = dx >= 0 ? (dy < 0 ? 0 : 3) : (dy < 0 ? 1 : 2);
            qTotal[qIdx]++;

            if (lum < faintThreshold) {
              faintCount++;
              qFaint[qIdx]++;
            }
            if (lum < mediumThreshold) {
              mediumCount++;
              qMedium[qIdx]++;
            }
            if (lum < darkThreshold) {
              darkCount++;
            }

            if (distSq <= coreRadiusSq) {
              coreTotal++;
              if (lum < faintThreshold) coreFaint++;
              if (lum < mediumThreshold) coreMedium++;
            }
          }
        }
      }

      if (innerTotal === 0) continue;

      const faintRatio = faintCount / innerTotal;
      const mediumRatio = mediumCount / innerTotal;
      const darkRatio = darkCount / innerTotal;
      const meanLum = innerLumSum / innerTotal;
      const meanDropFraction = Math.max(0, (localPaperLum - meanLum) / Math.max(1, localPaperLum));

      const qFaintRatios = qTotal.map((t, idx) => t > 0 ? (qFaint[idx] / t) : 0);
      const minQuadFaint = Math.min(...qFaintRatios);
      const activeQuads = qFaintRatios.filter(r => r >= 0.25).length;

      const coreFaintRatio = coreTotal > 0 ? (coreFaint / coreTotal) : 0;

      let fillScore = 0;

      // CASE 1: Empty bubble containing ONLY thin printed font letters (A, B, C, D) or digits (0-9)
      // Letter strokes occupy <= 14% pixels, leaving at least 2 quadrants empty.
      if (faintRatio < 0.16 || (faintRatio < 0.22 && minQuadFaint < 0.08 && activeQuads <= 2)) {
        fillScore = Math.max(0, faintRatio * 0.35); // Low density: 0.00 - 0.08
      }
      // CASE 2: Solid Dark Shading (Tô kín và đậm)
      else if (darkRatio >= 0.32 || (mediumRatio >= 0.45 && minQuadFaint >= 0.35)) {
        fillScore = 1.0; // 100% density: Đáp án học sinh chọn
      }
      // CASE 3: Fully Shaded Circle, even if faint/light pencil (Tô kín ô nhưng hơi mờ)
      // Shading covers across all 4 quadrants (minQuadFaint >= 0.25, faintRatio >= 0.50, core covered)
      else if (faintRatio >= 0.50 && minQuadFaint >= 0.25 && activeQuads >= 3) {
        fillScore = 1.0; // 100% density: Đáp án học sinh chọn (tô kín ô dù hơi mờ)
      }
      // CASE 4: Partially Shaded Bubble (Tô nhưng không kín ô)
      // Shading does not cover the full circle -> density is proportional to actual coverage
      else {
        const partialScore = faintRatio * 0.55 + (activeQuads / 4) * 0.20 + coreFaintRatio * 0.15;
        fillScore = Math.min(0.55, Math.max(0.12, partialScore)); // Proportional density (< 60%)
      }

      if (fillScore > bestFillScore) {
        bestFillScore = fillScore;
        bestCoreFill = coreFaintRatio;
        bestContrast = meanDropFraction;
      }
    }

    return {
      fillRatio: Number(Math.min(1.0, Math.max(0.0, bestFillScore)).toFixed(4)),
      coreFillRatio: Number(Math.min(1.0, Math.max(0.0, bestCoreFill)).toFixed(4)),
      contrastScore: Number(Math.min(1.0, Math.max(0.0, bestContrast)).toFixed(4)),
      localBgLum: Math.round(localPaperLum),
      cropDataUrl: cropCanvas.toDataURL('image/jpeg', 0.88)
    };
  } catch {
    return {
      fillRatio: 0,
      coreFillRatio: 0,
      contrastScore: 0,
      localBgLum: 240,
      cropDataUrl: ''
    };
  }
}

/**
 * Extracts a high-resolution rectangular crop as a Base64 data URL
 */
function cropRegionAsDataUrl(
  ctx: CanvasRenderingContext2D,
  normX: number,
  normY: number,
  normW: number,
  normH: number,
  paddingPercent = 0.015
): string {
  try {
    const padX = normW * paddingPercent;
    const padY = normH * paddingPercent;

    const x = Math.max(0, (normX - padX) * ctx.canvas.width);
    const y = Math.max(0, (normY - padY) * ctx.canvas.height);
    const w = Math.min(ctx.canvas.width - x, (normW + padX * 2) * ctx.canvas.width);
    const h = Math.min(ctx.canvas.height - y, (normH + padY * 2) * ctx.canvas.height);

    if (w <= 0 || h <= 0) return '';

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.round(w);
    cropCanvas.height = Math.round(h);
    const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true })!;

    cropCtx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);
    return cropCanvas.toDataURL('image/jpeg', 0.90);
  } catch {
    return '';
  }
}

/**
 * Decodes QR Code from Canvas if present on the sheet
 */
function tryReadQrCode(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { studentId?: string; studentName?: string; examCode?: string; className?: string; templateId?: string } | null {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const code = jsQR(imgData.data, width, height, {
      inversionAttempts: 'dontInvert'
    });

    if (code && code.data) {
      try {
        const parsed = JSON.parse(code.data);
        return {
          studentId: parsed.sId || parsed.studentId,
          studentName: parsed.sName || parsed.name,
          examCode: parsed.eCode || parsed.examCode || parsed.code,
          className: parsed.cls || parsed.className,
          templateId: parsed.tId || parsed.templateId
        };
      } catch {
        if (code.data.trim()) {
          return { studentId: code.data.trim() };
        }
      }
    }
  } catch (err) {
    console.warn('QR decode check skipped/failed:', err);
  }
  return null;
}

/**
 * Main High-Precision OMR Recognition & Scoring Engine
 * 
 * Accurately identifies:
 * 1. 4 Corner Optical Anchors & automatically perspective-warps the sheet
 * 2. Student ID (Số Báo Danh) via digit column analysis & QR ground truth
 * 3. Exam Code (Mã Đề Thi) with automatic variant key routing
 * 4. Question Options (A, B, C, D) via differential contrast & center-core fill analysis
 */
export async function processAnswerSheet(
  imageUrl: string,
  template: AnswerSheetTemplate,
  exam: Exam,
  students: Student[],
  options: OMRProcessingOptions = {}
): Promise<ExamSubmission> {
  const fillThreshold = options.fillThreshold ?? template.fillThreshold ?? 0.20;
  const uncertainThreshold = options.uncertainThreshold ?? template.uncertainThreshold ?? 0.14;
  const minMargin = options.minMargin ?? 0.09;

  // 1. Standardize Canvas & Rectify 4 Corner Anchors via Perspective Warping
  const img = await loadImage(imageUrl);
  const { canvas, ctx, quality } = createStandardizedCanvas(img, template.zones, 1600, 2260);

  // Use the rectified canvas data URL for crystal-clear visual inspection overlays
  const rectifiedImageUrl = canvas.toDataURL('image/jpeg', 0.90);

  // 2. Check for QR Code Ground Truth
  const qrData = tryReadQrCode(ctx, canvas.width, canvas.height);

  // Group recognition zones
  const bubbleZones = template.zones.filter(z => z.type === 'bubble' && z.questionNumber !== undefined && z.option);
  const studentIdZones = template.zones.filter(z => z.type === 'student_id_bubble');
  const examCodeZones = template.zones.filter(z => z.type === 'exam_code_bubble');

  // ==========================================
  // 3. RECOGNIZE STUDENT ID / SBD (Số Báo Danh)
  // ==========================================
  let detectedStudentId = '';
  let studentIdConfidence = 95;
  let studentIdStatus: ExamSubmission['studentIdStatus'] = 'VALID';
  let studentIdCropUrl = '';

  if (studentIdZones.length > 0) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    const sbdColumns: Record<number, { digit: number; fill: number; coreFill: number; zone: RecognitionZone }[]> = {};

    for (const z of studentIdZones) {
      minX = Math.min(minX, z.x);
      minY = Math.min(minY, z.y);
      maxX = Math.max(maxX, z.x + z.width);
      maxY = Math.max(maxY, z.y + z.height);

      if (z.digitPosition !== undefined && z.digitValue !== undefined) {
        if (!sbdColumns[z.digitPosition]) sbdColumns[z.digitPosition] = [];
        const pxX = Math.round(z.x * canvas.width);
        const pxY = Math.round(z.y * canvas.height);
        const pxW = Math.round(z.width * canvas.width);
        const pxH = Math.round(z.height * canvas.height);

        const { fillRatio, coreFillRatio } = analyzeBubbleFill(ctx, pxX, pxY, pxW, pxH);
        sbdColumns[z.digitPosition].push({
          digit: z.digitValue,
          fill: fillRatio,
          coreFill: coreFillRatio,
          zone: z
        });
      }
    }

    studentIdCropUrl = cropRegionAsDataUrl(ctx, minX, minY, maxX - minX, maxY - minY, 0.08);

    const sortedSbdCols = Object.keys(sbdColumns).map(Number).sort((a, b) => a - b);
    let sbdConfAcc = 0;
    let sbdHasMultiple = false;
    let sbdHasBlank = false;
    let sbdHasUncertain = false;

    for (const colIdx of sortedSbdCols) {
      const col = sbdColumns[colIdx];
      col.sort((a, b) => b.fill - a.fill);
      const top = col[0];
      const second = col[1];

      // Digits with fill density >= 60% (0.60) considered selected by user specification
      const filledDigits = col.filter(item => item.fill >= 0.60);

      if (filledDigits.length === 1) {
        // Exactly 1 digit with fill >= 60%
        detectedStudentId += filledDigits[0].digit.toString();
        sbdConfAcc += Math.min(99, Math.round(88 + filledDigits[0].fill * 11));
      } else if (filledDigits.length > 1) {
        // Multiple digits filled >= 60%
        sbdHasMultiple = true;
        detectedStudentId += '?';
        sbdConfAcc += 50;
      } else {
        // No digit reached 60%: Check if top has clear standout or is genuinely blank
        if (top && top.fill >= 0.48 && (top.fill - (second?.fill || 0)) >= 0.22) {
          detectedStudentId += top.digit.toString();
          sbdConfAcc += Math.round(75 + top.fill * 20);
        } else {
          sbdHasBlank = true;
          detectedStudentId += '_';
          sbdConfAcc += 95;
        }
      }
    }

    studentIdConfidence = sortedSbdCols.length > 0 ? Math.round(sbdConfAcc / sortedSbdCols.length) : 50;

    if (sbdHasMultiple) {
      studentIdStatus = 'MULTIPLE';
    } else if (sbdHasBlank) {
      studentIdStatus = 'BLANK';
    } else if (sbdHasUncertain) {
      studentIdStatus = 'UNCERTAIN';
    } else {
      studentIdStatus = 'VALID';
    }
  }

  // If QR code ground truth exists, reinforce SBD
  if (qrData?.studentId) {
    if (!detectedStudentId || detectedStudentId.includes('_') || detectedStudentId.includes('?')) {
      detectedStudentId = qrData.studentId;
      studentIdStatus = 'VALID';
      studentIdConfidence = 100;
    }
  }

  // Look up student in roster
  let matchedStudent = students.find(s => s.studentId === detectedStudentId);
  if (!matchedStudent && detectedStudentId) {
    const numOnlyDetected = detectedStudentId.replace(/\D/g, '');
    if (numOnlyDetected) {
      matchedStudent = students.find(s => {
        const sNum = s.studentId.replace(/\D/g, '');
        return sNum === numOnlyDetected || sNum.padStart(6, '0') === numOnlyDetected.padStart(6, '0');
      });
    }
  }

  // ==========================================
  // 4. RECOGNIZE TEST CODE / MÃ ĐỀ THI
  // ==========================================
  let detectedExamCode = '';
  let examCodeConfidence = 95;
  let examCodeStatus: ExamSubmission['examCodeStatus'] = 'VALID';
  let examCodeCropUrl = '';

  if (examCodeZones.length > 0) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    const codeColumns: Record<number, { digit: number; fill: number; coreFill: number; zone: RecognitionZone }[]> = {};

    for (const z of examCodeZones) {
      minX = Math.min(minX, z.x);
      minY = Math.min(minY, z.y);
      maxX = Math.max(maxX, z.x + z.width);
      maxY = Math.max(maxY, z.y + z.height);

      if (z.digitPosition !== undefined && z.digitValue !== undefined) {
        if (!codeColumns[z.digitPosition]) codeColumns[z.digitPosition] = [];
        const pxX = Math.round(z.x * canvas.width);
        const pxY = Math.round(z.y * canvas.height);
        const pxW = Math.round(z.width * canvas.width);
        const pxH = Math.round(z.height * canvas.height);

        const { fillRatio, coreFillRatio } = analyzeBubbleFill(ctx, pxX, pxY, pxW, pxH);
        codeColumns[z.digitPosition].push({
          digit: z.digitValue,
          fill: fillRatio,
          coreFill: coreFillRatio,
          zone: z
        });
      }
    }

    examCodeCropUrl = cropRegionAsDataUrl(ctx, minX, minY, maxX - minX, maxY - minY, 0.08);

    const sortedCodeCols = Object.keys(codeColumns).map(Number).sort((a, b) => a - b);
    let codeConfAcc = 0;
    let codeHasMultiple = false;
    let codeHasBlank = false;
    let codeHasUncertain = false;

    for (const colIdx of sortedCodeCols) {
      const col = codeColumns[colIdx];
      col.sort((a, b) => b.fill - a.fill);
      const top = col[0];
      const second = col[1];

      // Digits with fill density >= 60% (0.60) considered selected by user specification
      const filledDigits = col.filter(item => item.fill >= 0.60);

      if (filledDigits.length === 1) {
        // Exactly 1 digit with fill >= 60%
        detectedExamCode += filledDigits[0].digit.toString();
        codeConfAcc += Math.min(99, Math.round(88 + filledDigits[0].fill * 11));
      } else if (filledDigits.length > 1) {
        // Multiple digits filled >= 60%
        codeHasMultiple = true;
        detectedExamCode += '?';
        codeConfAcc += 50;
      } else {
        // No digit reached 60%: Check if top has clear standout or is genuinely blank
        if (top && top.fill >= 0.48 && (top.fill - (second?.fill || 0)) >= 0.22) {
          detectedExamCode += top.digit.toString();
          codeConfAcc += Math.round(75 + top.fill * 20);
        } else {
          codeHasBlank = true;
          detectedExamCode += '_';
          codeConfAcc += 95;
        }
      }
    }

    examCodeConfidence = sortedCodeCols.length > 0 ? Math.round(codeConfAcc / sortedCodeCols.length) : 50;

    if (codeHasMultiple) {
      examCodeStatus = 'MULTIPLE';
    } else if (codeHasBlank) {
      examCodeStatus = 'BLANK';
    } else if (codeHasUncertain) {
      examCodeStatus = 'UNCERTAIN';
    } else {
      examCodeStatus = 'VALID';
    }
  }

  // QR Code override for Exam Code if present
  if (qrData?.examCode) {
    if (!detectedExamCode || detectedExamCode.includes('_') || detectedExamCode.includes('?')) {
      detectedExamCode = qrData.examCode;
      examCodeStatus = 'VALID';
      examCodeConfidence = 100;
    }
  }

  // ==========================================
  // 5. MATCH EXAM VARIANT (MÃ ĐỀ) & ANSWER KEY
  // ==========================================
  let matchedVariant: ExamVariant | undefined;
  let appliedVariantCode = exam?.defaultVariantCode || exam?.code || '101';
  let variantMismatch = false;

  if (exam?.variants && exam.variants.length > 0) {
    const rawCode = (detectedExamCode || '').trim();
    if (rawCode && !rawCode.includes('_') && !rawCode.includes('?')) {
      const cleanDetected = rawCode.toLowerCase();
      const numOnlyDetected = cleanDetected.replace(/\D/g, '');

      matchedVariant = exam.variants.find(v => {
        const cleanV = v.code.trim().toLowerCase();
        const numOnlyV = cleanV.replace(/\D/g, '');

        return (
          cleanV === cleanDetected ||
          (numOnlyDetected !== '' && numOnlyV === numOnlyDetected) ||
          cleanV.includes(cleanDetected) ||
          cleanDetected.includes(cleanV)
        );
      });

      if (matchedVariant) {
        appliedVariantCode = matchedVariant.code;
        examCodeStatus = 'VALID';
      } else {
        variantMismatch = true;
        examCodeStatus = 'MISMATCH';
        matchedVariant = exam.variants[0];
        appliedVariantCode = exam.variants[0].code;
      }
    } else {
      matchedVariant = exam.variants[0];
      appliedVariantCode = exam.variants[0].code;
      if (rawCode) {
        variantMismatch = true;
      }
    }
  }

  // ==========================================
  // 6. RECOGNIZE QUESTION MULTIPLE-CHOICE BUBBLES
  // ==========================================
  const questionResultsMap: Record<number, {
    options: Record<BubbleOption, { fillRatio: number; coreFillRatio: number; cropUrl: string }>;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }> = {};

  for (const zone of bubbleZones) {
    const qNum = zone.questionNumber!;
    const opt = zone.option as BubbleOption;

    if (!questionResultsMap[qNum]) {
      questionResultsMap[qNum] = {
        options: {} as Record<BubbleOption, { fillRatio: number; coreFillRatio: number; cropUrl: string }>,
        minX: zone.x,
        minY: zone.y,
        maxX: zone.x + zone.width,
        maxY: zone.y + zone.height
      };
    } else {
      questionResultsMap[qNum].minX = Math.min(questionResultsMap[qNum].minX, zone.x);
      questionResultsMap[qNum].minY = Math.min(questionResultsMap[qNum].minY, zone.y);
      questionResultsMap[qNum].maxX = Math.max(questionResultsMap[qNum].maxX, zone.x + zone.width);
      questionResultsMap[qNum].maxY = Math.max(questionResultsMap[qNum].maxY, zone.y + zone.height);
    }

    const pxX = Math.round(zone.x * canvas.width);
    const pxY = Math.round(zone.y * canvas.height);
    const pxW = Math.round(zone.width * canvas.width);
    const pxH = Math.round(zone.height * canvas.height);

    const { fillRatio, coreFillRatio, cropDataUrl } = analyzeBubbleFill(ctx, pxX, pxY, pxW, pxH);
    questionResultsMap[qNum].options[opt] = {
      fillRatio,
      coreFillRatio,
      cropUrl: cropDataUrl
    };
  }

  const examId = exam?.id || 'exam_default';
  const examMaxScore = exam?.maxScore ?? 10;
  const examNumQuestions = exam?.numQuestions || template.numQuestions || 40;

  // Use the exact answer key matching the applied variant
  const examQuestions: QuestionConfig[] = matchedVariant && matchedVariant.questions && matchedVariant.questions.length > 0
    ? matchedVariant.questions
    : exam?.questions && exam.questions.length > 0
    ? exam.questions
    : Array.from({ length: examNumQuestions }, (_, idx) => ({
        questionNumber: idx + 1,
        correctAnswer: (['A', 'B', 'C', 'D'][idx % 4]) as BubbleOption,
        points: examMaxScore / examNumQuestions
      }));

  const recognizedAnswers: RecognizedAnswer[] = [];
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalBlank = 0;
  let totalMultiple = 0;
  let totalUncertain = 0;
  let totalPointsEarned = 0;
  let totalPointsPossible = 0;
  let confidenceSum = 0;

  // Process Each Question with high accuracy
  for (const qConfig of examQuestions) {
    const qNum = qConfig.questionNumber;
    const qData = questionResultsMap[qNum];
    const qPoints = qConfig.points || (examMaxScore / examNumQuestions);
    totalPointsPossible += qPoints;

    const fillMap: Record<string, number> = {};
    let rowCropUrl = '';

    if (qData) {
      const qW = qData.maxX - qData.minX;
      const qH = qData.maxY - qData.minY;
      rowCropUrl = cropRegionAsDataUrl(ctx, qData.minX, qData.minY, qW, qH, 0.15);

      const entries = Object.entries(qData.options) as [BubbleOption, { fillRatio: number; coreFillRatio: number; cropUrl: string }][];
      
      const sortedByFillAsc = [...entries].sort((a, b) => a[1].fillRatio - b[1].fillRatio);
      const unselectedOptions = sortedByFillAsc.slice(0, Math.max(1, sortedByFillAsc.length - 1));
      const rowBaseline = unselectedOptions.reduce((sum, item) => sum + item[1].fillRatio, 0) / Math.max(1, unselectedOptions.length);

      entries.sort((a, b) => b[1].fillRatio - a[1].fillRatio);

      for (const [opt, res] of entries) {
        fillMap[opt] = Number(res.fillRatio.toFixed(3));
      }

      const topOpt = entries[0];
      const secondOpt = entries[1];

      const topFill = topOpt ? topOpt[1].fillRatio : 0;
      const secondFill = secondOpt ? secondOpt[1].fillRatio : 0;

      // Options with fill density >= 60% (0.60) considered selected by user specification
      const filledOptions = entries.filter(e => e[1].fillRatio >= 0.60);

      let selectedOption: BubbleOption | null = null;
      let selectedOptions: BubbleOption[] = [];
      let status: RecognizedAnswer['status'] = 'BLANK';
      let confidence = 95;

      if (filledOptions.length > 1) {
        // RULE 1: MULTIPLE OPTIONS FILLED (>= 60% on 2 or more options)
        status = 'MULTIPLE';
        selectedOption = null;
        selectedOptions = filledOptions.map(f => f[0]);
        confidence = 60;
        totalMultiple++;
      } else if (filledOptions.length === 1) {
        // RULE 2: SINGLE VALID SELECTION (Exactly 1 option >= 60%)
        selectedOption = filledOptions[0][0];
        selectedOptions = [selectedOption];
        confidence = Math.min(99, Math.round(85 + filledOptions[0][1].fillRatio * 14));
        status = (selectedOption === qConfig.correctAnswer) ? 'CORRECT' : 'WRONG';
      } else {
        // RULE 3: No option >= 60% -> Check for borderline single mark vs pure BLANK
        if (topOpt && topFill >= 0.48 && (topFill - secondFill) >= 0.22) {
          selectedOption = topOpt[0];
          selectedOptions = [selectedOption];
          confidence = Math.round(75 + topFill * 20);
          status = (selectedOption === qConfig.correctAnswer) ? 'CORRECT' : 'WRONG';
        } else {
          // Genuinely BLANK
          selectedOption = null;
          selectedOptions = [];
          status = 'BLANK';
          confidence = 98;
          totalBlank++;
        }
      }

      // If status is MULTIPLE or BLANK, it can NEVER be correct or awarded points!
      const isCorrect = (status === 'CORRECT') && (!!selectedOption && selectedOption === qConfig.correctAnswer);
      const points = isCorrect ? qPoints : 0;

      if (isCorrect) {
        totalCorrect++;
        totalPointsEarned += points;
      } else if (status === 'WRONG') {
        totalWrong++;
      }

      confidenceSum += confidence;

      recognizedAnswers.push({
        questionNumber: qNum,
        selectedOption,
        selectedOptions: selectedOption ? [selectedOption] : [],
        fillRatios: fillMap,
        confidence,
        isCorrect,
        status,
        correctAnswer: qConfig.correctAnswer,
        pointsEarned: points,
        maxPoints: qPoints,
        cropImageUrl: rowCropUrl || topOpt?.[1]?.cropUrl || '',
        originalOmrAnswer: selectedOption
      });
    } else {
      recognizedAnswers.push({
        questionNumber: qNum,
        selectedOption: null,
        fillRatios: {},
        confidence: 0,
        isCorrect: false,
        status: 'BLANK',
        correctAnswer: qConfig.correctAnswer,
        pointsEarned: 0,
        maxPoints: qPoints,
        originalOmrAnswer: null
      });
      totalBlank++;
    }
  }

  // Calculate final score with decimal precision
  const rawScore = totalPointsPossible > 0 ? (totalPointsEarned / totalPointsPossible) * examMaxScore : 0;
  const multiplier = Math.pow(10, exam?.decimalPrecision ?? 2);
  const finalScore = Math.round(rawScore * multiplier) / multiplier;

  const avgConfidence = examQuestions.length > 0 ? Math.round(confidenceSum / examQuestions.length) : 0;

  // ==========================================
  // 7. DETERMINE OVERALL SUBMISSION STATUS
  // ==========================================
  let overallStatus: ExamSubmission['status'] = 'GRADED';
  let reviewReason = '';

  if (variantMismatch) {
    overallStatus = 'NEEDS_REVIEW';
    reviewReason = `Mã đề nhận diện "${detectedExamCode || 'Trống'}" không khớp danh sách mã đề của kỳ thi (${exam?.variants?.map(v => v.code).join(', ')})`;
  } else if (totalMultiple > 0) {
    overallStatus = 'NEEDS_REVIEW';
    reviewReason = `${totalMultiple} câu tô nhiều đáp án`;
  } else if (totalUncertain > 0) {
    overallStatus = 'NEEDS_REVIEW';
    reviewReason = `${totalUncertain} câu tô mờ/nghi ngờ`;
  } else if (!matchedStudent && detectedStudentId && !detectedStudentId.includes('_')) {
    overallStatus = 'STUDENT_NOT_FOUND';
    reviewReason = `SBD "${detectedStudentId}" chưa có trong danh sách thí sinh`;
  } else if (!detectedStudentId || detectedStudentId.includes('_')) {
    overallStatus = 'NEEDS_REVIEW';
    reviewReason = 'Chưa tô đủ hoặc chưa nhận diện được Số báo danh';
  } else if (avgConfidence < 75) {
    overallStatus = 'LOW_CONFIDENCE';
    reviewReason = 'Độ tin cậy nhận diện OMR thấp';
  }

  const submissionId = 'sub_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

  return {
    id: submissionId,
    examId: examId,
    studentId: matchedStudent?.studentId || (detectedStudentId && !detectedStudentId.includes('_') ? detectedStudentId : 'UNKNOWN'),
    studentName: matchedStudent?.name || (detectedStudentId ? `Học sinh SBD: ${detectedStudentId}` : 'Học sinh chưa xác định'),
    className: matchedStudent?.className || exam?.className || '12A1',
    detectedExamCode: detectedExamCode || undefined,
    appliedVariantCode: appliedVariantCode,
    matchedVariantTitle: matchedVariant ? (matchedVariant.title || `Mã đề ${matchedVariant.code}`) : `Mã đề ${appliedVariantCode}`,
    studentIdConfidence,
    examCodeConfidence,
    studentIdCropUrl,
    examCodeCropUrl,
    studentIdStatus,
    examCodeStatus,
    originalStudentId: detectedStudentId || undefined,
    originalExamCode: detectedExamCode || undefined,
    qualityMetrics: quality,
    scannedImageUrl: rectifiedImageUrl || imageUrl,
    scanDate: new Date().toISOString(),
    status: overallStatus,
    totalScore: finalScore,
    maxScore: examMaxScore,
    totalCorrect,
    totalWrong,
    totalBlank,
    totalMultiple,
    totalUncertain,
    overallConfidence: avgConfidence,
    recognizedAnswers,
    auditLogs: [],
    needsReviewReason: reviewReason
  };
}
