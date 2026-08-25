export type UserRole = 'teacher' | 'admin';

export interface UserAccount {
  id: string;
  username: string; // e.g. 'admin', 'giaovien01', 'taminhkhoi'
  email?: string;
  password: string; // e.g. 'admin@123'
  fullName: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt?: string;
  status: 'active' | 'inactive';
  department?: string;
  phone?: string;
  notes?: string;
}

export type Language = 'vi' | 'en';

export type ZoneType = 'bubble' | 'student_id_bubble' | 'student_id_qr' | 'exam_code_bubble' | 'anchor_mark' | 'info_box';

export type BubbleOption = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface RecognitionZone {
  id: string;
  type: ZoneType;
  questionNumber?: number; // For bubble type (e.g., 1..100)
  option?: BubbleOption;   // A, B, C, D, E
  digitPosition?: number;  // For student ID bubble columns (e.g. column 0..5)
  digitValue?: number;     // For student ID bubble rows (0..9)
  x: number;               // Normalized 0.0 - 1.0
  y: number;               // Normalized 0.0 - 1.0
  width: number;           // Normalized 0.0 - 1.0
  height: number;          // Normalized 0.0 - 1.0
  page?: number;
  label?: string;
  threshold?: number;      // Custom threshold override (0.0 - 1.0)
}

export interface CustomTemplateField {
  id: string;
  label: string;
  value?: string;
  newline?: boolean; // Whether to break into a new line
}

export interface CustomTemplateLayoutConfig {
  showDepartmentName?: boolean;
  departmentName?: string;
  showSchoolName?: boolean;
  schoolName?: string;
  showSheetTitle?: boolean;
  sheetTitle?: string;
  showExamTitle?: boolean;
  examTitle?: string;

  showSubjectName?: boolean;
  showSubject?: boolean;
  subjectName?: string;
  subject?: string;
  subjectNewline?: boolean;

  showDurationMinutes?: boolean;
  showDuration?: boolean;
  durationMinutes?: number;
  duration?: number;
  durationNewline?: boolean;

  showExamDate?: boolean;
  showDate?: boolean;
  examDate?: string;
  date?: string;
  examDateNewline?: boolean;

  showExamClass?: boolean;
  showClassName?: boolean;
  showClass?: boolean;
  examClass?: string;
  className?: string;

  showRoomNumber?: boolean;
  showRoomName?: boolean;
  showRoom?: boolean;
  roomNumber?: string;
  roomName?: string;

  showStudentName?: boolean;
  studentNameNewline?: boolean;
  showStudentDob?: boolean;
  studentDobNewline?: boolean;
  showExamClassInStudentBox?: boolean;
  examClassNewline?: boolean;
  showRoomNumberInStudentBox?: boolean;
  roomNumberNewline?: boolean;
  customFields?: CustomTemplateField[];
  headerCustomFields?: CustomTemplateField[];
  
  // Line spacing / Gap settings
  headerLineSpacing?: number;      // Multiplier e.g. 1.0 - 2.5
  studentLineSpacing?: number;     // Multiplier e.g. 1.0 - 2.5
  
  // Custom Box Titles & Field Labels
  studentInfoBoxTitle?: string;
  studentNameLabel?: string;
  examClassLabel?: string;
  studentDobLabel?: string;
  roomNumberLabel?: string;
  studentSignatureLabel?: string;
  studentSignatureNewline?: boolean;
  
  // Scores & Proctor Box
  showScoresTable?: boolean;
  showTeacherScoreBox?: boolean;
  scoreBoxTitle?: string;
  scoreTextLabel?: string;
  showScoreNumber?: boolean;
  showScoreText?: boolean;
  showProctor1?: boolean;
  showProctor2?: boolean;
  proctor1Label?: string;
  proctor2Label?: string;
  teacherNotesLabel?: string;
  scoreBoxCustomFields?: CustomTemplateField[];
  
  // Instructions Box
  showInstructions?: boolean;
  showInstructionsBox?: boolean;
  instructionsTitle?: string;
  instructionsText?: string;
  
