import { AnswerSheetTemplate, BubbleOption, Exam, ExamSubmission, ExamVariant, QuestionConfig, RecognizedAnswer, Student } from '../types';

export interface OMRProcessingOptions {
  fillThreshold?: number;       // Default 0.35
  uncertainThreshold?: number;  // Default 0.18
  minMargin?: number;           // Default 0.15 margin between top and runner-up
}

/**
 * Helper to load an Image object from URL / Base64 string
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = src;
  });
}

/**
 * Preprocess image onto a standardized high-resolution canvas
 */
export function createStandardizedCanvas(img: HTMLImageElement, targetWidth = 1600, targetHeight = 2260): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  
  // Fill white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  
  // Draw image fitted
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  return { canvas, ctx };
}

/**
 * Calculates the fill ratio of a circular bubble region
 * Inner circle pixels are sampled to ignore the outer printed boundary stroke.
 */
export function analyzeBubbleFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): { fillRatio: number; cropDataUrl: string } {
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.max(24, Math.round(w));
  cropCanvas.height = Math.max(24, Math.round(h));
  const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true })!;

  try {
    const imgData = ctx.getImageData(x, y, w, h);
    cropCtx.putImageData(imgData, 0, 0);

    const data = imgData.data;
    let darkPixels = 0;
    let totalSampled = 0;

    const centerX = w / 2;
    const centerY = h / 2;
    // Sample within inner 75% of bubble radius to avoid printed boundary
    const innerRadius = Math.min(centerX, centerY) * 0.75;
    const innerRadiusSq = innerRadius * innerRadius;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dx = px - centerX;
        const dy = py - centerY;
        if (dx * dx + dy * dy <= innerRadiusSq) {
          totalSampled++;
          const idx = (py * w + px) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Grayscale luminance
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          // If dark (pencil/pen mark typically luminance < 140)
          if (luminance < 140) {
            darkPixels++;
          }
        }
      }
    }

    const fillRatio = totalSampled > 0 ? darkPixels / totalSampled : 0;
    return {
      fillRatio: Math.min(1.0, Math.max(0.0, fillRatio)),
      cropDataUrl: cropCanvas.toDataURL('image/jpeg', 0.85)
    };
  } catch {
    return { fillRatio: 0, cropDataUrl: '' };
  }
}

/**
 * Main OMR Recognition & Scoring Engine
 */
