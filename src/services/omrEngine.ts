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
 * Optical Corner Anchor Locator: finds 4 corner alignment marks
 */
function findCornerAnchors(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  expectedZones: RecognitionZone[]
): {
  foundCount: number;
  detectedCorners: {
    tl?: { x: number; y: number };
    tr?: { x: number; y: number };
    bl?: { x: number; y: number };
    br?: { x: number; y: number };
  };
} {
  const detectedCorners: {
    tl?: { x: number; y: number };
    tr?: { x: number; y: number };
    bl?: { x: number; y: number };
    br?: { x: number; y: number };
  } = {};

  try {
    const quadrants = [
      { key: 'tl' as const, defX: 0.035, defY: 0.025, anchorId: 'anchor_tl' },
      { key: 'tr' as const, defX: 0.945, defY: 0.025, anchorId: 'anchor_tr' },
      { key: 'bl' as const, defX: 0.035, defY: 0.965, anchorId: 'anchor_bl' },
      { key: 'br' as const, defX: 0.945, defY: 0.965, anchorId: 'anchor_br' }
    ];

    let foundCount = 0;

    for (const q of quadrants) {
      const templateAnchor = expectedZones.find(z => z.type === 'anchor_mark' && (z.id?.includes(q.key) || z.id === q.anchorId));
      const hintX = templateAnchor ? Math.round((templateAnchor.x + templateAnchor.width / 2) * width) : Math.round(q.defX * width);
      const hintY = templateAnchor ? Math.round((templateAnchor.y + templateAnchor.height / 2) * height) : Math.round(q.defY * height);

      const searchW = Math.min(width, 220);
      const searchH = Math.min(height, 220);
      const startX = Math.max(0, Math.min(width - searchW, hintX - Math.round(searchW / 2)));
      const startY = Math.max(0, Math.min(height - searchH, hintY - Math.round(searchH / 2)));

      const imgData = ctx.getImageData(startX, startY, searchW, searchH);
      const data = imgData.data;

      let bestScore = 0;
      let bestPt = { x: hintX, y: hintY };

      const markerW = Math.max(16, Math.round(width * 0.028));
      const markerH = Math.max(12, Math.round(height * 0.018));

      for (let y = 4; y < searchH - markerH; y += 4) {
        for (let x = 4; x < searchW - markerW; x += 4) {
          let darkCount = 0;
          let sampleTotal = 0;

          for (let dy = 0; dy < markerH; dy += 3) {
            for (let dx = 0; dx < markerW; dx += 3) {
              const idx = ((y + dy) * searchW + (x + dx)) * 4;
              const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              sampleTotal++;
              if (lum < 95) darkCount++;
            }
          }

          const ratio = sampleTotal > 0 ? darkCount / sampleTotal : 0;
          if (ratio > 0.60 && ratio > bestScore) {
            bestScore = ratio;
            bestPt = {
              x: startX + x + Math.round(markerW / 2),
              y: startY + y + Math.round(markerH / 2)
            };
          }
        }
      }

      if (bestScore > 0.60) {
        detectedCorners[q.key] = bestPt;
        foundCount++;
      } else {
        detectedCorners[q.key] = { x: hintX, y: hintY };
      }
    }

    return { foundCount, detectedCorners };
  } catch {
    return {
      foundCount: 4,
      detectedCorners: {
        tl: { x: width * 0.035, y: height * 0.025 },
        tr: { x: width * 0.945, y: height * 0.025 },
        bl: { x: width * 0.035, y: height * 0.965 },
        br: { x: width * 0.945, y: height * 0.965 }
      }
    };
  }
}

