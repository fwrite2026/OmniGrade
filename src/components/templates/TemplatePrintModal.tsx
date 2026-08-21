import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { AnswerSheetTemplate, Student } from '../../types';
import { renderTemplateToCanvas, getTemplateRealStats } from '../../services/templateGenerator';
import { Printer, Download, X, Users, FileText, CheckCircle2 } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface TemplatePrintModalProps {
  template: AnswerSheetTemplate;
  onClose: () => void;
}

export const TemplatePrintModal: React.FC<TemplatePrintModalProps> = ({ template, onClose }) => {
  const { t, students, activeExam } = useApp();
  const [mode, setMode] = useState<'blank' | 'personalized'>('blank');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.studentId || '');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const currentStudent = mode === 'personalized' ? students.find(s => s.studentId === selectedStudentId) : undefined;

  useEffect(() => {
    let isMounted = true;
    const generatePreview = async () => {
      setIsGenerating(true);
      try {
        const canvas = await renderTemplateToCanvas(
          template,
          currentStudent,
          activeExam?.code || '101',
          activeExam?.title || 'BÀI THI TRẮC NGHIỆM ĐÁNH GIÁ NĂNG LỰC'
        );
        if (isMounted) {
          setPreviewUrl(canvas.toDataURL('image/png'));
        }
      } catch (err) {
        console.error('Failed to render preview', err);
      } finally {
        if (isMounted) setIsGenerating(false);
      }
    };

    generatePreview();
    return () => {
      isMounted = false;
    };
  }, [template, currentStudent, activeExam, mode]);

  const handlePrint = () => {
    if (!previewUrl) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>In Phiếu Trả Lời Trắc Nghiệm - ${template.name}</title>
            <style>
              @page { size: A4 portrait; margin: 0; }
              body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; }
              img { width: 100vw; height: 100vh; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${previewUrl}" onload="window.print();window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleDownloadPDF = async () => {
    if (!previewUrl) return;
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(previewUrl, 'PNG', 0, 0, 210, 297);
    const filename = mode === 'personalized' && currentStudent 
      ? `PhieuThi_${currentStudent.studentId}_${currentStudent.name.replace(/\s+/g, '_')}.pdf`
      : `PhieuThi_Trang_${template.id}.pdf`;
    pdf.save(filename);
  };

  const handlePrintAllClass = async () => {
    setIsGenerating(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      for (let i = 0; i < students.length; i++) {
        const std = students[i];
        const canvas = await renderTemplateToCanvas(
          template,
          std,
          activeExam?.code || '101',
          activeExam?.title
        );
        const dataUrl = canvas.toDataURL('image/png');
        if (i > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297);
      }
      pdf.save(`TapPhieuThi_Lop_${students[0]?.className || '6A1'}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#0E131F] rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#0B0F17]/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">{t.template.printBlank} / {t.template.printPersonalized}</h3>
              <p className="text-xs text-slate-400">{template.name} • {template.numQuestions} câu</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto flex-1">
          {/* Controls Column */}
          <div className="space-y-5">
            {/* Mode selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Chế độ in phiếu:</label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setMode('blank')}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition cursor-pointer ${
                    mode === 'blank'
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 font-semibold shadow-lg shadow-cyan-500/10'
                      : 'border-white/10 hover:border-white/20 text-slate-300 bg-white/5'
                  }`}
                >
                  <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-white">Phiếu thi trắng</p>
                    <p className="text-[11px] text-slate-400 font-normal">Học sinh tự điền họ tên, mã số và tô SBD</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('personalized')}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition cursor-pointer ${
                    mode === 'personalized'
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 font-semibold shadow-lg shadow-cyan-500/10'
                      : 'border-white/10 hover:border-white/20 text-slate-300 bg-white/5'
                  }`}
                >
                  <Users className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-white">Phiếu in sẵn kèm mã QR</p>
                    <p className="text-[11px] text-slate-400 font-normal">In sẵn Họ tên, Lớp, SBD & QR quét tự động</p>
                  </div>
                </button>
              </div>
            </div>

            {/* If personalized, choose student or batch */}
            {mode === 'personalized' && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <label className="text-xs font-bold text-slate-200">Chọn học sinh xem trước:</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full text-xs font-medium bg-black/50 text-white border border-white/10 rounded-xl p-2.5 focus:border-cyan-500/50 focus:outline-hidden"
                >
                  {students.map((s) => (
                    <option key={s.studentId} value={s.studentId} className="bg-slate-900 text-white">
                      {s.studentId} - {s.name} ({s.className})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handlePrintAllClass}
                  disabled={isGenerating}
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-500/20"
                >
                  <Users className="w-4 h-4" />
                  <span>Xuất tập PDF toàn bộ lớp ({students.length} em)</span>
                </button>
              </div>
            )}

            {/* Template Specs */}
            {(() => {
              const realStats = getTemplateRealStats(template);
              return (
                <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-xs space-y-1.5 text-cyan-200">
                  <p className="font-bold flex items-center gap-1.5 text-cyan-300">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    Thông số bản in phiếu trả lời:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-cyan-200/80 text-[11px]">
                    <li className="font-semibold text-white">
                      {realStats.numQuestions} câu trắc nghiệm ({realStats.numOptions} lựa chọn: {realStats.optionLabels})
                    </li>
                    <li className="font-semibold text-white">
                      Bố cục: {realStats.columnsCount} Cột ({realStats.questionsPerColumn} câu/cột)
                    </li>
                    {template.backgroundImageUrl ? (
                      <li className="text-emerald-300 font-medium">
                        ✨ Giữ nguyên 100% tiêu đề, nội dung & câu hỏi từ file gốc tải lên
                      </li>
                    ) : (
                      <li>Tiêu đề & thông tin trường: {template.schoolName}</li>
                    )}
                    <li>Khổ giấy: {template.paperSize || 'A4'} chuẩn (210 × 297 mm)</li>
                    <li>Độ nét in ấn: 300 DPI tiêu chuẩn OMR chống lệch</li>
                    {template.hasQrCode && <li>Mã QR định danh chống nhầm lẫn bài thi</li>}
                    <li>Sẵn sàng in trực tiếp hoặc xuất PDF</li>
                  </ul>
                </div>
              );
            })()}
          </div>

          {/* Preview Canvas Column */}
          <div className="md:col-span-2 flex flex-col items-center justify-center bg-[#050811] rounded-2xl p-4 border border-white/10 min-h-[380px]">
            {isGenerating ? (
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-300">Đang khởi tạo phiếu in độ nét cao...</p>
              </div>
            ) : previewUrl ? (
              <div className="w-full max-w-[340px] shadow-2xl rounded-sm overflow-hidden bg-white border border-white/20">
                <img 
                  src={previewUrl} 
                  alt="Answer Sheet Preview" 
                  className="w-full h-auto object-contain block"
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3 bg-[#0B0F17]/90">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            {t.actions.close}
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating || !previewUrl}
            className="px-4 py-2 text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Tải tệp PDF</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={isGenerating || !previewUrl}
            className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            <Printer className="w-4 h-4" />
            <span>In ngay</span>
          </button>
        </div>
      </div>
    </div>
  );
};