  // Custom Positions & Dimensions (Normalized 0..1 or offsets)
  studentInfoBoxX?: number;
  studentInfoBoxY?: number;
  studentInfoBoxW?: number;
  studentInfoBoxH?: number;
  
  scoreBoxX?: number;
  scoreBoxY?: number;
  scoreBoxW?: number;
  scoreBoxH?: number;
  
  instructionsBoxX?: number;
  instructionsBoxY?: number;
  instructionsBoxW?: number;
  instructionsBoxH?: number;

  // Bubble & Frame Color Styling
  bubbleColor?: string;          // Hex for bubble stroke & text (e.g. #000000, #1e3a8a, #991b1b, etc.)
  bubbleFillColor?: string;      // Background inside bubble (default #FFFFFF)
  frameBorderColor?: string;     // Color for table frames & dividing lines (default #000000)
  headerBannerColor?: string;    // Color for table header banner (default #000000 or matching theme)
  headerBannerTextColor?: string;// Color for text in banner (default #FFFFFF)

  // Typography & Text Styling (Colors, Bold, Italic)
  textColor?: string;            // Global default text color
  headerTextColor?: string;      // Header text color (default #000000)
  studentBoxTextColor?: string;  // Student box text color (default #000000)
  scoreBoxTextColor?: string;    // Score box text color (default #000000)
  instructionsTextColor?: string;// Instructions text color (default #000000)
  
  // Font Weights & Italic Toggles
  deptBold?: boolean;            // Sở GD&ĐT bold
  deptItalic?: boolean;          // Sở GD&ĐT italic
  schoolNameBold?: boolean;      // Tên trường bold
  schoolNameItalic?: boolean;    // Tên trường italic
  sheetTitleBold?: boolean;      // Tiêu đề phiếu bold
  sheetTitleItalic?: boolean;    // Tiêu đề phiếu italic
  examTitleBold?: boolean;       // Tên kỳ thi bold
  examTitleItalic?: boolean;     // Tên kỳ thi italic
  headerMetaBold?: boolean;      // Môn, thời gian, ngày thi bold
  headerMetaItalic?: boolean;    // Môn, thời gian, ngày thi italic

  studentBoxTitleBold?: boolean; // Tiêu đề khung thí sinh bold
  studentBoxTitleItalic?: boolean;// Tiêu đề khung thí sinh italic
  studentBoxLabelBold?: boolean; // Nhãn thông tin thí sinh bold
  studentBoxLabelItalic?: boolean;// Nhãn thông tin thí sinh italic
  studentBoxValueBold?: boolean; // Giá trị thông tin thí sinh bold
  studentBoxValueItalic?: boolean;// Giá trị thông tin thí sinh italic

  scoreBoxTitleBold?: boolean;   // Tiêu đề khung điểm số bold
  scoreBoxTitleItalic?: boolean; // Tiêu đề khung điểm số italic
  instructionsBold?: boolean;    // Chữ hướng dẫn bold
  instructionsItalic?: boolean;  // Chữ hướng dẫn italic

  // Footer Customization
  showFooter?: boolean;          // Bật/tắt footer (mặc định true)
  footerText?: string;           // Nội dung chính chân trang
  footerSecondaryText?: string;  // Nội dung phụ chân trang (bản quyền, số trang, ...)
  footerAlign?: 'center' | 'left' | 'right' | 'split'; // Căn lề chân trang
  footerBold?: boolean;          // In đậm chân trang
  footerItalic?: boolean;        // In nghiêng chân trang
  footerFontSize?: number;       // Kích cỡ font chân trang (px, 10-24, mặc định 14)
  footerTextColor?: string;      // Màu chữ chân trang (mặc định theo textColor)
  footerYOffset?: number;        // Độ lệch dọc / vị trí chân trang
  showFooterDivider?: boolean;   // Đường kẻ phân cách mỏng phía trên chân trang
  showFooterPageNumber?: boolean;// Hiển thị nhãn số trang (Trang 1/1)

