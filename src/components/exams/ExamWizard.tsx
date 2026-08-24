import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BubbleOption, Exam, ExamVariant, QuestionConfig } from '../../types';
import {
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Upload,
  Shield,
  Users,
  Plus,
  Trash2,
  Shuffle,
  Hash,
  Tag
} from 'lucide-react';

interface ExamWizardProps {
  initialExamId?: string;
  onFinish: () => void;
  onCancel: () => void;
}

interface WizardVariant {
  id: string;
  code: string;
  title: string;
  answerKeyMap: Record<number, BubbleOption>;
}

export const ExamWizard: React.FC<ExamWizardProps> = ({ initialExamId, onFinish, onCancel }) => {
  const { t, exams, templates, classes, addExam, updateExam, schoolName, currentUser } = useApp();

  const existingExam = initialExamId ? exams.find(e => e.id === initialExamId) : undefined;
  const isEditing = !!existingExam;

  const [currentStep, setCurrentStep] = useState<number>(1);

  // Helper for default keys
  const createDefaultAnswerKey = (count: number, optCount: number, offset = 0): Record<number, BubbleOption> => {
    const map: Record<number, BubbleOption> = {};
    const defaultCycle: BubbleOption[] = ['A', 'B', 'C', 'D', 'E'].slice(0, optCount) as BubbleOption[];
    for (let i = 1; i <= count; i++) {
      map[i] = defaultCycle[(i - 1 + offset) % optCount];
    }
    return map;
  };

  // Form State
  const [title, setTitle] = useState<string>(existingExam?.title || '');
  const [subject, setSubject] = useState<string>(existingExam?.subject || 'Tiếng Anh');
  const [grade, setGrade] = useState<string>(existingExam?.grade || '6');
  const [className, setClassName] = useState<string>(existingExam?.className || classes[0]?.name || '6A1');
  const [academicYear, setAcademicYear] = useState<string>(existingExam?.academicYear || '2025-2026');
  const [semester, setSemester] = useState<string>(existingExam?.semester || 'Học kỳ I');
  const [examType, setExamType] = useState<Exam['examType']>(existingExam?.examType || 'midterm');
  const [examCode, setExamCode] = useState<string>(
    existingExam?.code || `EXAM-${Math.floor(100 + Math.random() * 900)}`
  );
  const [examDate, setExamDate] = useState<string>(
    existingExam?.examDate || new Date().toISOString().slice(0, 10)
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(existingExam?.durationMinutes || 45);
  const [teacherName, setTeacherName] = useState<string>(
    existingExam?.teacherName || currentUser?.fullName || (currentUser?.role === 'admin' ? 'Quản trị viên' : 'Giáo viên')
  );

  // Sharing & Scope State (Admin default = school_wide, shared with all teachers)
  const isAdmin = currentUser?.role === 'admin';
  const [isSharedWithAllTeachers, setIsSharedWithAllTeachers] = useState<boolean>(
    existingExam ? (existingExam.isSharedWithAllTeachers ?? true) : true
  );
  const [targetScope, setTargetScope] = useState<'school_wide' | 'grade_wide' | 'class_only'>(
    existingExam?.targetScope || (isAdmin ? 'school_wide' : 'class_only')
  );

  const [numQuestions, setNumQuestions] = useState<number>(existingExam?.numQuestions || 40);
  const [numOptions, setNumOptions] = useState<number>(existingExam?.numOptions || 4);
  const [maxScore, setMaxScore] = useState<number>(existingExam?.maxScore || 10);
  const [passingScore, setPassingScore] = useState<number>(existingExam?.passingScore || 5.0);
  const [decimalPrecision, setDecimalPrecision] = useState<0 | 1 | 2>(
    existingExam?.decimalPrecision ?? 2
  );
  const [instructions, setInstructions] = useState<string>(
    existingExam?.instructions || 'Dùng bút chì 2B tô kín ô tròn tương ứng với đáp án đúng.'
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    existingExam?.templateId || templates[0]?.id || 'tpl_120_fpt'
  );

  // Multi-variant state initialization
  const initialVariants = (): WizardVariant[] => {
    if (existingExam?.variants && existingExam.variants.length > 0) {
      return existingExam.variants.map(v => {
        let keyMap: Record<number, BubbleOption> = { ...(v.answerKeyMap || {}) };
        if (Object.keys(keyMap).length === 0 && v.questions) {
          v.questions.forEach(q => {
            keyMap[q.questionNumber] = q.correctAnswer;
          });
        }
        return {
          id: v.id,
          code: v.code,
          title: v.title || `Mã đề ${v.code}`,
          answerKeyMap: keyMap
        };
      });
    }

    if (existingExam?.questions && existingExam.questions.length > 0) {
      const map: Record<number, BubbleOption> = {};
      existingExam.questions.forEach(q => {
        map[q.questionNumber] = q.correctAnswer;
      });
      return [{
        id: 'var_' + (existingExam.code || '101'),
        code: existingExam.code || '101',
        title: `Mã đề ${existingExam.code || '101'}`,
        answerKeyMap: map
      }];
    }

    return [
      {
        id: 'var_101',
        code: '101',
        title: 'Mã đề 101',
        answerKeyMap: createDefaultAnswerKey(40, 4, 0)
      },
      {
        id: 'var_102',
        code: '102',
        title: 'Mã đề 102',
        answerKeyMap: createDefaultAnswerKey(40, 4, 1)
      },
      {
        id: 'var_103',
        code: '103',
        title: 'Mã đề 103',
        answerKeyMap: createDefaultAnswerKey(40, 4, 2)
      },
      {
        id: 'var_104',
        code: '104',
        title: 'Mã đề 104',
        answerKeyMap: createDefaultAnswerKey(40, 4, 3)
      }
    ];
  };

  const [variants, setVariants] = useState<WizardVariant[]>(initialVariants);
  const [activeVariantId, setActiveVariantId] = useState<string>(variants[0]?.id || 'var_101');
  const [newVariantCodeInput, setNewVariantCodeInput] = useState<string>('');
  const [showAddVariantModal, setShowAddVariantModal] = useState<boolean>(false);
  const [quickString, setQuickString] = useState<string>('');
  const [quickStringMode, setQuickStringMode] = useState<boolean>(false);

  // Selected Template
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];
  const activeVariant = variants.find(v => v.id === activeVariantId) || variants[0];

  // Adjust answer keys for all variants when question count or option count changes
  const handleNumQuestionsChange = (newCount: number) => {
    setNumQuestions(newCount);
    setVariants(prev => prev.map(v => {
      const nextMap = { ...v.answerKeyMap };
      const defaultCycle: BubbleOption[] = ['A', 'B', 'C', 'D', 'E'].slice(0, numOptions) as BubbleOption[];
      for (let i = 1; i <= newCount; i++) {
        if (!nextMap[i]) {
          nextMap[i] = defaultCycle[(i - 1) % numOptions];
        }
      }
      return { ...v, answerKeyMap: nextMap };
    }));
  };

  // Add a new variant
  const handleAddVariant = (codeToUse?: string) => {
    const code = (codeToUse || newVariantCodeInput).trim().toUpperCase();
    if (!code) return;

    // Check duplicate
    if (variants.some(v => v.code.toUpperCase() === code)) {
      alert(`Mã đề "${code}" đã tồn tại trong danh sách!`);
      return;
    }

    const newVar: WizardVariant = {
      id: 'var_' + Math.random().toString(36).slice(2, 9),
      code,
      title: `Mã đề ${code}`,
      answerKeyMap: activeVariant ? { ...activeVariant.answerKeyMap } : createDefaultAnswerKey(numQuestions, numOptions)
    };

    setVariants(prev => [...prev, newVar]);
    setActiveVariantId(newVar.id);
    setNewVariantCodeInput('');
    setShowAddVariantModal(false);
  };

  // Quick preset generation (e.g. 101, 102, 103, 104)
  const handleGeneratePresetVariants = (codes: string[]) => {
    const newVars: WizardVariant[] = codes.map((c, idx) => ({
      id: 'var_' + c + '_' + Math.random().toString(36).slice(2, 6),
      code: c,
      title: `Mã đề ${c}`,
      answerKeyMap: createDefaultAnswerKey(numQuestions, numOptions, idx)
    }));
    setVariants(newVars);
    setActiveVariantId(newVars[0].id);
  };

  // Remove a variant
  const handleRemoveVariant = (idToRemove: string) => {
    if (variants.length <= 1) {
      alert('Đề thi phải có ít nhất 1 mã đề!');
      return;
    }
    const remaining = variants.filter(v => v.id !== idToRemove);
    setVariants(remaining);
    if (activeVariantId === idToRemove) {
      setActiveVariantId(remaining[0].id);
    }
  };

  // Scramble answers for current variant
  const handleScrambleAnswers = () => {
    if (!activeVariant) return;
    const options: BubbleOption[] = ['A', 'B', 'C', 'D', 'E'].slice(0, numOptions) as BubbleOption[];
    const newMap: Record<number, BubbleOption> = {};
    for (let i = 1; i <= numQuestions; i++) {
      newMap[i] = options[Math.floor(Math.random() * options.length)];
    }
    setVariants(prev => prev.map(v => v.id === activeVariant.id ? { ...v, answerKeyMap: newMap } : v));
  };

  // Quick String Answer Key Parser (e.g. "1A 2B 3C" or "ABCDABCD...")
  const handleApplyQuickString = () => {
    if (!quickString.trim() || !activeVariant) return;
    const clean = quickString.trim().toUpperCase();
    const newMap: Record<number, BubbleOption> = { ...activeVariant.answerKeyMap };

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

    setVariants(prev => prev.map(v => v.id === activeVariant.id ? { ...v, answerKeyMap: newMap } : v));
    setQuickStringMode(false);
  };

  // Missing answers check for active variant
  const currentAnswerKeyMap = activeVariant?.answerKeyMap || {};
  const missingCount = Object.keys(currentAnswerKeyMap).length < numQuestions 
    ? numQuestions - Object.keys(currentAnswerKeyMap).length 
    : 0;

  // Compatibility warning
  const isTemplateCompatible = selectedTemplate && selectedTemplate.numQuestions >= numQuestions;

  // Complete and publish/update exam
  const handlePublish = () => {
    try {
      const qCount = Number(numQuestions) || 40;
      const optCount = Number(numOptions) || 4;
      const mScore = Number(maxScore) || 10;
      const pointPerQ = qCount > 0 ? Number((mScore / qCount).toFixed(3)) : 0.25;
      
      // Fallback if variants is empty
      const safeVariantsList = variants.length > 0 ? variants : [
        {
          id: 'var_101',
          code: '101',
          title: 'Mã đề 101',
          answerKeyMap: createDefaultAnswerKey(qCount, optCount, 0)
        }
      ];

      // Build QuestionConfig[] for all variants
      const builtVariants: ExamVariant[] = safeVariantsList.map(v => {
        const qList: QuestionConfig[] = [];
        for (let i = 1; i <= qCount; i++) {
          qList.push({
            questionNumber: i,
            correctAnswer: v.answerKeyMap?.[i] || 'A',
            points: pointPerQ,
            difficulty: (i % 3 === 0) ? 'easy' : (i % 3 === 1) ? 'medium' : 'hard'
          });
        }
        return {
          id: v.id || ('var_' + Math.random().toString(36).slice(2, 8)),
          code: v.code || '101',
          title: v.title || `Mã đề ${v.code || '101'}`,
          questions: qList,
          answerKeyMap: v.answerKeyMap || {}
        };
      });

      const primaryVariant = builtVariants[0];
      const finalTemplateId = selectedTemplateId || selectedTemplate?.id || templates[0]?.id || 'tpl_120_fpt';

      if (existingExam) {
        const updatedExam: Exam = {
          ...existingExam,
          code: primaryVariant.code || examCode,
          title: title.trim() || `${subject} - ${targetScope === 'school_wide' ? 'Toàn Trường' : targetScope === 'grade_wide' ? `Khối ${grade}` : `Lớp ${className}`}`,
          subject,
          grade,
          className: targetScope === 'school_wide' ? 'Toàn trường' : targetScope === 'grade_wide' ? `Khối ${grade}` : className,
          academicYear,
          semester,
          examType,
          examDate,
          durationMinutes: Number(durationMinutes) || 45,
          teacherName: teacherName || (currentUser?.fullName || 'Giáo viên'),
          numQuestions: qCount,
          numOptions: optCount,
          maxScore: mScore,
          passingScore: Number(passingScore) || 5,
          decimalPrecision,
          templateId: finalTemplateId,
          questions: primaryVariant.questions,
          variants: builtVariants,
          defaultVariantCode: primaryVariant.code,
          instructions,
          updatedAt: new Date().toISOString(),
          targetScope,
          isSharedWithAllTeachers: isSharedWithAllTeachers || isAdmin
        };
        updateExam(updatedExam);
      } else {
        const newExam: Exam = {
          id: 'exam_' + Math.random().toString(36).slice(2, 9),
          code: primaryVariant.code || examCode,
          title: title.trim() || `${subject} - ${targetScope === 'school_wide' ? 'Toàn Trường' : targetScope === 'grade_wide' ? `Khối ${grade}` : `Lớp ${className}`}`,
          subject,
          grade,
          className: targetScope === 'school_wide' ? 'Toàn trường' : targetScope === 'grade_wide' ? `Khối ${grade}` : className,
          academicYear,
          semester,
          examType,
          examDate,
          durationMinutes: Number(durationMinutes) || 45,
          teacherName: teacherName || (currentUser?.fullName || 'Giáo viên'),
          numQuestions: qCount,
          numOptions: optCount,
          maxScore: mScore,
          passingScore: Number(passingScore) || 5,
          decimalPrecision,
          templateId: finalTemplateId,
          questions: primaryVariant.questions,
          variants: builtVariants,
          defaultVariantCode: primaryVariant.code,
          instructions,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active',
          // Creator & School Sharing
          createdById: currentUser?.id,
          createdByUsername: currentUser?.username,
          createdByFullName: currentUser?.fullName,
          createdByRole: currentUser?.role || 'teacher',
          isSharedWithAllTeachers: isSharedWithAllTeachers || isAdmin,
          targetScope
        };
        addExam(newExam);
      }

      onFinish();
    } catch (err) {
      console.error('Error publishing exam:', err);
      alert('Có lỗi xảy ra khi lưu đề thi. Vui lòng kiểm tra lại thông tin.');
    }
  };

  const steps = [
    { num: 1, label: t.exam.step1 },
    { num: 2, label: t.exam.step2 },
    { num: 3, label: '3. Mã Đề & Đáp Án' },
    { num: 4, label: t.exam.step4 },
    { num: 5, label: isEditing ? '5. Xem Lại & Lưu' : t.exam.step6 },
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
            <span>{isEditing ? `Chỉnh Sửa Kỳ Thi: ${existingExam?.title || existingExam?.code}` : t.exam.createTitle}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isEditing
              ? 'Cập nhật lại cấu hình đề thi, danh sách các mã đề và ma trận đáp án tương ứng.'
              : (isAdmin 
                  ? 'Tạo đề thi hỗ trợ nhiều mã đề (101, 102, 103...) — Hệ thống tự động nhận diện mã đề học sinh tô để chấm điểm chính xác.'
                  : 'Quy trình cấu hình đề thi đa mã đề, ma trận đáp án tương ứng và gán mẫu phiếu OMR.')}
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
              <div key={step.num} className="flex items-center flex-1 last:flex-none">
                <div
                  onClick={() => setCurrentStep(step.num)}
                  className={`flex items-center gap-2.5 cursor-pointer select-none ${
                    isCurrent ? 'text-cyan-400 font-bold' : isDone ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      isCurrent
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                        : isDone
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10'
                    }`}
                  >
                    {isDone ? '✓' : step.num}
                  </div>
                  <span className="text-xs hidden md:inline">{step.label}</span>
                </div>

                {idx < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-4 rounded-full transition ${
                      isDone ? 'bg-emerald-500/40' : 'bg-white/5'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Container */}
      <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-6 shadow-2xl space-y-6">
        {/* STEP 1: Basic Information */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2 text-cyan-300">
              <span>1. Thông Tin Chung & Phân Quyền Sử Dụng</span>
            </h2>

            {/* Scope / Sharing Banner for Admin */}
            {isAdmin && (
              <div className="p-4 bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-blue-950/40 rounded-2xl border border-purple-500/30 space-y-2">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <span>Cơ chế Chia sẻ Đề thi Toàn Trường (Quản trị viên)</span>
                </div>
                <p className="text-[11px] text-purple-200/80 leading-relaxed">
                  Đề thi do Admin tạo sẽ tự động được chia sẻ với tất cả giáo viên trong trường. Giáo viên ở mọi bộ môn và khối lớp đều có thể sử dụng đề thi này để in phiếu và chấm bài cho lớp học của mình.
                </p>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      checked={targetScope === 'school_wide'}
                      onChange={() => setTargetScope('school_wide')}
                      className="accent-cyan-500"
                    />
                    <span>Toàn trường (Tất cả khối lớp & giáo viên)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      checked={targetScope === 'grade_wide'}
                      onChange={() => setTargetScope('grade_wide')}
                      className="accent-cyan-500"
                    />
                    <span>Toàn Khối {grade}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      checked={targetScope === 'class_only'}
                      onChange={() => setTargetScope('class_only')}
                      className="accent-cyan-500"
                    />
                    <span>Chỉ lớp {className}</span>
                  </label>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  {t.exam.title} <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Kiểm tra Giữa Kỳ I - Môn Tiếng Anh 12"
                  className="w-full text-xs bg-white/5 border border-white/10 text-white rounded-xl p-2.5 focus:border-cyan-500/50 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.subject}</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full text-xs font-medium border border-white/10 rounded-xl p-2.5 bg-white/5 text-slate-200 focus:outline-hidden"
                >
                  {['Tiếng Anh', 'Toán học', 'Vật lí', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lí', 'GDCD', 'Tin học', 'Khoa học Tự nhiên'].map(s => (
                    <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Khối lớp</label>
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
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Lớp phụ trách / Áp dụng</label>
                <select
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full text-xs font-medium border border-white/10 rounded-xl p-2.5 bg-white/5 text-slate-200 focus:outline-hidden"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.name} className="bg-slate-900 text-white">{c.name} ({c.grade})</option>
                  ))}
                  <option value="Toàn trường" className="bg-slate-900 text-white">Tất cả các lớp (Toàn trường)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">{t.exam.examType}</label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as any)}
                  className="w-full text-xs font-medium border border-white/10 rounded-xl p-2.5 bg-white/5 text-slate-200 focus:outline-hidden"
                >
                  <option value="midterm" className="bg-slate-900 text-white">Kiểm tra giữa kỳ</option>
                  <option value="final" className="bg-slate-900 text-white">Kiểm tra cuối kỳ</option>
                  <option value="quiz" className="bg-slate-900 text-white">Kiểm tra thường xuyên / 15 phút</option>
                  <option value="mock" className="bg-slate-900 text-white">Thi thử tốt nghiệp / ĐGNL</option>
                  <option value="regular" className="bg-slate-900 text-white">Kiểm tra định kỳ 1 tiết</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Giáo viên ra đề</label>
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
                {[10, 20, 25, 30, 40, 50, 60, 100, 120].map(cnt => (
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

        {/* STEP 3: Multi-Variant & Answer Key Editor */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h2 className="text-base font-bold text-white text-cyan-300 flex items-center gap-2">
                  <Hash className="w-5 h-5" />
                  <span>3. Cấu Hình Danh Sách Mã Đề & Nhập Đáp Án Tương Ứng</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Tạo các mã đề khác nhau (VD: 101, 102, 103, 104) và nhập đáp án cho từng mã đề. Máy quét sẽ đọc ô tô mã đề của học sinh để đối chiếu.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleGeneratePresetVariants(['101', '102', '103', '104'])}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30 font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tạo 4 Mã (101 - 104)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddVariantModal(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-cyan-500/20 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Mã Đề</span>
                </button>
              </div>
            </div>

            {/* Quick Add Variant Modal / Inline input */}
            {showAddVariantModal && (
              <div className="p-4 bg-cyan-950/40 border border-cyan-500/40 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-cyan-300 mb-1">
                    Nhập mã đề thi mới (Số hoặc Ký tự, VD: 105, 201, 001, B12):
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="VD: 105"
                    value={newVariantCodeInput}
                    onChange={(e) => setNewVariantCodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddVariant();
                    }}
                    className="w-full text-xs font-bold bg-black/50 border border-cyan-500/50 text-white rounded-xl p-2.5 focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => handleAddVariant()}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Xác nhận thêm
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddVariantModal(false)}
                    className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-xl transition cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            {/* Variant Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/5">
              {variants.map((v) => {
                const isSelected = v.id === activeVariantId;
                const filledCount = Object.keys(v.answerKeyMap).length;
                const isComplete = filledCount === numQuestions;

                return (
                  <div
                    key={v.id}
                    onClick={() => setActiveVariantId(v.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition cursor-pointer border select-none whitespace-nowrap ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-500/40 shadow-lg shadow-cyan-500/20'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Mã {v.code}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : isComplete
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                    }`}>
                      {filledCount}/{numQuestions}
                    </span>

                    {variants.length > 1 && (
                      <button
                        type="button"
                        title="Xóa mã đề này"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveVariant(v.id);
                        }}
                        className={`p-1 rounded-lg transition hover:bg-rose-500/20 hover:text-rose-300 ${
                          isSelected ? 'text-white/70' : 'text-slate-500'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Active Variant Controls Toolbar */}
            {activeVariant && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 p-3.5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Đang chỉnh sửa đáp án:</span>
                  <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 font-extrabold text-xs rounded-xl border border-cyan-500/30">
                    Mã đề {activeVariant.code}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleScrambleAnswers}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-purple-400" />
                    <span>Đảo ngẫu nhiên</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickStringMode(!quickStringMode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{quickStringMode ? 'Đóng nhập nhanh' : 'Dán chuỗi đáp án (1A 2B...)'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick String Input Mode */}
            {quickStringMode && activeVariant ? (
              <div className="p-4 bg-black/40 border border-cyan-500/30 rounded-2xl space-y-3">
                <label className="block text-xs font-bold text-cyan-300">
                  Dán chuỗi đáp án cho <strong className="text-white">Mã đề {activeVariant.code}</strong> (VD: 1A 2B 3C 4D... hoặc chuỗi ABCD...):
                </label>
                <textarea
                  rows={3}
                  value={quickString}
                  onChange={(e) => setQuickString(e.target.value)}
                  placeholder="1A 2C 3B 4D 5B 6A 7C 8D 9A 10B..."
                  className="w-full text-xs font-mono border border-white/10 rounded-xl p-2.5 bg-black/60 text-cyan-300 focus:border-cyan-500/50 focus:outline-hidden"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleApplyQuickString}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-cyan-500/20"
                  >
                    Áp dụng cho Mã {activeVariant.code}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Matrix of bubbles for active variant */}
            {activeVariant && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto p-1">
                {Array.from({ length: numQuestions }, (_, i) => i + 1).map((qNum) => {
                  const currentAns = activeVariant.answerKeyMap[qNum];
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
                              onClick={() => {
                                setVariants(prev => prev.map(v => {
                                  if (v.id !== activeVariant.id) return v;
                                  return {
                                    ...v,
                                    answerKeyMap: { ...v.answerKeyMap, [qNum]: opt }
                                  };
                                }));
                              }}
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
            )}

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
                  {missingCount === 0 
                    ? `Mã đề ${activeVariant?.code}: Đã điền đầy đủ đáp án!` 
                    : `Mã đề ${activeVariant?.code}: Còn thiếu ${missingCount} câu chưa chọn đáp án`}
                </span>
              </div>
              <span className="font-bold">
                {Object.keys(currentAnswerKeyMap).length} / {numQuestions} câu
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
                  Mẫu phiếu tương thích tốt với {numQuestions} câu hỏi và hỗ trợ quét nhận diện ô tô Mã đề thi tự động.
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
                <span className="text-slate-400">Mã đề thi ({variants.length} mã):</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {variants.map(v => (
                    <span key={v.id} className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 font-bold rounded-lg border border-cyan-500/30">
                      Mã {v.code}
                    </span>
                  ))}
                </div>
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
                <span>Cơ chế chấm điểm tự động theo mã đề đã sẵn sàng:</span>
              </p>
              <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                Khi học sinh làm bài và tô mã đề (ví dụ: {variants.map(v => v.code).join(', ')}), máy quét OMR sẽ nhận diện chính xác mã đề đó và tự động áp dụng ma trận đáp án tương ứng để chấm điểm bài thi.
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
            <span>{isEditing ? 'Lưu Thay Đổi Kỳ Thi' : t.actions.finish}</span>
          </button>
        )}
      </div>
    </div>
  );
};
