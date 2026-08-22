import QRCode from 'qrcode';
import { AnswerSheetTemplate, BubbleOption, RecognitionZone, Student, CustomTemplateLayoutConfig } from '../types';

export interface GridConfigOptions {
  direction?: 'column_first' | 'row_first';
  startQuestion?: number;
  yStart?: number;
  yEnd?: number;
  xStart?: number;
  xEnd?: number;
  includeAnchors?: boolean;
  includeQr?: boolean;
}

export interface DirectDesignerConfig {
  id?: string;
  name?: string;
  showSchoolName?: boolean;
  schoolName: string;
  showDepartmentName?: boolean;
  departmentName?: string;
  showExamTitle?: boolean;
  examTitle: string;
  showSubjectName?: boolean;
  subjectName?: string;
  showDurationMinutes?: boolean;
  durationMinutes?: number;
  showExamDate?: boolean;
  examDate?: string;
  showExamClass?: boolean;
  examClass?: string;
  showRoomNumber?: boolean;
  roomNumber?: string;
  showStudentName?: boolean;
  showStudentDob?: boolean;
  showStudentSignature?: boolean;
  customFields?: { id: string; label: string; value?: string }[];
  paperSize: 'A4' | 'A5' | 'Letter';
  numQuestions: number;
  numOptions: number;
  columnsCount: number;
  direction: 'column_first' | 'row_first';
  hasStudentIdBubbles: boolean;
  numStudentIdDigits: number; // e.g. 6
  hasExamCodeBubbles: boolean;
  numExamCodeDigits: number;  // e.g. 3
  hasQrCode: boolean;
  hasAnchorMarks: boolean;
  showStudentInfoBox: boolean;
  showTeacherScoreBox: boolean;
  showInstructionsBox: boolean;
  instructionsText?: string;
}

/**
 * High-Precision Direct Designer Template & Zone Generator:
 * Generates exact RecognitionZone coordinates for:
 * 1. Question Answer Bubbles (A, B, C, D...) with tight spacing & column framing
 * 2. Student ID (SBD) spacious write-in & compact bubble grid (0-9)
 * 3. Exam Code (Mã Đề) spacious write-in & compact bubble grid (0-9)
 * 4. QR Code identifier zone
 * 5. Optical Corner Anchor Marks
 */
