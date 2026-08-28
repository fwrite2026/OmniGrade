import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { BubbleOption, ExamSubmission, RecognizedAnswer, QuestionAnalytics } from '../../types';
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
  ZoomIn,
  Tag,
  RefreshCw,
  Edit3,
  Search,
  CheckSquare,
  Sparkles,
  Info,
  ArrowUpDown,
  ArrowDownUp,
  Percent,
  Gauge,
  SlidersHorizontal,
  Filter,
  XCircle,
  TrendingDown,
  TrendingUp,
  Layers
} from 'lucide-react';

export type QuestionSortMode =
  | 'CONFIDENCE_ASC'   // Độ chính xác OMR: Thấp → Cao (Ưu tiên câu máy nghi vấn/kém tự tin)
  | 'CONFIDENCE_DESC'  // Độ chính xác OMR: Cao → Thấp
  | 'ACCURACY_ASC'     // Tỉ lệ % đúng toàn đề: Thấp → Cao (Câu khó nhất)
  | 'ACCURACY_DESC'    // Tỉ lệ % đúng toàn đề: Cao → Thấp (Câu dễ nhất)
  | 'FLAGGED_FIRST'    // Nghi vấn / Lỗi lên đầu
  | 'QUESTION_ASC'     // Số thứ tự 1 → N
  | 'QUESTION_DESC';   // Số thứ tự N → 1

export type QuestionFilterMode =
  | 'ALL'
  | 'FLAGGED'
  | 'LOW_CONFIDENCE'
  | 'WRONG'
  | 'CORRECT';

