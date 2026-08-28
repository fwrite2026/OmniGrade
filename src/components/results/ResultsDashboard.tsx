import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Exam, ExamSubmission } from '../../types';
import { exportResultsToCSV, exportResultsToExcel, generateExamSummaryPDF } from '../../services/exportService';
import { StudentReportModal } from './StudentReportModal';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Award,
  TrendingUp,
  User,
  ArrowUpDown,
  Trash2,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  Trophy,
  RefreshCw,
  Database,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Printer,
  FolderSync,
  SlidersHorizontal,
  Layers,
  ShieldCheck,
  Check,
  RotateCcw,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const ResultsDashboard: React.FC = () => {
  const {
    t,
    activeExam,
    exams,
    setActiveExamId,
    submissions,
    deleteSubmission,
    deleteSubmissionsBatch,
    approveSubmission,
    approveSubmissionsBatch,
    reassignSubmissionExam,
    reassignSubmissionsExamBatch,
    forceSyncSubmissionsToStorage,
    generateDemoSubmissions,
    getExamStatistics
  } = useApp();

  // View Modes: 'table' | 'grid' | 'rankings'
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'rankings'>('table');

  // Selected Exam Filter ('all' or specific exam ID)
  const [selectedExamFilterId, setSelectedExamFilterId] = useState<string>('all');

  // Multi-Criteria Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gradeBandFilter, setGradeBandFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'correct_desc' | 'name_asc' | 'id_asc' | 'newest' | 'review_first'>('score_desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Inspection Modal
  const [selectedSubIndex, setSelectedSubIndex] = useState<number | null>(null);

  // Selection & Bulk Operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState<boolean>(false);
  const [showReassignModal, setShowReassignModal] = useState<boolean>(false);
  const [targetReassignExamId, setTargetReassignExamId] = useState<string>('');
  const [reassignSingleSubId, setReassignSingleSubId] = useState<string | null>(null);

  // Storage notification toast
  const [storageToast, setStorageToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Trigger temporary storage notification toast
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setStorageToast({ message, type });
    setTimeout(() => {
      setStorageToast(null);
    }, 4000);
  };

  // Determine current active exam context
  const currentExam = exams.find(e => e.id === selectedExamFilterId) || (selectedExamFilterId === 'all' ? (activeExam || exams[0]) : null);

  // Compute available classes dynamically from submissions and exams
  const availableClasses = useMemo(() => {
    const classSet = new Set<string>();
    submissions.forEach(sub => {
      if (sub.className) classSet.add(sub.className);
    });
    exams.forEach(ex => {
      if (ex.className) classSet.add(ex.className);
    });
    return Array.from(classSet).sort();
  }, [submissions, exams]);

  // Filter Submissions based on exam filter & multi-criteria
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      // 1. Exam Filter
      if (selectedExamFilterId !== 'all' && sub.examId !== selectedExamFilterId) {
        return false;
      }

      // 2. Search Term (Name, SBD, Class, Variant)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = (sub.studentName || '').toLowerCase().includes(term);
        const matchesId = (sub.studentId || '').toLowerCase().includes(term);
        const matchesClass = (sub.className || '').toLowerCase().includes(term);
        const matchesVariant = (sub.appliedVariantCode || sub.detectedExamCode || '').toLowerCase().includes(term);
        if (!matchesName && !matchesId && !matchesClass && !matchesVariant) return false;
      }

      // 3. Class Filter
      if (classFilter !== 'all' && sub.className !== classFilter) {
        return false;
      }

      // 4. Status Filter
      const passingScore = currentExam?.passingScore ?? 5.0;
      if (statusFilter === 'graded' && sub.status !== 'GRADED') return false;
      if (statusFilter === 'review' && sub.status !== 'NEEDS_REVIEW' && sub.status !== 'MULTIPLE_ANSWERS' && sub.status !== 'LOW_CONFIDENCE') return false;
      if (statusFilter === 'issues' && (sub.totalMultiple || 0) === 0 && (sub.totalUncertain || 0) === 0) return false;
      if (statusFilter === 'pass' && sub.totalScore < passingScore) return false;
      if (statusFilter === 'fail' && sub.totalScore >= passingScore) return false;

      // 5. Grade Band Filter (0..10 standard scale)
      const scoreRatio = (sub.totalScore / (sub.maxScore || 10)) * 10;
      if (gradeBandFilter === 'excellent' && scoreRatio < 9.0) return false;
      if (gradeBandFilter === 'good' && (scoreRatio < 8.0 || scoreRatio >= 9.0)) return false;
      if (gradeBandFilter === 'fair' && (scoreRatio < 6.5 || scoreRatio >= 8.0)) return false;
      if (gradeBandFilter === 'average' && (scoreRatio < 5.0 || scoreRatio >= 6.5)) return false;
      if (gradeBandFilter === 'poor' && scoreRatio >= 5.0) return false;

      // 6. Confidence Filter
      const conf = sub.overallConfidence || 0;
      if (confidenceFilter === 'high' && conf < 95) return false;
      if (confidenceFilter === 'medium' && (conf < 80 || conf >= 95)) return false;
      if (confidenceFilter === 'low' && conf >= 80) return false;

      return true;
    });
  }, [submissions, selectedExamFilterId, searchTerm, classFilter, statusFilter, gradeBandFilter, confidenceFilter, currentExam]);

  // Sort filtered submissions
  const sortedSubmissions = useMemo(() => {
    const list = [...filteredSubmissions];
    list.sort((a, b) => {
      switch (sortBy) {
        case 'score_desc':
          return b.totalScore - a.totalScore;
        case 'score_asc':
          return a.totalScore - b.totalScore;
        case 'correct_desc':
          return b.totalCorrect - a.totalCorrect;
        case 'name_asc':
          return (a.studentName || '').localeCompare(b.studentName || '', 'vi');
        case 'id_asc':
          return (a.studentId || '').localeCompare(b.studentId || '', undefined, { numeric: true });
        case 'newest':
          return new Date(b.scanDate || 0).getTime() - new Date(a.scanDate || 0).getTime();
        case 'review_first':
          const aIsReview = a.status === 'NEEDS_REVIEW' ? 1 : 0;
          const bIsReview = b.status === 'NEEDS_REVIEW' ? 1 : 0;
          return bIsReview - aIsReview || b.totalScore - a.totalScore;
        default:
          return b.totalScore - a.totalScore;
      }
    });
    return list;
  }, [filteredSubmissions, sortBy]);

  // Compute Statistics for active selection
  const stats = useMemo(() => {
    return getExamStatistics(selectedExamFilterId);
  }, [selectedExamFilterId, submissions, exams, getExamStatistics]);

  // Pagination slice
  const totalPages = pageSize === 0 ? 1 : Math.ceil(sortedSubmissions.length / pageSize);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages || 1);
  const paginatedSubmissions = useMemo(() => {
    if (pageSize === 0) return sortedSubmissions;
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return sortedSubmissions.slice(startIndex, startIndex + pageSize);
  }, [sortedSubmissions, safeCurrentPage, pageSize]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllOnPage = () => {
    const pageIds = paginatedSubmissions.map(s => s.id);
    const allPageSelected = pageIds.every(id => selectedIds.includes(id));
    if (allPageSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleSelectAllGlobally = () => {
    if (selectedIds.length === sortedSubmissions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedSubmissions.map(s => s.id));
    }
  };

  // Single and Batch Actions
  const handleSingleDelete = (id: string) => {
    deleteSubmission(id);
    setSelectedIds(prev => prev.filter(item => item !== id));
    setConfirmDeleteId(null);
    showToast('Đã xóa bài chấm thành công', 'info');
  };

  const handleBatchDelete = () => {
    if (selectedIds.length > 0) {
      deleteSubmissionsBatch(selectedIds);
      showToast(`Đã xóa ${selectedIds.length} bài chấm thành công`, 'info');
      setSelectedIds([]);
      setShowBatchDeleteModal(false);
    }
  };

  const handleBatchApprove = () => {
    if (selectedIds.length > 0) {
      approveSubmissionsBatch(selectedIds);
      showToast(`Đã duyệt chuẩn ${selectedIds.length} bài chấm`, 'success');
      setSelectedIds([]);
    }
  };

  const handleOpenReassignModal = (subId?: string) => {
    if (subId) {
      setReassignSingleSubId(subId);
    } else {
      setReassignSingleSubId(null);
    }
    setTargetReassignExamId(exams[0]?.id || '');
    setShowReassignModal(true);
  };

  const handleExecuteReassign = () => {
    if (!targetReassignExamId) return;
    if (reassignSingleSubId) {
      reassignSubmissionExam(reassignSingleSubId, targetReassignExamId);
      showToast('Đã chuyển bài thi sang đề thi mới', 'success');
    } else if (selectedIds.length > 0) {
      reassignSubmissionsExamBatch(selectedIds, targetReassignExamId);
      showToast(`Đã chuyển ${selectedIds.length} bài thi sang đề thi mới`, 'success');
      setSelectedIds([]);
    }
    setShowReassignModal(false);
  };

  // Force storage sync
  const handleForceSave = () => {
    const result = forceSyncSubmissionsToStorage();
    if (result.success) {
      showToast(`Đã lưu an toàn toàn bộ ${result.count} bài thi vào cơ sở dữ liệu trình duyệt!`, 'success');
    } else {
      showToast('Có cảnh báo khi lưu trữ, nhưng dữ liệu bộ nhớ vẫn nguyên vẹn.', 'info');
    }
  };

  // Load demo submissions
  const handleGenerateDemo = () => {
    const targetExamId = selectedExamFilterId !== 'all' ? selectedExamFilterId : (currentExam?.id || exams[0]?.id);
    const result = generateDemoSubmissions(targetExamId, 16);
    showToast(`Đã nạp thành công ${result.count} bài thi mẫu với đầy đủ điểm số & nhận dạng OMR!`, 'success');
  };

  // Auto-recover orphaned submissions
  const handleRecoverOrphans = () => {
    if (exams.length === 0) return;
    const validExamIds = new Set(exams.map(e => e.id));
    const orphanSubs = submissions.filter(s => !validExamIds.has(s.examId));
    if (orphanSubs.length > 0) {
      const fallbackExamId = exams[0].id;
      reassignSubmissionsExamBatch(orphanSubs.map(s => s.id), fallbackExamId);
      showToast(`Đã khôi phục và gắn lại đề thi cho ${orphanSubs.length} bài chấm mồ côi!`, 'success');
    } else {
      showToast('Tất cả bài thi đều đã được liên kết chính xác với đề thi!', 'info');
    }
  };

  // Export handlers
  const handleExportExcel = () => {
    if (!currentExam) return;
    exportResultsToExcel(currentExam, sortedSubmissions);
  };

  const handleExportCSV = () => {
    if (!currentExam) return;
    exportResultsToCSV(currentExam, sortedSubmissions);
  };

  const handleExportPDF = () => {
    if (!currentExam) return;
    generateExamSummaryPDF(currentExam, sortedSubmissions, stats);
  };

  const targetSubToDelete = submissions.find(s => s.id === confirmDeleteId);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {storageToast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 backdrop-blur-xl transition-all animate-bounce ${
          storageToast.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
            : 'bg-cyan-950/90 border-cyan-500/40 text-cyan-200'
        }`}>
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold">{storageToast.message}</span>
        </div>
      )}

      {/* Persistence & Storage Status Header Banner */}
      <div className="bg-gradient-to-r from-[#0C1222] via-[#0E162B] to-[#0A101D] p-4 sm:p-5 rounded-3xl border border-white/10 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white">Trạng thái Lưu trữ & Quản lý Kết quả</h2>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Đã lưu an toàn {submissions.length} bài
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Hệ thống sử dụng cơ chế lưu kép IndexedDB & LocalStorage để bảo toàn toàn bộ kết quả chấm, điểm số và vết nhận dạng OMR.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleForceSave}
            title="Đồng bộ và ghi toàn bộ dữ liệu bài thi vào bộ nhớ vĩnh viễn"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-cyan-300 font-bold text-xs rounded-xl border border-cyan-500/30 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Lưu bộ nhớ ngay</span>
          </button>

          <button
            onClick={handleGenerateDemo}
            title="Tạo bài thi mẫu với đa dạng điểm số để trải nghiệm và kiểm tra báo cáo"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nạp 16 bài thi mẫu</span>
          </button>

          <button
            onClick={handleRecoverOrphans}
            title="Gắn lại đề thi cho các bài thi mồ côi nếu có"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-xl border border-white/10 transition cursor-pointer"
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>Kiểm tra bài</span>
          </button>
        </div>
      </div>

      {/* Main Header & Export Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t.analytics.title}</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedExamFilterId === 'all' ? (
                  <span>Đang xem: <strong className="text-cyan-300">Toàn bộ đề thi trong hệ thống ({exams.length} đề thi)</strong></span>
                ) : (
                  <span>Đề thi: <strong className="text-white">{currentExam?.title}</strong> ({currentExam?.code}) • Lớp {currentExam?.className}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons & Exam Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Exam Scope Dropdown */}
          <div className="flex items-center bg-[#0E131F]/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-lg">
            <select
              value={selectedExamFilterId}
              onChange={(e) => {
                setSelectedExamFilterId(e.target.value);
                if (e.target.value !== 'all') {
                  setActiveExamId(e.target.value);
                }
              }}
              className="text-xs font-bold text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-2 focus:outline-hidden cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-cyan-300 font-bold">
                ★ Tất cả đề thi ({submissions.length} bài chấm)
              </option>
              {exams.map(e => {
                const examSubCount = submissions.filter(s => s.examId === e.id).length;
                return (
                  <option key={e.id} value={e.id} className="bg-slate-900 text-white">
                    {e.title} ({e.code}) — {examSubCount} bài
                  </option>
                );
              })}
            </select>
          </div>

          <button
            id="btn-export-excel"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>

          <button
            id="btn-export-pdf"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Báo cáo PDF</span>
          </button>

          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-xs rounded-2xl border border-white/10 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0E131F]/80 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.analytics.avgScore}</span>
          <p className="text-2xl font-extrabold text-white">
            {(stats.averageScore ?? 0).toFixed(2)} <span className="text-sm font-normal text-slate-500">/ {currentExam?.maxScore ?? 10}</span>
          </p>
          <p className="text-xs text-slate-400">Trung vị: {(stats.medianScore ?? 0).toFixed(2)} • ĐLC: {stats.standardDeviation ?? 0}</p>
        </div>

        <div className="bg-[#0E131F]/80 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tỷ lệ Đạt (≥ {currentExam?.passingScore ?? 5.0}đ)</span>
          <p className="text-2xl font-extrabold text-emerald-400">{stats.passRate ?? 0}%</p>
          <p className="text-xs text-slate-400">{stats.passCount ?? 0} / {stats.totalSubmissions ?? 0} học sinh đạt chuẩn</p>
        </div>

        <div className="bg-[#0E131F]/80 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Điểm Cao nhất / Thấp nhất</span>
          <p className="text-2xl font-extrabold text-cyan-400">{stats.highestScore ?? 0} <span className="text-sm font-normal text-slate-500">/ {stats.lowestScore ?? 0}</span></p>
          <p className="text-xs text-slate-400">Phổ điểm trải rộng {currentExam?.maxScore ?? 10} bậc</p>
        </div>

        <div className="bg-[#0E131F]/80 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Đã chấm chuẩn / Cần duyệt</span>
          <p className="text-2xl font-extrabold text-purple-400">
            {stats.gradedCount} <span className="text-sm font-normal text-amber-400">({stats.needsReviewCount} cần duyệt)</span>
          </p>
          <p className="text-xs text-slate-400">Tổng cộng {stats.totalSubmissions} bài làm trong bộ lọc</p>
        </div>
      </div>

      {/* Score Distribution Chart */}
      {stats.totalSubmissions > 0 && (
        <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>{t.analytics.scoreChartTitle}</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Tổng {stats.totalSubmissions} bài làm
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  formatter={(val: any) => [`${val} học sinh`, 'Số lượng']}
                  contentStyle={{ fontSize: 12, borderRadius: 12, backgroundColor: '#0B0F17', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                />
                <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Main Submissions Display Card */}
      <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl overflow-hidden space-y-5 p-5 sm:p-6">
        {/* Top Control Bar: View Modes & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
          {/* Left: View Mode Toggles */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/40 p-1 rounded-2xl border border-white/10">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <List className="w-4 h-4" />
                <span>Bảng chi tiết ({sortedSubmissions.length})</span>
              </button>

              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Lưới thẻ bài thi</span>
              </button>

              <button
                onClick={() => setViewMode('rankings')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'rankings'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>Bảng xếp hạng</span>
              </button>
            </div>
          </div>

          {/* Right: Search Box */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Tìm theo tên học sinh, SBD, lớp, mã đề..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white/5 border border-white/10 text-white rounded-xl placeholder-slate-500 focus:outline-hidden focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Multi-Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Filter: Class */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Lớp học:</label>
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs border border-white/10 rounded-xl p-2 bg-white/5 text-slate-200 focus:outline-hidden"
            >
              <option value="all" className="bg-slate-900 text-white">Tất cả các lớp</option>
              {availableClasses.map(c => (
                <option key={c} value={c} className="bg-slate-900 text-white">Lớp {c}</option>
              ))}
            </select>
          </div>

          {/* Filter: Status */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Trạng thái chấm:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs border border-white/10 rounded-xl p-2 bg-white/5 text-slate-200 focus:outline-hidden"
            >
              <option value="all" className="bg-slate-900 text-white">Tất cả trạng thái</option>
              <option value="graded" className="bg-slate-900 text-white">Đã chấm chuẩn</option>
              <option value="review" className="bg-slate-900 text-white">Cần xem lại (Review)</option>
              <option value="issues" className="bg-slate-900 text-white">Tô nhiều ô / Nghi vấn</option>
              <option value="pass" className="bg-slate-900 text-white">Đạt (≥ {currentExam?.passingScore ?? 5.0})</option>
              <option value="fail" className="bg-slate-900 text-white">Chưa đạt (&lt; {currentExam?.passingScore ?? 5.0})</option>
            </select>
          </div>

          {/* Filter: Grade Band */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Phân loại điểm:</label>
            <select
              value={gradeBandFilter}
              onChange={(e) => {
                setGradeBandFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs border border-white/10 rounded-xl p-2 bg-white/5 text-slate-200 focus:outline-hidden"
            >
              <option value="all" className="bg-slate-900 text-white">Tất cả phân loại</option>
              <option value="excellent" className="bg-slate-900 text-emerald-400 font-bold">Xuất sắc (≥ 9.0)</option>
              <option value="good" className="bg-slate-900 text-cyan-400 font-bold">Giỏi (8.0 - 8.9)</option>
              <option value="fair" className="bg-slate-900 text-blue-400 font-bold">Khá (6.5 - 7.9)</option>
              <option value="average" className="bg-slate-900 text-amber-400 font-bold">Trung bình (5.0 - 6.4)</option>
              <option value="poor" className="bg-slate-900 text-rose-400 font-bold">Chưa đạt (&lt; 5.0)</option>
            </select>
          </div>

          {/* Filter: OMR Confidence */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Độ tin cậy OMR:</label>
            <select
              value={confidenceFilter}
              onChange={(e) => {
                setConfidenceFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs border border-white/10 rounded-xl p-2 bg-white/5 text-slate-200 focus:outline-hidden"
            >
              <option value="all" className="bg-slate-900 text-white">Tất cả độ tin cậy</option>
              <option value="high" className="bg-slate-900 text-white">Rất cao (≥ 95%)</option>
              <option value="medium" className="bg-slate-900 text-white">Bình thường (80% - 94%)</option>
              <option value="low" className="bg-slate-900 text-white">Nghi vấn (&lt; 80%)</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Sắp xếp theo:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full text-xs border border-white/10 rounded-xl p-2 bg-white/5 text-cyan-300 font-bold focus:outline-hidden"
            >
              <option value="score_desc" className="bg-slate-900 text-white">Điểm: Cao → Thấp</option>
              <option value="score_asc" className="bg-slate-900 text-white">Điểm: Thấp → Cao</option>
              <option value="correct_desc" className="bg-slate-900 text-white">Số câu đúng: Nhiều → Ít</option>
              <option value="name_asc" className="bg-slate-900 text-white">Tên học sinh (A → Z)</option>
              <option value="id_asc" className="bg-slate-900 text-white">Số báo danh (SBD)</option>
              <option value="newest" className="bg-slate-900 text-white">Thời gian chấm mới nhất</option>
              <option value="review_first" className="bg-slate-900 text-white">Cần duyệt đưa lên đầu</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar (When Items Selected) */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between bg-gradient-to-r from-cyan-950/40 via-blue-950/40 to-indigo-950/40 p-3.5 rounded-2xl border border-cyan-500/30 shadow-xl gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-cyan-300 font-bold px-3 py-1 bg-cyan-500/10 rounded-xl border border-cyan-500/30 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4" /> Đã chọn {selectedIds.length} / {sortedSubmissions.length} bài
              </span>

              <button
                onClick={handleSelectAllGlobally}
                className="text-xs text-slate-300 hover:text-white underline cursor-pointer"
              >
                {selectedIds.length === sortedSubmissions.length ? 'Bỏ chọn tất cả' : 'Chọn toàn bộ danh sách'}
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleBatchApprove}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Duyệt {selectedIds.length} bài</span>
              </button>

              <button
                onClick={() => handleOpenReassignModal()}
                className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Gán lại đề thi</span>
              </button>

              <button
                onClick={() => setShowBatchDeleteModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa {selectedIds.length} bài</span>
              </button>

              <button
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
              >
                Hủy chọn
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {sortedSubmissions.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white/[0.02] rounded-3xl border border-white/5 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Không tìm thấy bài thi nào phù hợp</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                {submissions.length === 0
                  ? 'Chưa có bài thi nào được quét hoặc lưu trên hệ thống. Hãy nạp bài mẫu hoặc thực hiện quét bài.'
                  : 'Hãy thử thay đổi bộ lọc tìm kiếm, lớp học hoặc đề thi để hiển thị bài làm.'}
              </p>
            </div>
            {submissions.length === 0 && (
              <button
                onClick={handleGenerateDemo}
                className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Nạp ngay 16 bài thi mẫu để xem báo cáo</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* VIEW MODE 1: TABLE VIEW */}
            {viewMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-slate-400 font-bold border-b border-white/10">
                      <th className="py-3 px-3 w-10">
                        <input
                          type="checkbox"
                          checked={paginatedSubmissions.length > 0 && paginatedSubmissions.every(s => selectedIds.includes(s.id))}
                          onChange={handleSelectAllOnPage}
                          className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3">STT</th>
                      <th className="py-3 px-3">Mã HS / SBD</th>
                      <th className="py-3 px-3">Họ và Tên</th>
                      <th className="py-3 px-3">Lớp</th>
                      <th className="py-3 px-3 text-center">Đề thi & Mã đề</th>
                      <th className="py-3 px-3 text-center">Số câu đúng</th>
                      <th className="py-3 px-3 text-center">Sai</th>
                      <th className="py-3 px-3 text-center">Trống</th>
                      <th className="py-3 px-3 text-center">Điểm số</th>
                      <th className="py-3 px-3 text-center">Độ tin cậy</th>
                      <th className="py-3 px-3">Trạng thái</th>
                      <th className="py-3 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {paginatedSubmissions.map((sub, idx) => {
                      const globalIdx = (safeCurrentPage - 1) * pageSize + idx;
                      const isSelected = selectedIds.includes(sub.id);
                      const examObj = exams.find(e => e.id === sub.examId);
                      const isPass = sub.totalScore >= (examObj?.passingScore ?? 5.0);
                      const isNeedsReview = sub.status === 'NEEDS_REVIEW' || sub.status === 'MULTIPLE_ANSWERS';

                      return (
                        <tr
                          key={sub.id}
                          className={`transition cursor-pointer ${isSelected ? 'bg-cyan-500/10' : 'hover:bg-white/5'}`}
                          onClick={() => setSelectedSubIndex(globalIdx)}
                        >
                          <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(sub.id)}
                              className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-mono">{globalIdx + 1}</td>
                          <td className="py-3 px-3 font-mono font-bold text-cyan-300">{sub.studentId}</td>
                          <td className="py-3 px-3 font-semibold text-white">
                            <div className="flex items-center gap-1.5">
                              <span>{sub.studentName}</span>
                              {sub.isStudentIdManuallyCorrected && (
                                <span className="text-[10px] text-amber-400 font-normal" title="Đã sửa tay">(sửa)</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-300 font-medium">{sub.className || '—'}</td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                {sub.appliedVariantCode || sub.detectedExamCode || examObj?.code || '101'}
                              </span>
                              {selectedExamFilterId === 'all' && examObj && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[100px]" title={examObj.title}>
                                  {examObj.title}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-emerald-400">
                            {sub.totalCorrect} / {examObj?.numQuestions || sub.recognizedAnswers?.length || 40}
                          </td>
                          <td className="py-3 px-3 text-center text-rose-400 font-medium">{sub.totalWrong}</td>
                          <td className="py-3 px-3 text-center text-slate-500">{sub.totalBlank || 0}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-extrabold text-base text-cyan-300">
                              {sub.totalScore}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`text-[11px] font-mono font-bold ${
                              (sub.overallConfidence || 0) >= 90 ? 'text-emerald-400' : (sub.overallConfidence || 0) >= 75 ? 'text-amber-400' : 'text-rose-400'
                            }`}>
                              {sub.overallConfidence || 95}%
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              isNeedsReview
                                ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                                : isPass
                                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                            }`}>
                              {isNeedsReview ? '⚠ Cần duyệt' : isPass ? 'Đạt' : 'Chưa đạt'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setSelectedSubIndex(globalIdx)}
                                className="px-2.5 py-1 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition cursor-pointer"
                                title="Xem chi tiết phiếu bài làm"
                              >
                                Xem bài
                              </button>
                              <button
                                onClick={() => handleOpenReassignModal(sub.id)}
                                className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-white/5 rounded-lg transition cursor-pointer"
                                title="Chuyển sang đề thi khác"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Xóa bài chấm này"
                                onClick={() => setConfirmDeleteId(sub.id)}
                                className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* VIEW MODE 2: VISUAL CARD GALLERY VIEW */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedSubmissions.map((sub, idx) => {
                  const globalIdx = (safeCurrentPage - 1) * pageSize + idx;
                  const isSelected = selectedIds.includes(sub.id);
                  const examObj = exams.find(e => e.id === sub.examId);
                  const totalQ = examObj?.numQuestions || sub.recognizedAnswers?.length || 40;
                  const scoreRatio = (sub.totalScore / (sub.maxScore || 10)) * 10;

                  let badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                  let badgeText = 'Trung bình';
                  if (scoreRatio >= 9.0) {
                    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                    badgeText = 'Xuất sắc';
                  } else if (scoreRatio >= 8.0) {
                    badgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
                    badgeText = 'Giỏi';
                  } else if (scoreRatio >= 6.5) {
                    badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
                    badgeText = 'Khá';
                  } else if (scoreRatio < 5.0) {
                    badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
                    badgeText = 'Chưa đạt';
                  }

                  return (
                    <div
                      key={sub.id}
                      onClick={() => setSelectedSubIndex(globalIdx)}
                      className={`p-4 rounded-3xl border transition flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/50 shadow-xl shadow-cyan-500/10'
                          : 'bg-white/[0.03] border-white/10 hover:border-cyan-500/30 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleSelect(sub.id);
                              }}
                              className="w-4 h-4 accent-cyan-500 rounded cursor-pointer mt-0.5"
                            />
                            <div>
                              <h4 className="font-bold text-white text-sm line-clamp-1">{sub.studentName}</h4>
                              <p className="text-[11px] text-slate-400 font-mono">
                                SBD: <span className="text-cyan-300 font-bold">{sub.studentId}</span> • Lớp {sub.className || '—'}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                            {badgeText}
                          </span>
                        </div>

                        {/* Score Display Area */}
                        <div className="bg-black/40 rounded-2xl p-3 border border-white/5 flex items-center justify-between mb-3">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Điểm số</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-extrabold text-cyan-300">{sub.totalScore}</span>
                              <span className="text-xs text-slate-500">/ {sub.maxScore || 10}đ</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mã đề thi</span>
                            <span className="text-xs font-mono font-bold text-slate-200 px-2 py-0.5 bg-white/10 rounded-md">
                              {sub.appliedVariantCode || sub.detectedExamCode || '101'}
                            </span>
                          </div>
                        </div>

                        {/* Accuracy Distribution Bar */}
                        <div className="space-y-1.5 mb-3">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-emerald-400 font-semibold">✓ Đúng {sub.totalCorrect} / {totalQ}</span>
                            <span className="text-rose-400">✗ Sai {sub.totalWrong}</span>
                          </div>

                          {/* Mini Progress Bar */}
                          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${(sub.totalCorrect / totalQ) * 100}%` }}
                              className="bg-emerald-500 h-full"
                              title={`Đúng ${sub.totalCorrect}`}
                            />
                            <div
                              style={{ width: `${(sub.totalWrong / totalQ) * 100}%` }}
                              className="bg-rose-500 h-full"
                              title={`Sai ${sub.totalWrong}`}
                            />
                            <div
                              style={{ width: `${((sub.totalBlank || 0) / totalQ) * 100}%` }}
                              className="bg-slate-600 h-full"
                              title={`Trống ${sub.totalBlank || 0}`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          Độ tin cậy: <strong className="text-emerald-400 font-mono">{sub.overallConfidence || 95}%</strong>
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedSubIndex(globalIdx)}
                            className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded-lg font-semibold transition cursor-pointer"
                          >
                            Xem bài
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(sub.id)}
                            className="p-1 text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                            title="Xóa bài"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW MODE 3: RANKINGS & PERFORMANCE BANDS */}
            {viewMode === 'rankings' && (
              <div className="space-y-6">
                {/* Top 10 Leaderboard */}
                <div className="bg-[#0B0F17] rounded-3xl p-5 border border-white/10 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>Bảng Vinh danh Học sinh Xuất sắc (Top 10)</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sortedSubmissions.slice(0, 9).map((sub, rankIdx) => {
                      const medalColor = rankIdx === 0
                        ? 'from-amber-500/30 via-yellow-500/20 to-transparent border-amber-500/50 text-amber-300'
                        : rankIdx === 1
                        ? 'from-slate-400/30 via-slate-300/20 to-transparent border-slate-400/50 text-slate-200'
                        : rankIdx === 2
                        ? 'from-amber-700/30 via-orange-600/20 to-transparent border-orange-600/50 text-orange-300'
                        : 'from-cyan-950/20 to-transparent border-white/10 text-cyan-300';

                      return (
                        <div
                          key={sub.id}
                          onClick={() => setSelectedSubIndex(rankIdx)}
                          className={`p-3.5 rounded-2xl border bg-gradient-to-r ${medalColor} flex items-center justify-between transition cursor-pointer hover:scale-[1.02]`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center font-bold text-xs font-mono">
                              #{rankIdx + 1}
                            </span>
                            <div>
                              <h5 className="font-bold text-white text-xs line-clamp-1">{sub.studentName}</h5>
                              <p className="text-[10px] text-slate-400">SBD: {sub.studentId} • Lớp: {sub.className}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-extrabold text-white block">{sub.totalScore}đ</span>
                            <span className="text-[10px] text-emerald-400 font-semibold">{sub.totalCorrect} câu đúng</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Grade Distribution Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { label: 'Xuất sắc (9.0 - 10.0)', min: 9.0, max: 10.1, color: 'text-emerald-400 bg-emerald-950/20 border-emerald-500/30' },
                    { label: 'Giỏi (8.0 - 8.9)', min: 8.0, max: 8.99, color: 'text-cyan-400 bg-cyan-950/20 border-cyan-500/30' },
                    { label: 'Khá (6.5 - 7.9)', min: 6.5, max: 7.99, color: 'text-blue-400 bg-blue-950/20 border-blue-500/30' },
                    { label: 'Trung bình (5.0 - 6.4)', min: 5.0, max: 6.49, color: 'text-amber-400 bg-amber-950/20 border-amber-500/30' },
                    { label: 'Chưa đạt (< 5.0)', min: 0.0, max: 4.99, color: 'text-rose-400 bg-rose-950/20 border-rose-500/30' }
                  ].map((band) => {
                    const count = sortedSubmissions.filter(s => {
                      const scoreRatio = (s.totalScore / (s.maxScore || 10)) * 10;
                      return scoreRatio >= band.min && scoreRatio <= band.max;
                    }).length;
                    const percent = sortedSubmissions.length > 0 ? ((count / sortedSubmissions.length) * 100).toFixed(1) : '0';

                    return (
                      <div key={band.label} className={`p-4 rounded-2xl border ${band.color} space-y-1 text-center`}>
                        <span className="text-[11px] font-semibold block text-slate-300">{band.label}</span>
                        <p className="text-2xl font-extrabold">{count} <span className="text-xs font-normal text-slate-400">học sinh</span></p>
                        <p className="text-xs font-mono font-bold text-slate-400">{percent}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pagination Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/10 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span>Hiển thị:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-white text-xs focus:outline-hidden"
                >
                  <option value={10} className="bg-slate-900">10 bài / trang</option>
                  <option value={25} className="bg-slate-900">25 bài / trang</option>
                  <option value={50} className="bg-slate-900">50 bài / trang</option>
                  <option value={100} className="bg-slate-900">100 bài / trang</option>
                  <option value={0} className="bg-slate-900">Tất cả bài</option>
                </select>
                <span className="hidden sm:inline">
                  • Đang xem bài {(safeCurrentPage - 1) * pageSize + 1} - {Math.min(safeCurrentPage * pageSize || sortedSubmissions.length, sortedSubmissions.length)} trong tổng số {sortedSubmissions.length} bài
                </span>
              </div>

              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-1.5 self-center sm:self-auto">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage === 1}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer text-slate-300"
                    title="Trang đầu"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={safeCurrentPage === 1}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer text-slate-300"
                    title="Trang trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 bg-white/5 rounded-lg font-mono text-cyan-300 font-bold">
                    Trang {safeCurrentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer text-slate-300"
                    title="Trang sau"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage === totalPages}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer text-slate-300"
                    title="Trang cuối"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Single Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Xác nhận xóa bài chấm"
        message={`Bạn có chắc chắn muốn xóa bài chấm của học sinh "${targetSubToDelete?.studentName}" (SBD: ${targetSubToDelete?.studentId})?`}
        confirmText="Xóa bài chấm"
        onConfirm={() => confirmDeleteId && handleSingleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Batch Delete Confirm Modal */}
      <ConfirmModal
        isOpen={showBatchDeleteModal}
        title="Xác nhận xóa đồng loạt bài chấm"
        message={`Hệ thống sẽ xóa vĩnh viễn ${selectedIds.length} bài chấm đã chọn. Bạn có chắc chắn muốn tiếp tục?`}
        confirmText="Xác nhận xóa tất cả"
        itemCount={selectedIds.length}
        onConfirm={handleBatchDelete}
        onCancel={() => setShowBatchDeleteModal(false)}
      />

      {/* Reassign Exam Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#0E131F] rounded-3xl max-w-md w-full border border-white/10 p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                <span>Gán lại Đề thi</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {reassignSingleSubId
                  ? 'Chọn đề thi mới để chuyển bài làm của học sinh này sang.'
                  : `Chuyển đồng loạt ${selectedIds.length} bài làm đã chọn sang đề thi mới.`}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Đề thi đích:</label>
              <select
                value={targetReassignExamId}
                onChange={(e) => setTargetReassignExamId(e.target.value)}
                className="w-full text-xs font-bold border border-white/10 rounded-xl p-3 bg-white/5 text-cyan-300 focus:outline-hidden"
              >
                {exams.map(e => (
                  <option key={e.id} value={e.id} className="bg-slate-900 text-white">
                    {e.title} ({e.code}) — Lớp {e.className}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReassignModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleExecuteReassign}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                Xác nhận chuyển đề
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Inspection Modal */}
      {selectedSubIndex !== null && sortedSubmissions[selectedSubIndex] && (
        <StudentReportModal
          exam={exams.find(e => e.id === sortedSubmissions[selectedSubIndex].examId) || currentExam || exams[0]}
          submission={sortedSubmissions[selectedSubIndex]}
          allSubmissions={sortedSubmissions}
          currentIndex={selectedSubIndex}
          onNavigate={(newIdx) => setSelectedSubIndex(newIdx)}
          onClose={() => setSelectedSubIndex(null)}
        />
      )}
    </div>
  );
};