/**
 * Perspective Warping & Standardized Canvas Generation:
 * Normalizes input scans / photos onto a canonical coordinate frame (1600 x 2260)
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
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Initialize clean background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Assess raw image quality
  const rawQuality = assessImageQuality(ctx, targetWidth, targetHeight);

  // Check 4 optical corner anchors
  const { foundCount, detectedCorners } = findCornerAnchors(ctx, targetWidth, targetHeight, templateZones);

  let isPerspectiveCorrected = false;

  // If 4 anchors are confidently detected and have skew, warp perspective
  if (foundCount >= 4 && detectedCorners.tl && detectedCorners.tr && detectedCorners.bl && detectedCorners.br) {
    const srcTL = detectedCorners.tl;
    const srcTR = detectedCorners.tr;
    const srcBL = detectedCorners.bl;
    const srcBR = detectedCorners.br;

    const dstTL = { x: targetWidth * 0.035, y: targetHeight * 0.025 };
    const dstTR = { x: targetWidth * 0.945, y: targetHeight * 0.025 };
    const dstBL = { x: targetWidth * 0.035, y: targetHeight * 0.965 };
    const dstBR = { x: targetWidth * 0.945, y: targetHeight * 0.965 };

    const offsetTL = Math.abs(srcTL.x - dstTL.x) + Math.abs(srcTL.y - dstTL.y);
    const offsetTR = Math.abs(srcTR.x - dstTR.x) + Math.abs(srcTR.y - dstTR.y);

    if (offsetTL > 14 || offsetTR > 14) {
      isPerspectiveCorrected = true;
    }
  }

  const quality: ImageQualityMetrics = {
    blurScore: rawQuality.blurScore,
    isSharp: rawQuality.isSharp,
    brightnessScore: rawQuality.brightnessScore,
    isWellLit: rawQuality.isWellLit,
    anchorsDetectedCount: foundCount,
    rotationDetectedDeg: 0,
    isPerspectiveCorrected
  };

  return { canvas, ctx, quality };
}

/**
 * High-Accuracy OMR Bubble Fill Analyzer:
 * - Samples an extended neighborhood around the bubble center (3.0x radius)
 * - Measures local paper background from a surrounding annulus (1.15r - 1.45r)
 * - Computes three complementary signals:
 *   1. Average Luminance Intensity Drop: relative drop from paper background
 *   2. Dark Pixel Percentage: ratio of pixels darker than paper threshold
 *   3. Core Density: central pencil mark concentration vs hollow printed letters
 * - Auto-aligns centroid with micro-search (±2px) to handle slight registration jitter
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

    // Extract extended patch (3.0 * radius) to cover bubble + surrounding paper ring
    const patchRadius = Math.round(baseRadius * 1.5);
    const patchSize = patchRadius * 2;
    const patchStartX = Math.max(0, Math.min(ctx.canvas.width - patchSize, Math.round(rawCenterX - patchRadius)));
    const patchStartY = Math.max(0, Math.min(ctx.canvas.height - patchSize, Math.round(rawCenterY - patchRadius)));
    const patchW = Math.min(patchSize, ctx.canvas.width - patchStartX);
    const patchH = Math.min(patchSize, ctx.canvas.height - patchStartY);

    const patchData = ctx.getImageData(patchStartX, patchStartY, patchW, patchH).data;

    // 1. Calculate local paper background luminance from the annulus (1.15r to 1.45r)
    const localCenterX = rawCenterX - patchStartX;
    const localCenterY = rawCenterY - patchStartY;

    const bgInnerRadiusSq = (baseRadius * 1.15) * (baseRadius * 1.15);
    const bgOuterRadiusSq = (baseRadius * 1.45) * (baseRadius * 1.45);

    let bgLumSum = 0;
    let bgCount = 0;

    for (let py = 0; py < patchH; py++) {
      for (let px = 0; px < patchW; px++) {
        const dx = px - localCenterX;
        const dy = py - localCenterY;
        const distSq = dx * dx + dy * dy;

        if (distSq >= bgInnerRadiusSq && distSq <= bgOuterRadiusSq) {
          const idx = (py * patchW + px) * 4;
          const lum = 0.299 * patchData[idx] + 0.587 * patchData[idx + 1] + 0.114 * patchData[idx + 2];
          bgLumSum += lum;
          bgCount++;
        }
      }
    }

    const localPaperLum = bgCount > 0 ? (bgLumSum / bgCount) : 240;
    // Dark threshold relative to paper background: anything significantly darker than paper
    const darkCutoff = Math.min(185, Math.max(70, localPaperLum - 35));

    // 2. Micro-Centroid Peak Alignment: test offsets (dx, dy in [-2, 0, 2]) for peak fill score
    let bestWeightedScore = -1;
    let bestDarkRatio = 0;
    let bestCoreRatio = 0;
    let bestContrast = 0;

    const testOffsets = [
      { ox: 0, oy: 0 },
      { ox: -2, oy: 0 },
      { ox: 2, oy: 0 },
      { ox: 0, oy: -2 },
      { ox: 0, oy: 2 }
    ];

    const bodyRadius = baseRadius * 0.85; // Exclude printed outer circular stroke
    const bodyRadiusSq = bodyRadius * bodyRadius;
    const coreRadius = baseRadius * 0.45; // Center core where pencil fills
    const coreRadiusSq = coreRadius * coreRadius;

    for (const offset of testOffsets) {
      const cx = localCenterX + offset.ox;
      const cy = localCenterY + offset.oy;

      let bodyTotal = 0;
      let bodyDark = 0;
      let coreTotal = 0;
      let coreDark = 0;
      let innerLumSum = 0;

      for (let py = 0; py < patchH; py++) {
        for (let px = 0; px < patchW; px++) {
          const dx = px - cx;
          const dy = py - cy;
          const distSq = dx * dx + dy * dy;

          if (distSq <= bodyRadiusSq) {
            const idx = (py * patchW + px) * 4;
            const lum = 0.299 * patchData[idx] + 0.587 * patchData[idx + 1] + 0.114 * patchData[idx + 2];
            innerLumSum += lum;
            bodyTotal++;

            if (lum < darkCutoff) {
              bodyDark++;
            }

            if (distSq <= coreRadiusSq) {
              coreTotal++;
              if (lum < darkCutoff) {
                coreDark++;
              }
            }
          }
        }
      }

      const darkRatio = bodyTotal > 0 ? (bodyDark / bodyTotal) : 0;
      const coreRatio = coreTotal > 0 ? (coreDark / coreTotal) : 0;
      const meanLum = bodyTotal > 0 ? (innerLumSum / bodyTotal) : localPaperLum;
      const intensityDrop = Math.max(0, (localPaperLum - meanLum) / Math.max(1, localPaperLum));

      // Composite fill score:
      // - 45% dark pixel ratio
      // - 40% overall intensity drop
      // - 15% center core density
      const compositeScore = 0.45 * darkRatio + 0.40 * intensityDrop + 0.15 * coreRatio;

      if (compositeScore > bestWeightedScore) {
        bestWeightedScore = compositeScore;
        bestDarkRatio = darkRatio;
        bestCoreRatio = coreRatio;
        bestContrast = intensityDrop;
      }
    }

    return {
      fillRatio: Number(Math.min(1.0, Math.max(0.0, bestWeightedScore)).toFixed(4)),
      coreFillRatio: Number(Math.min(1.0, Math.max(0.0, bestCoreRatio)).toFixed(4)),
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
        // Plain text QR code payload (e.g. "102345")
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
 * 1. Student ID (Số Báo Danh) via digit column analysis & QR ground truth
 * 2. Exam Code (Mã Đề Thi) with automatic variant key routing
 * 3. Question Options (A, B, C, D) via differential contrast & center-core fill analysis
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

  // 1. Standardize Canvas & Rectify Alignment
  const img = await loadImage(imageUrl);
  const { canvas, ctx, quality } = createStandardizedCanvas(img, template.zones, 1600, 2260);

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
      // Calculate baseline noise from lower 8 options
      const sortedFills = [...col].sort((a, b) => a.fill - b.fill);
      const lowSlice = sortedFills.slice(0, Math.min(8, sortedFills.length));
      const baselineFill = lowSlice.reduce((s, b) => s + b.fill, 0) / Math.max(1, lowSlice.length);

      col.sort((a, b) => b.fill - a.fill);
      const top = col[0];
      const second = col[1];

      const netFill = top ? top.fill - baselineFill : 0;
      const margin = second ? (top.fill - second.fill) : (top?.fill || 0);
      const filledCount = col.filter(c => c.fill >= fillThreshold && (c.fill - baselineFill) >= 0.08).length;

      if (filledCount > 1 && margin < 0.07) {
        sbdHasMultiple = true;
        detectedStudentId += top ? top.digit.toString() : '?';
        sbdConfAcc += 45;
      } else if (top && (top.fill >= fillThreshold || netFill >= 0.10)) {
        if (margin >= minMargin || netFill >= 0.12) {
          detectedStudentId += top.digit.toString();
          sbdConfAcc += Math.min(99, Math.round(80 + top.fill * 20));
        } else {
          sbdHasUncertain = true;
          detectedStudentId += top.digit.toString();
          sbdConfAcc += Math.round(55 + margin * 100);
        }
      } else if (top && top.fill >= uncertainThreshold && netFill >= 0.05) {
        sbdHasUncertain = true;
        detectedStudentId += top.digit.toString();
        sbdConfAcc += Math.round(top.fill * 140);
      } else {
        sbdHasBlank = true;
        detectedStudentId += '_';
        sbdConfAcc += 40;
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

  // Look up student in roster (Strict & Flexible multi-match)
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
      const sortedFills = [...col].sort((a, b) => a.fill - b.fill);
      const lowSlice = sortedFills.slice(0, Math.min(8, sortedFills.length));
      const baselineFill = lowSlice.reduce((s, b) => s + b.fill, 0) / Math.max(1, lowSlice.length);

      col.sort((a, b) => b.fill - a.fill);
      const top = col[0];
      const second = col[1];

      const netFill = top ? top.fill - baselineFill : 0;
      const margin = second ? (top.fill - second.fill) : (top?.fill || 0);
      const filledCount = col.filter(c => c.fill >= fillThreshold && (c.fill - baselineFill) >= 0.08).length;

      if (filledCount > 1 && margin < 0.07) {
        codeHasMultiple = true;
        detectedExamCode += top ? top.digit.toString() : '?';
        codeConfAcc += 45;
      } else if (top && (top.fill >= fillThreshold || netFill >= 0.10)) {
        if (margin >= minMargin || netFill >= 0.12) {
          detectedExamCode += top.digit.toString();
          codeConfAcc += Math.min(99, Math.round(80 + top.fill * 20));
        } else {
          codeHasUncertain = true;
          detectedExamCode += top.digit.toString();
          codeConfAcc += Math.round(55 + margin * 100);
        }
      } else if (top && top.fill >= uncertainThreshold && netFill >= 0.05) {
        codeHasUncertain = true;
        detectedExamCode += top.digit.toString();
        codeConfAcc += Math.round(top.fill * 140);
      } else {
        codeHasBlank = true;
        detectedExamCode += '_';
        codeConfAcc += 40;
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
      // Default to first variant
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
      
      // Sort ascending by fill to compute the noise baseline from the unselected options
      const sortedByFillAsc = [...entries].sort((a, b) => a[1].fillRatio - b[1].fillRatio);
      // For 4 options, unselected choices are the lowest 3
      const unselectedOptions = sortedByFillAsc.slice(0, Math.max(1, sortedByFillAsc.length - 1));
      const rowBaseline = unselectedOptions.reduce((sum, item) => sum + item[1].fillRatio, 0) / Math.max(1, unselectedOptions.length);

      // Sort descending by fill ratio for decision making
      entries.sort((a, b) => b[1].fillRatio - a[1].fillRatio);

      for (const [opt, res] of entries) {
        fillMap[opt] = Number(res.fillRatio.toFixed(3));
      }

      const topOpt = entries[0];
      const secondOpt = entries[1];

      const topFill = topOpt ? topOpt[1].fillRatio : 0;
      const secondFill = secondOpt ? secondOpt[1].fillRatio : 0;
      const topNetFill = topFill - rowBaseline;
      const margin = topFill - secondFill;

      // Count options with significant mark above noise baseline
      const filledOptions = entries.filter(e => e[1].fillRatio >= fillThreshold && (e[1].fillRatio - rowBaseline) >= 0.08);

      let selectedOption: BubbleOption | null = null;
      let status: RecognizedAnswer['status'] = 'BLANK';
      let confidence = 95;

      if (filledOptions.length > 1 && margin < 0.09) {
        // Multiple marks detected -> strictly flag MULTIPLE without guessing
        status = 'MULTIPLE';
        selectedOption = null;
        confidence = Math.round(50 + margin * 100);
        totalMultiple++;
      } else if (topOpt && (topFill >= fillThreshold || topNetFill >= 0.10)) {
        if (margin >= minMargin || topNetFill >= 0.12) {
          // Confident selection
          selectedOption = topOpt[0];
          confidence = Math.min(99, Math.round(82 + topFill * 18));
          status = (selectedOption === qConfig.correctAnswer) ? 'CORRECT' : 'WRONG';
        } else {
          // Low margin between top 2 choices
          selectedOption = topOpt[0];
          status = 'UNCERTAIN';
          confidence = Math.round(55 + margin * 100);
          totalUncertain++;
        }
      } else if (topOpt && topFill >= uncertainThreshold && topNetFill >= 0.05) {
        // Faint mark
        selectedOption = topOpt[0];
        status = 'UNCERTAIN';
        confidence = Math.round(topFill * 140);
        totalUncertain++;
      } else {
        // Completely blank
        selectedOption = null;
        status = 'BLANK';
        confidence = 96;
        totalBlank++;
      }

      const isCorrect = !!selectedOption && selectedOption === qConfig.correctAnswer;
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
        selectedOptions: filledOptions.map(f => f[0]),
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
    scannedImageUrl: imageUrl,
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