  // SBD & Exam Code Custom Titles & Fill Settings
  sbdTitle?: string;
  examCodeTitle?: string;
  leaveExamCodeBlankForStudent?: boolean; // Whether exam code write-in boxes are kept blank for student to fill in
  showExamCodeWriteInBoxes?: boolean;     // Whether to show blank write-in boxes
  examCodeOnlyWriteIn?: boolean;          // If true, student writes in box without bubble matrix
  
  showStudentInfoBox?: boolean;
  showExamInfoBox?: boolean;
  showStudentSignature?: boolean;
  showStudentIdBubbles?: boolean;
  numStudentIdDigits?: number; // 2..10 (default 6)
  showExamCodeBubbles?: boolean;
  numExamCodeDigits?: number;  // 2..6 (default 3)
  showQrCode?: boolean;
  showAnchorMarks?: boolean;
  direction?: 'column_first' | 'row_first';
  bubbleStyle?: 'circle_letter' | 'circle_empty' | 'square_letter';
  headerLayout?: 'standard' | 'compact' | 'split_box';
  sbdXOffset?: number;
  sbdYOffset?: number;
  codeXOffset?: number;
  codeYOffset?: number;
  instructionsYOffset?: number;
  questionGridYStart?: number;
  questionGridYEnd?: number;
  questionGridXStart?: number;
  questionGridXEnd?: number;
}

export interface AnswerSheetTemplate {
  id: string;
  name: string;
  schoolName: string;
  version: string;
  paperSize: 'A4' | 'A5' | 'Letter';
  numQuestions: number;
  numOptions: number;      // 4 for A-D, 5 for A-E
  numIdDigits?: number;    // E.g. 6 digits for student ID
  numExamCodeDigits?: number; // E.g. 3 digits for exam code
  hasStudentIdBubbles?: boolean;
  hasExamCodeBubbles?: boolean;
  hasQrCode: boolean;
  hasAnchorMarks: boolean;
  zones: RecognitionZone[];
  layoutConfig?: CustomTemplateLayoutConfig;
  backgroundImageUrl?: string; // Optional custom imported school template image
  fillThreshold: number;       // Default fill threshold (e.g. 0.35)
  uncertainThreshold: number;  // Threshold between empty & uncertain (e.g. 0.18)
  columnsCount: number;        // Visual layout column count
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isSystemDefault?: boolean;
}

