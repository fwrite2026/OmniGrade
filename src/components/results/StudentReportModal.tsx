import React from 'react';
import { Exam, ExamSubmission } from '../../types';
import { X, CheckCircle2, XCircle, AlertTriangle, Printer, User, Award } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface StudentReportModalProps {
  exam: Exam;
  submission: ExamSubmission;
  onClose: () => void;
}

export const StudentReportModal: React.FC<StudentReportModalProps> = ({ exam, submission, onClose }) => {
  const handlePrintStudentReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text('PHIẾU BÁO ĐIỂM HỌC SINH', 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text(`Họ và tên: ${submission.studentName}`, 14, 30);
    doc.text(`Mã HS: ${submission.studentId} | Lớp: ${submission.className}`, 14, 37);
    doc.text(`Bài thi: ${exam.title} (${exam.code})`, 14, 44);
    doc.text(`Điểm số: ${submission.totalScore} / ${exam.maxScore}`, 14, 51);
    doc.text(`Số câu đúng: ${submission.totalCorrect} / ${exam.numQuestions}`, 14, 58);

    doc.line(14, 64, 196, 64);

    let y = 74;
    doc.setFontSize(10);
    doc.text('Chi tiết câu trả lời:', 14, y);
    y += 8;

    const answersList = submission.recognizedAnswers || [];
    answersList.forEach((ans, idx) => {
      const mark = ans.isCorrect ? 'Đúng' : 'Sai';
      const text = `Câu ${ans.questionNumber}: Chọn [${ans.selectedOption || 'Trống'}] - ĐA [${ans.correctAnswer}] (${mark})`;
      const colX = idx < 20 ? 14 : 110;
      const rowY = y + (idx % 20) * 6;
      doc.text(text, colX, rowY);
    });

    doc.save(`Phieu_Diem_${submission.studentId}_${exam.code}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#0B0F17] rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">{submission.studentName}</h3>
              <p className="text-xs text-slate-400">Mã HS: <span className="text-cyan-300 font-mono">{submission.studentId}</span> • Lớp: {submission.className}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintStudentReport}
              className="px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <Printer className="w-4 h-4" />
              <span>In phiếu báo điểm</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Top Score Banner */}
          <div className="bg-gradient-to-r from-cyan-600/80 via-blue-600/80 to-indigo-700/80 border border-cyan-500/30 rounded-2xl p-5 text-white flex items-center justify-between shadow-lg shadow-cyan-500/10 backdrop-blur-xl">
            <div>
              <span className="text-xs font-semibold text-cyan-200 uppercase tracking-wider">Kết quả tổng kết</span>
              <h4 className="text-xl font-bold">{exam.title}</h4>
              <p className="text-xs text-cyan-100/80 mt-1">
                Đúng {submission.totalCorrect} / {exam.numQuestions} câu • Độ tin cậy OMR: {submission.overallConfidence}%
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-extrabold">{submission.totalScore}</span>
              <span className="text-sm text-cyan-200"> / {exam.maxScore}</span>
            </div>
          </div>

          {/* Question Breakdown Matrix */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Chi tiết câu trả lời bài làm:
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(submission.recognizedAnswers || []).map((ans) => {
                return (
                  <div
                    key={ans.questionNumber}
                    className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs transition ${
                      ans.isCorrect
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                        : ans.selectedOption
                        ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                        : 'bg-white/5 border-white/5 text-slate-400'
                    }`}
                  >
                    <span className="font-bold text-slate-200">Câu {ans.questionNumber}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold font-mono">
                        {ans.selectedOption || '—'}
                      </span>
                      {ans.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">
                          (ĐA: {ans.correctAnswer})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