export const ReviewQueue: React.FC = () => {
  const {
    t,
    submissions,
    activeExam,
    overrideAnswer,
    updateSubmissionStudent,
    updateSubmissionExamCode,
    regradeSubmissionWithVariant,
    approveSubmission,
    students,
    role,
    getExamStatistics
  } = useApp();

  const flaggedSubmissions = submissions.filter(s =>
    s.status === 'NEEDS_REVIEW' ||
    s.status === 'MULTIPLE_ANSWERS' ||
    s.status === 'LOW_CONFIDENCE' ||
    s.status === 'STUDENT_NOT_FOUND' ||
    (s.totalMultiple && s.totalMultiple > 0) ||
    (s.totalUncertain && s.totalUncertain > 0)
  );

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>(
    flaggedSubmissions[0]?.id || submissions[0]?.id || ''
  );

  const [selectedQNum, setSelectedQNum] = useState<number>(1);
  const [overrideReason, setOverrideReason] = useState<string>('Giáo viên xác nhận kết quả chấm');
  
  // Sorting & Filtering State for Questions
  const [sortMode, setSortMode] = useState<QuestionSortMode>('CONFIDENCE_ASC');
  const [filterMode, setFilterMode] = useState<QuestionFilterMode>('ALL');
  const [searchQInput, setSearchQInput] = useState<string>('');

  // Custom score & multiple selection state
  const [multipleSelectedOpts, setMultipleSelectedOpts] = useState<BubbleOption[]>(['A', 'B']);
  const [customScoreInput, setCustomScoreInput] = useState<string>('');
  const [isCustomScoreMode, setIsCustomScoreMode] = useState<boolean>(false);

  // Student ID edit modal state
  const [isEditingStudent, setIsEditingStudent] = useState<boolean>(false);
  const [editSbdInput, setEditSbdInput] = useState<string>('');
  const [editNameInput, setEditNameInput] = useState<string>('');

  // Exam Code edit modal state
  const [isEditingExamCode, setIsEditingExamCode] = useState<boolean>(false);
  const [editCodeInput, setEditCodeInput] = useState<string>('');

  const currentSubmission = submissions.find(s => s.id === selectedSubmissionId) || flaggedSubmissions[0] || submissions[0];

  // Exam item analytics statistics lookup
  const examStats = useMemo(() => {
    if (!currentSubmission?.examId) return null;
    return getExamStatistics(currentSubmission.examId);
  }, [currentSubmission?.examId, getExamStatistics, submissions]);

  const questionStatsMap = useMemo(() => {
    const map = new Map<number, QuestionAnalytics>();
    if (examStats?.questionAnalytics) {
      examStats.questionAnalytics.forEach(q => map.set(q.questionNumber, q));
    }
    return map;
  }, [examStats]);

  // If no submissions at all
  if (!currentSubmission) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Không có bài thi nào cần duyệt!</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Tất cả các bài thi đã được động cơ OMR nhận diện chuẩn xác với độ tin cậy cao và không phát hiện trường hợp nghi vấn.
        </p>
      </div>
    );
  }

  const recognizedAnswers = currentSubmission.recognizedAnswers || [];

  // Flagged questions in current submission
  const flaggedQuestionsInSub = recognizedAnswers.filter(r =>
    r.status === 'MULTIPLE' || r.status === 'UNCERTAIN' || r.confidence < 75
  );

  const lowConfidenceQuestionsInSub = recognizedAnswers.filter(r => (r.confidence ?? 100) < 80);
  const wrongQuestionsInSub = recognizedAnswers.filter(r => !r.isCorrect);
  const correctQuestionsInSub = recognizedAnswers.filter(r => r.isCorrect);

  // Filtered & Sorted Questions List
  const sortedFilteredQuestions = useMemo(() => {
    // 1. Filter
    let list = [...recognizedAnswers];

    if (filterMode === 'FLAGGED') {
      list = list.filter(r => r.status === 'MULTIPLE' || r.status === 'UNCERTAIN' || (r.confidence ?? 100) < 75);
    } else if (filterMode === 'LOW_CONFIDENCE') {
      list = list.filter(r => (r.confidence ?? 100) < 80);
    } else if (filterMode === 'WRONG') {
      list = list.filter(r => !r.isCorrect);
    } else if (filterMode === 'CORRECT') {
      list = list.filter(r => r.isCorrect);
    }

    if (searchQInput.trim()) {
      const q = searchQInput.trim().toLowerCase().replace(/^câu\s*|^q\s*/i, '');
      list = list.filter(r => r.questionNumber.toString().includes(q) || r.selectedOption?.toLowerCase().includes(q));
    }

    // 2. Sort
    list.sort((a, b) => {
      if (sortMode === 'CONFIDENCE_ASC') {
        const confA = a.confidence ?? 100;
        const confB = b.confidence ?? 100;
        return confA - confB || a.questionNumber - b.questionNumber;
      }
      if (sortMode === 'CONFIDENCE_DESC') {
        const confA = a.confidence ?? 100;
        const confB = b.confidence ?? 100;
        return confB - confA || a.questionNumber - b.questionNumber;
      }
      if (sortMode === 'ACCURACY_ASC') {
        const accA = questionStatsMap.get(a.questionNumber)?.correctPercentage ?? 50;
        const accB = questionStatsMap.get(b.questionNumber)?.correctPercentage ?? 50;
        return accA - accB || a.questionNumber - b.questionNumber;
      }
      if (sortMode === 'ACCURACY_DESC') {
        const accA = questionStatsMap.get(a.questionNumber)?.correctPercentage ?? 50;
        const accB = questionStatsMap.get(b.questionNumber)?.correctPercentage ?? 50;
        return accB - accA || a.questionNumber - b.questionNumber;
      }
      if (sortMode === 'FLAGGED_FIRST') {
        const getFlagScore = (ans: RecognizedAnswer) => {
          if (ans.status === 'MULTIPLE') return 5;
          if (ans.status === 'UNCERTAIN') return 4;
          if ((ans.confidence ?? 100) < 75) return 3;
          if (!ans.isCorrect) return 2;
          return 1;
        };
        return getFlagScore(b) - getFlagScore(a) || a.questionNumber - b.questionNumber;
      }
      if (sortMode === 'QUESTION_DESC') {
        return b.questionNumber - a.questionNumber;
      }
      // Default: QUESTION_ASC
      return a.questionNumber - b.questionNumber;
    });

    return list;
  }, [recognizedAnswers, filterMode, searchQInput, sortMode, questionStatsMap]);

  const activeAnswer = recognizedAnswers.find(r => r.questionNumber === selectedQNum) || recognizedAnswers[0];

  // Current index in sorted/filtered list
  const currentSortedIndex = sortedFilteredQuestions.findIndex(q => q.questionNumber === selectedQNum);

  const handleApplyOverride = (newOption: BubbleOption | null) => {
    overrideAnswer(currentSubmission.id, selectedQNum, newOption, overrideReason);
  };

  const handleSetCorrectStatus = (isCorrect: boolean) => {
    const qPoints = activeAnswer?.maxPoints || (activeExam ? activeExam.maxScore / (activeExam.numQuestions || 1) : 0.25);
    overrideAnswer(
      currentSubmission.id,
      selectedQNum,
      isCorrect ? (activeAnswer?.correctAnswer || 'A') : (activeAnswer?.selectedOption || null),
      overrideReason || (isCorrect ? 'Giáo viên xác nhận cho điểm câu này' : 'Giáo viên xác nhận không cho điểm câu này'),
      {
        isCorrect,
        status: isCorrect ? 'CORRECT' : 'WRONG',
        customPoints: isCorrect ? qPoints : 0
      }
    );
  };

  const handleApplyCustomScore = () => {
    const parsed = parseFloat(customScoreInput);
    if (isNaN(parsed) || parsed < 0) return;
    overrideAnswer(
      currentSubmission.id,
      selectedQNum,
      activeAnswer?.selectedOption || activeAnswer?.correctAnswer || 'A',
      overrideReason || `Giáo viên chấm điểm thủ công: ${parsed} điểm`,
      {
        isCorrect: parsed > 0,
        customPoints: parsed,
        status: parsed > 0 ? 'CORRECT' : 'WRONG'
      }
    );
    setIsCustomScoreMode(false);
  };

  const handleApplyMultipleAnswers = (options: BubbleOption[]) => {
    if (options.length === 0) return;
    overrideAnswer(
      currentSubmission.id,
      selectedQNum,
      null,
      overrideReason || `Giáo viên xác nhận HS tô nhiều phương án (${options.join(', ')})`,
      {
        status: 'MULTIPLE',
        selectedOptions: options,
        isCorrect: false,
        customPoints: 0
      }
    );
  };

  const toggleMultipleOption = (opt: BubbleOption) => {
    setMultipleSelectedOpts(prev => 
      prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt].sort()
    );
  };

  const handleSaveStudentEdit = () => {
    if (!editSbdInput.trim()) return;
    const found = students.find(s => s.studentId === editSbdInput.trim());
    const finalName = editNameInput.trim() || found?.name || `Học sinh SBD ${editSbdInput.trim()}`;
    const finalClass = found?.className || currentSubmission.className;
    updateSubmissionStudent(currentSubmission.id, editSbdInput.trim(), finalName, finalClass, 'Giáo viên chỉnh sửa Số báo danh thủ công');
    setIsEditingStudent(false);
  };

  const handleSaveExamCodeEdit = () => {
    if (!editCodeInput.trim()) return;
    updateSubmissionExamCode(currentSubmission.id, editCodeInput.trim(), 'Giáo viên chỉnh sửa Mã đề thủ công');
    setIsEditingExamCode(false);
  };

  const handleApproveAll = () => {
    approveSubmission(currentSubmission.id);
    const nextFlagged = flaggedSubmissions.find(s => s.id !== currentSubmission.id);
    if (nextFlagged) {
      setSelectedSubmissionId(nextFlagged.id);
    }
  };

  const handleNavigateQuestion = (direction: 'prev' | 'next') => {
    if (sortedFilteredQuestions.length === 0) return;
    if (currentSortedIndex === -1) {
      setSelectedQNum(sortedFilteredQuestions[0].questionNumber);
      return;
    }
    if (direction === 'prev' && currentSortedIndex > 0) {
      setSelectedQNum(sortedFilteredQuestions[currentSortedIndex - 1].questionNumber);
    } else if (direction === 'next' && currentSortedIndex < sortedFilteredQuestions.length - 1) {
      setSelectedQNum(sortedFilteredQuestions[currentSortedIndex + 1].questionNumber);
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

        <div className="flex items-center gap-2">
          <button
            id="btn-approve-clean-all"
            onClick={handleApproveAll}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Phê duyệt hoàn tất bài này</span>
          </button>
        </div>
      </div>

      {/* Submissions selector pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {submissions.map((sub) => {
          const isFlagged = sub.status === 'NEEDS_REVIEW' || sub.status === 'MULTIPLE_ANSWERS' || sub.status === 'STUDENT_NOT_FOUND' || (sub.totalMultiple && sub.totalMultiple > 0) || (sub.totalUncertain && sub.totalUncertain > 0);
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
                {sub.totalScore}/{sub.maxScore}
              </span>
              {isFlagged && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
            </button>
          );
        })}
      </div>

      {/* 3-Column Review Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Question Matrix, Sorting Toolbar & Overview) - 4 cols */}
        <div className="lg:col-span-4 bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-5 shadow-2xl space-y-4">
          {/* Submission Info Box */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bài làm thí sinh:</span>
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                <span>{currentSubmission.studentName}</span>
                {currentSubmission.isStudentIdManuallyCorrected && (
                  <span className="text-[9px] bg-purple-950/60 text-purple-300 border border-purple-500/30 px-1 py-0.2 rounded">
                    Đã sửa
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                SBD: <span className="text-cyan-300 font-bold">{currentSubmission.studentId}</span> • Lớp {currentSubmission.className}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold text-cyan-400">{currentSubmission.totalScore}</span>
              <span className="text-xs text-slate-400">/{currentSubmission.maxScore}</span>
              <p className={`text-[10px] font-bold ${currentSubmission.status === 'GRADED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {currentSubmission.status}
              </p>
            </div>
          </div>

          {/* Student ID (SBD) Inspection Card */}
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Số Báo Danh (SBD):</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                  currentSubmission.studentIdStatus === 'VALID'
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                }`}>
                  {currentSubmission.studentId} ({currentSubmission.studentIdConfidence ?? 95}%)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditSbdInput(currentSubmission.studentId || '');
                    setEditNameInput(currentSubmission.studentName || '');
                    setIsEditingStudent(!isEditingStudent);
                  }}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition cursor-pointer"
                  title="Sửa thông tin học sinh / SBD"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* SBD High-Res Physical Crop */}
            {currentSubmission.studentIdCropUrl && (
              <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 p-1">
                <div className="text-[9px] text-slate-400 px-1 pb-1">Ảnh chụp thực tế vùng SBD:</div>
                <img
                  src={currentSubmission.studentIdCropUrl}
                  alt="Ảnh chụp vùng SBD"
                  className="w-full h-auto max-h-24 object-contain rounded-lg"
                />
              </div>
            )}

            {/* Quick SBD Edit Inline Form */}
            {isEditingStudent && (
              <div className="p-2.5 bg-emerald-950/30 rounded-xl border border-emerald-500/30 space-y-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-emerald-300 block mb-1">Nhập Số Báo Danh chuẩn:</label>
                  <input
                    type="text"
                    value={editSbdInput}
                    onChange={(e) => {
                      setEditSbdInput(e.target.value);
                      const matched = students.find(s => s.studentId === e.target.value.trim());
                      if (matched) setEditNameInput(matched.name);
                    }}
                    className="w-full text-xs bg-black/50 border border-emerald-500/40 rounded-lg p-1.5 text-white"
                    placeholder="VD: 102345"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-300 block mb-1">Tên học sinh tương ứng:</label>
                  <input
                    type="text"
                    value={editNameInput}
                    onChange={(e) => setEditNameInput(e.target.value)}
                    className="w-full text-xs bg-black/50 border border-emerald-500/40 rounded-lg p-1.5 text-white"
                    placeholder="Tên học sinh"
                  />
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingStudent(false)}
                    className="px-2 py-1 rounded-lg bg-white/10 text-slate-300 text-[10px]"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveStudentEdit}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-[10px]"
                  >
                    Lưu SBD
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Test Code (Mã Đề) Inspection & Switcher Card */}
          <div className="p-3 bg-cyan-950/30 rounded-2xl border border-cyan-500/20 text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mã Đề Nhận Diện:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/30">
                  {currentSubmission.detectedExamCode || currentSubmission.appliedVariantCode || 'Chưa rõ'} ({currentSubmission.examCodeConfidence ?? 95}%)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditCodeInput(currentSubmission.detectedExamCode || currentSubmission.appliedVariantCode || '');
                    setIsEditingExamCode(!isEditingExamCode);
                  }}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition cursor-pointer"
                  title="Chỉnh sửa mã đề trực tiếp"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Test Code High-Res Physical Crop */}
            {currentSubmission.examCodeCropUrl && (
              <div className="rounded-xl overflow-hidden border border-cyan-500/20 bg-black/40 p-1">
                <div className="text-[9px] text-slate-400 px-1 pb-1">Ảnh chụp thực tế vùng Mã đề:</div>
                <img
                  src={currentSubmission.examCodeCropUrl}
                  alt="Ảnh chụp vùng Mã đề"
                  className="w-full h-auto max-h-24 object-contain rounded-lg"
                />
              </div>
            )}

            {/* Inline Manual Code Edit */}
            {isEditingExamCode && (
              <div className="p-2.5 bg-cyan-950/50 rounded-xl border border-cyan-500/40 space-y-2 text-xs">
                <label className="text-[10px] font-bold text-cyan-300 block">Nhập mã đề chính xác:</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={editCodeInput}
                    onChange={(e) => setEditCodeInput(e.target.value)}
                    className="flex-1 text-xs bg-black/50 border border-cyan-500/40 rounded-lg p-1.5 text-white font-mono"
                    placeholder="VD: 101, 102..."
                  />
                  <button
                    type="button"
                    onClick={handleSaveExamCodeEdit}
                    className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs rounded-lg"
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            )}

            {/* Switch Variant Buttons if exam has variants */}
            {activeExam?.variants && activeExam.variants.length > 1 && (
              <div className="pt-1.5 border-t border-white/10 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase block">
                  Đổi mã đề & Chấm lại bài này:
                </label>
                <div className="flex flex-wrap gap-1">
                  {activeExam.variants.map((variant) => {
                    const isCurrentVariant = (currentSubmission.appliedVariantCode || activeExam.defaultVariantCode) === variant.code;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={isCurrentVariant}
                        onClick={() => regradeSubmissionWithVariant(currentSubmission.id, variant.code)}
                        className={`px-2 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 ${
                          isCurrentVariant
                            ? 'bg-cyan-500 text-white shadow-xs cursor-default'
                            : 'bg-white/5 hover:bg-white/15 text-slate-300 border border-white/10'
                        }`}
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${isCurrentVariant ? 'hidden' : ''}`} />
                        <span>Mã {variant.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* QUESTION SORTING & FILTERING TOOLBAR (Sắp xếp theo % Độ chính xác & Tiêu chí) */}
          <div className="p-3.5 bg-gradient-to-b from-white/10 to-white/5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sắp xếp câu theo % độ chính xác:</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 rounded font-bold">
                {sortedFilteredQuestions.length}/{recognizedAnswers.length} câu
              </span>
            </div>

            {/* Granular Sort Dropdown Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 block">
                Tiêu chuẩn sắp xếp danh sách câu hỏi:
              </label>
              <div className="relative">
                <select
                  id="select-review-sort-mode"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as QuestionSortMode)}
                  className="w-full text-xs font-medium bg-[#080C14] border border-cyan-500/40 text-cyan-200 rounded-xl px-3 py-2 pr-8 focus:outline-none focus:border-cyan-400 appearance-none cursor-pointer"
                >
                  <option value="CONFIDENCE_ASC">🎯 Độ chính xác OMR: Thấp → Cao (Ưu tiên câu cần duyệt)</option>
                  <option value="CONFIDENCE_DESC">🎯 Độ chính xác OMR: Cao → Thấp (Câu rõ nét nhất)</option>
                  <option value="ACCURACY_ASC">📊 % Làm đúng toàn đề: Thấp → Cao (Câu khó nhất)</option>
                  <option value="ACCURACY_DESC">📊 % Làm đúng toàn đề: Cao → Thấp (Câu dễ nhất)</option>
                  <option value="FLAGGED_FIRST">⚠️ Ưu tiên câu nghi vấn / Lỗi lên đầu</option>
                  <option value="QUESTION_ASC">🔢 Số thứ tự câu (1 → {recognizedAnswers.length})</option>
                  <option value="QUESTION_DESC">🔢 Số thứ tự câu ({recognizedAnswers.length} → 1)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-cyan-400">
                  <ArrowDownUp className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Quick 1-Click Sort Preset Pills */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Chọn nhanh kiểu xếp:</span>
                {sortMode !== 'QUESTION_ASC' && (
                  <button
                    type="button"
                    onClick={() => setSortMode('QUESTION_ASC')}
                    className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Về thứ tự gốc
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  id="btn-sort-omr-confidence"
                  onClick={() => setSortMode(sortMode === 'CONFIDENCE_ASC' ? 'CONFIDENCE_DESC' : 'CONFIDENCE_ASC')}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center justify-between cursor-pointer ${
                    sortMode === 'CONFIDENCE_ASC' || sortMode === 'CONFIDENCE_DESC'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-xs'
                      : 'bg-black/30 text-slate-300 border-white/5 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-cyan-400" />
                    <span>% OMR {sortMode === 'CONFIDENCE_ASC' ? 'Thấp→Cao' : sortMode === 'CONFIDENCE_DESC' ? 'Cao→Thấp' : 'Độ tin cậy'}</span>
                  </span>
                  {sortMode === 'CONFIDENCE_ASC' && <TrendingUp className="w-3 h-3 text-cyan-300" />}
                  {sortMode === 'CONFIDENCE_DESC' && <TrendingDown className="w-3 h-3 text-cyan-300" />}
                </button>

                <button
                  type="button"
                  id="btn-sort-exam-accuracy"
                  onClick={() => setSortMode(sortMode === 'ACCURACY_ASC' ? 'ACCURACY_DESC' : 'ACCURACY_ASC')}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center justify-between cursor-pointer ${
                    sortMode === 'ACCURACY_ASC' || sortMode === 'ACCURACY_DESC'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-xs'
                      : 'bg-black/30 text-slate-300 border-white/5 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3 text-blue-400" />
                    <span>% Đúng {sortMode === 'ACCURACY_ASC' ? 'Khó→Dễ' : sortMode === 'ACCURACY_DESC' ? 'Dễ→Khó' : 'Toàn đề'}</span>
                  </span>
                  {sortMode === 'ACCURACY_ASC' && <TrendingUp className="w-3 h-3 text-blue-300" />}
                  {sortMode === 'ACCURACY_DESC' && <TrendingDown className="w-3 h-3 text-blue-300" />}
                </button>
              </div>
            </div>

            {/* Quick Search & Filter Tabs */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              {/* Search question input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQInput}
                  onChange={(e) => setSearchQInput(e.target.value)}
                  placeholder="Tìm câu số... (VD: 5, 12)"
                  className="w-full text-xs bg-black/40 border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/40"
                />
                {searchQInput && (
                  <button
                    type="button"
                    onClick={() => setSearchQInput('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setFilterMode('ALL')}
                  className={`px-2 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                    filterMode === 'ALL'
                      ? 'bg-white/20 text-white shadow-xs'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  Tất cả ({recognizedAnswers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('FLAGGED')}
                  className={`px-2 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                    filterMode === 'FLAGGED'
                      ? 'bg-amber-500 text-black shadow-xs'
                      : 'bg-amber-950/40 text-amber-300 hover:bg-amber-950/70'
                  }`}
                >
                  Nghi vấn ({flaggedQuestionsInSub.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('LOW_CONFIDENCE')}
                  className={`px-2 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                    filterMode === 'LOW_CONFIDENCE'
                      ? 'bg-cyan-500 text-black shadow-xs'
                      : 'bg-cyan-950/40 text-cyan-300 hover:bg-cyan-950/70'
                  }`}
                >
                  OMR &lt; 80% ({lowConfidenceQuestionsInSub.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('WRONG')}
                  className={`px-2 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                    filterMode === 'WRONG'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-rose-950/40 text-rose-300 hover:bg-rose-950/70'
                  }`}
                >
                  Sai ({wrongQuestionsInSub.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('CORRECT')}
                  className={`px-2 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                    filterMode === 'CORRECT'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/70'
                  }`}
                >
                  Đúng ({correctQuestionsInSub.length})
                </button>
              </div>
            </div>
          </div>

          {/* Flagged issues alert pill bar */}
          {flaggedQuestionsInSub.length > 0 && filterMode !== 'FLAGGED' && (
            <div className="p-2.5 bg-amber-950/40 rounded-2xl border border-amber-500/30 text-xs text-amber-300 space-y-1">
              <span className="font-bold flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Câu nghi vấn OMR ({flaggedQuestionsInSub.length} câu):
                </span>
                <button
                  type="button"
                  onClick={() => setSortMode('CONFIDENCE_ASC')}
                  className="text-[10px] text-amber-200 underline cursor-pointer"
                >
                  Xếp theo % OMR thấp nhất
                </button>
              </span>
              <div className="flex gap-1 flex-wrap pt-0.5">
                {flaggedQuestionsInSub.slice(0, 6).map(fq => (
                  <button
                    key={fq.questionNumber}
                    onClick={() => setSelectedQNum(fq.questionNumber)}
                    className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold hover:bg-amber-500/40 transition cursor-pointer"
                  >
                    Q{fq.questionNumber} ({fq.confidence ?? 0}%)
                  </button>
                ))}
                {flaggedQuestionsInSub.length > 6 && (
                  <span className="text-[10px] text-amber-400/80 self-center">+{flaggedQuestionsInSub.length - 6} câu khác</span>
                )}
              </div>
            </div>
          )}

          {/* Sorted & Filtered Full Question Grid List */}
          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {sortedFilteredQuestions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-white/5 rounded-2xl bg-white/5">
                Không tìm thấy câu hỏi phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              sortedFilteredQuestions.map((ans) => {
                const isSelected = ans.questionNumber === selectedQNum;
                const isFlagged = ans.status === 'MULTIPLE' || ans.status === 'UNCERTAIN' || (ans.confidence ?? 100) < 75;
                const qStat = questionStatsMap.get(ans.questionNumber);
                const examAcc = qStat?.correctPercentage;

                return (
                  <div
                    key={ans.questionNumber}
                    onClick={() => setSelectedQNum(ans.questionNumber)}
                    className={`p-2.5 rounded-2xl flex flex-col gap-1.5 transition cursor-pointer text-xs border ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-500 ring-1 ring-cyan-400/60 shadow-lg shadow-cyan-500/20'
                        : isFlagged
                        ? 'bg-amber-950/30 border-amber-500/30 hover:bg-amber-950/50'
                        : 'hover:bg-white/5 border-white/5 bg-white/5'
                    }`}
                  >
                    {/* Top Row: QNum + Options + Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold font-mono px-1.5 py-0.5 rounded text-[11px] ${
                          isSelected ? 'bg-cyan-500 text-white' : 'bg-white/10 text-slate-200'
                        }`}>
                          Q{ans.questionNumber}
                        </span>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                          ans.isCorrect
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                            : ans.selectedOption
                            ? 'bg-rose-950/80 text-rose-400 border border-rose-500/40'
                            : ans.status === 'MULTIPLE'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                            : 'bg-white/10 text-slate-400'
                        }`}>
                          {ans.selectedOption || (ans.status === 'MULTIPLE' ? 'M' : '—')}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          (ĐA: <strong className="text-emerald-400">{ans.correctAnswer}</strong>)
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ans.isManuallyCorrected && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-purple-950/60 text-purple-300 border border-purple-500/30 rounded font-semibold">
                            Đã sửa
                          </span>
                        )}

                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          ans.isCorrect
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                            : ans.status === 'MULTIPLE'
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                            : ans.status === 'UNCERTAIN'
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                        }`}>
                          {ans.status === 'CORRECT' ? 'Đúng' : ans.status === 'WRONG' ? 'Sai' : ans.status}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: % Metrics (% Độ chính xác OMR & % Đúng toàn đề) */}
                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/5">
                      {/* OMR Confidence */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-medium">Độ tin cậy OMR:</span>
                        <span className={`font-mono font-bold px-1 rounded ${
                          (ans.confidence ?? 100) >= 85
                            ? 'text-emerald-300 bg-emerald-950/40'
                            : (ans.confidence ?? 100) >= 70
                            ? 'text-amber-300 bg-amber-950/40'
                            : 'text-rose-300 bg-rose-950/40 animate-pulse'
                        }`}>
                          {ans.confidence ?? 95}%
                        </span>
                      </div>

                      {/* Exam-wide % Accuracy */}
                      {examAcc !== undefined && (
                        <div className="flex items-center gap-1 text-slate-400" title="Tỷ lệ % thí sinh làm đúng câu này toàn đề thi">
                          <span>Đúng đề:</span>
                          <span className={`font-mono font-bold ${
                            examAcc >= 70 ? 'text-emerald-400' : examAcc >= 40 ? 'text-blue-400' : 'text-amber-400'
                          }`}>
                            {examAcc}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center & Right Column: Interactive Override & High-Res Inspection (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Question Detail Card */}
          <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-6 shadow-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Đang kiểm tra:</span>
                  {currentSortedIndex !== -1 && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      (Vị trí {currentSortedIndex + 1}/{sortedFilteredQuestions.length} theo danh sách lọc)
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2 mt-0.5">
                  <span>Câu hỏi số {selectedQNum} / {activeExam?.numQuestions || 40}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    activeAnswer?.status === 'CORRECT'
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                      : activeAnswer?.status === 'WRONG'
                      ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                  }`}>
                    {activeAnswer?.status} (Độ tin cậy OMR {activeAnswer?.confidence ?? 95}%)
                  </span>
                </h3>
              </div>

              {/* Step Navigation buttons honoring the active sorted list */}
              <div className="flex items-center gap-2">
                <button
                  id="btn-prev-question"
                  onClick={() => handleNavigateQuestion('prev')}
                  disabled={currentSortedIndex <= 0}
                  className="px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer disabled:opacity-30 flex items-center gap-1"
                  title="Câu trước đó theo thứ tự sắp xếp"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>
                <button
                  id="btn-next-question"
                  onClick={() => handleNavigateQuestion('next')}
                  disabled={currentSortedIndex >= sortedFilteredQuestions.length - 1}
                  className="px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-950/70 text-cyan-300 text-xs font-bold transition cursor-pointer disabled:opacity-30 flex items-center gap-1"
                  title="Câu tiếp theo theo thứ tự sắp xếp"
                >
                  <span>Câu tiếp</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* High-Resolution Cropped Question Area */}
            {activeAnswer?.cropImageUrl && (
              <div className="p-3 bg-black/60 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold flex items-center gap-1.5 text-slate-200">
                    <ZoomIn className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Ảnh chụp thực tế vết bút chì / mực (Câu {selectedQNum}):</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Nhận diện OMR ban đầu: <b className="text-white">{activeAnswer.originalOmrAnswer || 'Trống'}</b>
                  </span>
                </div>
                <div className="p-2 bg-white/5 rounded-xl flex items-center justify-center min-h-[50px]">
                  <img
                    src={activeAnswer.cropImageUrl}
                    alt={`Ảnh cắt câu ${selectedQNum}`}
                    className="max-h-28 w-auto object-contain rounded-lg shadow-md"
                  />
                </div>
              </div>
            )}

            {/* Bubble Fill Ratio Meter Visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left: OMR Machine Interpretation & Exam Analytics for Question */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                    Mật độ điểm ảnh OMR (Fill Density):
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    (activeAnswer?.confidence ?? 100) >= 80 ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30' : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                  }`}>
                    Độ tin cậy: {activeAnswer?.confidence ?? 95}%
                  </span>
                </div>

                <div className="space-y-2.5">
                  {['A', 'B', 'C', 'D'].map((opt) => {
                    const ratio = activeAnswer?.fillRatios?.[opt] || 0.02;
                    const isFilled = ratio >= 0.32;
                    const isUncertain = ratio >= 0.16 && ratio < 0.32;

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

                {/* Exam-wide item statistics for this question */}
                {questionStatsMap.has(selectedQNum) && (
                  <div className="p-2.5 bg-cyan-950/30 rounded-xl border border-cyan-500/20 text-[11px] space-y-1 text-slate-300">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-cyan-300 flex items-center gap-1">
                        <Percent className="w-3 h-3 text-cyan-400" />
                        Tỉ lệ làm đúng toàn đề:
                      </span>
                      <span className="text-white font-mono">{questionStatsMap.get(selectedQNum)?.correctPercentage}%</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Độ khó: <strong className="text-slate-200">{questionStatsMap.get(selectedQNum)?.difficultyLabel === 'easy' ? 'Dễ (>70%)' : questionStatsMap.get(selectedQNum)?.difficultyLabel === 'medium' ? 'Vừa (40-70%)' : 'Khó (<40%)'}</strong> • Bẫy hay gặp: <strong className="text-amber-300">{questionStatsMap.get(selectedQNum)?.mostCommonDistractor || 'Không có'}</strong>
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                  <span>Đáp án đúng theo đề:</span>
                  <span className="font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Lựa chọn {activeAnswer?.correctAnswer}
                  </span>
                </div>
              </div>

              {/* Right: Teacher Manual Override & Score Confirmation Actions */}
              <div className="p-4 bg-cyan-950/20 rounded-2xl border border-cyan-500/20 space-y-4 flex flex-col justify-between">
                <div className="space-y-3.5">
                  {/* Current Score & Status Indicator */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-xs text-slate-300 font-medium">Điểm câu {selectedQNum}:</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-lg font-bold font-mono text-xs ${
                        activeAnswer?.isCorrect 
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30' 
                          : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                      }`}>
                        +{activeAnswer?.pointsEarned ?? 0} / {activeAnswer?.maxPoints ?? 0.25} điểm
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        activeAnswer?.status === 'CORRECT' ? 'bg-emerald-500/20 text-emerald-300' :
                        activeAnswer?.status === 'MULTIPLE' ? 'bg-amber-500/20 text-amber-300' :
                        activeAnswer?.status === 'BLANK' ? 'bg-slate-500/20 text-slate-300' :
                        'bg-rose-500/20 text-rose-300'
                      }`}>
                        {activeAnswer?.status}
                      </span>
                    </div>
                  </div>

                  {/* Section 1: Quick Score Confirmation (Cho điểm / Không cho điểm) */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-cyan-300 block uppercase tracking-wider">
                      1. Xác nhận Tính Điểm:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        id="btn-confirm-score-correct"
                        type="button"
                        onClick={() => handleSetCorrectStatus(true)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                          activeAnswer?.isCorrect
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-500/20'
                            : 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-950/60'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Cho Điểm (Đúng)</span>
                      </button>

                      <button
                        id="btn-confirm-score-wrong"
                        type="button"
                        onClick={() => handleSetCorrectStatus(false)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                          !activeAnswer?.isCorrect && activeAnswer?.status !== 'MULTIPLE'
                            ? 'bg-gradient-to-r from-rose-600 to-red-700 text-white ring-2 ring-rose-400/50 shadow-lg shadow-rose-500/20'
                            : 'bg-rose-950/30 text-rose-300 border border-rose-500/30 hover:bg-rose-950/60'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Không Cho Điểm (Sai)</span>
                      </button>
                    </div>

                    {/* Custom points input */}
                    {isCustomScoreMode ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max={activeExam?.maxScore || 10}
                          value={customScoreInput}
                          onChange={(e) => setCustomScoreInput(e.target.value)}
                          placeholder="Nhập số điểm..."
                          className="flex-1 text-xs border border-cyan-500/40 rounded-xl p-2 bg-white/5 text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCustomScore}
                          className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCustomScoreMode(false)}
                          className="px-2 py-2 bg-white/10 hover:bg-white/20 text-slate-300 text-xs rounded-xl transition cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomScoreInput(activeAnswer?.pointsEarned?.toString() || '0');
                          setIsCustomScoreMode(true);
                        }}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 cursor-pointer pt-0.5"
                      >
                        + Tùy chỉnh số điểm khác ({activeAnswer?.pointsEarned ?? 0}đ)
                      </button>
                    )}
                  </div>

                  {/* Section 2: Confirm Multiple Options Shaded (Xác nhận HS chọn nhiều phương án) */}
                  <div className="space-y-1.5 pt-1 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <CheckSquare className="w-3 h-3 text-amber-400" />
                        2. Xác nhận Tô Nhiều Phương Án:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleApplyMultipleAnswers(['A', 'B', 'C', 'D'])}
                        className="text-[10px] font-bold text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-950/70 border border-amber-500/30 px-2 py-0.5 rounded-lg transition cursor-pointer"
                      >
                        Tô cả 4 đáp án (A-B-C-D)
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-2">
                      <p className="text-[11px] text-slate-300">
                        Chọn các đáp án học sinh đã tô cùng lúc:
                      </p>
                      <div className="flex items-center gap-1.5">
                        {(['A', 'B', 'C', 'D'] as BubbleOption[]).map((opt) => {
                          const isOptChecked = multipleSelectedOpts.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleMultipleOption(opt)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                isOptChecked
                                  ? 'bg-amber-500 text-black border-amber-400 shadow-xs'
                                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {opt} {isOptChecked && '✓'}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        id="btn-confirm-multiple"
                        type="button"
                        onClick={() => handleApplyMultipleAnswers(multipleSelectedOpts)}
                        disabled={multipleSelectedOpts.length < 2}
                        className="w-full py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-black transition cursor-pointer shadow-xs"
                      >
                        Xác nhận tô {multipleSelectedOpts.join(' + ')} (0 điểm - MULTIPLE)
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Single Option Override (Chọn 1 đáp án / Bỏ trống) */}
                  <div className="space-y-1.5 pt-1 border-t border-white/10">
                    <span className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">
                      3. Hoặc Chọn 1 Đáp Án Cụ Thể:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {(['A', 'B', 'C', 'D'] as BubbleOption[]).map((opt) => {
                        const isCurrent = activeAnswer?.selectedOption === opt && activeAnswer?.status !== 'MULTIPLE';
                        return (
                          <button
                            key={opt}
                            id={`btn-override-${opt}`}
                            type="button"
                            onClick={() => handleApplyOverride(opt)}
                            className={`flex-1 py-2 rounded-xl font-bold text-xs transition cursor-pointer shadow-xs ${
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
                        className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          activeAnswer?.status === 'BLANK' || activeAnswer?.selectedOption === null
                            ? 'bg-rose-600 text-white ring-2 ring-rose-400/50'
                            : 'bg-rose-950/30 text-rose-400 border border-rose-500/30 hover:bg-rose-950/50'
                        }`}
                      >
                        Bỏ Trống
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lý do điều chỉnh:</label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder={t.review.reasonPlaceholder}
                    className="w-full text-xs border border-white/10 rounded-xl p-2 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
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