export function generateDirectTemplateZonesAndData(config: DirectDesignerConfig): {
  template: AnswerSheetTemplate;
  zones: RecognitionZone[];
} {
  const zones: RecognitionZone[] = [];
  const options: BubbleOption[] = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, config.numOptions) as BubbleOption[];

  // 1. Add Corner Anchors
  if (config.hasAnchorMarks !== false) {
    zones.push(
      { id: 'anchor_tl', type: 'anchor_mark', x: 0.02, y: 0.015, width: 0.035, height: 0.022, label: 'Top-Left' },
      { id: 'anchor_tr', type: 'anchor_mark', x: 0.945, y: 0.015, width: 0.035, height: 0.022, label: 'Top-Right' },
      { id: 'anchor_bl', type: 'anchor_mark', x: 0.02, y: 0.965, width: 0.035, height: 0.022, label: 'Bottom-Left' },
      { id: 'anchor_br', type: 'anchor_mark', x: 0.945, y: 0.965, width: 0.035, height: 0.022, label: 'Bottom-Right' }
    );
  }

  // 2. Compute Header Layout & Space allocation
  let headerBottomY = 0.23;
  if (config.hasStudentIdBubbles || config.hasExamCodeBubbles) {
    headerBottomY = 0.30;
  }
  if (config.showTeacherScoreBox) {
    headerBottomY = Math.max(headerBottomY, 0.31);
  }

  // Right column X layout (Allocated from 0.52 to 0.945)
  let currentRightX = 0.53;
  const rightTotalWidth = 0.945 - currentRightX;

  // Count active right column components
  const rightSections: ('sbd' | 'code' | 'qr')[] = [];
  if (config.hasStudentIdBubbles) rightSections.push('sbd');
  if (config.hasExamCodeBubbles) rightSections.push('code');
  if (config.hasQrCode) rightSections.push('qr');

  if (rightSections.length > 0) {
    const sbdWeight = config.hasStudentIdBubbles ? Math.max(1.1, config.numStudentIdDigits * 0.20) : 0;
    const codeWeight = config.hasExamCodeBubbles ? Math.max(0.75, config.numExamCodeDigits * 0.22) : 0;
    const qrWeight = config.hasQrCode ? 1.0 : 0;
    const totalWeight = sbdWeight + codeWeight + qrWeight;

    // A. Generate Student ID (SBD) Bubble Matrix Zones (Compact bubbles, spacious write-in)
    if (config.hasStudentIdBubbles) {
      const sbdWidth = (sbdWeight / totalWeight) * rightTotalWidth;
      const sbdX = currentRightX;
      const sbdY = 0.045;
      const sbdH = 0.25;

      const numDigits = config.numStudentIdDigits || 6;
      const colW = sbdWidth / numDigits;
      const digitBoxH = 0.033;
      const bubbleAreaStartY = sbdY + digitBoxH + 0.022;
      const bubbleAreaH = sbdH - digitBoxH - 0.026;
      const rowStep = bubbleAreaH / 10;
      const bubbleSize = Math.min(colW * 0.80, rowStep * 0.88);

      for (let col = 0; col < numDigits; col++) {
        const colCenterX = sbdX + (col + 0.5) * colW;
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

      currentRightX += sbdWidth + 0.015;
    }

    // B. Generate Exam Code (Mã Đề) Bubble Matrix Zones (Compact bubbles, spacious write-in)
    if (config.hasExamCodeBubbles) {
      const codeWidth = (codeWeight / totalWeight) * rightTotalWidth;
      const codeX = currentRightX;
      const codeY = 0.045;
      const codeH = 0.25;

      const numDigits = config.numExamCodeDigits || 3;
      const colW = codeWidth / numDigits;
      const digitBoxH = 0.033;
      const bubbleAreaStartY = codeY + digitBoxH + 0.022;
      const bubbleAreaH = codeH - digitBoxH - 0.026;
      const rowStep = bubbleAreaH / 10;
      const bubbleSize = Math.min(colW * 0.80, rowStep * 0.88);

      for (let col = 0; col < numDigits; col++) {
        const colCenterX = codeX + (col + 0.5) * colW;
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

      currentRightX += codeWidth + 0.015;
    }

    // C. Generate QR Code Zone
    if (config.hasQrCode) {
      const qrW = 0.14;
      const qrH = 0.12;
      zones.push({
        id: 'zone_qr_code',
        type: 'student_id_qr',
        x: Number((0.945 - qrW).toFixed(4)),
        y: 0.045,
        width: qrW,
        height: qrH,
        label: 'QR Code ID'
      });
    }
  }

  // 3. Instruction & Question Matrix Vertical Placement (Column Framed & Tight Options)
  const gridYStart = headerBottomY + (config.showInstructionsBox ? 0.042 : 0.018);
  const gridYEnd = 0.96;
  const gridXStart = 0.045;
  const gridXEnd = 0.955;

  const totalGridW = gridXEnd - gridXStart;
  const totalGridH = gridYEnd - gridYStart;
  const columnsCount = config.columnsCount || (config.numQuestions >= 60 ? 4 : config.numQuestions <= 25 ? 1 : 2);
  const colWidth = totalGridW / columnsCount;
  const questionsPerCol = Math.ceil(config.numQuestions / columnsCount);
  
  // Header title tab inside column frame takes ~0.024 height
  const colHeaderOffset = 0.024;
  const rowHeight = (totalGridH - colHeaderOffset) / (questionsPerCol + 0.3);

  // Compact, tight bubble dimensions
  const bubbleWidth = Math.min(0.022, colWidth * 0.13);
  const bubbleHeight = bubbleWidth * 1.25;
  const optSpacing = bubbleWidth * 1.38; // Tightly spaced options A-D right next to each other

  let qIndex = 1;

  if (config.direction === 'column_first') {
    for (let c = 0; c < columnsCount; c++) {
      const colX = gridXStart + c * colWidth;
      const startOptX = colX + colWidth * 0.28;

      for (let r = 0; r < questionsPerCol; r++) {
        if (qIndex > config.numQuestions) break;
        const currentQ = qIndex;
        const startY = gridYStart + colHeaderOffset + (r + 0.45) * rowHeight;

        options.forEach((opt, optIdx) => {
          const bubbleX = startOptX + optIdx * optSpacing;
          zones.push({
            id: `zone_q${currentQ}_${opt}`,
            type: 'bubble',
            questionNumber: currentQ,
            option: opt,
            x: Number(bubbleX.toFixed(4)),
            y: Number(startY.toFixed(4)),
            width: Number(bubbleWidth.toFixed(4)),
            height: Number(bubbleHeight.toFixed(4)),
            label: `Q${currentQ}-${opt}`
          });
        });

        qIndex++;
      }
    }
  } else {
    for (let r = 0; r < questionsPerCol; r++) {
      for (let c = 0; c < columnsCount; c++) {
        if (qIndex > config.numQuestions) break;
        const currentQ = qIndex;
        const colX = gridXStart + c * colWidth;
        const startY = gridYStart + colHeaderOffset + (r + 0.45) * rowHeight;
        const startOptX = colX + colWidth * 0.28;

        options.forEach((opt, optIdx) => {
          const bubbleX = startOptX + optIdx * optSpacing;
          zones.push({
            id: `zone_q${currentQ}_${opt}`,
            type: 'bubble',
            questionNumber: currentQ,
            option: opt,
            x: Number(bubbleX.toFixed(4)),
            y: Number(startY.toFixed(4)),
            width: Number(bubbleWidth.toFixed(4)),
            height: Number(bubbleHeight.toFixed(4)),
            label: `Q${currentQ}-${opt}`
          });
        });

        qIndex++;
      }
    }
  }

  const templateId = config.id || `tpl_direct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const templateName = config.name || `Phiếu ${config.numQuestions} câu - ${config.schoolName}`;

  const layoutConfig: CustomTemplateLayoutConfig = {
    showSchoolName: config.showSchoolName !== false,
    schoolName: config.schoolName,
    showDepartmentName: config.showDepartmentName !== false,
    departmentName: config.departmentName,
    showExamTitle: config.showExamTitle !== false,
    examTitle: config.examTitle,
    showSubjectName: config.showSubjectName !== false,
    subjectName: config.subjectName,
    showDurationMinutes: config.showDurationMinutes !== false,
    durationMinutes: config.durationMinutes,
    showExamDate: config.showExamDate !== false,
    examDate: config.examDate,
    showExamClass: config.showExamClass !== false,
    examClass: config.examClass,
    showRoomNumber: config.showRoomNumber !== false,
    roomNumber: config.roomNumber,
    showStudentName: config.showStudentName !== false,
    showStudentDob: config.showStudentDob !== false,
    showStudentSignature: config.showStudentSignature !== false,
    customFields: config.customFields || [],
    instructionsText: config.instructionsText,
    showStudentInfoBox: config.showStudentInfoBox,
    showExamInfoBox: true,
    showTeacherScoreBox: config.showTeacherScoreBox,
    showInstructionsBox: config.showInstructionsBox,
    showStudentIdBubbles: config.hasStudentIdBubbles,
    numStudentIdDigits: config.numStudentIdDigits,
    showExamCodeBubbles: config.hasExamCodeBubbles,
    numExamCodeDigits: config.numExamCodeDigits,
    showQrCode: config.hasQrCode,
    showAnchorMarks: config.hasAnchorMarks,
    direction: config.direction
  };

  const template: AnswerSheetTemplate = {
    id: templateId,
    name: templateName,
    schoolName: config.schoolName,
    version: '1.0',
    paperSize: config.paperSize,
    numQuestions: config.numQuestions,
    numOptions: config.numOptions,
    numIdDigits: config.numStudentIdDigits,
    numExamCodeDigits: config.numExamCodeDigits,
    hasStudentIdBubbles: config.hasStudentIdBubbles,
    hasExamCodeBubbles: config.hasExamCodeBubbles,
    hasQrCode: config.hasQrCode,
    hasAnchorMarks: config.hasAnchorMarks,
    zones,
    layoutConfig,
    fillThreshold: 0.35,
    uncertainThreshold: 0.18,
    columnsCount: config.columnsCount,
    createdBy: 'Giáo viên',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSystemDefault: false
  };

  return { template, zones };
}

/**
 * Generates an automatic grid of recognition zones for a template
 * E.g., 40 questions x 4 choices (A, B, C, D) organized in 2 or 4 neat columns.
 */
export function generateAutoGridZones(
  numQuestions = 40,
  numOptions = 4,
  columnsCount = 2,
  config?: GridConfigOptions
): RecognitionZone[] {
  const zones: RecognitionZone[] = [];
  const options: BubbleOption[] = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, numOptions) as BubbleOption[];

  // Normalized dimensions
  const headerHeight = config?.yStart ?? 0.28; // Space for header, school info, student ID, instructions
  const bottomLimit = config?.yEnd ?? 0.95;
  const leftLimit = config?.xStart ?? 0.06;
  const rightLimit = config?.xEnd ?? 0.94;
  const direction = config?.direction ?? 'column_first';
  const startQ = config?.startQuestion ?? 1;

  const availableWidth = rightLimit - leftLimit;
  const availableHeight = bottomLimit - headerHeight;

  const colWidth = availableWidth / columnsCount;
  const questionsPerCol = Math.ceil(numQuestions / columnsCount);
  const rowHeight = availableHeight / (questionsPerCol + 0.3);

  const bubbleWidth = Math.min(0.024, (colWidth / (numOptions + 1.5)));
  const bubbleHeight = bubbleWidth * 1.32;

  let qCount = startQ;

  if (direction === 'column_first') {
    // Column-first layout (Standard: Col 1 has Q1..20, Col 2 has Q21..40)
    for (let c = 0; c < columnsCount; c++) {
      const colX = leftLimit + c * colWidth;
      for (let r = 0; r < questionsPerCol; r++) {
        if (qCount > startQ + numQuestions - 1) break;
        const currentQ = qCount;
        const startY = headerHeight + (r + 0.4) * rowHeight;

        // Spread options evenly in the column
        const optAreaWidth = colWidth * 0.76;
        const optSpacing = optAreaWidth / Math.max(1, numOptions - 1);
        const startOptX = colX + colWidth * 0.18;

        options.forEach((opt, optIdx) => {
          const bubbleX = startOptX + optIdx * optSpacing;
          zones.push({
            id: `zone_q${currentQ}_${opt}`,
            type: 'bubble',
            questionNumber: currentQ,
            option: opt,
            x: Number(bubbleX.toFixed(4)),
            y: Number(startY.toFixed(4)),
            width: Number(bubbleWidth.toFixed(4)),
            height: Number(bubbleHeight.toFixed(4)),
            label: `Q${currentQ}-${opt}`
          });
        });

        qCount++;
      }
    }
  } else {
    // Row-first layout (Q1, Q2 across columns)
    for (let r = 0; r < questionsPerCol; r++) {
      const startY = headerHeight + (r + 0.4) * rowHeight;
      for (let c = 0; c < columnsCount; c++) {
        if (qCount > startQ + numQuestions - 1) break;
        const currentQ = qCount;
        const colX = leftLimit + c * colWidth;
        const optAreaWidth = colWidth * 0.76;
        const optSpacing = optAreaWidth / Math.max(1, numOptions - 1);
        const startOptX = colX + colWidth * 0.18;

        options.forEach((opt, optIdx) => {
          const bubbleX = startOptX + optIdx * optSpacing;
          zones.push({
            id: `zone_q${currentQ}_${opt}`,
            type: 'bubble',
            questionNumber: currentQ,
            option: opt,
            x: Number(bubbleX.toFixed(4)),
            y: Number(startY.toFixed(4)),
            width: Number(bubbleWidth.toFixed(4)),
            height: Number(bubbleHeight.toFixed(4)),
            label: `Q${currentQ}-${opt}`
          });
        });

        qCount++;
      }
    }
  }

  // Add standard Anchor markers at 4 corners if requested
  if (config?.includeAnchors !== false) {
    zones.push(
      { id: 'anchor_tl', type: 'anchor_mark', x: 0.02, y: 0.02, width: 0.03, height: 0.025, label: 'Top-Left' },
      { id: 'anchor_tr', type: 'anchor_mark', x: 0.95, y: 0.02, width: 0.03, height: 0.025, label: 'Top-Right' },
      { id: 'anchor_bl', type: 'anchor_mark', x: 0.02, y: 0.96, width: 0.03, height: 0.025, label: 'Bottom-Left' },
      { id: 'anchor_br', type: 'anchor_mark', x: 0.95, y: 0.96, width: 0.03, height: 0.025, label: 'Bottom-Right' }
    );
  }

  // Add QR Code zone in top right if requested
  if (config?.includeQr !== false) {
    zones.push({
      id: 'zone_qr_code',
      type: 'student_id_qr',
      x: 0.76,
      y: 0.05,
      width: 0.18,
      height: 0.14,
      label: 'QR Code ID'
    });
  }

  return zones;
}

/**
 * Rebuilds / Regenerates SBD (Student ID) zones with updated columns count or coordinates
 */
export function rebuildSbdZones(
  currentZones: RecognitionZone[],
  numDigits: number,
  sbdX: number = 0.53,
  sbdY: number = 0.045,
  sbdWidth: number = 0.20,
  sbdH: number = 0.25
): RecognitionZone[] {
  const filtered = currentZones.filter(z => z.type !== 'student_id_bubble');
  if (numDigits <= 0) return filtered;

  const colW = sbdWidth / numDigits;
  const digitBoxH = 0.033;
  const bubbleAreaStartY = sbdY + digitBoxH + 0.022;
  const bubbleAreaH = sbdH - digitBoxH - 0.026;
  const rowStep = bubbleAreaH / 10;
  const bubbleSize = Math.min(colW * 0.80, rowStep * 0.88);

  const newSbdZones: RecognitionZone[] = [];
  for (let col = 0; col < numDigits; col++) {
    const colCenterX = sbdX + (col + 0.5) * colW;
    for (let val = 0; val <= 9; val++) {
      const rowCenterY = bubbleAreaStartY + (val + 0.5) * rowStep;
      newSbdZones.push({
        id: `zone_sbd_col${col}_val${val}_${Date.now()}`,
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

  return [...filtered, ...newSbdZones];
}

/**
 * Rebuilds / Regenerates Exam Code (Mã Đề) zones with updated columns count or coordinates
 */
export function rebuildExamCodeZones(
  currentZones: RecognitionZone[],
  numDigits: number,
  codeX: number = 0.74,
  codeY: number = 0.045,
  codeWidth: number = 0.12,
  codeH: number = 0.25
): RecognitionZone[] {
  const filtered = currentZones.filter(z => z.type !== 'exam_code_bubble');
  if (numDigits <= 0) return filtered;

  const colW = codeWidth / numDigits;
  const digitBoxH = 0.033;
  const bubbleAreaStartY = codeY + digitBoxH + 0.022;
  const bubbleAreaH = codeH - digitBoxH - 0.026;
  const rowStep = bubbleAreaH / 10;
  const bubbleSize = Math.min(colW * 0.80, rowStep * 0.88);

  const newCodeZones: RecognitionZone[] = [];
  for (let col = 0; col < numDigits; col++) {
    const colCenterX = codeX + (col + 0.5) * colW;
    for (let val = 0; val <= 9; val++) {
      const rowCenterY = bubbleAreaStartY + (val + 0.5) * rowStep;
      newCodeZones.push({
        id: `zone_code_col${col}_val${val}_${Date.now()}`,
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

  return [...filtered, ...newCodeZones];
}

/**
 * Rebuilds / Regenerates Question Answer Bubbles matrix
 */
export function rebuildQuestionMatrixZones(
  currentZones: RecognitionZone[],
  numQuestions: number,
  numOptions: number,
  columnsCount: number,
  direction: 'column_first' | 'row_first' = 'column_first',
  yStart: number = 0.32,
  yEnd: number = 0.96,
  xStart: number = 0.045,
  xEnd: number = 0.955
): RecognitionZone[] {
  const filtered = currentZones.filter(z => z.type !== 'bubble');
  const options: BubbleOption[] = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, numOptions) as BubbleOption[];

  const totalGridW = xEnd - xStart;
  const totalGridH = yEnd - yStart;
  const colWidth = totalGridW / columnsCount;
  const questionsPerCol = Math.ceil(numQuestions / columnsCount);
  const colHeaderOffset = 0.024;
  const rowHeight = (totalGridH - colHeaderOffset) / (questionsPerCol + 0.3);

  const bubbleWidth = Math.min(0.022, colWidth * 0.13);
  const bubbleHeight = bubbleWidth * 1.25;
  const optSpacing = bubbleWidth * 1.38;

  let qIndex = 1;
  const newBubbleZones: RecognitionZone[] = [];

  if (direction === 'column_first') {
    for (let c = 0; c < columnsCount; c++) {
      const colX = xStart + c * colWidth;
      const startOptX = colX + colWidth * 0.28;

      for (let r = 0; r < questionsPerCol; r++) {
        if (qIndex > numQuestions) break;
        const currentQ = qIndex;
        const startY = yStart + colHeaderOffset + (r + 0.45) * rowHeight;

        options.forEach((opt, optIdx) => {
          const bubbleX = startOptX + optIdx * optSpacing;
          newBubbleZones.push({
            id: `zone_q${currentQ}_${opt}`,
            type: 'bubble',
            questionNumber: currentQ,
            option: opt,
            x: Number(bubbleX.toFixed(4)),
            y: Number(startY.toFixed(4)),
            width: Number(bubbleWidth.toFixed(4)),
            height: Number(bubbleHeight.toFixed(4)),
            label: `Q${currentQ}-${opt}`
          });
        });

        qIndex++;
      }
    }
  } else {
    for (let r = 0; r < questionsPerCol; r++) {
      for (let c = 0; c < columnsCount; c++) {
        if (qIndex > numQuestions) break;
        const currentQ = qIndex;
        const colX = xStart + c * colWidth;
        const startY = yStart + colHeaderOffset + (r + 0.45) * rowHeight;
        const startOptX = colX + colWidth * 0.28;

        options.forEach((opt, optIdx) => {
          const bubbleX = startOptX + optIdx * optSpacing;
          newBubbleZones.push({
            id: `zone_q${currentQ}_${opt}`,
            type: 'bubble',
            questionNumber: currentQ,
            option: opt,
            x: Number(bubbleX.toFixed(4)),
            y: Number(startY.toFixed(4)),
            width: Number(bubbleWidth.toFixed(4)),
            height: Number(bubbleHeight.toFixed(4)),
            label: `Q${currentQ}-${opt}`
          });
        });

        qIndex++;
      }
    }
  }

  return [...filtered, ...newBubbleZones];
}

export interface TemplateRealStats {
  numQuestions: number;
  numOptions: number;
  columnsCount: number;
  questionsPerColumn: number;
  optionLabels: string;
}

/**
 * Accurately analyzes recognition zones to derive mathematical parameters
 * (numQuestions, numOptions, columnsCount, questionsPerColumn)
 */
export function getTemplateRealStats(template: AnswerSheetTemplate): TemplateRealStats {
  const bubbleZones = (template.zones || []).filter(z => z.type === 'bubble');

  if (bubbleZones.length === 0) {
    const qCount = template.numQuestions || 40;
    const optCount = template.numOptions || 4;
    const colCount = template.columnsCount || (qCount >= 60 ? 4 : qCount <= 25 ? 1 : 2);
    return {
      numQuestions: qCount,
      numOptions: optCount,
      columnsCount: colCount,
      questionsPerColumn: Math.ceil(qCount / colCount),
      optionLabels: optCount === 4 ? 'A, B, C, D' : optCount === 5 ? 'A-E' : `A-${String.fromCharCode(64 + optCount)}`
    };
  }

  const questionSet = new Set<number>();
  const optionSet = new Set<string>();

  bubbleZones.forEach(z => {
    if (typeof z.questionNumber === 'number' && z.questionNumber > 0) {
      questionSet.add(z.questionNumber);
    }
    if (z.option) {
      optionSet.add(z.option);
    }
  });

  const numQuestions = questionSet.size > 0 ? questionSet.size : (template.numQuestions || 40);
  const numOptions = optionSet.size > 0 ? optionSet.size : (template.numOptions || 4);

  // Determine actual columns count
  let columnsCount = template.columnsCount;
  if (!columnsCount || columnsCount < 1) {
    if (numQuestions >= 60) columnsCount = 4;
    else if (numQuestions <= 25) columnsCount = 1;
    else columnsCount = 2;
  }

  const questionsPerCol = Math.ceil(numQuestions / columnsCount);
  const optionLetters = Array.from(optionSet).sort();
  const optionLabels = optionLetters.length === 4 && optionLetters.join('') === 'ABCD'
    ? 'A, B, C, D'
    : optionLetters.length > 0
    ? `${optionLetters[0]}-${optionLetters[optionLetters.length - 1]}`
    : 'A, B, C, D';

  return {
    numQuestions,
    numOptions,
    columnsCount,
    questionsPerColumn: questionsPerCol,
    optionLabels
  };
}

/**
 * Creates a clean default preset template
 */
export function createDefaultTemplate(
  id: string,
  name: string,
  numQuestions = 40,
  numOptions = 4,
  schoolName = 'FPT SCHOOLS',
  customColumnsCount?: number
): AnswerSheetTemplate {
  const cols = customColumnsCount ?? (numQuestions >= 60 ? 4 : numQuestions <= 25 ? 1 : 2);
  const zones = generateAutoGridZones(numQuestions, numOptions, cols);

  return {
    id,
    name,
    schoolName,
    version: '1.0',
    paperSize: 'A4',
    numQuestions,
    numOptions,
    numIdDigits: 6,
    numExamCodeDigits: 3,
    hasStudentIdBubbles: true,
    hasExamCodeBubbles: true,
    hasQrCode: true,
    hasAnchorMarks: true,
    zones,
    fillThreshold: 0.35,
    uncertainThreshold: 0.18,
    columnsCount: cols,
    createdBy: 'System',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSystemDefault: true
  };
}

/**
 * Renders a full printable canvas / image for an Answer Sheet Template
 * Can be pre-filled with student info & QR code or blank.
 */
export async function renderTemplateToCanvas(
  template: AnswerSheetTemplate,
  student?: Student,
  examCode?: string,
  examTitle?: string,
  width = 1600,
  height = 2260
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. If this template was created from an uploaded PDF or image file,
  // preserve 100% of the original content, exam questions, headers, and school title!
  if (template.backgroundImageUrl) {
    try {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        bgImg.onload = () => resolve();
        bgImg.onerror = () => resolve(); // fallback gracefully
        bgImg.src = template.backgroundImageUrl!;
      });

      // Preserve natural aspect ratio if image has real dimensions
      if (bgImg.width > 0 && bgImg.height > 0) {
        const naturalH = Math.round(width * (bgImg.height / bgImg.width));
        canvas.height = naturalH;
        height = naturalH;
      }

      // Clear with white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Draw the original uploaded document page with high crisp quality
      ctx.drawImage(bgImg, 0, 0, width, height);

      // If personalized student printing with QR is requested
      if (student && template.hasQrCode) {
        const qrZone = template.zones.find(z => z.type === 'student_id_qr');
        if (qrZone) {
          const qrPayload = JSON.stringify({
            sId: student.studentId,
            sName: student.name,
            cls: student.className,
            eCode: examCode || '101',
            tId: template.id
          });
          const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 220 });
          const qrImg = new Image();
          await new Promise<void>(r => {
            qrImg.onload = () => r();
            qrImg.onerror = () => r();
            qrImg.src = qrDataUrl;
          });
          const qrX = qrZone.x * width;
          const qrY = qrZone.y * height;
          const qrW = qrZone.width * width;
          const qrH = qrZone.height * height;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(qrX, qrY, qrW, qrH);
          ctx.drawImage(qrImg, qrX, qrY, qrW, qrH);
        }
      }

      return canvas;
    } catch (err) {
      console.warn('Error drawing background image in renderTemplateToCanvas, falling back to synthetic layout', err);
    }
  }

  // 2. High-Definition Synthetic Educational Layout
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // A. Draw Corner Anchor Marks (Black solid rectangles for optical scanner registration)
  const showAnchors = (template.hasAnchorMarks !== false) && (template.layoutConfig?.showAnchorMarks !== false);
  const anchorZones = template.zones.filter(z => z.type === 'anchor_mark');
  ctx.fillStyle = '#111827';
  if (showAnchors) {
    if (anchorZones.length > 0) {
      anchorZones.forEach(az => {
        ctx.fillRect(az.x * width, az.y * height, az.width * width, az.height * height);
      });
    } else {
      const aW = width * 0.035;
      const aH = height * 0.022;
      ctx.fillRect(width * 0.02, height * 0.015, aW, aH);
      ctx.fillRect(width * 0.945, height * 0.015, aW, aH);
      ctx.fillRect(width * 0.02, height * 0.965, aW, aH);
      ctx.fillRect(width * 0.945, height * 0.965, aW, aH);
    }
  }

  const layout = template.layoutConfig;
  const bubbleColor = layout?.bubbleColor || '#000000';
  const bubbleFillColor = layout?.bubbleFillColor || '#FFFFFF';
  const frameBorderColor = layout?.frameBorderColor || '#000000';
  const headerBannerColor = layout?.headerBannerColor || '#000000';
  const headerBannerTextColor = layout?.headerBannerTextColor || '#FFFFFF';

  // Typography helper
  const makeFont = (isBold: boolean = false, isItalic: boolean = false, size: number = 16, family: string = 'sans-serif') => {
    const styleStr = isItalic ? 'italic ' : '';
    const weightStr = isBold ? 'bold ' : 'normal ';
    return `${styleStr}${weightStr}${size}px ${family}`;
  };

  const globalTextColor = layout?.textColor || '#000000';
  const headerTextColor = layout?.headerTextColor || globalTextColor;
  const studentBoxTextColor = layout?.studentBoxTextColor || globalTextColor;
  const scoreBoxTextColor = layout?.scoreBoxTextColor || globalTextColor;
  const instructionsTextColor = layout?.instructionsTextColor || globalTextColor;

  const sbdZones = template.zones.filter(z => z.type === 'student_id_bubble');
  const codeZones = template.zones.filter(z => z.type === 'exam_code_bubble');
  const qrZones = template.zones.filter(z => z.type === 'student_id_qr');

  const hasRightColumnBubbles = sbdZones.length > 0 || codeZones.length > 0 || qrZones.length > 0;
  const defaultLeftHeaderWidth = hasRightColumnBubbles ? width * 0.47 : width * 0.88;
  const defaultLeftHeaderX = width * 0.05;

  // B. School & Exam Information (Left Top) - Fully customizable spacing, bold, italic & text color
  ctx.textAlign = 'left';
  let curHeaderY = height * 0.045;
  const headerLineSpacingMultiplier = layout?.headerLineSpacing ?? 1.0;

  const showDept = (layout?.showDepartmentName ?? true) !== false;
  if (showDept) {
    ctx.font = makeFont(layout?.deptBold ?? true, layout?.deptItalic ?? false, 22);
    ctx.fillStyle = headerTextColor;
    const dept = layout?.departmentName || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO';
    ctx.fillText(dept.toUpperCase(), defaultLeftHeaderX, curHeaderY);
    curHeaderY += Math.round(26 * headerLineSpacingMultiplier);
  }

  const showSchool = (layout?.showSchoolName ?? true) !== false;
  if (showSchool) {
    ctx.font = makeFont(layout?.schoolNameBold ?? true, layout?.schoolNameItalic ?? false, 28);
    ctx.fillStyle = headerTextColor;
    ctx.fillText((layout?.schoolName || template.schoolName || 'TRƯỜNG THPT CHUYÊN').toUpperCase(), defaultLeftHeaderX, curHeaderY);
    curHeaderY += Math.round(34 * headerLineSpacingMultiplier);
  }

  const showSheetTitle = (layout?.showSheetTitle ?? true) !== false;
  if (showSheetTitle) {
    ctx.font = makeFont(layout?.sheetTitleBold ?? true, layout?.sheetTitleItalic ?? false, 36);
    ctx.fillStyle = headerTextColor;
    const sheetT = layout?.sheetTitle || 'PHIẾU TRẢ LỜI TRẮC NGHIỆM';
    ctx.fillText(sheetT.toUpperCase(), defaultLeftHeaderX, curHeaderY);
    curHeaderY += Math.round(32 * headerLineSpacingMultiplier);
  }

  const showExam = (layout?.showExamTitle ?? true) !== false;
  if (showExam) {
    ctx.font = makeFont(layout?.examTitleBold ?? true, layout?.examTitleItalic ?? false, 20);
    ctx.fillStyle = headerTextColor;
    const eTitle = layout?.examTitle || examTitle || 'KỲ THI ĐÁNH GIÁ NĂNG LỰC / KIỂM TRA ĐỊNH KỲ';
    ctx.fillText(eTitle.toUpperCase(), defaultLeftHeaderX, curHeaderY);
    curHeaderY += Math.round(26 * headerLineSpacingMultiplier);
  }

  // Meta row (Môn thi, Thời gian, Ngày thi, và các trường tùy chỉnh Tiêu đề/Chung)
  interface HeaderMetaItem {
    id: string;
    text: string;
    newline: boolean;
  }
  const headerMetaItems: HeaderMetaItem[] = [];

  const showSub = (layout?.showSubjectName ?? layout?.showSubject ?? true) !== false;
  const subVal = layout?.subjectName ?? layout?.subject;
  if (showSub) {
    headerMetaItems.push({
      id: 'subject',
      text: subVal ? `Môn: ${subVal}` : 'Môn: ....................',
      newline: layout?.subjectNewline ?? false
    });
  }

  const showDur = (layout?.showDurationMinutes ?? layout?.showDuration ?? true) !== false;
  const durVal = layout?.durationMinutes ?? layout?.duration;
  if (showDur) {
    headerMetaItems.push({
      id: 'duration',
      text: durVal ? `Thời gian: ${durVal} phút` : 'Thời gian: 60 phút',
      newline: layout?.durationNewline ?? false
    });
  }

  const showDt = (layout?.showExamDate ?? layout?.showDate ?? true) !== false;
  const dtVal = layout?.examDate ?? layout?.date;
  if (showDt && dtVal) {
    headerMetaItems.push({
      id: 'examDate',
      text: `Ngày: ${dtVal}`,
      newline: layout?.examDateNewline ?? false
    });
  }

  // Header custom fields
  const headerCustomFields = layout?.headerCustomFields || [];
  headerCustomFields.forEach(cf => {
    if (cf.label) {
      headerMetaItems.push({
        id: cf.id,
        text: `${cf.label}: ${cf.value || '....................'}`,
        newline: cf.newline ?? false
      });
    }
  });

  // Group header meta items into rows based on newline flags
  const headerRows: string[][] = [];
  let curHeaderRow: string[] = [];
  headerMetaItems.forEach((item, idx) => {
    if (idx === 0) {
      curHeaderRow.push(item.text);
    } else if (item.newline) {
      if (curHeaderRow.length > 0) {
        headerRows.push(curHeaderRow);
      }
      curHeaderRow = [item.text];
    } else {
      curHeaderRow.push(item.text);
    }
  });
  if (curHeaderRow.length > 0) {
    headerRows.push(curHeaderRow);
  }

  const headerRowGap = Math.round(24 * headerLineSpacingMultiplier);

  if (headerRows.length > 0) {
    ctx.font = makeFont(layout?.headerMetaBold ?? false, layout?.headerMetaItalic ?? false, 18);
    ctx.fillStyle = headerTextColor;
    headerRows.forEach(rowItems => {
      ctx.fillText(rowItems.join('   |   '), defaultLeftHeaderX, curHeaderY);
      curHeaderY += headerRowGap;
    });
  }

  // C. Student Information Box (Customizable text, labels, dimensions, newlines, line spacing and position)
  const showStudentBox = (layout?.showStudentInfoBox ?? true) !== false;
  let studentBoxX = layout?.studentInfoBoxX !== undefined ? width * layout.studentInfoBoxX : defaultLeftHeaderX;
  const defaultMinStudentBoxY = Math.max(curHeaderY + Math.round(8 * headerLineSpacingMultiplier), height * 0.155);
  let studentBoxY = layout?.studentInfoBoxY !== undefined ? Math.max(height * layout.studentInfoBoxY, curHeaderY + 6) : defaultMinStudentBoxY;
  let studentBoxW = layout?.studentInfoBoxW !== undefined ? width * layout.studentInfoBoxW : defaultLeftHeaderWidth;

  const showNameInBox = (layout?.showStudentName ?? true) !== false;
  const showClsInBox = (layout?.showExamClassInStudentBox ?? layout?.showExamClass ?? layout?.showClassName ?? true) !== false;
  const showDobInBox = (layout?.showStudentDob ?? true) !== false;
  const showRmInBox = (layout?.showRoomNumberInStudentBox ?? layout?.showRoomNumber ?? layout?.showRoomName ?? true) !== false;
  const showSigInBox = (layout?.showStudentSignature ?? true) !== false;
  const customFields = layout?.customFields || [];

  interface StudentBoxFieldItem {
    id: string;
    label: string;
    value: string;
    newline: boolean;
    isName?: boolean;
    isSignature?: boolean;
  }

  const studentFieldItems: StudentBoxFieldItem[] = [];

  if (showNameInBox) {
    const nameLbl = layout?.studentNameLabel || 'Họ và tên:';
    studentFieldItems.push({
      id: 'name',
      label: nameLbl.endsWith(':') ? nameLbl : `${nameLbl}:`,
      value: student?.name || '...........................................................................',
      newline: layout?.studentNameNewline ?? true,
      isName: true
    });
  }

  if (showClsInBox) {
    const classLbl = layout?.examClassLabel || 'Lớp:';
    studentFieldItems.push({
      id: 'class',
      label: classLbl.endsWith(':') ? classLbl : `${classLbl}:`,
      value: student?.className || layout?.examClass || layout?.className || '.............',
      newline: layout?.examClassNewline ?? false
    });
  }

  if (showDobInBox) {
    const dobLbl = layout?.studentDobLabel || 'Ngày sinh:';
    studentFieldItems.push({
      id: 'dob',
      label: dobLbl.endsWith(':') ? dobLbl : `${dobLbl}:`,
      value: '...................',
      newline: layout?.studentDobNewline ?? false
    });
  }

  if (showRmInBox) {
    const roomLbl = layout?.roomNumberLabel || 'Phòng:';
    studentFieldItems.push({
      id: 'room',
      label: roomLbl.endsWith(':') ? roomLbl : `${roomLbl}:`,
      value: layout?.roomNumber || layout?.roomName || '.........',
      newline: layout?.roomNumberNewline ?? false
    });
  }

  // Add custom student fields
  customFields.forEach(cf => {
    if (cf.label) {
      studentFieldItems.push({
        id: cf.id,
        label: cf.label.endsWith(':') ? cf.label : `${cf.label}:`,
        value: cf.value || '.........................',
        newline: cf.newline ?? false
      });
    }
  });

  if (showSigInBox) {
    const sigLbl = layout?.studentSignatureLabel || 'Chữ ký thí sinh:';
    studentFieldItems.push({
      id: 'signature',
      label: sigLbl.endsWith(':') ? sigLbl : `${sigLbl}:`,
      value: '.......................................',
      newline: layout?.studentSignatureNewline ?? true,
      isSignature: true
    });
  }

  // Group into rows based on newline triggers
  const studentRows: StudentBoxFieldItem[][] = [];
  let curStudentRow: StudentBoxFieldItem[] = [];
  studentFieldItems.forEach((item, idx) => {
    if (idx === 0) {
      curStudentRow.push(item);
    } else if (item.newline) {
      if (curStudentRow.length > 0) {
        studentRows.push(curStudentRow);
      }
      curStudentRow = [item];
    } else {
      curStudentRow.push(item);
    }
  });
  if (curStudentRow.length > 0) {
    studentRows.push(curStudentRow);
  }

  const studentLineSpacingMultiplier = layout?.studentLineSpacing ?? 1.0;
  const studentRowHeight = Math.round(28 * studentLineSpacingMultiplier);
  const calculatedStudentBoxH = 34 + (studentRows.length * studentRowHeight) + 12;
  const studentBoxH = layout?.studentInfoBoxH !== undefined ? height * layout.studentInfoBoxH : calculatedStudentBoxH;

  if (showStudentBox) {
    ctx.strokeStyle = frameBorderColor;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(studentBoxX, studentBoxY, studentBoxW, studentBoxH);

    // Box title banner
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(studentBoxX, studentBoxY, studentBoxW, 28);
    ctx.strokeRect(studentBoxX, studentBoxY, studentBoxW, 28);

    ctx.font = makeFont(layout?.studentBoxTitleBold ?? true, layout?.studentBoxTitleItalic ?? false, 16);
    ctx.fillStyle = studentBoxTextColor;
    const sBoxTitle = layout?.studentInfoBoxTitle || 'THÔNG TIN THÍ SINH';
    ctx.fillText(sBoxTitle.toUpperCase(), studentBoxX + 12, studentBoxY + 19);

    // Render each row in student box with customizable label/value weight & color
    let fieldY = studentBoxY + 30 + Math.round(20 * studentLineSpacingMultiplier);
    const labelFont = makeFont(layout?.studentBoxLabelBold ?? true, layout?.studentBoxLabelItalic ?? false, 17);
    const valFont = makeFont(layout?.studentBoxValueBold ?? false, layout?.studentBoxValueItalic ?? false, 17);

    studentRows.forEach(row => {
      if (row.length === 1 && row[0].isName) {
        // Formatted Name row
        const item = row[0];
        ctx.font = labelFont;
        ctx.fillStyle = studentBoxTextColor;
        ctx.fillText(item.label, studentBoxX + 12, fieldY);
        ctx.font = valFont;
        ctx.fillText(item.value, studentBoxX + 115, fieldY);
      } else {
        // Multi-item or single standard row
        let curItemX = studentBoxX + 12;
        row.forEach(item => {
          ctx.font = labelFont;
          ctx.fillStyle = studentBoxTextColor;
          ctx.fillText(item.label, curItemX, fieldY);
          const lblW = ctx.measureText(item.label).width;

          ctx.font = valFont;
          ctx.fillText(` ${item.value}`, curItemX + lblW, fieldY);
          const valW = ctx.measureText(` ${item.value}`).width;

          curItemX += lblW + valW + 28;
        });
      }
      fieldY += studentRowHeight;
    });
  }

  // Teacher Score & Proctor Box (Redesigned with top small headers, score in words, custom fields, and spacious writing cells)
  const showScoreBox = (layout?.showTeacherScoreBox ?? layout?.showScoresTable ?? true) !== false;
  if (showScoreBox) {
    const scoreBoxX = layout?.scoreBoxX !== undefined ? width * layout.scoreBoxX : studentBoxX;
    const scoreBoxY = layout?.scoreBoxY !== undefined ? height * layout.scoreBoxY : (studentBoxY + (showStudentBox ? studentBoxH + 6 : 0));
    const scoreBoxW = layout?.scoreBoxW !== undefined ? width * layout.scoreBoxW : studentBoxW;
    const scoreBoxH = layout?.scoreBoxH !== undefined ? height * layout.scoreBoxH : 64;

    ctx.strokeStyle = frameBorderColor;
    ctx.lineWidth = 1.8;

    // Define columns to render
    interface ScoreColumn {
      id: string;
      title: string;
      weight: number;
      value?: string;
    }

    const scoreCols: ScoreColumn[] = [];
    if (layout?.showScoreNumber !== false) {
      scoreCols.push({ id: 'num', title: layout?.scoreBoxTitle || 'ĐIỂM BẰNG SỐ', weight: 1.2 });
    }
    if (layout?.showScoreText !== false) {
      scoreCols.push({ id: 'text', title: layout?.scoreTextLabel || 'ĐIỂM BẰNG CHỮ', weight: 1.5 });
    }
    if (layout?.showProctor1 !== false) {
      scoreCols.push({ id: 'p1', title: layout?.proctor1Label || 'CB CHẤM THI 1', weight: 1.3 });
    }
    if (layout?.showProctor2 !== false) {
      scoreCols.push({ id: 'p2', title: layout?.proctor2Label || 'CB CHẤM THI 2', weight: 1.3 });
    }

    // Custom Score Box Fields
    (layout?.scoreBoxCustomFields || []).forEach(cf => {
      if (cf.label) {
        scoreCols.push({ id: cf.id, title: cf.label.toUpperCase(), weight: 1.2, value: cf.value });
      }
    });

    if (scoreCols.length > 0) {
      const totalWeight = scoreCols.reduce((sum, c) => sum + c.weight, 0);
      let curColX = scoreBoxX;
      const headerBarH = 22;

      // Outer container
      ctx.strokeRect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH);

      scoreCols.forEach((col, idx) => {
        const colW = (idx === scoreCols.length - 1)
          ? (scoreBoxX + scoreBoxW - curColX)
          : Math.round((col.weight / totalWeight) * scoreBoxW);

        // Column cell outer border
        ctx.strokeRect(curColX, scoreBoxY, colW, scoreBoxH);

        // Top Header Banner for this column
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(curColX, scoreBoxY, colW, headerBarH);
        ctx.strokeRect(curColX, scoreBoxY, colW, headerBarH);

        // Column Header Text (small font at top)
        ctx.font = makeFont(layout?.scoreBoxTitleBold ?? true, layout?.scoreBoxTitleItalic ?? false, 12);
        ctx.fillStyle = scoreBoxTextColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(col.title, curColX + colW / 2, scoreBoxY + headerBarH / 2);

        // If custom field has pre-filled value, render lightly in center of writing space
        if (col.value) {
          ctx.font = makeFont(false, true, 14);
          ctx.fillStyle = scoreBoxTextColor;
          ctx.fillText(col.value, curColX + colW / 2, scoreBoxY + headerBarH + (scoreBoxH - headerBarH) / 2);
        }

        curColX += colW;
      });
      ctx.textBaseline = 'alphabetic';
    }
  }

  // D. Render SBD (Số Báo Danh) with customizable title, spacious write-in boxes and compact bubbles below
  if (sbdZones.length > 0) {
    const sbdCols: Record<number, RecognitionZone[]> = {};
    sbdZones.forEach(z => {
      if (z.digitPosition !== undefined) {
        if (!sbdCols[z.digitPosition]) sbdCols[z.digitPosition] = [];
        sbdCols[z.digitPosition].push(z);
      }
    });

    const colPositions = Object.keys(sbdCols).map(Number).sort((a, b) => a - b);
    if (colPositions.length > 0) {
      const minX = Math.min(...sbdZones.map(z => z.x * width)) - 6;
      const maxX = Math.max(...sbdZones.map(z => (z.x + z.width) * width)) + 6;
      const firstZ = [...sbdZones].sort((a, b) => a.y - b.y)[0];
      const minY = Math.max(10, firstZ.y * height - 62);
      const maxY = Math.max(...sbdZones.map(z => (z.y + z.height) * height)) + 6;
      const sbdBoxW = maxX - minX;
      const sbdBoxH = maxY - minY;

      // Outer container
      ctx.strokeStyle = frameBorderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(minX, minY, sbdBoxW, sbdBoxH);

      // Header title banner
      ctx.fillStyle = headerBannerColor;
      ctx.fillRect(minX, minY, sbdBoxW, 26);
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = headerBannerTextColor;
      ctx.textAlign = 'center';
      const sbdTitle = layout?.sbdTitle || 'SỐ BÁO DANH';
      ctx.fillText(sbdTitle.toUpperCase(), minX + sbdBoxW / 2, minY + 18);

      // Write-in boxes on top: spacious, bold
      const writeInY = minY + 28;
      const writeInH = (firstZ.y * height) - writeInY - 3;

      colPositions.forEach((colIdx) => {
        const colZones = sbdCols[colIdx].sort((a, b) => (a.digitValue ?? 0) - (b.digitValue ?? 0));
        if (colZones.length === 0) return;
        const cz = colZones[0];
        const colX = cz.x * width - 2;
        const colW = cz.width * width + 4;

        ctx.strokeStyle = frameBorderColor;
        ctx.lineWidth = 1.6;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(colX, writeInY, colW, writeInH);
        ctx.strokeRect(colX, writeInY, colW, writeInH);

        // Personalized digit print
        if (student && student.studentId) {
          const sbdStr = student.studentId.padStart(colPositions.length, '0');
          const char = sbdStr[colIdx] || '';
          if (char) {
            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.fillText(char, colX + colW / 2, writeInY + writeInH / 2 + 7);
          }
        }
      });
    }
  }

  // E. Render Exam Code (Mã Đề Thi) - Option to leave completely blank for student hand-writing
  const leaveCodeBlank = layout?.leaveExamCodeBlankForStudent ?? true;
  if (codeZones.length > 0) {
    const codeCols: Record<number, RecognitionZone[]> = {};
    codeZones.forEach(z => {
      if (z.digitPosition !== undefined) {
        if (!codeCols[z.digitPosition]) codeCols[z.digitPosition] = [];
        codeCols[z.digitPosition].push(z);
      }
    });

    const colPositions = Object.keys(codeCols).map(Number).sort((a, b) => a - b);
    if (colPositions.length > 0) {
      const minX = Math.min(...codeZones.map(z => z.x * width)) - 6;
      const maxX = Math.max(...codeZones.map(z => (z.x + z.width) * width)) + 6;
      const firstZ = [...codeZones].sort((a, b) => a.y - b.y)[0];
      const minY = Math.max(10, firstZ.y * height - 62);
      const maxY = Math.max(...codeZones.map(z => (z.y + z.height) * height)) + 6;
      const codeBoxW = maxX - minX;
      const codeBoxH = maxY - minY;

      ctx.strokeStyle = frameBorderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(minX, minY, codeBoxW, codeBoxH);

      ctx.fillStyle = headerBannerColor;
      ctx.fillRect(minX, minY, codeBoxW, 26);
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = headerBannerTextColor;
      ctx.textAlign = 'center';
      const codeTitle = layout?.examCodeTitle || 'MÃ ĐỀ THI';
      ctx.fillText(codeTitle.toUpperCase(), minX + codeBoxW / 2, minY + 18);

      const writeInY = minY + 28;
      const writeInH = (firstZ.y * height) - writeInY - 3;

      colPositions.forEach((colIdx) => {
        const colZones = codeCols[colIdx].sort((a, b) => (a.digitValue ?? 0) - (b.digitValue ?? 0));
        if (colZones.length === 0) return;
        const cz = colZones[0];
        const colX = cz.x * width - 2;
        const colW = cz.width * width + 4;

        ctx.strokeStyle = frameBorderColor;
        ctx.lineWidth = 1.6;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(colX, writeInY, colW, writeInH);
        ctx.strokeRect(colX, writeInY, colW, writeInH);

        // If not forced blank for student and examCode is provided
        if (!leaveCodeBlank && examCode) {
          const codeStr = examCode.padStart(colPositions.length, '0');
          const char = codeStr[colIdx] || '';
          if (char) {
            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.fillText(char, colX + colW / 2, writeInY + writeInH / 2 + 7);
          }
        }
      });
    }
  }

  // F. Render QR Code (Top Right)
  if (template.hasQrCode && qrZones.length > 0) {
    const qrZone = qrZones[0];
    const qrPayload = JSON.stringify({
      sId: student?.studentId || 'TEST001',
      sName: student?.name || 'Nguyen Van A',
      cls: student?.className || '6A1',
      eCode: examCode || '101',
      tId: template.id
    });

    try {
      const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 220 });
      const qrImg = new Image();
      await new Promise<void>(r => {
        qrImg.onload = () => r();
        qrImg.src = qrDataUrl;
      });

      const qrX = qrZone.x * width;
      const qrY = qrZone.y * height;
      const qrW = qrZone.width * width;
      const qrH = qrZone.height * height;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(qrX, qrY, qrW, qrH);
      ctx.drawImage(qrImg, qrX, qrY, qrW, qrH);
      ctx.strokeStyle = frameBorderColor;
      ctx.lineWidth = 1.8;
      ctx.strokeRect(qrX, qrY, qrW, qrH);

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.fillText('MÃ ĐỊNH DANH QR', qrX + qrW / 2, qrY + qrH + 16);
    } catch {
      // Fallback gracefully
    }
  }

  // G. Draw Bubble Circles for SBD & Exam Code (Custom bubbleColor & bubbleFillColor)
  const digitBubbleZones = [...sbdZones, ...codeZones];
  digitBubbleZones.forEach(z => {
    const zX = z.x * width;
    const zY = z.y * height;
    const zW = z.width * width;
    const zH = z.height * height;
    const radius = Math.min(zW, zH) / 2;
    const centerX = zX + zW / 2;
    const centerY = zY + zH / 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    if (bubbleFillColor && bubbleFillColor !== 'transparent') {
      ctx.fillStyle = bubbleFillColor;
      ctx.fill();
    }
    ctx.strokeStyle = bubbleColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = bubbleColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(z.digitValue !== undefined ? z.digitValue.toString() : '0', centerX, centerY + 1);
  });

  // H. Instructions Banner (Customizable text and position)
  if (layout?.showInstructionsBox !== false && layout?.showInstructions !== false) {
    const instX = layout?.instructionsBoxX !== undefined ? width * layout.instructionsBoxX : width * 0.05;
    const instY = layout?.instructionsBoxY !== undefined
      ? height * layout.instructionsBoxY
      : (layout?.instructionsYOffset !== undefined
        ? height * layout.instructionsYOffset
        : ((layout?.showTeacherScoreBox || layout?.showScoresTable) ? height * 0.275 : height * 0.245));
    const instW = layout?.instructionsBoxW !== undefined ? width * layout.instructionsBoxW : width * 0.90;
    const instH = layout?.instructionsBoxH !== undefined ? height * layout.instructionsBoxH : 32;

    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = frameBorderColor;
    ctx.lineWidth = 1.5;
    ctx.fillRect(instX, instY, instW, instH);
    ctx.strokeRect(instX, instY, instW, instH);

    ctx.font = makeFont(layout?.instructionsBold ?? true, layout?.instructionsItalic ?? false, 15);
    ctx.fillStyle = instructionsTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const instr = layout?.instructionsText || 'HƯỚNG DẪN TÔ ĐÁP ÁN: Dùng bút chì 2B tô tròn kín ô: [●] Đúng   |   [○] [◐] [x] [✓] Sai   |   Tẩy sạch nếu muốn đổi đáp án';
    ctx.fillText(instr, instX + instW / 2, instY + instH / 2);
  }

  // I. Draw Framed Question Columns with Tightly Spaced ABCD Bubbles & Custom Colors
  const bubbleZones = template.zones.filter(z => z.type === 'bubble');
  const questionsMap: Record<number, RecognitionZone[]> = {};
  for (const z of bubbleZones) {
    if (z.questionNumber) {
      if (!questionsMap[z.questionNumber]) questionsMap[z.questionNumber] = [];
      questionsMap[z.questionNumber].push(z);
    }
  }

  // Identify column boundaries to frame each column
  const columnsCount = template.columnsCount || 4;
  const colsData: { qNums: number[]; minX: number; maxX: number; minY: number; maxY: number }[] = [];

  for (let c = 0; c < columnsCount; c++) {
    colsData.push({ qNums: [], minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  }

  const allQNums = Object.keys(questionsMap).map(Number).sort((a, b) => a - b);
  const qPerCol = Math.ceil(allQNums.length / columnsCount);

  allQNums.forEach((qNum, idx) => {
    const colIdx = Math.min(columnsCount - 1, Math.floor(idx / qPerCol));
    const zones = questionsMap[qNum];
    colsData[colIdx].qNums.push(qNum);
    zones.forEach(z => {
      const zX = z.x * width;
      const zY = z.y * height;
      const zW = z.width * width;
      const zH = z.height * height;
      colsData[colIdx].minX = Math.min(colsData[colIdx].minX, zX - 44);
      colsData[colIdx].maxX = Math.max(colsData[colIdx].maxX, zX + zW + 12);
      colsData[colIdx].minY = Math.min(colsData[colIdx].minY, zY - 14);
      colsData[colIdx].maxY = Math.max(colsData[colIdx].maxY, zY + zH + 14);
    });
  });

  // Draw Column Frames with custom frameBorderColor & headerBannerColor
  colsData.forEach((col, cIdx) => {
    if (col.qNums.length === 0 || !isFinite(col.minX)) return;
    const minQ = Math.min(...col.qNums);
    const maxQ = Math.max(...col.qNums);
    const frameX = col.minX - 4;
    const frameY = col.minY - 22;
    const frameW = (col.maxX - col.minX) + 8;
    const frameH = (col.maxY - col.minY) + 26;

    // Frame rectangle
    ctx.strokeStyle = frameBorderColor;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(frameX, frameY, frameW, frameH);

    // Column header tab
    ctx.fillStyle = headerBannerColor;
    ctx.fillRect(frameX, frameY, frameW, 24);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = headerBannerTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`CÂU ${minQ} – ${maxQ}`, frameX + frameW / 2, frameY + 12);
  });

  // Draw each question row and tight bubbles with custom bubbleColor
  for (const [qNumStr, zones] of Object.entries(questionsMap)) {
    const qNum = parseInt(qNumStr, 10);
    const sortedZones = zones.sort((a, b) => (a.option || '').localeCompare(b.option || ''));
    if (sortedZones.length === 0) continue;

    const firstZone = sortedZones[0];
    const qLabelX = firstZone.x * width - 14;
    const qLabelY = firstZone.y * height + (firstZone.height * height) / 2;

    // Question number
    ctx.font = 'bold 19px sans-serif';
    ctx.fillStyle = globalTextColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${qNum}`, qLabelX, qLabelY);

    // Draw each option bubble (Tight spacing, custom bubbleColor)
    for (const z of sortedZones) {
      const zX = z.x * width;
      const zY = z.y * height;
      const zW = z.width * width;
      const zH = z.height * height;
      const radius = Math.min(zW, zH) / 2;
      const centerX = zX + zW / 2;
      const centerY = zY + zH / 2;

      // Circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      if (bubbleFillColor && bubbleFillColor !== 'transparent') {
        ctx.fillStyle = bubbleFillColor;
        ctx.fill();
      }
      ctx.strokeStyle = bubbleColor;
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Option letter inside
      ctx.font = 'bold 17px sans-serif';
      ctx.fillStyle = bubbleColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(z.option || 'A', centerX, centerY + 1);
    }
  }

  // Footer (Customizable content, styling, alignment, and dividers)
  const showFooter = layout?.showFooter !== false;
  if (showFooter) {
    const footerYRatio = layout?.footerYOffset ?? 0.985;
    const footerY = height * footerYRatio;
    const footerTextColor = layout?.footerTextColor || globalTextColor;
    const footerFontSize = layout?.footerFontSize || 15;
    const align = layout?.footerAlign || 'center';

    // Optional thin divider line above footer
    if (layout?.showFooterDivider) {
      ctx.save();
      ctx.strokeStyle = layout?.frameBorderColor || '#CBD5E1';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(width * 0.045, footerY - footerFontSize - 8);
      ctx.lineTo(width * 0.955, footerY - footerFontSize - 8);
      ctx.stroke();
      ctx.restore();
    }

    // Replace template variable tags
    const replaceTags = (txt: string) => {
      return txt
        .replace(/\{numQuestions\}/g, String(template.numQuestions || 40))
        .replace(/\{schoolName\}/g, template.schoolName || layout?.schoolName || 'Trường')
        .replace(/\{version\}/g, template.version || '1.0')
        .replace(/\{templateId\}/g, template.id || '')
        .replace(/\{paperSize\}/g, template.paperSize || 'A4')
        .replace(/\{examCode\}/g, examCode || '101');
    };

    const defaultFooterMain = `Hệ thống chấm thi trắc nghiệm OMR • Phiên bản ${template.version} • Mã phiếu: ${template.id}`;
    const mainText = layout?.footerText !== undefined && layout.footerText.trim() !== ''
      ? replaceTags(layout.footerText)
      : defaultFooterMain;

    const secondaryText = layout?.footerSecondaryText ? replaceTags(layout.footerSecondaryText) : '';
    const pageNumText = layout?.showFooterPageNumber ? 'Trang 1/1' : '';

    ctx.save();
    ctx.font = makeFont(layout?.footerBold ?? false, layout?.footerItalic ?? false, footerFontSize);
    ctx.fillStyle = footerTextColor;
    ctx.textBaseline = 'middle';

    if (align === 'split') {
      // Left part: main text
      ctx.textAlign = 'left';
      ctx.fillText(mainText, width * 0.045, footerY);

      // Right part: secondary text or page number
      const rightContent = [secondaryText, pageNumText].filter(Boolean).join(' • ');
      if (rightContent) {
        ctx.textAlign = 'right';
        ctx.fillText(rightContent, width * 0.955, footerY);
      }
    } else if (align === 'left') {
      ctx.textAlign = 'left';
      const fullText = [mainText, secondaryText, pageNumText].filter(Boolean).join(' • ');
      ctx.fillText(fullText, width * 0.045, footerY);
    } else if (align === 'right') {
      ctx.textAlign = 'right';
      const fullText = [mainText, secondaryText, pageNumText].filter(Boolean).join(' • ');
      ctx.fillText(fullText, width * 0.955, footerY);
    } else {
      // Center
      ctx.textAlign = 'center';
      const fullText = [mainText, secondaryText, pageNumText].filter(Boolean).join(' • ');
      ctx.fillText(fullText, width / 2, footerY);
    }
    ctx.restore();
  }

  return canvas;
}

