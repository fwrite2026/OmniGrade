import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  AnswerSheetTemplate,
  BubbleOption,
  CustomTemplateField
} from '../../types';
import {
  generateDirectTemplateZonesAndData,
  DirectDesignerConfig,
  renderTemplateToCanvas
} from '../../services/templateGenerator';
import {
  X,
  Printer,
  Download,
  Save,
  Sliders,
  FileSpreadsheet,
  Users,
  Grid,
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  FileCheck,
  Building2,
  GraduationCap,
  Calendar,
  Clock,
  QrCode,
  Hash,
  Award,
  Plus,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface DirectTemplateDesignerModalProps {
  onClose: () => void;
  onSavedAndEdit?: (template: AnswerSheetTemplate) => void;
}

export const DirectTemplateDesignerModal: React.FC<DirectTemplateDesignerModalProps> = ({
  onClose,
  onSavedAndEdit
}) => {
  const { t, addTemplate, activeExam } = useApp();

  // Active configuration tab
  const [activeTab, setActiveTab] = useState<'exam' | 'student' | 'id_code' | 'questions'>('exam');

  // Form State - Exam & School Info
  const [templateName, setTemplateName] = useState<string>('Phiếu trắc nghiệm chuẩn');
  const [schoolName, setSchoolName] = useState<string>('FPT SCHOOLS');
  const [showSchoolName, setShowSchoolName] = useState<boolean>(true);
  const [departmentName, setDepartmentName] = useState<string>('SỞ GIÁO DỤC VÀ ĐÀO TẠO');
  const [showDepartmentName, setShowDepartmentName] = useState<boolean>(true);
  const [examTitle, setExamTitle] = useState<string>('KIỂM TRA HỌC KỲ I - ĐÁNH GIÁ NĂNG LỰC');
  const [showExamTitle, setShowExamTitle] = useState<boolean>(true);
  const [subjectName, setSubjectName] = useState<string>('Toán học');
  const [showSubjectName, setShowSubjectName] = useState<boolean>(true);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [showDurationMinutes, setShowDurationMinutes] = useState<boolean>(true);
  const [examDate, setExamDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showExamDate, setShowExamDate] = useState<boolean>(true);
  const [examClass, setExamClass] = useState<string>('Khối 10');
  const [showExamClass, setShowExamClass] = useState<boolean>(true);
  const [roomNumber, setRoomNumber] = useState<string>('P.01');
  const [showRoomNumber, setShowRoomNumber] = useState<boolean>(true);
  const [paperSize, setPaperSize] = useState<'A4' | 'A5' | 'Letter'>('A4');

  // Student & Instructions
  const [showStudentInfoBox, setShowStudentInfoBox] = useState<boolean>(true);
  const [showStudentName, setShowStudentName] = useState<boolean>(true);
  const [showStudentDob, setShowStudentDob] = useState<boolean>(true);
  const [showStudentSignature, setShowStudentSignature] = useState<boolean>(true);
  const [showTeacherScoreBox, setShowTeacherScoreBox] = useState<boolean>(true);
  const [showInstructionsBox, setShowInstructionsBox] = useState<boolean>(true);
  const [instructionsText, setInstructionsText] = useState<string>(
    'HƯỚNG DẪN TÔ ĐÁP ÁN: Dùng bút chì 2B tô tròn kín ô: [●] Đúng   |   [○] [◐] [x] [✓] Sai   |   Tẩy sạch nếu muốn đổi đáp án'
  );
  const [hasQrCode, setHasQrCode] = useState<boolean>(false);
  const [hasAnchorMarks, setHasAnchorMarks] = useState<boolean>(true);

  // Dynamic Custom Extra Fields
  const [customFields, setCustomFields] = useState<CustomTemplateField[]>([
    { id: 'cf_1', label: 'Hội đồng thi', value: '' }
  ]);
  const [newFieldLabel, setNewFieldLabel] = useState<string>('');

  // SBD & Exam Code Bubbles
  const [hasStudentIdBubbles, setHasStudentIdBubbles] = useState<boolean>(true);
  const [numStudentIdDigits, setNumStudentIdDigits] = useState<number>(6);
  const [hasExamCodeBubbles, setHasExamCodeBubbles] = useState<boolean>(true);
  const [numExamCodeDigits, setNumExamCodeDigits] = useState<number>(3);

  // Questions Grid
  const [numQuestions, setNumQuestions] = useState<number>(60);
  const [numOptions, setNumOptions] = useState<number>(4);
  const [columnsCount, setColumnsCount] = useState<number>(4);
  const [direction, setDirection] = useState<'column_first' | 'row_first'>('column_first');

  // Preview options
  const [showZonesOverlay, setShowZonesOverlay] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>('');

  // Presets definition
  const presets = [
    { name: '20 câu - 2 cột (A4/A5)', q: 20, opt: 4, cols: 2, sbd: 4, code: 2 },
    { name: '40 câu - 2 cột chuẩn', q: 40, opt: 4, cols: 2, sbd: 6, code: 3 },
    { name: '50 câu - 2 cột (THPT)', q: 50, opt: 4, cols: 2, sbd: 6, code: 3 },
    { name: '60 câu - 4 cột (FPT Schools)', q: 60, opt: 4, cols: 4, sbd: 6, code: 3 },
    { name: '80 câu - 4 cột Ngoại ngữ', q: 80, opt: 4, cols: 4, sbd: 6, code: 4 },
    { name: '100 câu - 4 cột ĐGNL', q: 100, opt: 4, cols: 4, sbd: 6, code: 4 },
    { name: '120 câu - 4 cột ĐGNL', q: 120, opt: 4, cols: 4, sbd: 6, code: 4 }
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    setNumQuestions(preset.q);
    setNumOptions(preset.opt);
    setColumnsCount(preset.cols);
    setNumStudentIdDigits(preset.sbd);
    setNumExamCodeDigits(preset.code);
    setTemplateName(`Phiếu ${preset.q} câu - ${schoolName}`);
  };

  // Custom fields handlers
  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;
    const newField: CustomTemplateField = {
      id: `cf_${Date.now()}`,
      label: newFieldLabel.trim(),
      value: ''
    };
    setCustomFields(prev => [...prev, newField]);
    setNewFieldLabel('');
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  const handleUpdateCustomField = (id: string, field: Partial<CustomTemplateField>) => {
    setCustomFields(prev => prev.map(f => (f.id === id ? { ...f, ...field } : f)));
  };

  // Generate template object and zones
  const { generatedTemplate, zones } = useMemo(() => {
    const config: DirectDesignerConfig = {
      name: templateName || `Phiếu ${numQuestions} câu - ${schoolName}`,
      showSchoolName,
      schoolName,
      showDepartmentName,
      departmentName,
      showExamTitle,
      examTitle,
      showSubjectName,
      subjectName,
      showDurationMinutes,
      durationMinutes,
      showExamDate,
      examDate,
      showExamClass,
      examClass,
      showRoomNumber,
      roomNumber,
      showStudentName,
      showStudentDob,
      showStudentSignature,
      customFields,
      paperSize,
      numQuestions,
      numOptions,
      columnsCount,
      direction,
      hasStudentIdBubbles,
      numStudentIdDigits,
      hasExamCodeBubbles,
      numExamCodeDigits,
      hasQrCode,
      hasAnchorMarks,
      showStudentInfoBox,
      showTeacherScoreBox,
      showInstructionsBox,
      instructionsText
    };

    const result = generateDirectTemplateZonesAndData(config);
    return {
      generatedTemplate: result.template,
      zones: result.zones
    };
  }, [
    templateName,
    schoolName,
    showSchoolName,
    departmentName,
    showDepartmentName,
    examTitle,
    showExamTitle,
    subjectName,
    showSubjectName,
    durationMinutes,
    showDurationMinutes,
    examDate,
    showExamDate,
    examClass,
    showExamClass,
    roomNumber,
    showRoomNumber,
    showStudentName,
    showStudentDob,
    showStudentSignature,
    customFields,
    paperSize,
    numQuestions,
    numOptions,
    columnsCount,
    direction,
    hasStudentIdBubbles,
    numStudentIdDigits,
    hasExamCodeBubbles,
    numExamCodeDigits,
    hasQrCode,
    hasAnchorMarks,
    showStudentInfoBox,
    showTeacherScoreBox,
    showInstructionsBox,
    instructionsText
  ]);

  // Render preview canvas
  useEffect(() => {
    let isCurrent = true;
    const updatePreview = async () => {
      setIsGenerating(true);
      try {
        const renderedCanvas = await renderTemplateToCanvas(
          generatedTemplate,
          undefined,
          '101',
          examTitle
        );

        if (!isCurrent) return;

        // If zones overlay is requested, draw subtle bounding boxes
        if (showZonesOverlay) {
          const ctx = renderedCanvas.getContext('2d')!;
          const w = renderedCanvas.width;
          const h = renderedCanvas.height;

          // Bubbles overlay (Cyan/Blue)
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.45)';
          ctx.lineWidth = 1.5;
          zones.filter(z => z.type === 'bubble').forEach(z => {
            ctx.strokeRect(z.x * w, z.y * h, z.width * w, z.height * h);
          });

          // SBD bubbles overlay (Purple)
          ctx.strokeStyle = 'rgba(147, 51, 234, 0.7)';
          ctx.lineWidth = 1.8;
          zones.filter(z => z.type === 'student_id_bubble').forEach(z => {
            ctx.strokeRect(z.x * w, z.y * h, z.width * w, z.height * h);
          });

          // Exam Code bubbles overlay (Emerald)
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
          ctx.lineWidth = 1.8;
          zones.filter(z => z.type === 'exam_code_bubble').forEach(z => {
            ctx.strokeRect(z.x * w, z.y * h, z.width * w, z.height * h);
          });

          // Anchors overlay (Amber)
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
          ctx.lineWidth = 2;
          zones.filter(z => z.type === 'anchor_mark').forEach(z => {
            ctx.strokeRect(z.x * w - 2, z.y * h - 2, z.width * w + 4, z.height * h + 4);
          });
        }

        setPreviewDataUrl(renderedCanvas.toDataURL('image/png'));
      } catch (err) {
        console.error('Error updating live template preview:', err);
      } finally {
        if (isCurrent) setIsGenerating(false);
      }
    };

    updatePreview();
    return () => {
      isCurrent = false;
    };
  }, [generatedTemplate, showZonesOverlay, zones, examTitle]);

  // Action: Save template to app state
  const handleSaveTemplate = () => {
    addTemplate(generatedTemplate);
    setSaveSuccessMessage('Đã lưu mẫu phiếu trắc nghiệm thành công!');
    setTimeout(() => {
      setSaveSuccessMessage('');
      onClose();
    }, 1200);
  };

  // Action: Save & Open in Studio for custom fine-tuning
  const handleSaveAndOpenStudio = () => {
    addTemplate(generatedTemplate);
    if (onSavedAndEdit) {
      onSavedAndEdit(generatedTemplate);
    }
    onClose();
  };

  // Action: Direct Print
  const handlePrint = () => {
    if (!previewDataUrl) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>In Phiếu Trả Lời Trắc Nghiệm - ${templateName}</title>
            <style>
              @page { size: A4 portrait; margin: 0; }
              body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: white; }
              img { width: 100vw; height: 100vh; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${previewDataUrl}" onload="window.print();window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Action: Download crisp PDF
  const handleDownloadPDF = () => {
    if (!previewDataUrl) return;
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(previewDataUrl, 'PNG', 0, 0, 210, 297);
    const filename = `PhieuTrisNghiem_${numQuestions}cau_${schoolName.replace(/\s+/g, '_')}.pdf`;
    pdf.save(filename);
  };

  const questionZonesCount = zones.filter(z => z.type === 'bubble').length;
  const sbdZonesCount = zones.filter(z => z.type === 'student_id_bubble').length;
  const examCodeZonesCount = zones.filter(z => z.type === 'exam_code_bubble').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden text-slate-900">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Tạo & Thiết Kế Phiếu Trắc Nghiệm Trực Tiếp</h2>
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full">
                  OMR Vector Designer
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tùy chỉnh bật/tắt mọi trường thông tin, thêm trường tùy thích, đóng khung câu hỏi và tinh chỉnh ô tô OMR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="btn_print_designer"
              onClick={handlePrint}
              disabled={isGenerating || !previewDataUrl}
              className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 flex items-center gap-2 transition"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              In trực tiếp
            </button>

            <button
              id="btn_pdf_designer"
              onClick={handleDownloadPDF}
              disabled={isGenerating || !previewDataUrl}
              className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Tải PDF A4
            </button>

            <button
              id="btn_save_designer"
              onClick={handleSaveTemplate}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center gap-2 shadow-md shadow-blue-600/30 transition"
            >
              <Save className="w-4 h-4" />
              Lưu vào hệ thống
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Panel: Configuration Tabs & Forms */}
          <div className="w-full lg:w-[500px] xl:w-[540px] bg-slate-50 border-r border-slate-200 flex flex-col h-full overflow-hidden shrink-0">
            {/* Quick Presets Bar */}
            <div className="p-3 bg-white border-b border-slate-200 shrink-0">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5">
                Mẫu nhanh chuẩn (Presets):
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {presets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition border ${
                      numQuestions === p.q && columnsCount === p.cols
                        ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-xs'
                        : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-3 pt-2 shrink-0">
              <button
                onClick={() => setActiveTab('exam')}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  activeTab === 'exam'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Kỳ thi & Trường
              </button>
              <button
                onClick={() => setActiveTab('student')}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  activeTab === 'student'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Học sinh & Tùy biến
              </button>
              <button
                onClick={() => setActiveTab('id_code')}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  activeTab === 'id_code'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                Tô SBD & Mã Đề
              </button>
              <button
                onClick={() => setActiveTab('questions')}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  activeTab === 'questions'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                Ma trận câu hỏi
              </button>
            </div>

            {/* Tab Contents: Scrollable Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-900">
              {/* TAB 1: EXAM & SCHOOL INFO */}
              {activeTab === 'exam' && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-xs">
                    <label className="text-xs font-bold text-slate-900 block">Tên mẫu phiếu</label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      placeholder="VD: Phiếu 60 câu - FPT Schools"
                      className="w-full px-3 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* School & Department with visibility checkboxes */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Đơn vị & Cơ quan:</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-900">Tên trường / Đơn vị</label>
                          <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showSchoolName}
                              onChange={e => setShowSchoolName(e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded"
                            />
                            Hiện
                          </label>
                        </div>
                        <input
                          type="text"
                          value={schoolName}
                          disabled={!showSchoolName}
                          onChange={e => setSchoolName(e.target.value)}
                          placeholder="VD: FPT SCHOOLS"
                          className="w-full px-3 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-900">Cơ quan chủ quản</label>
                          <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showDepartmentName}
                              onChange={e => setShowDepartmentName(e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded"
                            />
                            Hiện
                          </label>
                        </div>
                        <input
                          type="text"
                          value={departmentName}
                          disabled={!showDepartmentName}
                          onChange={e => setDepartmentName(e.target.value)}
                          placeholder="VD: SỞ GIÁO DỤC VÀ ĐÀO TẠO"
                          className="w-full px-3 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Exam Title with toggle */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-900">Tiêu đề kỳ thi / Bài kiểm tra</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showExamTitle}
                          onChange={e => setShowExamTitle(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 rounded"
                        />
                        Hiện trên phiếu
                      </label>
                    </div>
                    <input
                      type="text"
                      value={examTitle}
                      disabled={!showExamTitle}
                      onChange={e => setExamTitle(e.target.value)}
                      placeholder="VD: KIỂM TRA HỌC KỲ I - ĐÁNH GIÁ NĂNG LỰC"
                      className="w-full px-3 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  {/* Meta items: Subject & Duration */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Thông tin môn thi & ca thi:</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-900">Môn thi</label>
                          <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showSubjectName}
                              onChange={e => setShowSubjectName(e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded"
                            />
                            Hiện
                          </label>
                        </div>
                        <input
                          type="text"
                          value={subjectName}
                          disabled={!showSubjectName}
                          onChange={e => setSubjectName(e.target.value)}
                          placeholder="VD: Toán học"
                          className="w-full px-3 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-900">Thời gian (phút)</label>
                          <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showDurationMinutes}
                              onChange={e => setShowDurationMinutes(e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded"
                            />
                            Hiện
                          </label>
                        </div>
                        <input
                          type="number"
                          min={5}
                          max={180}
                          value={durationMinutes}
                          disabled={!showDurationMinutes}
                          onChange={e => setDurationMinutes(parseInt(e.target.value, 10) || 60)}
                          className="w-full px-3 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-900">Khối / Lớp</label>
                          <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showExamClass}
                              onChange={e => setShowExamClass(e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded"
                            />
                            Hiện
                          </label>
                        </div>
                        <input
                          type="text"
                          value={examClass}
                          disabled={!showExamClass}
                          onChange={e => setExamClass(e.target.value)}
                          placeholder="Khối 10"
                          className="w-full px-3 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-900">Phòng thi</label>
                          <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showRoomNumber}
                              onChange={e => setShowRoomNumber(e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded"
                            />
                            Hiện
                          </label>
                        </div>
                        <input
                          type="text"
                          value={roomNumber}
                          disabled={!showRoomNumber}
                          onChange={e => setRoomNumber(e.target.value)}
                          placeholder="P.01"
                          className="w-full px-3 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-900">Ngày thi</label>
                          <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showExamDate}
                              onChange={e => setShowExamDate(e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded"
                            />
                            Hiện
                          </label>
                        </div>
                        <input
                          type="date"
                          value={examDate}
                          disabled={!showExamDate}
                          onChange={e => setExamDate(e.target.value)}
                          className="w-full px-2 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Teacher Score Box Toggle */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTeacherScoreBox}
                        onChange={e => setShowTeacherScoreBox(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Khung Điểm số & Chữ ký Giám thị</span>
                        <span className="text-[11px] text-slate-500">Ô đóng khung ghi điểm bài thi, chữ ký giám thị 1, giám thị 2 và lời phê</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: STUDENT INFO & CUSTOM EXTRA FIELDS */}
              {activeTab === 'student' && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  {/* Student Info Box Parent Toggle */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showStudentInfoBox}
                        onChange={e => setShowStudentInfoBox(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Hiển thị Khung Thông Tin Thí Sinh</span>
                        <span className="text-[11px] text-slate-500">Bật/tắt toàn bộ khung chữ nhật chứa thông tin thí sinh</span>
                      </div>
                    </label>

                    {showStudentInfoBox && (
                      <div className="pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showStudentName}
                            onChange={e => setShowStudentName(e.target.checked)}
                            className="w-3.5 h-3.5 text-blue-600 rounded"
                          />
                          Họ và tên
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showStudentDob}
                            onChange={e => setShowStudentDob(e.target.checked)}
                            className="w-3.5 h-3.5 text-blue-600 rounded"
                          />
                          Ngày sinh
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showStudentSignature}
                            onChange={e => setShowStudentSignature(e.target.checked)}
                            className="w-3.5 h-3.5 text-blue-600 rounded"
                          />
                          Chữ ký thí sinh
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Dynamic Custom Fields Section */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Trường thông tin tùy thích (Custom Fields):</span>
                        <span className="text-[11px] text-slate-500">Thêm các trường tùy biến như Hội đồng thi, Ca thi, CCCD/CMND...</span>
                      </div>
                    </div>

                    {/* Add Custom Field Form */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newFieldLabel}
                        onChange={e => setNewFieldLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddCustomField(); }}
                        placeholder="Nhập tên trường mới (VD: Hội đồng thi, Ca thi, Số CCCD...)"
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomField}
                        disabled={!newFieldLabel.trim()}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Thêm
                      </button>
                    </div>

                    {/* List of custom fields */}
                    {customFields.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {customFields.map((field) => (
                          <div key={field.id} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                            <input
                              type="text"
                              value={field.label}
                              onChange={e => handleUpdateCustomField(field.id, { label: e.target.value })}
                              className="w-1/3 px-2 py-1 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Tên trường"
                            />
                            <input
                              type="text"
                              value={field.value || ''}
                              onChange={e => handleUpdateCustomField(field.id, { value: e.target.value })}
                              className="flex-1 px-2 py-1 text-xs text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Giá trị mặc định (hoặc để trống dấu chấm)"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomField(field.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition"
                              title="Xóa trường này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Instructions Box */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showInstructionsBox}
                        onChange={e => setShowInstructionsBox(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Hiển thị Khung Hướng Dẫn Tô Đáp Án</span>
                        <span className="text-[11px] text-slate-500">Dải banner hướng dẫn quy cách tô tròn kín ô bút chì 2B</span>
                      </div>
                    </label>
                    {showInstructionsBox && (
                      <textarea
                        rows={2}
                        value={instructionsText}
                        onChange={e => setInstructionsText(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>

                  {/* Anchors & QR Code */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-xs">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Định vị & Mã hóa:</div>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasAnchorMarks}
                        onChange={e => setHasAnchorMarks(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">4 Điểm định vị góc OMR (Anchor Marks)</span>
                        <span className="text-[11px] text-slate-500">Khuyến nghị BẬT để camera/máy quét tự động nắn thẳng góc xoay</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasQrCode}
                        onChange={e => setHasQrCode(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Khung Mã QR định danh học sinh</span>
                        <span className="text-[11px] text-slate-500">Tự động in mã QR chứa SBD và thông tin học sinh theo lớp</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 3: SBD & EXAM CODE MATRIX */}
              {activeTab === 'id_code' && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  {/* SBD Section */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                          SBD
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Số Báo Danh (SBD) Tô Ô</span>
                          <span className="text-[11px] text-slate-500">Ô vuông viết số bên trên + Ma trận tô 0-9 sát nhau bên dưới</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={hasStudentIdBubbles}
                        onChange={e => setHasStudentIdBubbles(e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                      />
                    </div>

                    {hasStudentIdBubbles && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-800">Số chữ số SBD (Số cột ô tô):</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={2}
                            max={10}
                            value={numStudentIdDigits}
                            onChange={e => setNumStudentIdDigits(parseInt(e.target.value, 10))}
                            className="w-28"
                          />
                          <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded">
                            {numStudentIdDigits} chữ số
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Exam Code Section */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                          MĐ
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Mã Đề Thi Tô Ô</span>
                          <span className="text-[11px] text-slate-500">Ô vuông viết số bên trên + Ma trận tô 0-9 sát nhau bên dưới</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={hasExamCodeBubbles}
                        onChange={e => setHasExamCodeBubbles(e.target.checked)}
                        className="w-5 h-5 text-emerald-600 rounded cursor-pointer"
                      />
                    </div>

                    {hasExamCodeBubbles && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-800">Số chữ số Mã Đề (Số cột ô tô):</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={2}
                            max={6}
                            value={numExamCodeDigits}
                            onChange={e => setNumExamCodeDigits(parseInt(e.target.value, 10))}
                            className="w-28"
                          />
                          <span className="px-2 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                            {numExamCodeDigits} chữ số
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      Quy chuẩn Ô viết số & Ô tô SBD/Mã Đề
                    </span>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Phía trên gồm các ô vuông trắng rộng rãi viền đen để học sinh điền số bằng tay. Bên dưới là các vòng tròn số 0-9 được căn chỉnh sát nhau theo chuẩn phiếu Bộ GD&ĐT giúp học sinh tô nhanh và chống lệch dòng.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: QUESTIONS MATRIX CONFIG */}
              {activeTab === 'questions' && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  {/* Question Count Slider */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-900">Số lượng câu trắc nghiệm:</label>
                      <span className="px-2.5 py-1 text-sm font-bold bg-blue-600 text-white rounded-lg">
                        {numQuestions} câu
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={120}
                      step={5}
                      value={numQuestions}
                      onChange={e => setNumQuestions(parseInt(e.target.value, 10))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                      <span>5 câu</span>
                      <span>20</span>
                      <span>40</span>
                      <span>60</span>
                      <span>80</span>
                      <span>100</span>
                      <span>120 câu</span>
                    </div>
                  </div>

                  {/* Options per question */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs">
                    <label className="text-xs font-bold text-slate-900 block">Số lựa chọn đáp án mỗi câu:</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { val: 2, label: '2 (Đ/S)' },
                        { val: 3, label: '3 (A-C)' },
                        { val: 4, label: '4 (A-D)' },
                        { val: 5, label: '5 (A-E)' },
                        { val: 6, label: '6 (A-F)' }
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setNumOptions(opt.val)}
                          className={`py-2 text-xs font-bold rounded-lg border transition ${
                            numOptions === opt.val
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Columns Count Layout */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-900">Số cột đóng khung trên trang:</label>
                      <span className="text-xs font-bold text-slate-700">
                        {Math.ceil(numQuestions / columnsCount)} câu / cột
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map(cols => (
                        <button
                          key={cols}
                          type="button"
                          onClick={() => setColumnsCount(cols)}
                          className={`py-2 text-xs font-bold rounded-lg border transition ${
                            columnsCount === cols
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {cols} cột
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question numbering direction */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs">
                    <label className="text-xs font-bold text-slate-900 block">Thứ tự đánh số câu hỏi:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDirection('column_first')}
                        className={`p-2 text-left text-xs rounded-lg border transition ${
                          direction === 'column_first'
                            ? 'bg-blue-50 text-blue-900 border-blue-300 font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block font-bold">Theo Cột (Chuẩn)</span>
                        <span className="text-[10px] text-slate-500 block">Cột 1: Q1..15, Cột 2: Q16..30</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDirection('row_first')}
                        className={`p-2 text-left text-xs rounded-lg border transition ${
                          direction === 'row_first'
                            ? 'bg-blue-50 text-blue-900 border-blue-300 font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block font-bold">Theo Hàng ngang</span>
                        <span className="text-[10px] text-slate-500 block">Q1, Q2, Q3 xếp ngang các cột</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Left Panel Footer Summary */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="text-[11px] text-slate-600 font-medium">
                <strong className="text-slate-900">{numQuestions} câu</strong> •{' '}
                <span>{columnsCount} cột</span> •{' '}
                <span>{zones.length} ô OMR</span>
              </div>
              <button
                type="button"
                onClick={handleSaveAndOpenStudio}
                className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
              >
                Mở trong Studio hiệu chỉnh
              </button>
            </div>
          </div>

          {/* Right Panel: Real-time Live Sheet Preview */}
          <div className="flex-1 bg-slate-200 flex flex-col overflow-hidden">
            {/* Preview Toolbar */}
            <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-blue-600" />
                  Xem trước thời gian thực (Live Preview)
                </span>
                <span className="text-xs text-slate-400">|</span>
                <button
                  type="button"
                  onClick={() => setShowZonesOverlay(!showZonesOverlay)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition ${
                    showZonesOverlay
                      ? 'bg-blue-100 text-blue-800 font-bold border border-blue-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  {showZonesOverlay ? 'Lớp phủ OMR: BẬT' : 'Lớp phủ OMR: TẮT'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.1))}
                  className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-md transition"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-800 w-12 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(1.6, prev + 0.1))}
                  className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-md transition"
                  title="Phóng to"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1.0)}
                  className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-md transition"
                  title="Đặt lại 100%"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Canvas Preview Area */}
            <div className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center bg-slate-200/90">
              {isGenerating && !previewDataUrl ? (
                <div className="flex flex-col items-center gap-3 text-slate-600">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold">Đang sinh đồ họa phiếu thi OMR vector...</span>
                </div>
              ) : (
                <div
                  className="bg-white shadow-2xl rounded-sm border border-slate-300 overflow-hidden transition-transform origin-top"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    maxWidth: '100%'
                  }}
                >
                  {previewDataUrl && (
                    <img
                      src={previewDataUrl}
                      alt="Xem trước phiếu trắc nghiệm"
                      className="w-[580px] xl:w-[680px] h-auto object-contain block select-none pointer-events-none"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Preview Status & Metrics Bar */}
            <div className="px-4 py-2 bg-slate-900 text-slate-300 text-xs flex items-center justify-between shrink-0 border-t border-slate-800">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Tọa độ OMR tự động tối ưu
                </span>
                <span>•</span>
                <span>Ô đáp án: <strong className="text-white">{questionZonesCount}</strong></span>
                <span>•</span>
                <span>Ô SBD: <strong className="text-purple-300">{sbdZonesCount}</strong></span>
                <span>•</span>
                <span>Ô Mã đề: <strong className="text-emerald-300">{examCodeZonesCount}</strong></span>
              </div>

              {saveSuccessMessage ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {saveSuccessMessage}
                </span>
              ) : (
                <span className="text-slate-400">Độ phân giải vector xuất bản: 300 DPI A4</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
