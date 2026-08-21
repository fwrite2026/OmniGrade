import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BubbleOption, ExamSubmission, RecognizedAnswer } from '../../types';
import {
  AlertTriangle,
  CheckCircle2,
  Check,
  RotateCcw,
  History,
  FileText,
  User,
  HelpCircle,
  Clock,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ZoomIn
} from 'lucide-react';

export const ReviewQueue: React.FC = () => {
  const { t, submissions, activeExam, overrideAnswer, approveSubmission, role } = useApp();

  const flaggedSubmissions = submissions.filter(s => 
    s.status === 'NEEDS_REVIEW' || s.status === 'MULTIPLE_ANSWERS' || s.status === 'LOW_CONFIDENCE'
  );

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>(
    flaggedSubmissions[0]?.id || submissions[0]?.id || ''
  );

  const [selectedQNum, setSelectedQNum] = useState<number>(1);
  const [overrideReason, setOverrideReason] = useState<string>('Học sinh tẩy đáp án cũ và tô lại');

  const currentSubmission = submissions.find(s => s.id === selectedSubmissionId) || flaggedSubmissions[0] || submissions[0];

  // If no submissions at all
  if (!currentSubmission) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Không có bài thi nào cần duyệt!</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Tất cả các bài thi đã được động cơ OMR chấm chuẩn xác với độ tin cậy cao và không phát hiện trường hợp nghi vấn.
        </p>
      </div>
    );
  }

  const recognizedAnswers = currentSubmission.recognizedAnswers || [];
  const activeAnswer = recognizedAnswers.find(r => r.questionNumber === selectedQNum) || recognizedAnswers[0];

  // Flagged questions in current submission
  const flaggedQuestionsInSub = recognizedAnswers.filter(r => 
    r.status === 'MULTIPLE' || r.status === 'UNCERTAIN' || r.confidence < 75
  );

  const handleApplyOverride = (newOption: BubbleOption | null) => {
    overrideAnswer(currentSubmission.id, selectedQNum, newOption, overrideReason);
  };

  const handleApproveAll = () => {
    approveSubmission(currentSubmission.id);
    // Find next flagged
    const nextFlagged = flaggedSubmissions.find(s => s.id !== currentSubmission.id);
    if (nextFlagged) {
      setSelectedSubmissionId(nextFlagged.id);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/10">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <span>{t.review.title}</span>
            </h1>
            {flaggedSubmissions.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950/60 border border-amber-500/30 text-amber-400 animate-pulse">
                {flaggedSubmissions.length} bài cần duyệt
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t.review.subtitle}
          </p>
        </div>

        <button
          id="btn-approve-clean-all"
          onClick={handleApproveAll}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{t.review.markAllClean}</span>
        </button>
      </div>

      {/* Submissions selector pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {submissions.map((sub) => {
          const isFlagged = sub.status === 'NEEDS_REVIEW' || sub.status === 'MULTIPLE_ANSWERS';
          const isSelected = sub.id === currentSubmission.id;

          return (
            <button
              key={sub.id}
              onClick={() => {
                setSelectedSubmissionId(sub.id);
                setSelectedQNum(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                isSelected
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-500/40 shadow-lg shadow-cyan-500/20'
                  : isFlagged
                  ? 'bg-amber-950/40 text-amber-300 border-amber-500/30 hover:bg-amber-950/60'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <span>{sub.studentName}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                isSelected ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'
              }`}>
                {sub.totalScore}/10
              </span>
              {isFlagged && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
            </button>
          );
        })}
      </div>

      {/* 3-Column Review Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Question Matrix in Paper) - 4 cols */}
        <div className="lg:col-span-4 bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Bài làm:</span>
              <h3 className="font-bold text-white text-sm">{currentSubmission.studentName}</h3>
              <p className="text-xs text-slate-400 font-mono">SBD: <span className="text-cyan-300">{currentSubmission.studentId}</span> • Lớp {currentSubmission.className}</p>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold text-cyan-400">{currentSubmission.totalScore}</span>
              <span className="text-xs text-slate-400">/10</span>
            </div>
          </div>

          {/* Flagged issues alert */}
          {flaggedQuestionsInSub.length > 0 && (
            <div className="p-3 bg-amber-950/40 rounded-2xl border border-amber-500/30 text-xs text-amber-300 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Câu nghi vấn ({flaggedQuestionsInSub.length} câu):
              </span>
              <div className="flex gap-1.5 flex-wrap pt-1">
                {flaggedQuestionsInSub.map(fq => (
                  <button
                    key={fq.questionNumber}
                    onClick={() => setSelectedQNum(fq.questionNumber)}
                    className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold hover:bg-amber-500/30 transition cursor-pointer"
                  >
                    Câu {fq.questionNumber} ({fq.status})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Full question grid list */}
          <div className="space-y-1 max-h-[440px] overflow-y-auto pr-1">
            {recognizedAnswers.map((ans) => {
              const isSelected = ans.questionNumber === selectedQNum;
              const isFlagged = ans.status === 'MULTIPLE' || ans.status === 'UNCERTAIN';

              return (
                <div
                  key={ans.questionNumber}
                  onClick={() => setSelectedQNum(ans.questionNumber)}
                  className={`p-2.5 rounded-2xl flex items-center justify-between transition cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-cyan-950/50 border border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                      : isFlagged
                      ? 'bg-amber-950/30 border border-amber-500/30 hover:bg-amber-950/50'
                      : 'hover:bg-white/5 border border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-300 w-8">Q{ans.questionNumber}</span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                      ans.isCorrect
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                        : ans.selectedOption
                        ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                        : 'bg-white/10 text-slate-400'
                    }`}>
                      {ans.selectedOption || '—'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      (ĐA: {ans.correctAnswer})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {ans.isManuallyCorrected && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-950/50 text-purple-400 border border-purple-500/30 rounded-full font-semibold">
                        Đã sửa
                      </span>
                    )}

                    <span className={`text-[11px] font-semibold ${
                      isFlagged
                        ? 'text-amber-400'
                        : ans.isCorrect
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }`}>
                      {ans.status} ({ans.confidence}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center & Right Column: Interactive Override & High-Res Inspection (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Question Detail Card */}
          <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Đang kiểm tra:</span>
                <h3 className="font-bold text-white text-lg">
                  Câu hỏi số {selectedQNum} / {activeExam?.numQuestions || 40}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedQNum(prev => Math.max(1, prev - 1))}
                  disabled={selectedQNum === 1}
                  className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-slate-300 transition cursor-pointer disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedQNum(prev => Math.min(activeExam?.numQuestions || 40, prev + 1))}
                  disabled={selectedQNum === (activeExam?.numQuestions || 40)}
                  className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-slate-300 transition cursor-pointer disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bubble Fill Ratio Meter Visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left: OMR Machine Interpretation */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                <span className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                  Mật độ điểm ảnh OMR (Fill Density):
                </span>

                <div className="space-y-2.5">
                  {['A', 'B', 'C', 'D'].map((opt) => {
                    const ratio = activeAnswer?.fillRatios?.[opt] || 0.02;
                    const isFilled = ratio >= 0.35;
                    const isUncertain = ratio >= 0.18 && ratio < 0.35;

                    return (
                      <div key={opt} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="font-bold flex items-center gap-1.5 text-slate-200">
                            <span className="w-5 h-5 rounded-full bg-white/10 border border-white/15 flex items-center justify-center font-bold text-[11px] text-cyan-300">
                              {opt}
                            </span>
                            {isFilled ? 'Đã tô đậm' : isUncertain ? 'Tô mờ / Nghi vấn' : 'Trống'}
                          </span>
                          <span className="font-mono text-slate-400">{(ratio * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isFilled ? 'bg-cyan-500' : isUncertain ? 'bg-amber-500' : 'bg-slate-700'
                            }`}
                            style={{ width: `${Math.min(100, ratio * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                  <span>Đáp án đúng theo đề:</span>
                  <span className="font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Lựa chọn {activeAnswer?.correctAnswer}
                  </span>
                </div>
              </div>

              {/* Right: Teacher Manual Override Actions */}
              <div className="p-4 bg-cyan-950/20 rounded-2xl border border-cyan-500/20 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-cyan-300 block uppercase tracking-wider">
                    {t.review.manualCorrection}
                  </span>
                  <p className="text-xs text-slate-300">
                    Chọn đáp án bạn muốn chỉnh sửa cho câu này:
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    {(['A', 'B', 'C', 'D'] as BubbleOption[]).map((opt) => {
                      const isCurrent = activeAnswer?.selectedOption === opt;
                      return (
                        <button
                          key={opt}
                          id={`btn-override-${opt}`}
                          type="button"
                          onClick={() => handleApplyOverride(opt)}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition cursor-pointer shadow-xs ${
                            isCurrent
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white ring-2 ring-cyan-400/50 scale-105 shadow-lg shadow-cyan-500/20'
                              : 'bg-white/5 text-slate-200 border border-white/10 hover:border-cyan-500/50 hover:bg-white/10'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                    <button
                      id="btn-override-blank"
                      type="button"
                      onClick={() => handleApplyOverride(null)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        activeAnswer?.selectedOption === null
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-950/30 text-rose-400 border border-rose-500/30 hover:bg-rose-950/50'
                      }`}
                    >
                      Bỏ Trống
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400">Ghi chú lý do sửa:</label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder={t.review.reasonPlaceholder}
                    className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Audit Trail Section */}
          <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-5 shadow-2xl space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <History className="w-4 h-4 text-cyan-400" />
              {t.review.auditHistory}
            </h4>

            {currentSubmission.auditLogs && currentSubmission.auditLogs.length > 0 ? (
              <div className="divide-y divide-white/5 text-xs">
                {currentSubmission.auditLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-white">{log.newValue}</p>
                      <p className="text-[11px] text-slate-400">
                        {log.reason && `Lý do: ${log.reason} • `}Bởi: <span className="text-cyan-300">{log.changedBy}</span>
                      </p>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Chưa có thao tác chỉnh sửa thủ công nào trên bài thi này.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