/**
 * Creates a simulated filled student submission image with realistic pencil marks
 * (Used for instant testing, scanning demo, and reviewing error edge cases)
 */
export async function createSimulatedFilledSheet(
  template: AnswerSheetTemplate,
  student: Student,
  examCode: string,
  examTitle: string,
  answers: Record<number, BubbleOption | 'MULTIPLE' | 'UNCERTAIN' | 'BLANK'>
): Promise<string> {
  const baseCanvas = await renderTemplateToCanvas(template, student, examCode, examTitle);
  const ctx = baseCanvas.getContext('2d')!;

  const width = baseCanvas.width;
  const height = baseCanvas.height;

  const fillBubble = (zone: RecognitionZone, isLight = false) => {
    const zX = zone.x * width;
    const zY = zone.y * height;
    const zW = zone.width * width;
    const zH = zone.height * height;
    const radius = Math.min(zW, zH) / 2;
    const centerX = zX + zW / 2;
    const centerY = zY + zH / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? 'rgba(70, 70, 70, 0.45)' : 'rgba(20, 20, 20, 0.94)';
    ctx.fill();

    // Add realistic pencil texture strokes
    ctx.strokeStyle = isLight ? 'rgba(40, 40, 40, 0.3)' : 'rgba(10, 10, 10, 0.85)';
    ctx.lineWidth = 2.5;
    for (let i = -radius * 0.6; i <= radius * 0.6; i += 4) {
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 0.7, centerY + i);
      ctx.lineTo(centerX + radius * 0.7, centerY + i);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Fill Student ID bubbles if present
  if (student?.studentId) {
    const cleanId = student.studentId.replace(/\D/g, '');
    const sbdCols = Array.from(new Set(
      template.zones
        .filter(z => z.type === 'student_id_bubble' && z.digitPosition !== undefined)
        .map(z => z.digitPosition as number)
    )).sort((a, b) => a - b);

    const paddedId = cleanId.padStart(sbdCols.length, '0');
    sbdCols.forEach((colIdx, idx) => {
      const char = paddedId[idx];
      if (char !== undefined) {
        const val = parseInt(char, 10);
        const z = template.zones.find(
          item => item.type === 'student_id_bubble' && item.digitPosition === colIdx && item.digitValue === val
        );
        if (z) fillBubble(z);
      }
    });
  }

  // Fill Exam Code (Mã Đề) bubbles if present
  if (examCode) {
    const cleanCode = examCode.replace(/\D/g, '');
    const codeCols = Array.from(new Set(
      template.zones
        .filter(z => z.type === 'exam_code_bubble' && z.digitPosition !== undefined)
        .map(z => z.digitPosition as number)
    )).sort((a, b) => a - b);

    const paddedCode = cleanCode.padStart(codeCols.length, '0');
    codeCols.forEach((colIdx, idx) => {
      const char = paddedCode[idx];
      if (char !== undefined) {
        const val = parseInt(char, 10);
        const z = template.zones.find(
          item => item.type === 'exam_code_bubble' && item.digitPosition === colIdx && item.digitValue === val
        );
        if (z) fillBubble(z);
      }
    });
  }

  for (const [qNumStr, markedAnswer] of Object.entries(answers)) {
    const qNum = parseInt(qNumStr, 10);
    if (markedAnswer === 'BLANK') continue;

    const qZones = template.zones.filter(z => z.type === 'bubble' && z.questionNumber === qNum);

    if (markedAnswer === 'MULTIPLE') {
      // Mark 2 bubbles
      if (qZones[0]) fillBubble(qZones[0]);
      if (qZones[1]) fillBubble(qZones[1]);
    } else if (markedAnswer === 'UNCERTAIN') {
      // Mark lightly or partially
      if (qZones[0]) fillBubble(qZones[0], true);
    } else {
      const targetZone = qZones.find(z => z.option === markedAnswer);
      if (targetZone) {
        fillBubble(targetZone);
      }
    }
  }

  return baseCanvas.toDataURL('image/jpeg', 0.9);
}