export interface QuestionConfig {
  questionNumber: number;
  correctAnswer: BubbleOption;
  points: number;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface ExamVariant {
  id: string;
  code: string;                      // e.g. "101", "102", "103", "104"
  title?: string;
  questions: QuestionConfig[];
  answerKeyMap?: Record<number, BubbleOption>;
  description?: string;
}

export interface Exam {
  id: string;
  code: string;
  title: string;
  subject: string;
  grade: string;
  className: string;
  academicYear: string;
  semester: string;
  examType: 'midterm' | 'final' | 'quiz' | 'mock' | 'regular';
  examDate: string;
  durationMinutes: number;
  teacherName: string;
  numQuestions: number;
  numOptions: number;
  maxScore: number;
  passingScore: number;
  decimalPrecision: 0 | 1 | 2;
  templateId: string;
  questions: QuestionConfig[];       // Default / Primary answer key
  variants?: ExamVariant[];          // List of multi-code variants (e.g. 101, 102, 103, 104)
  defaultVariantCode?: string;       // Primary variant code (e.g. "101")
  instructions?: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  // Creator and School Sharing
  createdById?: string;
  createdByUsername?: string;
  createdByFullName?: string;
  createdByRole?: UserRole;
  isSharedWithAllTeachers?: boolean;
  targetScope?: 'school_wide' | 'grade_wide' | 'class_only';
}

export interface Student {
  id: string;
  studentId: string;
  name: string;
  className: string;
  grade: string;
  gender?: 'male' | 'female' | 'other';
  email?: string;
  parentEmail?: string;
  avatarUrl?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  grade: string;
  academicYear: string;
  homeroomTeacher?: string;
  totalStudents: number;
}

export type SubmissionStatus = 
  | 'READY'
  | 'PROCESSING'
  | 'GRADED'
  | 'NEEDS_REVIEW'
  | 'MULTIPLE_ANSWERS'
  | 'LOW_CONFIDENCE'
  | 'STUDENT_NOT_FOUND'
  | 'INVALID_TEMPLATE'
  | 'INVALID_IMAGE';

export type AnswerStatus = 'CORRECT' | 'WRONG' | 'BLANK' | 'MULTIPLE' | 'UNCERTAIN' | 'MANUALLY_OVERRIDDEN';

export interface RecognizedAnswer {
  questionNumber: number;
  selectedOption: BubbleOption | null; // null if blank or invalid
  selectedOptions?: BubbleOption[];    // if multiple detected
  fillRatios: Record<string, number>;  // e.g. { A: 0.05, B: 0.82, C: 0.02, D: 0.04 }
  confidence: number;                  // 0 - 100
  isCorrect: boolean;
  status: AnswerStatus;
  correctAnswer: BubbleOption;
  pointsEarned: number;
  maxPoints: number;
  cropImageUrl?: string;               // Base64 snippet of the bubble area
  isManuallyCorrected?: boolean;
  originalOmrAnswer?: BubbleOption | null;
  teacherNote?: string;
}

export interface AuditLog {
  id: string;
  submissionId: string;
  questionNumber?: number;
  action: string;
  previousValue?: string;
  newValue: string;
  changedBy: string;
  timestamp: string;
  reason?: string;
}

export interface ImageQualityMetrics {
  blurScore: number;
  isSharp: boolean;
  brightnessScore: number;
  isWellLit: boolean;
  anchorsDetectedCount: number;
  rotationDetectedDeg: number;
  isPerspectiveCorrected: boolean;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  studentId?: string;
  studentName?: string;
  className?: string;
  detectedExamCode?: string;          // Mã đề nhận diện được từ ô tô mã đề
  appliedVariantCode?: string;         // Mã đề áp dụng để đối chiếu đáp án chấm điểm
  matchedVariantTitle?: string;        // Tên mô tả mã đề
  studentIdConfidence?: number;        // 0 - 100
  examCodeConfidence?: number;         // 0 - 100
  studentIdCropUrl?: string;           // Ảnh crop khu vực SBD
  examCodeCropUrl?: string;            // Ảnh crop khu vực Mã đề
  studentIdStatus?: 'VALID' | 'UNCERTAIN' | 'MULTIPLE' | 'BLANK' | 'NOT_FOUND';
  examCodeStatus?: 'VALID' | 'UNCERTAIN' | 'MULTIPLE' | 'BLANK' | 'MISMATCH';
  originalStudentId?: string;
  originalExamCode?: string;
  isStudentIdManuallyCorrected?: boolean;
  isExamCodeManuallyCorrected?: boolean;
  qualityMetrics?: ImageQualityMetrics;
  scannedImageUrl: string;
  processedImageUrl?: string;
  scanDate: string;
  status: SubmissionStatus;
  totalScore: number;
  maxScore: number;
  totalCorrect: number;
  totalWrong: number;
  totalBlank: number;
  totalMultiple: number;
  totalUncertain: number;
  overallConfidence: number; // 0 - 100
  recognizedAnswers: RecognizedAnswer[];
  auditLogs: AuditLog[];
  needsReviewReason?: string;
  notes?: string;
}

export interface QuestionAnalytics {
  questionNumber: number;
  correctAnswer: BubbleOption;
  totalResponses: number;
  correctCount: number;
  correctPercentage: number;
  distractorCounts: Record<string, number>; // { A: 12, B: 3, C: 20, D: 1, blank: 2 }
  difficultyIndex: number; // 0.0 - 1.0 (proportion correct)
  discriminationIndex?: number;
  difficultyLabel: 'easy' | 'medium' | 'hard';
  mostCommonDistractor?: BubbleOption;
}

export interface ExamStatistics {
  totalSubmissions: number;
  gradedCount: number;
  needsReviewCount: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  medianScore: number;
  standardDeviation: number;
  passCount: number;
  passRate: number;
  scoreDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  questionAnalytics: QuestionAnalytics[];
}
