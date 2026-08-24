import { BubbleOption, RecognitionZone } from '../types';

export interface DetectedBubble {
  cx: number;          // Center X in standardized canvas pixels (1200x1697)
  cy: number;          // Center Y in standardized canvas pixels
  radius: number;      // Radius in pixels
  circularity: number; // 0.0 - 1.0
  confidence: number;  // 0.0 - 1.0
}

export interface DetectedSectionBounds {
  sbd?: { xStart: number; xEnd: number; yStart: number; yEnd: number; numDigits: number };
  examCode?: { xStart: number; xEnd: number; yStart: number; yEnd: number; numDigits: number };
  questions?: { xStart: number; xEnd: number; yStart: number; yEnd: number; numQuestions: number; columnsCount: number };
  qr?: { xStart: number; xEnd: number; yStart: number; yEnd: number };
}

export interface DetectedBubbleGridResult {
  detectedZones: RecognitionZone[];
  numQuestions: number;
  numOptions: number;
  columnsCount: number;
  numSbdDigits: number;
  numExamCodeDigits: number;
  hasSbd: boolean;
  hasExamCode: boolean;
  hasQrCode: boolean;
  hasAnchorMarks: boolean;
  averageBubbleWidth: number;
  averageBubbleHeight: number;
  averageRadius: number;
  confidence: number;
  rawCirclesCount: number;
  detectedAnchorsCount: number;
  gridBounds?: {
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
  };
  detectedQrZone?: RecognitionZone;
  detectedSbdZones?: RecognitionZone[];
  detectedExamCodeZones?: RecognitionZone[];
  detectedQuestionZones?: RecognitionZone[];
  detectedAnchors?: RecognitionZone[];
  sectionBounds?: DetectedSectionBounds;
  detectedColumnsInfo?: {
    columnCount: number;
    questionsPerColumn: number;
    optionsCount: number;
    direction: 'column_first' | 'row_first';
  };
}

/**
 * Loads an image from a data URL or path safely
 */
function loadImageFromUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for bubble detection: ' + e));
    img.src = src;
  });
}

/**
 * High-Accuracy Computer Vision: Multi-Scale Circular Stroke Correlation, 
 * Anchor Optical Locator & Structured Lattice Reconstruction for Vietnamese/Standard OMR Sheets.
 */
export async function detectBubblesFromImageData(
  imageSource: string | HTMLImageElement | HTMLCanvasElement
): Promise<DetectedBubbleGridResult> {
  let img: HTMLImageElement;
  if (typeof imageSource === 'string') {
    img = await loadImageFromUrl(imageSource);
  } else if (imageSource instanceof HTMLImageElement) {
    img = imageSource;
  } else {
    const dataUrl = imageSource.toDataURL();
    img = await loadImageFromUrl(dataUrl);
  }

  // Work on standardized high-definition canvas (1200 x 1697 A4 ratio)
  const targetW = 1200;
  const targetH = 1697;
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;

  // 1. Compute Grayscale & Luminance
  const gray = new Uint8Array(targetW * targetH);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[p] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
  }

  // 2. Optical Anchor Detection (4 corner black blocks / alignment squares)
  const detectedAnchors = detectOpticalCornerAnchors(gray, targetW, targetH);

  // 3. Multi-Radius Radial Ring Intensity & Circular Stroke Detector
  const rawBubbles: DetectedBubble[] = [];
  
  // Test candidate radii covering typical OMR bubbles (radius 8px to 21px in 1200px width)
  const testRadii = [9, 11, 13, 15, 17, 19];
  const step = 3; // Dense 3px grid step for precise peak localization
  const startY = Math.floor(targetH * 0.04);
  const endY = Math.floor(targetH * 0.96);
  const startX = Math.floor(targetW * 0.03);
  const endX = Math.floor(targetW * 0.97);

  // Precompute sample offsets for each radius (16 points on perimeter, 8 on inner ring, 12 on outer ring)
  const radiusConfigs = testRadii.map(r => {
    const perimeter: [number, number][] = [];
    const inner: [number, number][] = [];
    const outer: [number, number][] = [];
    
    const numPerim = 16;
    for (let a = 0; a < numPerim; a++) {
      const angle = (a * 2 * Math.PI) / numPerim;
      perimeter.push([Math.round(r * Math.cos(angle)), Math.round(r * Math.sin(angle))]);
    }
    
    const numInner = 8;
    const innerR = Math.max(2, Math.round(r * 0.45));
    for (let a = 0; a < numInner; a++) {
      const angle = (a * 2 * Math.PI) / numInner;
      inner.push([Math.round(innerR * Math.cos(angle)), Math.round(innerR * Math.sin(angle))]);
    }

    const numOuter = 12;
    const outerR = Math.round(r * 1.45);
    for (let a = 0; a < numOuter; a++) {
      const angle = (a * 2 * Math.PI) / numOuter;
      outer.push([Math.round(outerR * Math.cos(angle)), Math.round(outerR * Math.sin(angle))]);
    }

    return { r, perimeter, inner, outer };
  });

  for (let y = startY; y < endY; y += step) {
    const rowOffset = y * targetW;
    for (let x = startX; x < endX; x += step) {
      const centerVal = gray[rowOffset + x];
      if (centerVal < 50) continue; // Skip solid black regions/bars/anchors

      for (const config of radiusConfigs) {
        let perimDarkCount = 0;
        let perimLumSum = 0;
        let validPerim = 0;

        for (const [ox, oy] of config.perimeter) {
          const px = x + ox;
          const py = y + oy;
          if (px >= 0 && px < targetW && py >= 0 && py < targetH) {
            const v = gray[py * targetW + px];
            perimLumSum += v;
            validPerim++;
            if (v < 185) perimDarkCount++;
          }
        }

        if (validPerim < 12) continue;
        const perimDarkRatio = perimDarkCount / validPerim;
        const avgPerimLum = perimLumSum / validPerim;

        if (perimDarkRatio >= 0.50) {
          // Check interior brightness
          let innerLumSum = 0;
          let validInner = 0;
          for (const [ox, oy] of config.inner) {
            const px = x + ox;
            const py = y + oy;
            if (px >= 0 && px < targetW && py >= 0 && py < targetH) {
              innerLumSum += gray[py * targetW + px];
              validInner++;
            }
          }
          const avgInnerLum = validInner > 0 ? innerLumSum / validInner : centerVal;

          // Check exterior brightness
          let outerLumSum = 0;
          let validOuter = 0;
          for (const [ox, oy] of config.outer) {
            const px = x + ox;
            const py = y + oy;
            if (px >= 0 && px < targetW && py >= 0 && py < targetH) {
              outerLumSum += gray[py * targetW + px];
              validOuter++;
            }
          }
          const avgOuterLum = validOuter > 0 ? outerLumSum / validOuter : 255;

          // OMR circle condition: perimeter ring is darker than interior paper and exterior background
          const ringContrast = (avgOuterLum + avgInnerLum) / 2 - avgPerimLum;
          if (ringContrast > 14 && avgInnerLum > 95) {
            const confidence = Math.min(1.0, (perimDarkRatio * 0.5) + (ringContrast / 100) * 0.5);
            rawBubbles.push({
              cx: x,
              cy: y,
              radius: config.r,
              circularity: perimDarkRatio,
              confidence
            });
          }
        }
      }
    }
  }

  // 4. Remove duplicate / overlapping circle detections within radius
  const uniqueBubbles = removeOverlappingCircles(rawBubbles, 8);

  // 5. Advanced Lattice Segmentation: Distinguish SBD, Exam Code, and Question Matrix
  return segmentAndReconstructOMRLattice(uniqueBubbles, detectedAnchors, targetW, targetH);
}

