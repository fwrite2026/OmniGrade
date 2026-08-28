import React, { useState, useEffect } from 'react';
import { Exam, ExamSubmission } from '../../types';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Printer,
  User,
  Award,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  FileText,
  Clock,
  ShieldCheck,
  HelpCircle,
  Eye,
  Sparkles,
  Layers,
  History
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { loadSubmissionImage } from '../../services/imageStorage';

interface StudentReportModalProps {
  exam: Exam;
  submission: ExamSubmission;
  allSubmissions?: ExamSubmission[];
  currentIndex?: number;
  onNavigate?: (newIndex: number) => void;
  onClose: () => void;
}

export const StudentReportModal: React.FC<StudentReportModalProps> = ({
  exam,
  submission,
  allSubmissions = [],
  currentIndex = 0,
  onNavigate,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'sheet' | 'audit'>('matrix');
  const [filterAnswerType, setFilterAnswerType] = useState<'all' | 'correct' | 'wrong' | 'issues'>('all');
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  // Load scanned image from storage
  useEffect(() => {
    let isMounted = true;
    const fetchImage = async () => {
      setIsLoadingImage(true);
      try {
        if (submission.scannedImageUrl && submission.scannedImageUrl.startsWith('data:')) {
          setScannedImage(submission.scannedImageUrl);
        } else {
          const img = await loadSubmissionImage(submission.scannedImageUrl || submission.id);
          if (isMounted) setScannedImage(img);
        }
      } catch (e) {
        console.warn('Failed loading submission image:', e);
      } finally {
        if (isMounted) setIsLoadingImage(false);
      }
    };
    fetchImage();
    return () => {
      isMounted = false;
    };
  }, [submission.id, submission.scannedImageUrl]);

  const handlePrintStudentReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text('PHIẾU BÁO ĐIỂM HỌC SINH', 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text(`Họ và tên: ${submission.studentName}`, 14, 30);
    doc.text(`Mã HS / SBD: ${submission.studentId} | Lớp: ${submission.className} | Mã đề: ${submission.appliedVariantCode || submission.detectedExamCode || exam.code}`, 14, 37);
    doc.text(`Bài thi: ${exam.title} (${exam.code})`, 14, 44);
    doc.text(`Điểm số: ${submission.totalScore} / ${exam.maxScore} điểm`, 14, 51);
    doc.text(`Số câu đúng: ${submission.totalCorrect} / ${exam.numQuestions} câu (Tỷ lệ: ${((submission.totalCorrect / (exam.numQuestions || 1)) * 100).toFixed(1)}%)`, 14, 58);
    doc.text(`Độ tin cậy OMR: ${submission.overallConfidence}% | Trạng thái: ${submission.status === 'GRADED' ? 'Đã duyệt chấm' : 'Cần xem lại'}`, 14, 65);

    doc.line(14, 70, 196, 70);

    let y = 78;
    doc.setFontSize(10);
    doc.text('BẢNG CHI TIẾT CÂU TRẢ LỜI:', 14, y);
    y += 8;

    const answersList = submission.recognizedAnswers || [];
    answersList.forEach((ans, idx) => {
      const mark = ans.isCorrect ? 'Đúng' : ans.status === 'MULTIPLE' ? 'Tô nhiều ô' : ans.status === 'BLANK' ? 'Bỏ trống' : 'Sai';
      const text = `Câu ${ans.questionNumber}: Chọn [${ans.selectedOption || '—'}] - ĐA [${ans.correctAnswer}] (${mark})`;
      const colX = idx < 20 ? 14 : idx < 40 ? 76 : 138;
      const rowY = y + (idx % 20) * 5.5;
      if (idx < 60) {
        doc.text(text, colX, rowY);
      }
    });

    doc.save(`Phieu_Diem_${submission.studentId}_${exam.code}.pdf`);
  };

  const rawAnswers = submission.recognizedAnswers || [];
  const filteredAnswers = rawAnswers.filter(ans => {
    if (filterAnswerType === 'correct') return ans.isCorrect;
    if (filterAnswerType === 'wrong') return !ans.isCorrect && ans.status !== 'BLANK';
    if (filterAnswerType === 'issues') return ans.status === 'MULTIPLE' || ans.status === 'UNCERTAIN' || ans.status === 'BLANK';
    return true;
  });

  const hasPrev = onNavigate && currentIndex > 0;
  const hasNext = onNavigate && currentIndex < allSubmissions.length - 1;

  // Grade classification badge
  const scorePercent = ((submission.totalScore / (exam.maxScore || 10)) * 10);
  let gradeBand = 'Trung bình';
  let gradeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  if (scorePercent >= 9.0) {
    gradeBand = 'Xuất sắc';
    gradeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  } else if (scorePercent >= 8.0) {
    gradeBand = 'Giỏi';
    gradeColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
  } else if (scorePercent >= 6.5) {
    gradeBand = 'Khá';
    gradeColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  } else if (scorePercent < 5.0) {
    gradeBand = 'Chưa đạt';
    gradeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#0B0F17] rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold shadow-inner">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-lg">{submission.studentName}</h3>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${gradeColor}`}>
                  {gradeBand}
                </span>
                {submission.status === 'NEEDS_REVIEW' && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Cần duyệt OMR
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>SBD: <strong className="text-cyan-300 font-mono">{submission.studentId}</strong></span>
                <span>•</span>
                <span>Lớp: <strong className="text-slate-200">{submission.className}</strong></span>
                <span>•</span>
                <span>Mã đề: <strong className="text-cyan-400 font-bold px-1.5 py-0.2 bg-cyan-500/10 border border-cyan-500/20 rounded">{submission.appliedVariantCode || submission.detectedExamCode || exam.code}</strong></span>
                <span>•</span>
                <span>Độ tin cậy: <strong className="text-emerald-400">{submission.overallConfidence}%</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Navigation Between Students */}
            {allSubmissions.length > 1 && onNavigate && (
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                <button
                  onClick={() => onNavigate(currentIndex - 1)}
                  disabled={!hasPrev}
                  title="Học sinh trước"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-400 px-2">
                  {currentIndex + 1} / {allSubmissions.length}
                </span>
                <button
                  onClick={() => onNavigate(currentIndex + 1)}
                  disabled={!hasNext}
                  title="Học sinh tiếp theo"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={handlePrintStudentReport}
              className="px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">In phiếu điểm</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2 border-b border-white/10 bg-white/[0.02] flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Bảng điểm & Câu trả lời ({rawAnswers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('sheet')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sheet'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ảnh phiếu OMR bài thi</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Nhật ký sửa đổi ({(submission.auditLogs || []).length})</span>
            </button>
          </div>

          {activeTab === 'matrix' && (
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5 text-[11px]">
              <button
                onClick={() => setFilterAnswerType('all')}
                className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer transition ${filterAnswerType === 'all' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Tất cả ({rawAnswers.length})
              </button>
              <button
                onClick={() => setFilterAnswerType('correct')}
                className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer transition ${filterAnswerType === 'correct' ? 'bg-emerald-500 text-black font-bold' : 'text-emerald-400 hover:text-white'}`}
              >
                Đúng ({submission.totalCorrect})
              </button>
              <button
                onClick={() => setFilterAnswerType('wrong')}
                className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer transition ${filterAnswerType === 'wrong' ? 'bg-rose-500 text-white font-bold' : 'text-rose-400 hover:text-white'}`}
              >
                Sai ({submission.totalWrong})
              </button>
              <button
                onClick={() => setFilterAnswerType('issues')}
                className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer transition ${filterAnswerType === 'issues' ? 'bg-amber-500 text-black font-bold' : 'text-amber-400 hover:text-white'}`}
              >
                Nghi vấn ({(submission.totalMultiple || 0) + (submission.totalUncertain || 0) + (submission.totalBlank || 0)})
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Top Score Banner */}
          <div className="bg-gradient-to-r from-cyan-950/40 via-blue-950/40 to-indigo-950/40 border border-cyan-500/25 rounded-2xl p-5 text-white flex flex-wrap items-center justify-between gap-4 shadow-lg backdrop-blur-xl">
            <div>
              <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" /> Kết quả chấm thi tự động
              </span>
              <h4 className="text-xl font-bold mt-1 text-white">{exam.title}</h4>
              <div className="flex items-center gap-3 text-xs text-slate-300 mt-2 flex-wrap">
                <span className="text-emerald-400 font-bold">✓ Đúng: {submission.totalCorrect}</span>
                <span className="text-rose-400 font-bold">✗ Sai: {submission.totalWrong}</span>
                <span className="text-slate-400">○ Trống: {submission.totalBlank || 0}</span>
                {(submission.totalMultiple || 0) > 0 && (
                  <span className="text-amber-400 font-bold">⚠ Tô {submission.totalMultiple} ô kép</span>
                )}
                {(submission.totalUncertain || 0) > 0 && (
                  <span className="text-yellow-400 font-bold">? Mờ {submission.totalUncertain} câu</span>
                )}
              </div>
            </div>
            <div className="flex items-baseline gap-2 bg-black/40 px-5 py-3 rounded-2xl border border-cyan-500/20">
              <span className="text-3xl font-extrabold text-cyan-300">{submission.totalScore}</span>
              <span className="text-sm text-slate-400">/ {exam.maxScore} điểm</span>
            </div>
          </div>

          {/* TAB 1: QUESTION MATRIX */}
          {activeTab === 'matrix' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Chi tiết từng câu hỏi ({filteredAnswers.length} câu hiển thị):
                </h4>
              </div>

              {filteredAnswers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm bg-white/5 rounded-2xl border border-white/5">
                  Không có câu hỏi nào khớp với bộ lọc đã chọn.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                  {filteredAnswers.map((ans) => {
                    const isManual = ans.status === 'MANUALLY_OVERRIDDEN' || ans.isManuallyCorrected;
                    return (
                      <div
                        key={ans.questionNumber}
                        className={`p-3 rounded-2xl border flex flex-col justify-between text-xs transition ${
                          ans.isCorrect
                            ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-300'
                            : ans.status === 'MULTIPLE'
                            ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                            : ans.status === 'UNCERTAIN'
                            ? 'bg-yellow-950/30 border-yellow-500/30 text-yellow-300'
                            : ans.selectedOption
                            ? 'bg-rose-950/25 border-rose-500/30 text-rose-300'
                            : 'bg-white/5 border-white/5 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-slate-200">Câu {ans.questionNumber}</span>
                          <span className="text-[10px] font-mono text-slate-400">+{ans.pointsEarned || 0}đ</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-extrabold font-mono text-sm px-1.5 py-0.5 rounded ${
                              ans.isCorrect ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {ans.selectedOption || '—'}
                            </span>
                            {!ans.isCorrect && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                (ĐA: {ans.correctAnswer})
                              </span>
                            )}
                          </div>

                          {ans.isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : ans.status === 'MULTIPLE' ? (
                            <span title="Tô nhiều đáp án">
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                            </span>
                          ) : ans.status === 'BLANK' ? (
                            <span className="text-[10px] text-slate-500">Trống</span>
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </div>

                        {ans.teacherNote && (
                          <p className="text-[10px] text-amber-300/80 mt-1 italic line-clamp-1">
                            {ans.teacherNote}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCANNED SHEET PREVIEW */}
          {activeTab === 'sheet' && (
            <div className="space-y-3">
              {/* Image Toolbar */}
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-2xl border border-white/10 text-xs">
                <span className="text-slate-300 font-medium px-2">
                  Xem trước phiếu bài làm OMR thực tế
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                    title="Thu nhỏ"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-slate-400 px-1">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                    title="Phóng to"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer ml-2"
                    title="Xoay ảnh 90 độ"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setZoomLevel(1); setRotation(0); }}
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs cursor-pointer ml-1"
                  >
                    Mặc định
                  </button>
                </div>
              </div>

              {/* Image Display Area */}
              <div className="relative bg-black/60 rounded-2xl border border-white/10 min-h-[360px] flex items-center justify-center overflow-auto p-4 max-h-[500px]">
                {isLoadingImage ? (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs">Đang tải ảnh bài làm từ IndexedDB...</span>
                  </div>
                ) : scannedImage ? (
                  <div
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease-out'
                    }}
                    className="origin-center max-w-full"
                  >
                    <img
                      src={scannedImage}
                      alt={`Phiếu bài làm của ${submission.studentName}`}
                      className="max-h-[460px] rounded-lg shadow-2xl object-contain"
                    />
                  </div>
                ) : (
                  <div className="text-center py-12 px-4 text-slate-400 max-w-md">
                    <Layers className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                    <p className="font-bold text-slate-300">Không có bản lưu ảnh quét cho bài này</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Dữ liệu nhận dạng OMR và bảng điểm vẫn được lưu trữ và tính toán chính xác trên hệ thống.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Lịch sử can thiệp & Nhật ký chấm thi:
              </h4>

              {(!submission.auditLogs || submission.auditLogs.length === 0) ? (
                <div className="text-center py-8 text-slate-400 text-xs bg-white/5 rounded-2xl border border-white/5">
                  Chưa có lần chỉnh sửa thủ công nào. Bài làm được chấm tự động bởi OMR Engine.
                </div>
              ) : (
                <div className="space-y-2">
                  {submission.auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-start gap-3 text-xs"
                    >
                      <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 mt-0.5">
                        <History className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-white font-bold">{log.action}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.timestamp).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        {log.previousValue && (
                          <p className="text-slate-400 mt-0.5">
                            Trước: <span className="text-rose-300 line-through">{log.previousValue}</span>
                          </p>
                        )}
                        {log.newValue && (
                          <p className="text-slate-300 mt-0.5">
                            Sau: <span className="text-emerald-300 font-bold">{log.newValue}</span>
                          </p>
                        )}
                        {log.reason && (
                          <p className="text-amber-300/80 mt-1 italic text-[11px]">
                            Lý do: {log.reason}
                          </p>
                        )}
                        <span className="text-[10px] text-slate-500 mt-1 inline-block">
                          Thực hiện bởi: {log.changedBy}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
