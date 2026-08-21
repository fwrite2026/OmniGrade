import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BubbleOption, Exam, QuestionConfig } from '../../types';
import {
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  HelpCircle,
  Upload,
  Layers,
  Award,
  Shield,
  Users,
  Globe,
  Share2
} from 'lucide-react';

interface ExamWizardProps {
  onFinish: () => void;
  onCancel: () => void;
}

export const ExamWizard: React.FC<ExamWizardProps> = ({ onFinish, onCancel }) => {
  const { t, templates, classes, addExam, schoolName, currentUser } = useApp();

  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [title, setTitle] = useState<string>('');
  const [subject, setSubject] = useState<string>('Tiếng Anh');
  const [grade, setGrade] = useState<string>('6');
  const [className, setClassName] = useState<string>(classes[0]?.name || '6A1');
  const [academicYear, setAcademicYear] = useState<string>('2025-2026');
  const [semester, setSemester] = useState<string>('Học kỳ I');
  const [examType, setExamType] = useState<Exam['examType']>('midterm');
  const [examCode, setExamCode] = useState<string>(`EXAM-${Math.floor(100 + Math.random() * 900)}`);
  const [examDate, setExamDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [teacherName, setTeacherName] = useState<string>(
    currentUser?.fullName || (currentUser?.role === 'admin' ? 'Quản trị viên' : 'Giáo viên')
  );

  // Sharing & Scope State (Admin default = school_wide, shared with all teachers)
  const isAdmin = currentUser?.role === 'admin';
  const [isSharedWithAllTeachers, setIsSharedWithAllTeachers] = useState<boolean>(true);
  const [targetScope, setTargetScope] = useState<'school_wide' | 'grade_wide' | 'class_only'>(
    isAdmin ? 'school_wide' : 'class_only'
  );

  const [numQuestions, setNumQuestions] = useState<number>(40);
  const [numOptions, setNumOptions] = useState<number>(4);
  const [maxScore, setMaxScore] = useState<number>(10);
  const [passingScore, setPassingScore] = useState<number>(5.0);
  const [decimalPrecision, setDecimalPrecision] = useState<0 | 1 | 2>(2);
  const [instructions, setInstructions] = useState<string>('Dùng bút chì 2B tô kín ô tròn tương ứng với đáp án đúng.');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || 'tpl_fpt_40');

  // Answer Key State
  const [answerKeyMap, setAnswerKeyMap] = useState<Record<number, BubbleOption>>(() => {
    const map: Record<number, BubbleOption> = {};
    const defaultCycle: BubbleOption[] = ['A', 'B', 'C', 'D'];
    for (let i = 1; i <= 40; i++) {
      map[i] = defaultCycle[(i - 1) % 4];
    }
    return map;
  });

  const [quickString, setQuickString] = useState<string>('');
  const [quickStringMode, setQuickStringMode] = useState<boolean>(false);

  // Selected Template
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  // Adjust answer keys when question count changes
  const handleNumQuestionsChange = (newCount: number) => {
    setNumQuestions(newCount);
    const defaultCycle: BubbleOption[] = ['A', 'B', 'C', 'D'];
    setAnswerKeyMap(prev => {
      const nextMap = { ...prev };
      for (let i = 1; i <= newCount; i++) {
        if (!nextMap[i]) {
          nextMap[i] = defaultCycle[(i - 1) % numOptions];
        }
      }
      return nextMap;
    });
  };

  // Quick String Answer Key Parser (e.g. "1A 2B 3C" or "ABCDABCD...")
  const handleApplyQuickString = () => {
    if (!quickString.trim()) return;
    const clean = quickString.trim().toUpperCase();
    const newMap: Record<number, BubbleOption> = { ...answerKeyMap };

    // Format 1: "1A 2B 3C"
    const pairRegex = /(\d+)\s*[:=.-]?\s*([A-E])/g;
    let match;
    let foundPairs = 0;
    while ((match = pairRegex.exec(clean)) !== null) {
      const qNum = parseInt(match[1], 10);
      const opt = match[2] as BubbleOption;
      if (qNum >= 1 && qNum <= numQuestions) {
        newMap[qNum] = opt;
        foundPairs++;
      }
    }

    // Format 2: "ABCDABCD..."
    if (foundPairs === 0) {
      const letters = clean.replace(/[^A-E]/g, '');
      for (let i = 0; i < Math.min(letters.length, numQuestions); i++) {
        newMap[i + 1] = letters[i] as BubbleOption;
      }
    }

    setAnswerKeyMap(newMap);
    setQuickStringMode(false);
  };

  // Missing answers check
  const missingCount = Object.keys(answerKeyMap).length < numQuestions 
    ? numQuestions - Object.keys(answerKeyMap).length 
    : 0;

  // Compatibility warning
  const isTemplateCompatible = selectedTemplate && selectedTemplate.numQuestions >= numQuestions;

  // Complete and publish exam
  const handlePublish = () => {
    const pointPerQ = Number((maxScore / numQuestions).toFixed(3));
    const questions: QuestionConfig[] = [];
    for (let i = 1; i <= numQuestions; i++) {
      questions.push({
        questionNumber: i,
        correctAnswer: answerKeyMap[i] || 'A',
        points: pointPerQ,
        difficulty: (i % 3 === 0) ? 'easy' : (i % 3 === 1) ? 'medium' : 'hard'
      });
    }

    const newExam: Exam = {
      id: 'exam_' + Math.random().toString(36).slice(2, 9),
      code: examCode,
      title: title || `${subject} - ${targetScope === 'school_wide' ? 'Toàn Trường' : targetScope === 'grade_wide' ? `Khối ${grade}` : `Lớp ${className}`}`,
      subject,
      grade,
      className: targetScope === 'school_wide' ? 'Toàn trường' : targetScope === 'grade_wide' ? `Khối ${grade}` : className,
      academicYear,
      semester,
      examType,
      examDate,
      durationMinutes,
      teacherName: teacherName || (currentUser?.fullName || 'Giáo viên'),
      numQuestions,
      numOptions,
      maxScore,
      passingScore,
      decimalPrecision,
      templateId: selectedTemplateId,
      questions,
      instructions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      // Creator & School Sharing
      createdById: currentUser?.id,
      createdByUsername: currentUser?.username,
      createdByFullName: currentUser?.fullName,
      createdByRole: currentUser?.role || 'admin',
      isSharedWithAllTeachers: isSharedWithAllTeachers || isAdmin,
      targetScope
    };

    addExam(newExam);
    onFinish();
  };

  const steps = [
    { num: 1, label: t.exam.step1 },
    { num: 2, label: t.exam.step2 },
    { num: 3, label: t.exam.step3 },
    { num: 4, label: t.exam.step4 },
    { num: 5, label: t.exam.step6 },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Wizard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10">
              <FileCheck className="w-6 h-6" />
            </div>
            <span>{t.exam.createTitle}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isAdmin 
              ? 'Tạo đề thi với quyền Quản trị viên — Đề thi sẽ tự động hiển thị trên trang của tất cả giáo viên thành viên.'
              : 'Quy trình 5 bước cấu hình đề thi, ma trận đáp án và gán mẫu phiếu OMR.'}
          </p>
        </div>

        <button
          onClick={onCancel}
          className="text-xs font-semibold text-slate-300 hover:text-white border border-white/10 px-3.5 py-2 rounded-xl hover:bg-white/5 transition cursor-pointer"
        >
          {t.actions.cancel}
        </button>
      </div>

      {/* Stepper Bar */}
      <div className="bg-[#0E131F]/80 backdrop-blur-xl p-4 rounded-3xl border border-white/5 shadow-2xl">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => {
            const isDone = currentStep > step.num;
            const isCurrent = currentStep === step.num;

            return (
              <React.Fragment key={step.num}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white ring-4 ring-cyan-500/20 shadow-lg shadow-cyan-500/20'
                        : 'bg-white/5 text-slate-500 border border-white/10'
                    }`}
                  >
                    {isDone ? '✓' : step.num}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline ${
                      isCurrent ? 'text-cyan-300 font-bold' : isDone ? 'text-slate-200' : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-3 ${
                      isDone ? 'bg-emerald-500/50' : 'bg-white/10'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content Card */}
      <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-6 shadow-2xl space-y-6">
        {/* STEP 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                <span>1. Thông Tin Cơ Bản Về Bài Thi</span>
              </h2>
              {isAdmin && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-bold">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  <span>Quyền Admin: Chia sẻ toàn trường</span>
                </span>
              )}
            </div>

            {/* Admin / Scope Banner */}
            <div className={`p-4 rounded-2xl border ${
              isAdmin 
                ? 'bg-purple-950/20 border-purple-500/30' 
                : 'bg-cyan-950/20 border-cyan-500/20'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span>Phạm vi phát hành & Quyền tiếp cận đề thi</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {isAdmin
                      ? 'Đề thi do Quản trị viên tạo sẽ tự động được chia sẻ và hiển thị trên trang Đề thi của TẤT CẢ giáo viên thành viên trong trường.'
                      : 'Đề thi có thể được chia sẻ cho toàn bộ giáo viên trong trường hoặc dùng riêng cho lớp phụ trách.'}
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer shrink-0 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/10 transition self-start">
                  <input
                    type="checkbox"
                    checked={isSharedWithAllTeachers}
                    onChange={(e) => setIsSharedWithAllTeachers(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-cyan-300">
                    Hiển thị cho tất cả GV
                  </span>
                </label>
              </div>

              {/* Scope Selection */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setTargetScope('school_wide')}
                  className={`p-2.5 rounded-xl text-left border transition text-xs cursor-pointer ${
                    targetScope === 'school_wide'
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200 font-bold shadow-xs'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Toàn trường</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">Mọi khối & lớp cùng thi</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetScope('grade_wide')}
                  className={`p-2.5 rounded-xl text-left border transition text-xs cursor-pointer ${
                    targetScope === 'grade_wide'
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200 font-bold shadow-xs'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Toàn khối ({grade})</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">Áp dụng tất cả lớp khối {grade}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetScope('class_only')}
                  className={`p-2.5 rounded-xl text-left border transition text-xs cursor-pointer ${
                    targetScope === 'class_only'
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200 font-bold shadow-xs'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Lớp cụ thể ({className})</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">Chỉ định riêng cho lớp {className}</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  {t.exam.title} <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isAdmin ? 'Ví dụ: Đề thi Khảo sát Chất lượng Đầu năm - Toàn trường' : t.exam.titlePlaceholder}
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl p-2.5 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.subject}</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full text-xs font-medium border border-white/10 rounded-xl p-2.5 bg-white/5 text-slate-200 focus:outline-hidden"
                >
                  <option value="Tiếng Anh" className="bg-slate-900 text-white">Tiếng Anh</option>
                  <option value="Toán Học" className="bg-slate-900 text-white">Toán Học</option>
                  <option value="Khoa Học Tự Nhiên" className="bg-slate-900 text-white">Khoa Học Tự Nhiên (Vật Lý / Hóa Học / Sinh Học)</option>
                  <option value="Lịch Sử & Địa Lý" className="bg-slate-900 text-white">Lịch Sử & Địa Lý</option>
                  <option value="Giáo Dục Công Dân" className="bg-slate-900 text-white">Giáo Dục Công Dân</option>
                  <option value="Tin Học" className="bg-slate-900 text-white">Tin Học</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.grade}</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full text-xs font-medium border border-white/10 rounded-xl p-2.5 bg-white/5 text-slate-200 focus:outline-hidden"
                  >
                    {['6', '7', '8', '9', '10', '11', '12'].map(g => (
                      <option key={g} value={g} className="bg-slate-900 text-white">Khối {g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.className}</label>
                  <select
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    disabled={targetScope === 'school_wide'}
                    className={`w-full text-xs font-medium border border-white/10 rounded-xl p-2.5 bg-white/5 text-slate-200 focus:outline-hidden ${
                      targetScope === 'school_wide' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.name} className="bg-slate-900 text-white">{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.examCode}</label>
                <input
                  type="text"
                  value={examCode}
                  onChange={(e) => setExamCode(e.target.value)}
                  className="w-full text-xs font-mono font-bold border border-white/10 rounded-xl p-2.5 bg-black/40 text-cyan-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.teacher} / Đơn vị phụ trách</label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full text-xs bg-white/5 border border-white/10 text-white rounded-xl p-2.5 focus:border-cyan-500/50 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.date}</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full text-xs bg-white/5 border border-white/10 text-white rounded-xl p-2.5 focus:border-cyan-500/50 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.duration}</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 45)}
                  className="w-full text-xs bg-white/5 border border-white/10 text-white rounded-xl p-2.5 focus:border-cyan-500/50 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Questions & Scoring */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2 text-cyan-300">
              <span>2. Cấu Hình Số Lượng Câu Hỏi & Thang Điểm</span>
            </h2>

            {/* Presets */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase block mb-2">{t.exam.presetConfigs}</label>
              <div className="flex flex-wrap gap-2">
                {[10, 20, 25, 30, 40, 50, 60, 100].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleNumQuestionsChange(cnt)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      numQuestions === cnt
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-500/40 shadow-lg shadow-cyan-500/20'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {cnt} Câu
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Số câu hỏi thực tế:
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={numQuestions}
                  onChange={(e) => handleNumQuestionsChange(parseInt(e.target.value, 10) || 10)}
                  className="w-full text-sm font-bold bg-white/5 border border-white/10 text-white rounded-xl p-2.5 focus:border-cyan-500/50 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.numOptions}</label>
                <select
                  value={numOptions}
                  onChange={(e) => setNumOptions(parseInt(e.target.value, 10) || 4)}
                  className="w-full text-xs font-medium border border-white/10 rounded-xl p-2.5 bg-white/5 text-slate-200 focus:outline-hidden"
                >
                  <option value={4} className="bg-slate-900 text-white">4 phương án (A, B, C, D)</option>
                  <option value={5} className="bg-slate-900 text-white">5 phương án (A, B, C, D, E)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.maxScore}</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxScore}
                  onChange={(e) => setMaxScore(parseFloat(e.target.value) || 10)}
                  className="w-full text-sm font-bold bg-white/5 border border-white/10 text-white rounded-xl p-2.5 focus:border-cyan-500/50 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.passingScore}</label>
                <input
                  type="number"
                  step="0.5"
                  value={passingScore}
                  onChange={(e) => setPassingScore(parseFloat(e.target.value) || 5.0)}
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-xl p-2.5 focus:border-cyan-500/50 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.decimalPrecision}</label>
                <select
                  value={decimalPrecision}
                  onChange={(e) => setDecimalPrecision(parseInt(e.target.value, 10) as 0 | 1 | 2)}
                  className="w-full text-xs font-medium border border-white/10 rounded-xl p-2.5 bg-white/5 text-slate-200 focus:outline-hidden"
                >
                  <option value={2} className="bg-slate-900 text-white">2 chữ số thập phân (VD: 8.75)</option>
                  <option value={1} className="bg-slate-900 text-white">1 chữ số thập phân (VD: 8.8)</option>
                  <option value={0} className="bg-slate-900 text-white">Làm tròn số nguyên (VD: 9)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Điểm mỗi câu (Tự tính):</label>
                <div className="p-2.5 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-xs font-bold text-cyan-300">
                  {(maxScore / numQuestions).toFixed(3)} điểm / câu
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Answer Key Editor */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h2 className="text-base font-bold text-white text-cyan-300">
                  3. Ma Trận Đáp Án Đúng (Answer Key)
                </h2>
                <p className="text-xs text-slate-400">
                  Bấm trực tiếp vào các ô tròn hoặc dán chuỗi đáp án nhanh.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuickStringMode(!quickStringMode)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  {quickStringMode ? 'Quay lại Bảng Bấm' : 'Nhập Chuỗi Nhanh (1A 2B...)'}
                </button>
              </div>
            </div>

            {/* Quick String Input Mode */}
            {quickStringMode ? (
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                <label className="block text-xs font-bold text-slate-300">
                  Dán chuỗi đáp án (VD: 1A 2B 3C 4D... hoặc chuỗi ABCD...):
                </label>
                <textarea
                  rows={3}
                  value={quickString}
                  onChange={(e) => setQuickString(e.target.value)}
                  placeholder="1A 2C 3B 4D 5B 6A 7C 8D 9A 10B..."
                  className="w-full text-xs font-mono border border-white/10 rounded-xl p-2.5 bg-black/40 text-cyan-300 focus:border-cyan-500/50 focus:outline-hidden"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleApplyQuickString}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-cyan-500/20"
                  >
                    Áp dụng đáp án
                  </button>
                </div>
              </div>
            ) : null}

            {/* Matrix of bubbles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto p-1">
              {Array.from({ length: numQuestions }, (_, i) => i + 1).map((qNum) => {
                const currentAns = answerKeyMap[qNum];
                const options: BubbleOption[] = ['A', 'B', 'C', 'D', 'E'].slice(0, numOptions) as BubbleOption[];

                return (
                  <div
                    key={qNum}
                    className="flex items-center justify-between p-2.5 rounded-2xl border border-white/5 bg-white/5 hover:border-cyan-500/30 transition"
                  >
                    <span className="text-xs font-bold text-slate-300 w-10">
                      Câu {qNum}:
                    </span>

                    <div className="flex items-center gap-1.5">
                      {options.map((opt) => {
                        const isSelected = currentAns === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswerKeyMap(prev => ({ ...prev, [qNum]: opt }))}
                            className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 scale-105'
                                : 'bg-black/40 text-slate-300 border border-white/10 hover:border-cyan-400/50'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Validation Notice */}
            <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
              missingCount === 0
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                {missingCount === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <span>
                  {missingCount === 0 ? t.exam.allAnswered : t.exam.missingAnswers.replace('{count}', missingCount.toString())}
                </span>
              </div>
              <span className="font-bold">
                {Object.keys(answerKeyMap).length} / {numQuestions} câu đã chọn
              </span>
            </div>
          </div>
        )}

        {/* STEP 4: Select Template */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-white border-b border-white/10 pb-3 text-cyan-300">
              4. Gán Mẫu Phiếu Trả Lời Trắc Nghiệm (OMR Template)
            </h2>

            {/* Compatibility status */}
            {!isTemplateCompatible ? (
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span>
                  {t.exam.compatibilityWarning
                    .replace('{templateQ}', (selectedTemplate?.numQuestions || 0).toString())
                    .replace('{examQ}', numQuestions.toString())}
                </span>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>
                  {t.exam.compatibilitySuccess
                    .replace('{questions}', numQuestions.toString())
                    .replace('{options}', numOptions.toString())}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tpl) => {
                const isSelected = tpl.id === selectedTemplateId;
                const isTplFit = tpl.numQuestions >= numQuestions;

                return (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`p-5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-950/30 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/50'
                        : 'border-white/5 hover:border-white/15 bg-white/5'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{tpl.name}</span>
                        <span className="text-xs font-mono px-2 py-0.5 bg-white/10 rounded-lg text-cyan-300">v{tpl.version}</span>
                      </div>
                      <p className="text-xs text-slate-400">{tpl.schoolName}</p>
                      <div className="text-xs text-slate-300 flex items-center gap-3">
                        <span>Hỗ trợ: <strong className="text-white">{tpl.numQuestions} câu</strong></span>
                        <span>Khổ: <strong className="text-white">{tpl.paperSize}</strong></span>
                        <span>{tpl.columnsCount} Cột</span>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between text-xs">
                      <span className={isTplFit ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                        {isTplFit ? '✓ Tương thích' : '⚠ Dung lượng câu nhỏ hơn đề'}
                      </span>
                      {isSelected && (
                        <span className="text-cyan-400 font-bold">Đang chọn</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5: Review & Publish */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-white border-b border-white/10 pb-3 text-cyan-300">
              5. Kiểm Tra Tổng Thể & Phát Hành Đề Thi
            </h2>

            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400">Tên bài thi:</span>
                <p className="font-bold text-white text-sm">{title || `${subject} - ${targetScope === 'school_wide' ? 'Toàn Trường' : `Khối ${grade}`}`}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400">Mã đề / Phạm vi:</span>
                <p className="font-bold text-white">
                  {examCode} • {targetScope === 'school_wide' ? 'Chung toàn trường' : targetScope === 'grade_wide' ? `Khối ${grade}` : `Lớp ${className}`}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400">Người tạo & Quyền chia sẻ:</span>
                <p className="font-bold text-cyan-300 flex items-center gap-1.5">
                  {isAdmin ? <Shield className="w-3.5 h-3.5 text-purple-400" /> : <Users className="w-3.5 h-3.5 text-cyan-400" />}
                  <span>{currentUser?.fullName || teacherName} ({isAdmin ? 'Quản trị viên' : 'Giáo viên'})</span>
                  <span className="text-emerald-400">• Đề thi chung toàn trường</span>
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400">Cấu hình câu hỏi:</span>
                <p className="font-bold text-white">{numQuestions} câu ({numOptions} phương án) • Thang điểm {maxScore}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400">Mẫu phiếu đã gán:</span>
                <p className="font-bold text-cyan-400">{selectedTemplate?.name} ({selectedTemplate?.numQuestions} câu)</p>
              </div>
            </div>

            <div className="p-4 bg-emerald-950/30 rounded-2xl border border-emerald-500/30 text-xs text-emerald-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {isAdmin ? 'Đề thi phát hành cho toàn bộ giáo viên thành viên:' : 'Sẵn sàng chấm điểm ngay sau khi tạo:'}
              </p>
              <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                {isAdmin
                  ? 'Sau khi phát hành, đề thi sẽ tự động xuất hiện trên tài khoản của tất cả giáo viên. Mọi giáo viên đều có thể in phiếu thi theo lớp của mình, quét bài thi và xem báo cáo kết quả.'
                  : 'Sau khi phát hành, đề thi sẽ xuất hiện trong trung tâm chấm thi. Bạn có thể in phiếu trả lời cho học sinh hoặc quét bài làm bất cứ lúc nào.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Footer Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-2xl border transition cursor-pointer ${
            currentStep === 1
              ? 'opacity-40 cursor-not-allowed bg-white/5 text-slate-500 border-white/5'
              : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.actions.back}</span>
        </button>

        {currentStep < 5 ? (
          <button
            type="button"
            onClick={() => setCurrentStep(prev => Math.min(5, prev + 1))}
            className="flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            <span>{t.actions.next}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            id="btn-finish-publish-exam"
            onClick={handlePublish}
            className="flex items-center gap-1.5 px-7 py-2.5 text-xs font-bold rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t.actions.finish}</span>
          </button>
        )}
      </div>
    </div>
  );
};