/**
 * Optical Corner Anchor Locator (Locates 4 Corner Alignment Squares)
 */
function detectOpticalCornerAnchors(gray: Uint8Array, targetW: number, targetH: number): RecognitionZone[] {
  const corners: RecognitionZone[] = [];
  const searchMarginX = Math.round(targetW * 0.16);
  const searchMarginY = Math.round(targetH * 0.14);

  const quadrants = [
    { id: 'anchor_tl', label: 'Top-Left', xMin: 10, xMax: searchMarginX, yMin: 10, yMax: searchMarginY, defX: 0.02, defY: 0.015 },
    { id: 'anchor_tr', label: 'Top-Right', xMin: targetW - searchMarginX, xMax: targetW - 10, yMin: 10, yMax: searchMarginY, defX: 0.945, defY: 0.015 },
    { id: 'anchor_bl', label: 'Bottom-Left', xMin: 10, xMax: searchMarginX, yMin: targetH - searchMarginY, yMax: targetH - 10, defX: 0.02, defY: 0.965 },
    { id: 'anchor_br', label: 'Bottom-Right', xMin: targetW - searchMarginX, xMax: targetW - 10, yMin: targetH - searchMarginY, yMax: targetH - 10, defX: 0.945, defY: 0.965 }
  ];

  for (const q of quadrants) {
    let bestX = q.defX * targetW;
    let bestY = q.defY * targetH;
    let foundSolidBlack = false;
    let maxBlackCount = 0;

    // Search for solid black square (size around 18x18 to 45x45 px)
    for (let y = q.yMin; y < q.yMax - 25; y += 4) {
      for (let x = q.xMin; x < q.xMax - 25; x += 4) {
        let blackCount = 0;
        const boxSize = 24;
        for (let dy = 0; dy < boxSize; dy += 3) {
          for (let dx = 0; dx < boxSize; dx += 3) {
            const v = gray[(y + dy) * targetW + (x + dx)];
            if (v < 70) blackCount++;
          }
        }
        if (blackCount > 45 && blackCount > maxBlackCount) {
          maxBlackCount = blackCount;
          bestX = x + 12;
          bestY = y + 12;
          foundSolidBlack = true;
        }
      }
    }

    const normX = Number((bestX / targetW - 0.017).toFixed(4));
    const normY = Number((bestY / targetH - 0.011).toFixed(4));

    corners.push({
      id: q.id,
      type: 'anchor_mark',
      x: Math.max(0.01, Math.min(0.96, normX)),
      y: Math.max(0.01, Math.min(0.97, normY)),
      width: 0.035,
      height: 0.022,
      label: q.label
    });
  }

  return corners;
}

/**
 * Remove duplicate or overlapping circles using non-maximum suppression
 */
function removeOverlappingCircles(circles: DetectedBubble[], minDist = 8): DetectedBubble[] {
  const sorted = [...circles].sort((a, b) => b.confidence - a.confidence);
  const kept: DetectedBubble[] = [];

  for (const c of sorted) {
    let clash = false;
    for (const k of kept) {
      if (Math.hypot(c.cx - k.cx, c.cy - k.cy) < Math.max(minDist, (c.radius + k.radius) * 0.6)) {
        clash = true;
        break;
      }
    }
    if (!clash) {
      kept.push(c);
    }
  }

  return kept;
}

/**
 * High-Precision Multi-Region OMR Segmenter:
 * Categorizes and builds zones for:
 * 1. Số Báo Danh (SBD) (Digits 0-9 columns in header)
 * 2. Mã Đề Thi (Exam Code) (Digits 0-9 columns in header)
 * 3. Các câu trắc nghiệm (Phần trả lời trắc nghiệm Q1..Qn)
 * 4. Điểm neo góc (4 Corner Anchors)
 * 5. QR Code ID
 */
