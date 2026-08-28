import { BubbleOption, Exam, ExamSubmission, RecognizedAnswer } from '../types';

const SAMPLE_STUDENT_NAMES = [
  'Nguyễn Văn An',
  'Trần Thị Mai',
  'Lê Hoàng Nam',
  'Phạm Minh Tuấn',
  'Đỗ Quỳnh Nga',
  'Vũ Đức Thắng',
  'Hoàng Bảo Châu',
  'Bùi Gia Huy',
  'Đặng Thu Hà',
  'Ngô Quang Khải',
  'Phan Thanh Trúc',
  'Trịnh Hoài Nam',
  'Dương Khánh Linh',
  'Lý Quốc Hùng',
  'Tạ Minh Khôi',
  'Lâm Nhật Vy',
  'Đinh Văn Hải',
  'Võ Thị Bích Ngọc',
  'Hà Anh Quân',
  'Lê Thị Hương Tràm'
];

const SAMPLE_CLASSES = ['12A1', '12A2', '12A3', '12A4', '12D1'];

/**
 * Generates rich, realistic sample submissions for an exam to demonstrate
 * all capabilities of Results & Reports dashboard.
 */
export function generateSampleSubmissions(exam: Exam, count = 16): ExamSubmission[] {
  const numQuestions = exam.numQuestions || 40;
  const maxScore = exam.maxScore || 10;
  const pointsPerQuestion = Number((maxScore / numQuestions).toFixed(3));
  const precision = exam.decimalPrecision ?? 2;
  const options: BubbleOption[] = ['A', 'B', 'C', 'D'];

  const variants = exam.variants || [];
  const variantCodes = variants.length > 0 ? variants.map(v => v.code) : [exam.code || '101', '102', '103', '104'];

  const sampleList: ExamSubmission[] = [];

  for (let i = 0; i < count; i++) {
    const studentName = SAMPLE_STUDENT_NAMES[i % SAMPLE_STUDENT_NAMES.length];
    const studentId = (102000 + i + 1).toString();
    const className = SAMPLE_CLASSES[i % SAMPLE_CLASSES.length];
    const appliedVariantCode = variantCodes[i % variantCodes.length];

    // Determine student tier: High scorer (0..3), Medium (4..10), Lower (11..13), Needs Review (14..15)
    let accuracyTarget = 0.8;
    let isNeedsReviewTier = false;

    if (i === 0 || i === 1) {
      accuracyTarget = 0.95 + Math.random() * 0.05; // 9.5 - 10.0
    } else if (i < 5) {
      accuracyTarget = 0.8 + Math.random() * 0.15; // 8.0 - 9.5
    } else if (i < 10) {
      accuracyTarget = 0.65 + Math.random() * 0.15; // 6.5 - 8.0
    } else if (i < 13) {
      accuracyTarget = 0.45 + Math.random() * 0.2; // 4.5 - 6.5
    } else {
      accuracyTarget = 0.35 + Math.random() * 0.3; // 3.5 - 6.5
      isNeedsReviewTier = true;
    }

    let correctCount = 0;
    let wrongCount = 0;
    let blankCount = 0;
    let multipleCount = 0;
    let uncertainCount = 0;
    let totalEarned = 0;

    // Find variant questions or exam questions
    const matchedVariant = variants.find(v => v.code === appliedVariantCode);
    const questionsList = matchedVariant?.questions || exam.questions;

    const recognizedAnswers: RecognizedAnswer[] = [];

    for (let q = 1; q <= numQuestions; q++) {
      const qConfig = questionsList.find(item => item.questionNumber === q);
      const correctAnswer = qConfig?.correctAnswer || options[(q - 1) % 4];
      const qPoints = qConfig?.points || pointsPerQuestion;

      let selectedOption: BubbleOption | null = null;
      let isCorrect = false;
      let status: RecognizedAnswer['status'] = 'BLANK';
      let confidence = Math.round(85 + Math.random() * 14); // 85..99%
      let fillRatios: Record<string, number> = { A: 0.02, B: 0.03, C: 0.02, D: 0.01 };

      const rand = Math.random();

      if (isNeedsReviewTier && q === 4 && i === 14) {
        // Multiple mark case
        status = 'MULTIPLE';
        selectedOption = null;
        multipleCount++;
        confidence = 58;
        fillRatios = { A: 0.78, B: 0.82, C: 0.05, D: 0.02 };
      } else if (isNeedsReviewTier && q === 7 && i === 15) {
        // Uncertain / Faint case
        status = 'UNCERTAIN';
        selectedOption = correctAnswer;
        uncertainCount++;
        confidence = 62;
        fillRatios = { [correctAnswer]: 0.24, A: 0.04, B: 0.02, C: 0.03, D: 0.01 };
      } else if (rand < accuracyTarget) {
        // Correct answer
        selectedOption = correctAnswer;
        isCorrect = true;
        status = 'CORRECT';
        correctCount++;
        totalEarned += qPoints;
        fillRatios[correctAnswer] = Number((0.75 + Math.random() * 0.22).toFixed(2));
      } else if (rand > 0.96) {
        // Blank answer
        selectedOption = null;
        isCorrect = false;
        status = 'BLANK';
        blankCount++;
        confidence = 98;
      } else {
        // Wrong answer
        const wrongOpts = options.filter(o => o !== correctAnswer);
        selectedOption = wrongOpts[Math.floor(Math.random() * wrongOpts.length)];
        isCorrect = false;
        status = 'WRONG';
        wrongCount++;
        fillRatios[selectedOption] = Number((0.68 + Math.random() * 0.25).toFixed(2));
      }

      recognizedAnswers.push({
        questionNumber: q,
        selectedOption,
        selectedOptions: status === 'MULTIPLE' ? ['A', 'B'] : undefined,
        fillRatios,
        confidence,
        isCorrect,
        status,
        correctAnswer,
        pointsEarned: isCorrect ? qPoints : 0,
        maxPoints: qPoints,
        teacherNote: isNeedsReviewTier && (q === 4 || q === 7) ? 'Cần giáo viên đối chiếu bài gốc' : undefined
      });
    }

    const calculatedRawScore = (totalEarned / (exam.maxScore || 10)) * (exam.maxScore || 10);
    const multiplier = Math.pow(10, precision);
    const finalScore = Math.min(maxScore, Math.max(0, Math.round(calculatedRawScore * multiplier) / multiplier));

    const overallStatus = (multipleCount > 0 || uncertainCount > 0 || (isNeedsReviewTier && i >= 14))
      ? 'NEEDS_REVIEW'
      : 'GRADED';

    const subId = `sub_sample_${Date.now()}_${i + 1}`;

    sampleList.push({
      id: subId,
      examId: exam.id,
      studentId,
      studentName,
      className,
      detectedExamCode: appliedVariantCode,
      appliedVariantCode,
      matchedVariantTitle: matchedVariant ? matchedVariant.title : `Mã đề ${appliedVariantCode}`,
      studentIdConfidence: 98,
      examCodeConfidence: 99,
      studentIdStatus: 'VALID',
      examCodeStatus: 'VALID',
      scannedImageUrl: '', // lightweight simulated sheet
      scanDate: new Date(Date.now() - (i * 3600000 * 4)).toISOString(),
      status: overallStatus,
      totalScore: finalScore,
      maxScore,
      totalCorrect: correctCount,
      totalWrong: wrongCount,
      totalBlank: blankCount,
      totalMultiple: multipleCount,
      totalUncertain: uncertainCount,
      overallConfidence: Math.round(88 + Math.random() * 10),
      recognizedAnswers,
      auditLogs: isNeedsReviewTier ? [
        {
          id: 'log_auto_flag_' + i,
          submissionId: subId,
          action: 'OMR_FLAGGED',
          newValue: 'Phát hiện câu trả lời nghi vấn / tô nhiều ô',
          changedBy: 'Hệ thống OMR Engine',
          timestamp: new Date().toISOString(),
          reason: 'Độ đậm nhạt vết tô vượt ngưỡng quy định'
        }
      ] : [],
      needsReviewReason: overallStatus === 'NEEDS_REVIEW' ? 'Phát hiện ô tô nhiều đáp án hoặc độ đậm chưa đạt chuẩn' : undefined
    });
  }

  return sampleList;
}