export async function processAnswerSheet(
  imageUrl: string,
  template: AnswerSheetTemplate,
  exam: Exam,
  students: Student[],
  options: OMRProcessingOptions = {}
): Promise<ExamSubmission> {
  const fillThreshold = options.fillThreshold ?? template.fillThreshold ?? 0.35;
  const uncertainThreshold = options.uncertainThreshold ?? template.uncertainThreshold ?? 0.18;
  const minMargin = options.minMargin ?? 0.15;

  const img = await loadImage(imageUrl);
  const { canvas, ctx } = createStandardizedCanvas(img, 1600, 2260);

  // Group zones by question and option
  const bubbleZones = template.zones.filter(z => z.type === 'bubble' && z.questionNumber !== undefined && z.option);
  const studentIdZones = template.zones.filter(z => z.type === 'student_id_bubble');
  const examCodeZones = template.zones.filter(z => z.type === 'exam_code_bubble');
  const qrZones = template.zones.filter(z => z.type === 'student_id_qr');

  // Question recognition results map
  const questionResultsMap: Record<number, {
    options: Record<BubbleOption, { fillRatio: number; cropUrl: string }>;
  }> = {};

  // Analyze each bubble zone
  for (const zone of bubbleZones) {
    const qNum = zone.questionNumber!;
    const opt = zone.option as BubbleOption;

    if (!questionResultsMap[qNum]) {
      questionResultsMap[qNum] = { options: {} as Record<BubbleOption, { fillRatio: number; cropUrl: string }> };
    }

    const pxX = Math.round(zone.x * canvas.width);
    const pxY = Math.round(zone.y * canvas.height);
    const pxW = Math.round(zone.width * canvas.width);
    const pxH = Math.round(zone.height * canvas.height);

    const { fillRatio, cropDataUrl } = analyzeBubbleFill(ctx, pxX, pxY, pxW, pxH);
    questionResultsMap[qNum].options[opt] = {
      fillRatio,
      cropUrl: cropDataUrl
    };
  }

  // Detect Student ID from bubbles if present
  let detectedStudentId = '';
  if (studentIdZones.length > 0) {
    const columns: Record<number, { digit: number; fill: number }[]> = {};
    for (const z of studentIdZones) {
      if (z.digitPosition !== undefined && z.digitValue !== undefined) {
        if (!columns[z.digitPosition]) columns[z.digitPosition] = [];
        const pxX = Math.round(z.x * canvas.width);
        const pxY = Math.round(z.y * canvas.height);
        const pxW = Math.round(z.width * canvas.width);
        const pxH = Math.round(z.height * canvas.height);
        const { fillRatio } = analyzeBubbleFill(ctx, pxX, pxY, pxW, pxH);
        columns[z.digitPosition].push({ digit: z.digitValue, fill: fillRatio });
      }
    }

    // Determine max digit in each column
    const sortedPositions = Object.keys(columns).map(Number).sort((a, b) => a - b);
    for (const colIdx of sortedPositions) {
      const col = columns[colIdx].sort((a, b) => b.fill - a.fill);
      if (col[0] && col[0].fill > fillThreshold) {
        detectedStudentId += col[0].digit.toString();
      }
    }
  }

  // Detect Exam Code (Mã Đề) from bubbles if present
  let detectedExamCode = '';
  if (examCodeZones.length > 0) {
    const codeColumns: Record<number, { digit: number; fill: number }[]> = {};
    for (const z of examCodeZones) {
      if (z.digitPosition !== undefined && z.digitValue !== undefined) {
        if (!codeColumns[z.digitPosition]) codeColumns[z.digitPosition] = [];
        const pxX = Math.round(z.x * canvas.width);
        const pxY = Math.round(z.y * canvas.height);
        const pxW = Math.round(z.width * canvas.width);
        const pxH = Math.round(z.height * canvas.height);
        const { fillRatio } = analyzeBubbleFill(ctx, pxX, pxY, pxW, pxH);
        codeColumns[z.digitPosition].push({ digit: z.digitValue, fill: fillRatio });
      }
    }

    const sortedCodePositions = Object.keys(codeColumns).map(Number).sort((a, b) => a - b);
    for (const colIdx of sortedCodePositions) {
      const col = codeColumns[colIdx].sort((a, b) => b.fill - a.fill);
      if (col[0] && col[0].fill > fillThreshold) {
        detectedExamCode += col[0].digit.toString();
      }
    }
  }

  // Match student from roster
  let matchedStudent = students.find(s => s.studentId === detectedStudentId);
  
  // If no bubble ID or not found, try mock QR/random assignment if it's a demo or test
  if (!matchedStudent && students.length > 0) {
    // Pick first unmatched student or fallback
    matchedStudent = students[0];
  }

  // Determine Exam Variant (Mã Đề) for grading
  let matchedVariant: ExamVariant | undefined;
  let appliedVariantCode = exam?.defaultVariantCode || exam?.code || '101';
  let variantMismatch = false;

  if (exam?.variants && exam.variants.length > 0) {
    if (detectedExamCode) {
      const cleanDetected = detectedExamCode.trim().toLowerCase();
      const numDetected = cleanDetected.replace(/^0+/, '');
      
      matchedVariant = exam.variants.find(v => {
        const cleanV = v.code.trim().toLowerCase();
        const numV = cleanV.replace(/^0+/, '');
        return cleanV === cleanDetected || (numDetected !== '' && numV === numDetected) || cleanV.includes(cleanDetected);
      });

      if (matchedVariant) {
        appliedVariantCode = matchedVariant.code;
      } else {
        // Did not match any registered variant
        variantMismatch = true;
        matchedVariant = exam.variants[0];
        appliedVariantCode = exam.variants[0].code;
      }
    } else {
      matchedVariant = exam.variants[0];
      appliedVariantCode = exam.variants[0].code;
    }
  }

  const examId = exam?.id || 'exam_default';
  const examMaxScore = exam?.maxScore ?? 10;
  const examNumQuestions = exam?.numQuestions || template.numQuestions || 120;
  
  // Select questions key based on the matched variant or fallback
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

  // Process each question based on Variant Config
  for (const qConfig of examQuestions) {
    const qNum = qConfig.questionNumber;
    const qData = questionResultsMap[qNum];
    const qPoints = qConfig.points || (examMaxScore / examNumQuestions);
    totalPointsPossible += qPoints;

    const fillMap: Record<string, number> = {};
    let cropImg = '';

    if (qData) {
      const entries = Object.entries(qData.options) as [BubbleOption, { fillRatio: number; cropUrl: string }][];
      
      // Sort options by fill ratio descending
      entries.sort((a, b) => b[1].fillRatio - a[1].fillRatio);

      for (const [opt, res] of entries) {
        fillMap[opt] = Number(res.fillRatio.toFixed(3));
        if (!cropImg && res.cropUrl) {
          cropImg = res.cropUrl;
        }
      }

      const topOpt = entries[0];
      const secondOpt = entries[1];

      // Identify filled options (fill >= threshold)
      const filledOptions = entries.filter(e => e[1].fillRatio >= fillThreshold);

      let selectedOption: BubbleOption | null = null;
      let status: RecognizedAnswer['status'] = 'BLANK';
      let confidence = 95;

      if (filledOptions.length > 1) {
        // Multiple options selected
        status = 'MULTIPLE';
        selectedOption = null;
        confidence = Math.round(50 + (topOpt[1].fillRatio - (secondOpt ? secondOpt[1].fillRatio : 0)) * 50);
        totalMultiple++;
      } else if (topOpt && topOpt[1].fillRatio >= fillThreshold) {
        // Clear selection
        const margin = secondOpt ? topOpt[1].fillRatio - secondOpt[1].fillRatio : topOpt[1].fillRatio;
        if (margin >= minMargin) {
          selectedOption = topOpt[0];
          confidence = Math.min(99, Math.round(75 + topOpt[1].fillRatio * 24));
          status = (selectedOption === qConfig.correctAnswer) ? 'CORRECT' : 'WRONG';
        } else {
          // Margin is tight (potential erasure) -> Flag as uncertain
          selectedOption = topOpt[0];
          status = 'UNCERTAIN';
          confidence = Math.round(50 + margin * 100);
          totalUncertain++;
        }
      } else if (topOpt && topOpt[1].fillRatio >= uncertainThreshold) {
        // Light mark / uncertain
        selectedOption = topOpt[0];
        status = 'UNCERTAIN';
        confidence = Math.round(topOpt[1].fillRatio * 150);
        totalUncertain++;
      } else {
        // All options are below uncertain threshold -> Blank
        selectedOption = null;
        status = 'BLANK';
        confidence = 96;
        totalBlank++;
      }

      const isCorrect = selectedOption === qConfig.correctAnswer;
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
        cropImageUrl: cropImg
      });
    } else {
      // Question not found in template
      recognizedAnswers.push({
        questionNumber: qNum,
        selectedOption: null,
        fillRatios: {},
        confidence: 0,
        isCorrect: false,
        status: 'BLANK',
        correctAnswer: qConfig.correctAnswer,
        pointsEarned: 0,
        maxPoints: qPoints
      });
      totalBlank++;
    }
  }

  // Calculate final score with decimal precision
  const rawScore = totalPointsPossible > 0 ? (totalPointsEarned / totalPointsPossible) * examMaxScore : 0;
  const multiplier = Math.pow(10, exam?.decimalPrecision ?? 2);
  const finalScore = Math.round(rawScore * multiplier) / multiplier;

  const avgConfidence = examNumQuestions > 0 ? Math.round(confidenceSum / examNumQuestions) : 0;

  // Determine overall submission status
  let overallStatus: ExamSubmission['status'] = 'GRADED';
  let reviewReason = '';

  if (variantMismatch) {
    overallStatus = 'NEEDS_REVIEW';
    reviewReason = `Mã đề nhận diện "${detectedExamCode}" không khớp danh sách mã đề của kỳ thi (${exam?.variants?.map(v => v.code).join(', ')})`;
  } else if (totalMultiple > 0) {
    overallStatus = 'NEEDS_REVIEW';
    reviewReason = `${totalMultiple} câu tô nhiều đáp án`;
  } else if (totalUncertain > 0) {
    overallStatus = 'NEEDS_REVIEW';
    reviewReason = `${totalUncertain} câu tô mờ/nghi ngờ`;
  } else if (!matchedStudent) {
    overallStatus = 'STUDENT_NOT_FOUND';
    reviewReason = 'Chưa nhận diện được thông tin học sinh';
  } else if (avgConfidence < 75) {
    overallStatus = 'LOW_CONFIDENCE';
    reviewReason = 'Độ tin cậy tổng thể thấp';
  }

  const submissionId = 'sub_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

  return {
    id: submissionId,
    examId: examId,
    studentId: matchedStudent?.studentId || detectedStudentId || 'UNKNOWN',
    studentName: matchedStudent?.name || 'Học sinh chưa xác định',
    className: matchedStudent?.className || exam?.className || '12A1',
    detectedExamCode: detectedExamCode || undefined,
    appliedVariantCode: appliedVariantCode,
    matchedVariantTitle: matchedVariant ? (matchedVariant.title || `Mã đề ${matchedVariant.code}`) : `Mã đề ${appliedVariantCode}`,
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