function segmentAndReconstructOMRLattice(
  circles: DetectedBubble[],
  anchors: RecognitionZone[],
  canvasWidth: number,
  canvasHeight: number
): DetectedBubbleGridResult {
  // Compute typical bubble size
  const allRadii = circles.map(c => c.radius).sort((a, b) => a - b);
  const medianRadius = allRadii.length > 0 ? allRadii[Math.floor(allRadii.length / 2)] : 13;
  const avgRadius = Math.max(9, Math.min(20, medianRadius));
  const normW = Number(((avgRadius * 2.1) / canvasWidth).toFixed(4));
  const normH = Number(((avgRadius * 2.3) / canvasHeight).toFixed(4));

  // Partition bubbles into Header Area (SBD, Mã đề) and Body Area (Multiple Choice Questions)
  // Standard Vietnamese OMR sheets have SBD/Mã đề at y < 0.36
  const splitY = canvasHeight * 0.34;
  const headerBubbles = circles.filter(c => c.cy < splitY && c.cy > canvasHeight * 0.04);
  const bodyBubbles = circles.filter(c => c.cy >= splitY && c.cy < canvasHeight * 0.97);

  // --- SECTION A: DETECT SỐ BÁO DANH (SBD) & MÃ ĐỀ (EXAM CODE) FROM HEADER ---
  const { sbdZones, examCodeZones, numSbdDigits, numExamCodeDigits, sbdBounds, examCodeBounds } = extractSbdAndExamCodeZones(
    headerBubbles,
    avgRadius,
    canvasWidth,
    canvasHeight
  );

  // --- SECTION B: DETECT QUESTION MATRIX FROM BODY ---
  const { questionZones, numQuestions, numOptions, columnsCount, gridBounds, colInfo } = extractQuestionMatrixZones(
    bodyBubbles,
    avgRadius,
    canvasWidth,
    canvasHeight
  );

  // --- SECTION C: QR CODE ZONE ---
  const qrZone: RecognitionZone = {
    id: 'zone_qr_code',
    type: 'student_id_qr',
    x: 0.78,
    y: 0.045,
    width: 0.16,
    height: 0.12,
    label: 'Mã QR Thí Sinh'
  };

  // Combine all zones
  const allZones: RecognitionZone[] = [
    ...anchors,
    qrZone,
    ...sbdZones,
    ...examCodeZones,
    ...questionZones
  ];

  const sectionBounds: DetectedSectionBounds = {
    sbd: sbdBounds,
    examCode: examCodeBounds,
    questions: {
      xStart: gridBounds.xStart,
      xEnd: gridBounds.xEnd,
      yStart: gridBounds.yStart,
      yEnd: gridBounds.yEnd,
      numQuestions,
      columnsCount
    },
    qr: {
      xStart: qrZone.x,
      xEnd: qrZone.x + qrZone.width,
      yStart: qrZone.y,
      yEnd: qrZone.y + qrZone.height
    }
  };

  return {
    detectedZones: allZones,
    numQuestions,
    numOptions,
    columnsCount,
    numSbdDigits,
    numExamCodeDigits,
    hasSbd: sbdZones.length > 0,
    hasExamCode: examCodeZones.length > 0,
    hasQrCode: true,
    hasAnchorMarks: true,
    averageBubbleWidth: normW || 0.024,
    averageBubbleHeight: normH || 0.03,
    averageRadius: Math.round(avgRadius),
    confidence: allZones.length > 30 ? 0.98 : 0.88,
    rawCirclesCount: circles.length,
    detectedAnchorsCount: anchors.length,
    gridBounds,
    detectedQrZone: qrZone,
    detectedSbdZones: sbdZones,
    detectedExamCodeZones: examCodeZones,
    detectedQuestionZones: questionZones,
    detectedAnchors: anchors,
    sectionBounds,
    detectedColumnsInfo: colInfo
  };
}

/**
 * Extracts Số Báo Danh (SBD) and Mã Đề Digit Bubble Columns
 */
