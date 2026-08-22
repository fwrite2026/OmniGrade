import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  AnswerSheetTemplate,
  BubbleOption,
  Exam,
  ExamStatistics,
  ExamSubmission,
  Language,
  QuestionAnalytics,
  RecognizedAnswer,
  SchoolClass,
  Student,
  UserRole,
  UserAccount
} from '../types';
import { translations } from '../locales/translations';
import { DEFAULT_120_TEMPLATE, DEFAULT_USERS } from '../services/demoData';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations['vi'];
  role: UserRole;
  setRole: (role: UserRole) => void;
  schoolName: string;
  setSchoolName: (name: string) => void;

  // Authentication & User Accounts
  users: UserAccount[];
  currentUser: UserAccount | null;
  login: (username: string, password: string) => { success: boolean; message?: string };
  logout: () => void;
  addUser: (user: Omit<UserAccount, 'id' | 'createdAt'>) => { success: boolean; message?: string };
  updateUser: (user: UserAccount) => { success: boolean; message?: string };
  deleteUser: (id: string) => { success: boolean; message?: string };
  changePassword: (userId: string, oldPassword: string, newPassword: string, isSelf?: boolean) => { success: boolean; message?: string };
  resetUserPassword: (userId: string, newPassword: string) => { success: boolean; message?: string };
  switchUserDirect: (userId: string) => void;

  // Exams
  exams: Exam[];
  activeExamId: string | null;
  setActiveExamId: (id: string | null) => void;
  activeExam: Exam | null;
  addExam: (exam: Exam) => void;
  updateExam: (exam: Exam) => void;
  deleteExam: (id: string) => void;
  deleteExamsBatch: (ids: string[]) => void;

  // Templates
  templates: AnswerSheetTemplate[];
  activeTemplateId: string | null;
  setActiveTemplateId: (id: string | null) => void;
  activeTemplate: AnswerSheetTemplate | null;
  addTemplate: (template: AnswerSheetTemplate) => void;
  updateTemplate: (template: AnswerSheetTemplate) => void;
  deleteTemplate: (id: string) => void;
  deleteTemplatesBatch: (ids: string[]) => void;

  // Submissions
  submissions: ExamSubmission[];
  addSubmissions: (newSubs: ExamSubmission[]) => void;
  updateSubmission: (sub: ExamSubmission) => void;
  overrideAnswer: (
    submissionId: string,
    questionNumber: number,
    newOption: BubbleOption | null,
    reason: string
  ) => void;
  regradeSubmissionWithVariant: (submissionId: string, variantCode: string) => void;
  approveSubmission: (submissionId: string) => void;
  deleteSubmission: (id: string) => void;
  deleteSubmissionsBatch: (ids: string[]) => void;

  // Students & Classes
  students: Student[];
  classes: SchoolClass[];
  addStudent: (student: Student) => void;
  addStudentsBatch: (students: Student[]) => void;
  deleteStudent: (id: string) => void;
  deleteStudentsBatch: (ids: string[]) => void;
  addClass: (cls: SchoolClass) => void;
  deleteClass: (id: string) => void;
  deleteClassesBatch: (ids: string[]) => void;

  // Statistics Helper
  getExamStatistics: (examId: string) => ExamStatistics;
  
  // Backup Import & Reset
  importBackupData: (backupData: any) => { success: boolean; message?: string };
  resetToDemoData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('omr_lang') as Language) || 'vi';
  });

  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('omr_users');
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.error('Error loading saved users', e);
      }
    }
    return DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  const [role, setRole] = useState<UserRole>('teacher');

  const [schoolName, setSchoolName] = useState<string>(() => {
    return localStorage.getItem('omr_school_name') || 'TRƯỜNG PHỔ THÔNG';
  });

  const [templates, setTemplates] = useState<AnswerSheetTemplate[]>(() => {
    const saved = localStorage.getItem('omr_templates');
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.error('Error loading saved templates', e);
      }
    }
    return [DEFAULT_120_TEMPLATE];
  });

  const [exams, setExams] = useState<Exam[]>(() => {
    const saved = localStorage.getItem('omr_exams');
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.error('Error loading saved exams', e);
      }
    }
    return [];
  });

  const [activeExamId, setActiveExamId] = useState<string | null>(() => {
    const savedId = localStorage.getItem('omr_active_exam_id');
    if (savedId) return savedId;
    const saved = localStorage.getItem('omr_exams');
    if (saved !== null) {
      try {
        const parsed: Exam[] = JSON.parse(saved);
        return parsed[0]?.id || null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(() => {
    const savedId = localStorage.getItem('omr_active_template_id');
    if (savedId) return savedId;
    const saved = localStorage.getItem('omr_templates');
    if (saved !== null) {
      try {
        const parsed: AnswerSheetTemplate[] = JSON.parse(saved);
        return parsed[0]?.id || DEFAULT_120_TEMPLATE.id;
      } catch {
        return DEFAULT_120_TEMPLATE.id;
      }
    }
    return DEFAULT_120_TEMPLATE.id;
  });

  const [submissions, setSubmissions] = useState<ExamSubmission[]>(() => {
    const saved = localStorage.getItem('omr_submissions');
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.error('Error loading saved submissions', e);
      }
    }
    return [];
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('omr_students');
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.error('Error loading saved students', e);
      }
    }
    return [];
  });

  const [classes, setClasses] = useState<SchoolClass[]>(() => {
    const saved = localStorage.getItem('omr_classes');
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.error('Error loading saved classes', e);
      }
    }
    return [];
  });

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('omr_lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('omr_school_name', schoolName);
  }, [schoolName]);

  useEffect(() => {
    localStorage.setItem('omr_templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    if (activeTemplateId) {
      localStorage.setItem('omr_active_template_id', activeTemplateId);
    } else {
      localStorage.removeItem('omr_active_template_id');
    }
  }, [activeTemplateId]);

  useEffect(() => {
    localStorage.setItem('omr_exams', JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    if (activeExamId) {
      localStorage.setItem('omr_active_exam_id', activeExamId);
    } else {
      localStorage.removeItem('omr_active_exam_id');
    }
  }, [activeExamId]);

  useEffect(() => {
    localStorage.setItem('omr_submissions', JSON.stringify(submissions));
  }, [submissions]);

  useEffect(() => {
    localStorage.setItem('omr_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('omr_classes', JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem('omr_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('omr_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('omr_current_user');
    }
  }, [currentUser]);

  // Auth & User Management methods
  const login = (username: string, pass: string): { success: boolean; message?: string } => {
    const cleanUser = username.trim().toLowerCase();
    const targetUser = users.find(u => u.username.toLowerCase() === cleanUser);
    if (!targetUser) {
      return { success: false, message: 'Tên đăng nhập không tồn tại!' };
    }
    if (targetUser.status === 'inactive') {
      return { success: false, message: 'Tài khoản này đang bị khóa. Vui lòng liên hệ Quản trị viên!' };
    }
    if (targetUser.password !== pass) {
      return { success: false, message: 'Mật khẩu không chính xác!' };
    }
    const updatedUser: UserAccount = {
      ...targetUser,
      lastLoginAt: new Date().toISOString()
    };
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    setRole(updatedUser.role);
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const switchUserDirect = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (target) {
      const updatedUser = { ...target, lastLoginAt: new Date().toISOString() };
      setUsers(prev => prev.map(u => u.id === target.id ? updatedUser : u));
      setCurrentUser(updatedUser);
      setRole(updatedUser.role);
    }
  };

  const addUser = (newUserData: Omit<UserAccount, 'id' | 'createdAt'>): { success: boolean; message?: string } => {
    const cleanUsername = newUserData.username.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, message: 'Tên đăng nhập phải có ít nhất 3 ký tự!' };
    }
    if (!newUserData.password || newUserData.password.length < 3) {
      return { success: false, message: 'Mật khẩu phải có ít nhất 3 ký tự!' };
    }
    const isDuplicate = users.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (isDuplicate) {
      return { success: false, message: 'Tên đăng nhập này đã tồn tại trong hệ thống!' };
    }
    const newUser: UserAccount = {
      ...newUserData,
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      username: cleanUsername,
      createdAt: new Date().toISOString(),
      status: newUserData.status || 'active'
    };
    setUsers(prev => [newUser, ...prev]);
    return { success: true };
  };

  const updateUser = (updated: UserAccount): { success: boolean; message?: string } => {
    const cleanUsername = updated.username.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, message: 'Tên đăng nhập phải có ít nhất 3 ký tự!' };
    }
    const isDuplicate = users.some(u => u.id !== updated.id && u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (isDuplicate) {
      return { success: false, message: 'Tên đăng nhập này đã bị trùng với tài khoản khác!' };
    }
    setUsers(prev => prev.map(u => u.id === updated.id ? { ...updated, username: cleanUsername } : u));
    if (currentUser?.id === updated.id) {
      setCurrentUser({ ...updated, username: cleanUsername });
      setRole(updated.role);
    }
    return { success: true };
  };

  const deleteUser = (id: string): { success: boolean; message?: string } => {
    if (currentUser?.id === id) {
      return { success: false, message: 'Không thể xóa tài khoản bạn đang đăng nhập!' };
    }
    const target = users.find(u => u.id === id);
    if (target?.username.toLowerCase() === 'admin') {
      return { success: false, message: 'Không thể xóa tài khoản Quản trị viên mặc định (admin)!' };
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    return { success: true };
  };

  const changePassword = (userId: string, oldPassword: string, newPassword: string, isForceAdmin = false): { success: boolean; message?: string } => {
    const target = users.find(u => u.id === userId);
    if (!target) {
      return { success: false, message: 'Không tìm thấy tài khoản người dùng!' };
    }
    if (!isForceAdmin && target.password !== oldPassword) {
      return { success: false, message: 'Mật khẩu hiện tại không đúng!' };
    }
    if (!newPassword || newPassword.length < 3) {
      return { success: false, message: 'Mật khẩu mới phải có ít nhất 3 ký tự!' };
    }
    const updatedUser = { ...target, password: newPassword };
    setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
    if (currentUser?.id === userId) {
      setCurrentUser(updatedUser);
    }
    return { success: true, message: 'Đổi mật khẩu thành công!' };
  };

  const resetUserPassword = (userId: string, newPassword: string): { success: boolean; message?: string } => {
    return changePassword(userId, '', newPassword, true);
  };

  const activeExam = exams.find(e => e.id === activeExamId) || exams[0] || null;
  const activeTemplate = templates.find(t => t.id === activeTemplateId) || templates[0] || DEFAULT_120_TEMPLATE;

  const t = translations[language] || translations.vi;

  // Exam actions
  const addExam = (exam: Exam) => {
    setExams(prev => [exam, ...prev]);
    setActiveExamId(exam.id);
  };

  const updateExam = (updated: Exam) => {
    setExams(prev => prev.map(e => e.id === updated.id ? updated : e));
  };

  const deleteExam = (id: string) => {
    setExams(prev => prev.filter(e => e.id !== id));
    if (activeExamId === id) {
      setActiveExamId(exams.find(e => e.id !== id)?.id || null);
    }
  };

  const deleteExamsBatch = (ids: string[]) => {
    const idSet = new Set(ids);
    setExams(prev => prev.filter(e => !idSet.has(e.id)));
    if (activeExamId && idSet.has(activeExamId)) {
      const remaining = exams.filter(e => !idSet.has(e.id));
      setActiveExamId(remaining[0]?.id || null);
    }
  };

  // Template actions
  const addTemplate = (template: AnswerSheetTemplate) => {
    setTemplates(prev => [template, ...prev]);
    setActiveTemplateId(template.id);
  };

  const updateTemplate = (updated: AnswerSheetTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (activeTemplateId === id) {
      const remaining = templates.filter(t => t.id !== id);
      setActiveTemplateId(remaining[0]?.id || null);
    }
  };

  const deleteTemplatesBatch = (ids: string[]) => {
    const idSet = new Set(ids);
    setTemplates(prev => prev.filter(t => !idSet.has(t.id)));
    if (activeTemplateId && idSet.has(activeTemplateId)) {
      const remaining = templates.filter(t => !idSet.has(t.id));
      setActiveTemplateId(remaining[0]?.id || null);
    }
  };

  // Submission actions
  const addSubmissions = (newSubs: ExamSubmission[]) => {
    setSubmissions(prev => [...newSubs, ...prev]);
  };

  const updateSubmission = (updated: ExamSubmission) => {
    setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const overrideAnswer = (
    submissionId: string,
    questionNumber: number,
    newOption: BubbleOption | null,
    reason: string
  ) => {
    setSubmissions(prev => prev.map(sub => {
      if (sub.id !== submissionId) return sub;

      const exam = exams.find(e => e.id === sub.examId);
      const qConfig = exam?.questions.find(q => q.questionNumber === questionNumber);
      const qPoints = qConfig?.points || (exam ? exam.maxScore / exam.numQuestions : 0.25);

      let correctCount = 0;
      let wrongCount = 0;
      let blankCount = 0;
      let multipleCount = 0;
      let uncertainCount = 0;
      let totalEarned = 0;

      const updatedAnswers = sub.recognizedAnswers.map(ans => {
        if (ans.questionNumber === questionNumber) {
          const isCorrect = newOption === ans.correctAnswer;
          const pointsEarned = isCorrect ? qPoints : 0;
          return {
            ...ans,
            selectedOption: newOption,
            isCorrect,
            status: (isCorrect ? 'CORRECT' : (newOption ? 'WRONG' : 'BLANK')) as any,
            pointsEarned,
            isManuallyCorrected: true,
            originalOmrAnswer: ans.originalOmrAnswer ?? ans.selectedOption,
            teacherNote: reason
          };
        }
        return ans;
      });

      // Recalculate summary stats
      updatedAnswers.forEach(a => {
        if (a.isCorrect) {
          correctCount++;
          totalEarned += a.pointsEarned;
        } else if (a.status === 'WRONG') wrongCount++;
        else if (a.status === 'BLANK') blankCount++;
        else if (a.status === 'MULTIPLE') multipleCount++;
        else if (a.status === 'UNCERTAIN') uncertainCount++;
      });

      const maxScore = exam ? exam.maxScore : sub.maxScore;
      const totalPossible = exam ? exam.questions.reduce((acc, q) => acc + (q.points || 0.25), 0) : maxScore;
      const precision = exam?.decimalPrecision ?? 2;
      const rawScore = totalPossible > 0 ? (totalEarned / totalPossible) * maxScore : 0;
      const multiplier = Math.pow(10, precision);
      const recalculatedScore = Math.round(rawScore * multiplier) / multiplier;

      // Update status
      const hasIssues = multipleCount > 0 || uncertainCount > 0;
      const newStatus = hasIssues ? 'NEEDS_REVIEW' : 'GRADED';

      const newAuditLog = {
        id: 'log_' + Math.random().toString(36).slice(2),
        submissionId: sub.id,
        questionNumber,
        action: 'TEACHER_OVERRIDE',
        newValue: `Changed Q${questionNumber} to ${newOption || 'BLANK'}`,
        changedBy: role === 'admin' ? 'Administrator' : 'Teacher',
        timestamp: new Date().toISOString(),
        reason: reason || 'Manual review correction'
      };

      return {
        ...sub,
        totalScore: recalculatedScore,
        totalCorrect: correctCount,
        totalWrong: wrongCount,
        totalBlank: blankCount,
        totalMultiple: multipleCount,
        totalUncertain: uncertainCount,
        status: newStatus,
        recognizedAnswers: updatedAnswers,
        auditLogs: [newAuditLog, ...sub.auditLogs]
      };
    }));
  };

  const regradeSubmissionWithVariant = (submissionId: string, variantCode: string) => {
    setSubmissions(prev => prev.map(sub => {
      if (sub.id !== submissionId) return sub;

      const exam = exams.find(e => e.id === sub.examId);
      if (!exam) return sub;

      const matchedVariant = exam.variants?.find(v => v.code.trim().toLowerCase() === variantCode.trim().toLowerCase());
      const targetQuestions = matchedVariant?.questions || exam.questions;

      let totalEarned = 0;
      let correctCount = 0;
      let wrongCount = 0;
      let blankCount = 0;
      let multipleCount = 0;
      let uncertainCount = 0;

      const updatedAnswers: RecognizedAnswer[] = (sub.recognizedAnswers || []).map(ans => {
        const qConfig = targetQuestions.find(q => q.questionNumber === ans.questionNumber);
        const correctAns = qConfig?.correctAnswer || ans.correctAnswer;
        const qPoints = qConfig?.points || (sub.maxScore / (exam.numQuestions || 1));

        const isCorrect = !!ans.selectedOption && ans.selectedOption === correctAns;
        const earned = isCorrect ? qPoints : 0;

        if (isCorrect) {
          correctCount++;
          totalEarned += earned;
        } else if (ans.selectedOption) {
          wrongCount++;
        } else if (ans.status === 'BLANK') {
          blankCount++;
        } else if (ans.status === 'MULTIPLE') {
          multipleCount++;
        } else if (ans.status === 'UNCERTAIN') {
          uncertainCount++;
        } else {
          wrongCount++;
        }

        return {
          ...ans,
          correctAnswer: correctAns,
          isCorrect,
          pointsEarned: earned
        };
      });

      const maxScore = exam.maxScore;
      const totalPossible = targetQuestions.reduce((acc, q) => acc + (q.points || 0.25), 0) || maxScore;
      const precision = exam.decimalPrecision ?? 2;
      const rawScore = totalPossible > 0 ? (totalEarned / totalPossible) * maxScore : 0;
      const multiplier = Math.pow(10, precision);
      const recalculatedScore = Math.round(rawScore * multiplier) / multiplier;

      const hasIssues = multipleCount > 0 || uncertainCount > 0;
      const newStatus = hasIssues ? 'NEEDS_REVIEW' : 'GRADED';

      const newAuditLog = {
        id: 'log_' + Math.random().toString(36).slice(2),
        submissionId: sub.id,
        action: 'VARIANT_OVERRIDE',
        newValue: `Đổi chấm sang Mã đề ${variantCode}`,
        changedBy: role === 'admin' ? 'Administrator' : 'Teacher',
        timestamp: new Date().toISOString(),
        reason: `Áp dụng bộ đáp án mã đề ${variantCode}`
      };

      return {
        ...sub,
        appliedVariantCode: variantCode,
        matchedVariantTitle: matchedVariant ? (matchedVariant.title || `Mã đề ${matchedVariant.code}`) : `Mã đề ${variantCode}`,
        totalScore: recalculatedScore,
        totalCorrect: correctCount,
        totalWrong: wrongCount,
        totalBlank: blankCount,
        totalMultiple: multipleCount,
        totalUncertain: uncertainCount,
        status: newStatus,
        needsReviewReason: hasIssues ? sub.needsReviewReason : undefined,
        recognizedAnswers: updatedAnswers,
        auditLogs: [newAuditLog, ...(sub.auditLogs || [])]
      };
    }));
  };

  const approveSubmission = (submissionId: string) => {
    setSubmissions(prev => prev.map(sub => {
      if (sub.id !== submissionId) return sub;
      return {
        ...sub,
        status: 'GRADED',
        needsReviewReason: undefined,
        auditLogs: [
          {
            id: 'log_' + Math.random().toString(36).slice(2),
            submissionId: sub.id,
            action: 'TEACHER_APPROVAL',
            newValue: 'Manually marked as Graded',
            changedBy: role === 'admin' ? 'Administrator' : 'Teacher',
            timestamp: new Date().toISOString()
          },
          ...sub.auditLogs
        ]
      };
    }));
  };

  const deleteSubmission = (id: string) => {
    setSubmissions(prev => prev.filter(s => s.id !== id));
  };

  const deleteSubmissionsBatch = (ids: string[]) => {
    const idSet = new Set(ids);
    setSubmissions(prev => prev.filter(s => !idSet.has(s.id)));
  };

  // Student actions
  const addStudent = (student: Student) => {
    setStudents(prev => [student, ...prev]);
  };

  const addStudentsBatch = (newStudents: Student[]) => {
    setStudents(prev => {
      const existingIds = new Set(prev.map(s => s.studentId));
      const filtered = newStudents.filter(s => !existingIds.has(s.studentId));
      return [...filtered, ...prev];
    });
  };

  const deleteStudent = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  const deleteStudentsBatch = (ids: string[]) => {
    const idSet = new Set(ids);
    setStudents(prev => prev.filter(s => !idSet.has(s.id)));
  };

  const addClass = (cls: SchoolClass) => {
    setClasses(prev => [cls, ...prev]);
  };

  const deleteClass = (id: string) => {
    setClasses(prev => prev.filter(c => c.id !== id));
  };

  const deleteClassesBatch = (ids: string[]) => {
    const idSet = new Set(ids);
    setClasses(prev => prev.filter(c => !idSet.has(c.id)));
  };

  // Calculate detailed exam statistics & item analysis
  const getExamStatistics = (examId: string): ExamStatistics => {
    const exam = exams.find(e => e.id === examId);
    const examSubs = submissions.filter(s => s.examId === examId);

    if (!exam || examSubs.length === 0) {
      return {
        totalSubmissions: 0,
        gradedCount: 0,
        needsReviewCount: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        medianScore: 0,
        standardDeviation: 0,
        passCount: 0,
        passRate: 0,
        scoreDistribution: [],
        questionAnalytics: []
      };
    }

    const scores = examSubs.map(s => s.totalScore).sort((a, b) => a - b);
    const totalSubmissions = examSubs.length;
    const gradedCount = examSubs.filter(s => s.status === 'GRADED').length;
    const needsReviewCount = examSubs.filter(s => s.status === 'NEEDS_REVIEW').length;

    const sumScore = scores.reduce((a, b) => a + b, 0);
    const averageScore = Number((sumScore / totalSubmissions).toFixed(2));
    const highestScore = scores[scores.length - 1] || 0;
    const lowestScore = scores[0] || 0;

    // Median
    const mid = Math.floor(scores.length / 2);
    const medianScore = scores.length % 2 !== 0 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;

    // Standard deviation
    const variance = scores.reduce((acc, val) => acc + Math.pow(val - averageScore, 2), 0) / totalSubmissions;
    const standardDeviation = Number(Math.sqrt(variance).toFixed(2));

    // Pass count
    const passingThreshold = exam.passingScore ?? 5;
    const passCount = examSubs.filter(s => (s.totalScore ?? 0) >= passingThreshold).length;
    const passRate = Number(((passCount / totalSubmissions) * 100).toFixed(1));

    // Score distribution buckets (0-2, 2-4, 4-6, 6-8, 8-10)
    const buckets: { range: string; min: number; max: number; count: number }[] = [
      { range: '0.0 - 2.0', min: 0, max: 2, count: 0 },
      { range: '2.0 - 4.0', min: 2, max: 4, count: 0 },
      { range: '4.0 - 6.0', min: 4, max: 6, count: 0 },
      { range: '6.0 - 8.0', min: 6, max: 8, count: 0 },
      { range: '8.0 - 10.0', min: 8, max: 10.01, count: 0 },
    ];

    scores.forEach(s => {
      const bucket = buckets.find(b => s >= b.min && s < b.max);
      if (bucket) bucket.count++;
      else if (s === 10) buckets[buckets.length - 1].count++;
    });

    const scoreDistribution = buckets.map(b => ({
      range: b.range,
      count: b.count,
      percentage: Number(((b.count / totalSubmissions) * 100).toFixed(1))
    }));

    // Question analytics
    const examQuestionsList = (exam.questions && exam.questions.length > 0)
      ? exam.questions
      : Array.from({ length: exam.numQuestions || 120 }, (_, idx) => ({
          questionNumber: idx + 1,
          correctAnswer: (['A', 'B', 'C', 'D'][idx % 4]) as BubbleOption,
          points: (exam.maxScore || 10) / (exam.numQuestions || 120)
        }));

    const questionAnalytics: QuestionAnalytics[] = examQuestionsList.map(qConfig => {
      const qNum = qConfig.questionNumber;
      let correctAnswersCount = 0;
      const distractorCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, blank: 0 };

      examSubs.forEach(sub => {
        const answersList = sub.recognizedAnswers || [];
        const ans = answersList.find(r => r.questionNumber === qNum);
        if (ans) {
          if (ans.isCorrect) correctAnswersCount++;
          if (ans.selectedOption) {
            distractorCounts[ans.selectedOption] = (distractorCounts[ans.selectedOption] || 0) + 1;
          } else {
            distractorCounts['blank'] = (distractorCounts['blank'] || 0) + 1;
          }
        }
      });

      const correctPercentage = Number(((correctAnswersCount / totalSubmissions) * 100).toFixed(1));
      const difficultyIndex = Number((correctAnswersCount / totalSubmissions).toFixed(2));

      // Find most common wrong distractor
      let maxDistractorCount = -1;
      let mostCommonDistractor: BubbleOption | undefined;
      Object.entries(distractorCounts).forEach(([opt, cnt]) => {
        if (opt !== qConfig.correctAnswer && opt !== 'blank' && cnt > maxDistractorCount) {
          maxDistractorCount = cnt;
          mostCommonDistractor = opt as BubbleOption;
        }
      });

      let difficultyLabel: 'easy' | 'medium' | 'hard' = 'medium';
      if (correctPercentage >= 70) difficultyLabel = 'easy';
      else if (correctPercentage < 40) difficultyLabel = 'hard';

      return {
        questionNumber: qNum,
        correctAnswer: qConfig.correctAnswer,
        totalResponses: totalSubmissions,
        correctCount: correctAnswersCount,
        correctPercentage,
        distractorCounts,
        difficultyIndex,
        difficultyLabel,
        mostCommonDistractor
      };
    });

    return {
      totalSubmissions,
      gradedCount,
      needsReviewCount,
      averageScore,
      highestScore,
      lowestScore,
      medianScore,
      standardDeviation,
      passCount,
      passRate,
      scoreDistribution,
      questionAnalytics
    };
  };

  const importBackupData = (backupData: any): { success: boolean; message?: string } => {
    try {
      let data = backupData;
      if (typeof backupData === 'string') {
        data = JSON.parse(backupData);
      }
      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Định dạng dữ liệu sao lưu không hợp lệ!' };
      }

      if (data.schoolName && typeof data.schoolName === 'string') {
        setSchoolName(data.schoolName);
        localStorage.setItem('omr_school_name', data.schoolName);
      }

      if (data.users) {
        const parsedUsers = typeof data.users === 'string' ? JSON.parse(data.users) : data.users;
        if (Array.isArray(parsedUsers)) {
          setUsers(parsedUsers);
          localStorage.setItem('omr_users', JSON.stringify(parsedUsers));
        }
      }

      if (data.templates) {
        const parsedTemplates = typeof data.templates === 'string' ? JSON.parse(data.templates) : data.templates;
        if (Array.isArray(parsedTemplates)) {
          setTemplates(parsedTemplates);
          localStorage.setItem('omr_templates', JSON.stringify(parsedTemplates));
          if (parsedTemplates[0]?.id) {
            setActiveTemplateId(parsedTemplates[0].id);
          }
        }
      }

      if (data.exams) {
        const parsedExams = typeof data.exams === 'string' ? JSON.parse(data.exams) : data.exams;
        if (Array.isArray(parsedExams)) {
          setExams(parsedExams);
          localStorage.setItem('omr_exams', JSON.stringify(parsedExams));
          if (parsedExams[0]?.id) {
            setActiveExamId(parsedExams[0].id);
          }
        }
      }

      if (data.submissions) {
        const parsedSubs = typeof data.submissions === 'string' ? JSON.parse(data.submissions) : data.submissions;
        if (Array.isArray(parsedSubs)) {
          setSubmissions(parsedSubs);
          localStorage.setItem('omr_submissions', JSON.stringify(parsedSubs));
        }
      }

      if (data.students) {
        const parsedStudents = typeof data.students === 'string' ? JSON.parse(data.students) : data.students;
        if (Array.isArray(parsedStudents)) {
          setStudents(parsedStudents);
          localStorage.setItem('omr_students', JSON.stringify(parsedStudents));
        }
      }

      if (data.classes) {
        const parsedClasses = typeof data.classes === 'string' ? JSON.parse(data.classes) : data.classes;
        if (Array.isArray(parsedClasses)) {
          setClasses(parsedClasses);
          localStorage.setItem('omr_classes', JSON.stringify(parsedClasses));
        }
      }

      return { success: true, message: 'Đã nhập dữ liệu sao lưu thành công!' };
    } catch (err: any) {
      console.error('Import error', err);
      return { success: false, message: err?.message || 'Lỗi khi đọc file sao lưu!' };
    }
  };

  const resetToDemoData = () => {
    setTemplates([DEFAULT_120_TEMPLATE]);
    setActiveTemplateId(DEFAULT_120_TEMPLATE.id);
    setExams([]);
    setActiveExamId(null);
    setSubmissions([]);
    setStudents([]);
    setClasses([]);
  };

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        t,
        role,
        setRole,
        schoolName,
        setSchoolName,
        users,
        currentUser,
        login,
        logout,
        addUser,
        updateUser,
        deleteUser,
        changePassword,
        resetUserPassword,
        switchUserDirect,
        exams,
        activeExamId,
        setActiveExamId,
        activeExam,
        addExam,
        updateExam,
        deleteExam,
        deleteExamsBatch,
        templates,
        activeTemplateId,
        setActiveTemplateId,
        activeTemplate,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        deleteTemplatesBatch,
        submissions,
        addSubmissions,
        updateSubmission,
        overrideAnswer,
        regradeSubmissionWithVariant,
        approveSubmission,
        deleteSubmission,
        deleteSubmissionsBatch,
        students,
        classes,
        addStudent,
        addStudentsBatch,
        deleteStudent,
        deleteStudentsBatch,
        addClass,
        deleteClass,
        deleteClassesBatch,
        getExamStatistics,
        importBackupData,
        resetToDemoData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