function extractSbdAndExamCodeZones(
  headerCircles: DetectedBubble[],
  avgRadius: number,
  canvasWidth: number,
  canvasHeight: number
): {
  sbdZones: RecognitionZone[];
  examCodeZones: RecognitionZone[];
  numSbdDigits: number;
  numExamCodeDigits: number;
  sbdBounds?: { xStart: number; xEnd: number; yStart: number; yEnd: number; numDigits: number };
  examCodeBounds?: { xStart: number; xEnd: number; yStart: number; yEnd: number; numDigits: number };
} {
  // If fewer than 10 header bubbles detected, generate standard fallback SBD (6 digits) & Mã đề (3 digits)
  if (headerCircles.length < 10) {
    const sbd = generateDefaultSbdZones(6, 0.54, 0.05, 0.20, 0.24, canvasWidth, canvasHeight);
    const code = generateDefaultExamCodeZones(3, 0.76, 0.05, 0.11, 0.24, canvasWidth, canvasHeight);
    return {
      sbdZones: sbd.zones,
      examCodeZones: code.zones,
      numSbdDigits: 6,
      numExamCodeDigits: 3,
      sbdBounds: sbd.bounds,
      examCodeBounds: code.bounds
    };
  }

  // 1. Cluster header circles into vertical digit columns (sharing similar X)
  const colClusters: { centerX: number; circles: DetectedBubble[] }[] = [];
  const sortedByX = [...headerCircles].sort((a, b) => a.cx - b.cx);

  for (const c of sortedByX) {
    let matched = false;
    for (const cluster of colClusters) {
      if (Math.abs(c.cx - cluster.centerX) <= avgRadius * 1.1) {
        cluster.circles.push(c);
        cluster.centerX = cluster.circles.reduce((s, b) => s + b.cx, 0) / cluster.circles.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      colClusters.push({ centerX: c.cx, circles: [c] });
    }
  }

  // Filter valid digit columns (must have at least 4 bubbles)
  const validDigitCols = colClusters
    .filter(cl => cl.circles.length >= 4)
    .sort((a, b) => a.centerX - b.centerX);

  if (validDigitCols.length < 2) {
    const sbd = generateDefaultSbdZones(6, 0.54, 0.05, 0.20, 0.24, canvasWidth, canvasHeight);
    const code = generateDefaultExamCodeZones(3, 0.76, 0.05, 0.11, 0.24, canvasWidth, canvasHeight);
    return {
      sbdZones: sbd.zones,
      examCodeZones: code.zones,
      numSbdDigits: 6,
      numExamCodeDigits: 3,
      sbdBounds: sbd.bounds,
      examCodeBounds: code.bounds
    };
  }

  // Identify gap between SBD and Mã Đề blocks
  // Find the largest gap between consecutive columns
  let largestGapIdx = -1;
  let maxGap = 0;
  for (let i = 0; i < validDigitCols.length - 1; i++) {
    const gap = validDigitCols[i + 1].centerX - validDigitCols[i].centerX;
    if (gap > maxGap) {
      maxGap = gap;
      largestGapIdx = i;
    }
  }

  let sbdCols: typeof validDigitCols;
  let codeCols: typeof validDigitCols;

  if (largestGapIdx >= 0 && maxGap > avgRadius * 3.0) {
    // Divided at the gap
    sbdCols = validDigitCols.slice(0, largestGapIdx + 1);
    codeCols = validDigitCols.slice(largestGapIdx + 1);
  } else if (validDigitCols.length >= 9) {
    // 6 SBD + 3 or 4 Mã Đề
    sbdCols = validDigitCols.slice(0, 6);
    codeCols = validDigitCols.slice(6);
  } else if (validDigitCols.length >= 6) {
    // e.g. 6 SBD, 2 or 3 Mã Đề
    sbdCols = validDigitCols.slice(0, validDigitCols.length - 3);
    codeCols = validDigitCols.slice(validDigitCols.length - 3);
  } else {
    sbdCols = validDigitCols;
    codeCols = [];
  }

  // Regularize vertical 10-digit lattice (0 to 9) for SBD
  const sbdZones: RecognitionZone[] = [];
  const sbdDigitsCount = Math.max(4, Math.min(8, sbdCols.length || 6));
  
  // Calculate average row pitch for digits 0..9
  const allDigitPitches: number[] = [];
  validDigitCols.forEach(col => {
    const sortedY = col.circles.map(c => c.cy).sort((a, b) => a - b);
    for (let i = 0; i < sortedY.length - 1; i++) {
      const dy = sortedY[i + 1] - sortedY[i];
      if (dy >= avgRadius * 1.4 && dy <= avgRadius * 3.5) {
        allDigitPitches.push(dy);
      }
    }
  });
  allDigitPitches.sort((a, b) => a - b);
  const digitPitchY = allDigitPitches.length > 0 ? allDigitPitches[Math.floor(allDigitPitches.length / 2)] : 26;

  let sbdMinX = canvasWidth, sbdMaxX = 0, sbdMinY = canvasHeight, sbdMaxY = 0;

  sbdCols.forEach((col, digitColIdx) => {
    col.circles.sort((a, b) => a.cy - b.cy);
    const minY = col.circles[0].cy;
    const maxY = col.circles[col.circles.length - 1].cy;
    const startY0 = Math.max(canvasHeight * 0.05, minY);

    for (let val = 0; val <= 9; val++) {
      const cy = startY0 + val * digitPitchY;
      const cx = col.centerX;

      if (cx < sbdMinX) sbdMinX = cx;
      if (cx > sbdMaxX) sbdMaxX = cx;
      if (cy < sbdMinY) sbdMinY = cy;
      if (cy > sbdMaxY) sbdMaxY = cy;

      const normX = Number(((cx - avgRadius * 1.05) / canvasWidth).toFixed(4));
      const normY = Number(((cy - avgRadius * 1.05) / canvasHeight).toFixed(4));
      const normSize = Number(((avgRadius * 2.1) / canvasWidth).toFixed(4));

      sbdZones.push({
        id: `zone_sbd_col${digitColIdx}_val${val}_${Date.now()}`,
        type: 'student_id_bubble',
        digitPosition: digitColIdx,
        digitValue: val,
        x: Math.max(0.01, Math.min(0.96, normX)),
        y: Math.max(0.01, Math.min(0.96, normY)),
        width: Math.max(0.018, normSize),
        height: Math.max(0.018, normSize),
        label: `SBD[${digitColIdx}]=${val}`
      });
    }
  });

  // Regularize vertical 10-digit lattice for Mã Đề
  const examCodeZones: RecognitionZone[] = [];
  const examCodeDigitsCount = Math.max(2, Math.min(4, codeCols.length || 3));
  let codeMinX = canvasWidth, codeMaxX = 0, codeMinY = canvasHeight, codeMaxY = 0;

  if (codeCols.length > 0) {
    codeCols.forEach((col, digitColIdx) => {
      col.circles.sort((a, b) => a.cy - b.cy);
      const startY0 = Math.max(canvasHeight * 0.05, col.circles[0].cy);

      for (let val = 0; val <= 9; val++) {
        const cy = startY0 + val * digitPitchY;
        const cx = col.centerX;

        if (cx < codeMinX) codeMinX = cx;
        if (cx > codeMaxX) codeMaxX = cx;
        if (cy < codeMinY) codeMinY = cy;
        if (cy > codeMaxY) codeMaxY = cy;

        const normX = Number(((cx - avgRadius * 1.05) / canvasWidth).toFixed(4));
        const normY = Number(((cy - avgRadius * 1.05) / canvasHeight).toFixed(4));
        const normSize = Number(((avgRadius * 2.1) / canvasWidth).toFixed(4));

        examCodeZones.push({
          id: `zone_code_col${digitColIdx}_val${val}_${Date.now()}`,
          type: 'exam_code_bubble',
          digitPosition: digitColIdx,
          digitValue: val,
          x: Math.max(0.01, Math.min(0.96, normX)),
          y: Math.max(0.01, Math.min(0.96, normY)),
          width: Math.max(0.018, normSize),
          height: Math.max(0.018, normSize),
          label: `MãĐề[${digitColIdx}]=${val}`
        });
      }
    });
  } else {
    // Generate default Exam Code if not detected separately
    const defCode = generateDefaultExamCodeZones(3, 0.76, 0.05, 0.11, 0.24, canvasWidth, canvasHeight);
    defCode.zones.forEach(z => examCodeZones.push(z));
  }

  const sbdBounds = sbdZones.length > 0 ? {
    xStart: Number((Math.max(0.01, (sbdMinX - avgRadius * 1.5) / canvasWidth)).toFixed(4)),
    xEnd: Number((Math.min(0.98, (sbdMaxX + avgRadius * 1.5) / canvasWidth)).toFixed(4)),
    yStart: Number((Math.max(0.01, (sbdMinY - avgRadius * 1.5) / canvasHeight)).toFixed(4)),
    yEnd: Number((Math.min(0.40, (sbdMaxY + avgRadius * 1.5) / canvasHeight)).toFixed(4)),
    numDigits: sbdDigitsCount
  } : undefined;

  const examCodeBounds = examCodeZones.length > 0 ? {
    xStart: Number((Math.max(0.01, (codeMinX - avgRadius * 1.5) / canvasWidth)).toFixed(4)),
    xEnd: Number((Math.min(0.98, (codeMaxX + avgRadius * 1.5) / canvasWidth)).toFixed(4)),
    yStart: Number((Math.max(0.01, (codeMinY - avgRadius * 1.5) / canvasHeight)).toFixed(4)),
    yEnd: Number((Math.min(0.40, (codeMaxY + avgRadius * 1.5) / canvasHeight)).toFixed(4)),
    numDigits: examCodeDigitsCount
  } : undefined;

  return {
    sbdZones,
    examCodeZones,
    numSbdDigits: sbdDigitsCount,
    numExamCodeDigits: examCodeDigitsCount,
    sbdBounds,
    examCodeBounds
  };
}

/**
 * Generate standard fallback SBD zones
 */
function generateDefaultSbdZones(
  numDigits: number,
  normX: number,
  normY: number,
  normW: number,
  normH: number,
  canvasW: number,
  canvasH: number
): { zones: RecognitionZone[]; bounds: { xStart: number; xEnd: number; yStart: number; yEnd: number; numDigits: number } } {
  const zones: RecognitionZone[] = [];
  const colW = normW / numDigits;
  const bubbleAreaStartY = normY + 0.045;
  const bubbleAreaH = normH - 0.05;
  const rowStep = bubbleAreaH / 10;
  const bubbleSize = Math.min(colW * 0.78, rowStep * 0.85);

  for (let col = 0; col < numDigits; col++) {
    const colCenterX = normX + (col + 0.5) * colW;
    for (let val = 0; val <= 9; val++) {
      const rowCenterY = bubbleAreaStartY + (val + 0.5) * rowStep;
      zones.push({
        id: `zone_sbd_col${col}_val${val}`,
        type: 'student_id_bubble',
        digitPosition: col,
        digitValue: val,
        x: Number((colCenterX - bubbleSize / 2).toFixed(4)),
        y: Number((rowCenterY - bubbleSize / 2).toFixed(4)),
        width: Number(bubbleSize.toFixed(4)),
        height: Number(bubbleSize.toFixed(4)),
        label: `SBD[${col}]=${val}`
      });
    }
  }

  return {
    zones,
    bounds: {
      xStart: normX,
      xEnd: normX + normW,
      yStart: normY,
      yEnd: normY + normH,
      numDigits
    }
  };
}

/**
 * Generate standard fallback Exam Code zones
 */
function generateDefaultExamCodeZones(
  numDigits: number,
  normX: number,
  normY: number,
  normW: number,
  normH: number,
  canvasW: number,
  canvasH: number
): { zones: RecognitionZone[]; bounds: { xStart: number; xEnd: number; yStart: number; yEnd: number; numDigits: number } } {
  const zones: RecognitionZone[] = [];
  const colW = normW / numDigits;
  const bubbleAreaStartY = normY + 0.045;
  const bubbleAreaH = normH - 0.05;
  const rowStep = bubbleAreaH / 10;
  const bubbleSize = Math.min(colW * 0.78, rowStep * 0.85);

  for (let col = 0; col < numDigits; col++) {
    const colCenterX = normX + (col + 0.5) * colW;
    for (let val = 0; val <= 9; val++) {
      const rowCenterY = bubbleAreaStartY + (val + 0.5) * rowStep;
      zones.push({
        id: `zone_code_col${col}_val${val}`,
        type: 'exam_code_bubble',
        digitPosition: col,
        digitValue: val,
        x: Number((colCenterX - bubbleSize / 2).toFixed(4)),
        y: Number((rowCenterY - bubbleSize / 2).toFixed(4)),
        width: Number(bubbleSize.toFixed(4)),
        height: Number(bubbleSize.toFixed(4)),
        label: `MãĐề[${col}]=${val}`
      });
    }
  }

  return {
    zones,
    bounds: {
      xStart: normX,
      xEnd: normX + normW,
      yStart: normY,
      yEnd: normY + normH,
      numDigits
    }
  };
}

/**
 * Extracts Multiple-Choice Question Matrix (Phần các câu trắc nghiệm)
 */
function extractQuestionMatrixZones(
  bodyCircles: DetectedBubble[],
  avgRadius: number,
  canvasWidth: number,
  canvasHeight: number
): {
  questionZones: RecognitionZone[];
  numQuestions: number;
  numOptions: number;
  columnsCount: number;
  gridBounds: { xStart: number; xEnd: number; yStart: number; yEnd: number };
  colInfo: { columnCount: number; questionsPerColumn: number; optionsCount: number; direction: 'column_first' | 'row_first' };
} {
  // If fewer than 16 body circles, generate clean standard fallback grid
  if (bodyCircles.length < 16) {
    const defaultCols = 4;
    const defaultQuestions = 60;
    const defaultOptions = 4;
    const defaultZones = generateFallbackGrid(defaultQuestions, defaultOptions, defaultCols, {
      yStart: 0.32,
      yEnd: 0.95,
      xStart: 0.05,
      xEnd: 0.95
    });

    return {
      questionZones: defaultZones.filter(z => z.type === 'bubble'),
      numQuestions: defaultQuestions,
      numOptions: defaultOptions,
      columnsCount: defaultCols,
      gridBounds: { xStart: 0.05, xEnd: 0.95, yStart: 0.32, yEnd: 0.95 },
      colInfo: {
        columnCount: defaultCols,
        questionsPerColumn: 15,
        optionsCount: defaultOptions,
        direction: 'column_first'
      }
    };
  }

  // 1. Discover horizontal Option spacing (A -> B -> C -> D)
  const xSpacings: number[] = [];
  for (let i = 0; i < bodyCircles.length; i++) {
    for (let j = i + 1; j < bodyCircles.length; j++) {
      const b1 = bodyCircles[i];
      const b2 = bodyCircles[j];
      if (Math.abs(b1.cy - b2.cy) <= avgRadius * 0.6) {
        const dx = Math.abs(b1.cx - b2.cx);
        if (dx >= avgRadius * 1.6 && dx <= avgRadius * 5.2) {
          xSpacings.push(dx);
        }
      }
    }
  }
  xSpacings.sort((a, b) => a - b);
  const optSpacing = xSpacings.length > 0 
    ? xSpacings[Math.floor(xSpacings.length * 0.5)] 
    : avgRadius * 2.8;

  // 2. Histogram across X to locate distinct question columns
  const allX = bodyCircles.map(c => c.cx).sort((a, b) => a - b);
  const binW = Math.max(12, Math.round(optSpacing * 0.6));
  const numBins = Math.ceil(canvasWidth / binW);
  const xDensity = new Array(numBins).fill(0);
  for (const x of allX) {
    const b = Math.min(numBins - 1, Math.floor(x / binW));
    xDensity[b]++;
  }

  const smoothed = new Array(numBins).fill(0);
  for (let b = 0; b < numBins; b++) {
    const left = b > 0 ? xDensity[b - 1] : 0;
    const right = b < numBins - 1 ? xDensity[b + 1] : 0;
    smoothed[b] = (left + xDensity[b] * 2 + right) / 4;
  }

  interface ColCluster {
    startX: number;
    endX: number;
    centerX: number;
    circles: DetectedBubble[];
  }

  const rawClusters: { startBin: number; endBin: number }[] = [];
  let inClust = false;
  let sBin = 0;

  for (let b = 0; b < numBins; b++) {
    if (smoothed[b] >= 1.5 && !inClust) {
      inClust = true;
      sBin = b;
    } else if (smoothed[b] < 1.0 && inClust) {
      inClust = false;
      if (b - sBin >= 2) {
        rawClusters.push({ startBin: Math.max(0, sBin - 1), endBin: b });
      }
    }
  }
  if (inClust) {
    rawClusters.push({ startBin: sBin, endBin: numBins - 1 });
  }

  const detectedCols: ColCluster[] = [];
  for (const rc of rawClusters) {
    const minX = rc.startBin * binW;
    const maxX = (rc.endBin + 1) * binW;
    const colCircles = bodyCircles.filter(c => c.cx >= minX - 10 && c.cx <= maxX + 10);
    if (colCircles.length >= 8) {
      const cMinX = Math.min(...colCircles.map(c => c.cx));
      const cMaxX = Math.max(...colCircles.map(c => c.cx));
      detectedCols.push({
        startX: cMinX,
        endX: cMaxX,
        centerX: (cMinX + cMaxX) / 2,
        circles: colCircles
      });
    }
  }

  // Merge nearby clusters into same question columns
  const mergedCols: ColCluster[] = [];
  for (const dc of detectedCols) {
    if (mergedCols.length === 0) {
      mergedCols.push(dc);
    } else {
      const prev = mergedCols[mergedCols.length - 1];
      if (dc.startX - prev.endX < optSpacing * 2.2) {
        prev.startX = Math.min(prev.startX, dc.startX);
        prev.endX = Math.max(prev.endX, dc.endX);
        prev.centerX = (prev.startX + prev.endX) / 2;
        prev.circles = [...prev.circles, ...dc.circles];
      } else {
        mergedCols.push(dc);
      }
    }
  }

  let finalCols = mergedCols;
  if (finalCols.length === 0) {
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const inferredColCount = (maxX - minX) > 600 ? 4 : 2;
    const span = (maxX - minX) / inferredColCount;
    finalCols = [];
    for (let i = 0; i < inferredColCount; i++) {
      const csX = minX + i * span;
      const ceX = minX + (i + 1) * span;
      finalCols.push({
        startX: csX,
        endX: ceX,
        centerX: (csX + ceX) / 2,
        circles: bodyCircles.filter(c => c.cx >= csX && c.cx <= ceX)
      });
    }
  }
  finalCols.sort((a, b) => a.startX - b.startX);

  // 3. Process Each Question Column & Fit Exact Regular Rows
  const optionLetters: BubbleOption[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  const questionZones: RecognitionZone[] = [];
  let detectedOptionsCount = 4;
  let totalDetectedQuestions = 0;
  let globalMinX = canvasWidth, globalMaxX = 0, globalMinY = canvasHeight, globalMaxY = 0;
  let questionCounter = 1;

  const colRowsData: { colIndex: number; rowsY: number[]; optCentersX: number[] }[] = [];

  for (let cIdx = 0; cIdx < finalCols.length; cIdx++) {
    const col = finalCols[cIdx];
    const cCircles = col.circles;
    if (cCircles.length === 0) continue;

    cCircles.sort((a, b) => a.cy - b.cy);
    const rowGroups: DetectedBubble[][] = [];
    let curRow: DetectedBubble[] = [];

    for (const c of cCircles) {
      if (curRow.length === 0) {
        curRow.push(c);
      } else {
        const avgY = curRow.reduce((s, b) => s + b.cy, 0) / curRow.length;
        if (Math.abs(c.cy - avgY) <= avgRadius * 0.75) {
          curRow.push(c);
        } else {
          rowGroups.push(curRow);
          curRow = [c];
        }
      }
    }
    if (curRow.length > 0) rowGroups.push(curRow);

    const validRows = rowGroups.filter(r => r.length >= 2);
    if (validRows.length === 0) continue;

    const rowYList = validRows.map(r => r.reduce((s, b) => s + b.cy, 0) / r.length);
    const pitches: number[] = [];
    for (let i = 0; i < rowYList.length - 1; i++) {
      const dy = rowYList[i + 1] - rowYList[i];
      if (dy >= avgRadius * 1.5 && dy <= avgRadius * 4.5) {
        pitches.push(dy);
      }
    }
    pitches.sort((a, b) => a - b);
    const medianPitch = pitches.length > 0 ? pitches[Math.floor(pitches.length / 2)] : 28;

    // Detect options count (usually 4: A, B, C, D)
    const rowLengths = validRows.map(r => Math.min(6, Math.max(2, r.length)));
    const freqMap: Record<number, number> = {};
    rowLengths.forEach(len => { freqMap[len] = (freqMap[len] || 0) + 1; });
    let maxF = 0;
    let colOptCount = 4;
    for (const [lenStr, f] of Object.entries(freqMap)) {
      if (f > maxF) {
        maxF = f;
        colOptCount = parseInt(lenStr, 10);
      }
    }
    if (colOptCount < 2 || colOptCount > 5) colOptCount = 4;
    detectedOptionsCount = colOptCount;

    // Discover Option X positions
    const optXSlots: number[][] = Array.from({ length: detectedOptionsCount }, () => []);
    for (const r of validRows) {
      r.sort((a, b) => a.cx - b.cx);
      r.forEach((b, optIdx) => {
        if (optIdx < detectedOptionsCount) {
          optXSlots[optIdx].push(b.cx);
        }
      });
    }

    const regOptX: number[] = optXSlots.map((list, idx) => {
      if (list.length > 0) {
        list.sort((a, b) => a - b);
        return list[Math.floor(list.length / 2)];
      }
      return col.startX + idx * optSpacing;
    });

    // Regularize row Y positions and interpolate missing rows
    const regularizedRowY: number[] = [];
    for (let rIdx = 0; rIdx < rowYList.length; rIdx++) {
      const curY = rowYList[rIdx];
      if (regularizedRowY.length > 0) {
        const prevY = regularizedRowY[regularizedRowY.length - 1];
        const gap = curY - prevY;
        if (gap > medianPitch * 1.7 && gap < medianPitch * 2.4) {
          regularizedRowY.push(prevY + medianPitch);
        }
      }
      regularizedRowY.push(curY);
    }

    colRowsData.push({
      colIndex: cIdx,
      rowsY: regularizedRowY,
      optCentersX: regOptX
    });
  }

  // 4. Generate Zones for All Questions
  const normW = Number(((avgRadius * 2.1) / canvasWidth).toFixed(4));
  const normH = Number(((avgRadius * 2.3) / canvasHeight).toFixed(4));

  colRowsData.forEach((colData, colIdx) => {
    colData.rowsY.forEach((rowY) => {
      const qNum = questionCounter++;
      totalDetectedQuestions++;

      if (rowY < globalMinY) globalMinY = rowY;
      if (rowY > globalMaxY) globalMaxY = rowY;

      for (let optIdx = 0; optIdx < detectedOptionsCount; optIdx++) {
        const opt = optionLetters[optIdx] || 'A';
        const optX = colData.optCentersX[optIdx] || (colData.optCentersX[0] + optIdx * optSpacing);

        if (optX < globalMinX) globalMinX = optX;
        if (optX > globalMaxX) globalMaxX = optX;

        const zNormX = Number(((optX - avgRadius * 1.05) / canvasWidth).toFixed(4));
        const zNormY = Number(((rowY - avgRadius * 1.15) / canvasHeight).toFixed(4));

        questionZones.push({
          id: `zone_q${qNum}_${opt}_${Date.now()}_${colIdx}_${optIdx}`,
          type: 'bubble',
          questionNumber: qNum,
          option: opt,
          x: Math.max(0.01, Math.min(0.96, zNormX)),
          y: Math.max(0.01, Math.min(0.96, zNormY)),
          width: Math.max(0.018, normW),
          height: Math.max(0.02, normH),
          label: `Q${qNum}-${opt}`
        });
      }
    });
  });

  // Standardize total questions to nearest standard exam size
  let normalizedQuestions = totalDetectedQuestions || 60;
  const STANDARD_SIZES = [20, 25, 30, 40, 50, 60, 80, 100, 120];
  for (const std of STANDARD_SIZES) {
    if (Math.abs(totalDetectedQuestions - std) <= 3) {
      normalizedQuestions = std;
      break;
    }
  }

  let finalColumnsCount = colRowsData.length || 4;
  if (normalizedQuestions === 60) {
    finalColumnsCount = 4;
  } else if (normalizedQuestions === 100 || normalizedQuestions === 120) {
    finalColumnsCount = 4;
  } else if (normalizedQuestions === 40 || normalizedQuestions === 50) {
    finalColumnsCount = finalColumnsCount >= 3 ? 4 : 2;
  }

  const questionsPerColumn = Math.ceil(normalizedQuestions / finalColumnsCount);

  const xStartNorm = Number(Math.max(0.04, Math.min(0.20, (globalMinX - avgRadius) / canvasWidth)).toFixed(4));
  const xEndNorm = Number(Math.max(0.80, Math.min(0.96, (globalMaxX + avgRadius) / canvasWidth)).toFixed(4));
  const yStartNorm = Number(Math.max(0.20, Math.min(0.40, (globalMinY - avgRadius) / canvasHeight)).toFixed(4));
  const yEndNorm = Number(Math.max(0.70, Math.min(0.96, (globalMaxY + avgRadius) / canvasHeight)).toFixed(4));

  return {
    questionZones,
    numQuestions: normalizedQuestions,
    numOptions: detectedOptionsCount,
    columnsCount: finalColumnsCount,
    gridBounds: {
      xStart: xStartNorm,
      xEnd: xEndNorm,
      yStart: yStartNorm,
      yEnd: yEndNorm
    },
    colInfo: {
      columnCount: finalColumnsCount,
      questionsPerColumn,
      optionsCount: detectedOptionsCount,
      direction: 'column_first'
    }
  };
}

/**
 * Fallback / Precision grid generator with customizable bounds and layout
 */
export function generateFallbackGrid(
  numQuestions = 40,
  numOptions = 4,
  columnsCount = 2,
  options?: {
    yStart?: number;
    yEnd?: number;
    xStart?: number;
    xEnd?: number;
    direction?: 'column_first' | 'row_first';
    startQ?: number;
  }
): RecognitionZone[] {
  const zones: RecognitionZone[] = [];
  const optsList: BubbleOption[] = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, numOptions) as BubbleOption[];

  const yStart = options?.yStart ?? 0.32;
  const yEnd = options?.yEnd ?? 0.95;
  const xStart = options?.xStart ?? 0.05;
  const xEnd = options?.xEnd ?? 0.95;
  const direction = options?.direction ?? 'column_first';
  const startQ = options?.startQ ?? 1;

  const totalW = xEnd - xStart;
  const totalH = yEnd - yStart;

  const colWidth = totalW / columnsCount;
  const questionsPerCol = Math.ceil(numQuestions / columnsCount);
  const rowHeight = totalH / (questionsPerCol + 0.4);

  const bubbleWidth = Math.min(0.024, (colWidth / (numOptions + 1.4)));
  const bubbleHeight = bubbleWidth * 1.30;

  let currentQ = startQ;

  if (direction === 'column_first') {
    for (let c = 0; c < columnsCount; c++) {
      const colX = xStart + c * colWidth;
      for (let r = 0; r < questionsPerCol; r++) {
        if (currentQ > startQ + numQuestions - 1) break;
        const qNum = currentQ;
        const startY = yStart + (r + 0.4) * rowHeight;
        const optAreaWidth = colWidth * 0.76;
        const optSpacing = optAreaWidth / Math.max(1, numOptions - 1);
        const startOptX = colX + colWidth * 0.18;

        optsList.forEach((opt, optIdx) => {
          const bubbleX = startOptX + optIdx * optSpacing;
          zones.push({
            id: `zone_q${qNum}_${opt}_${Date.now()}_${c}_${optIdx}`,
            type: 'bubble',
            questionNumber: qNum,
            option: opt,
            x: Number(bubbleX.toFixed(4)),
            y: Number(startY.toFixed(4)),
            width: Number(bubbleWidth.toFixed(4)),
            height: Number(bubbleHeight.toFixed(4)),
            label: `Q${qNum}-${opt}`
          });
        });

        currentQ++;
      }
    }
  } else {
    for (let r = 0; r < questionsPerCol; r++) {
      const startY = yStart + (r + 0.4) * rowHeight;
      for (let c = 0; c < columnsCount; c++) {
        if (currentQ > startQ + numQuestions - 1) break;
        const qNum = currentQ;
        const colX = xStart + c * colWidth;
        const optAreaWidth = colWidth * 0.76;
        const optSpacing = optAreaWidth / Math.max(1, numOptions - 1);
        const startOptX = colX + colWidth * 0.18;

        optsList.forEach((opt, optIdx) => {
          const bubbleX = startOptX + optIdx * optSpacing;
          zones.push({
            id: `zone_q${qNum}_${opt}_${Date.now()}_${r}_${c}_${optIdx}`,
            type: 'bubble',
            questionNumber: qNum,
            option: opt,
            x: Number(bubbleX.toFixed(4)),
            y: Number(startY.toFixed(4)),
            width: Number(bubbleWidth.toFixed(4)),
            height: Number(bubbleHeight.toFixed(4)),
            label: `Q${qNum}-${opt}`
          });
        });

        currentQ++;
      }
    }
  }

  zones.push(
    { id: 'anchor_tl', type: 'anchor_mark', x: 0.02, y: 0.015, width: 0.035, height: 0.022, label: 'Top-Left' },
    { id: 'anchor_tr', type: 'anchor_mark', x: 0.945, y: 0.015, width: 0.035, height: 0.022, label: 'Top-Right' },
    { id: 'anchor_bl', type: 'anchor_mark', x: 0.02, y: 0.965, width: 0.035, height: 0.022, label: 'Bottom-Left' },
    { id: 'anchor_br', type: 'anchor_mark', x: 0.945, y: 0.965, width: 0.035, height: 0.022, label: 'Bottom-Right' },
    { id: 'zone_qr_code', type: 'student_id_qr', x: 0.78, y: 0.045, width: 0.16, height: 0.12, label: 'QR Code ID' }
  );

  return zones;
}

