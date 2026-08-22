import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ExamSubmission } from '../../types';
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
  Square
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const ResultsDashboard: React.FC = () => {
  const { t, activeExam, exams, setActiveExamId, submissions, deleteSubmission, deleteSubmissionsBatch, getExamStatistics } = useApp();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedStudentSub, setSelectedStudentSub] = useState<ExamSubmission | null>(null);

  // Selection & Bulk delete state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState<boolean>(false);

  const currentExam = activeExam || exams[0];
  const examSubmissions = currentExam ? submissions.filter(s => s.examId === currentExam.id) : [];
  const stats = currentExam ? getExamStatistics(currentExam.id) : {
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

  // If no exams exist in the system
  if (!currentExam) {
    return (
      <div className="p-12 max-w-xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/10">
          <BarChart3 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Chưa có đề thi nào trong hệ thống</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Vui lòng tạo một đề thi mới hoặc thực hiện chấm bài để theo dõi bảng điểm, phân tích phổ điểm và xuất báo cáo kết quả.
        </p>
      </div>
    );
  }

  // Filtering
  const filteredSubmissions = examSubmissions.filter(sub => {
    const matchesSearch = (sub.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) || (sub.studentId || '').toLowerCase().includes(searchTerm.toLowerCase());
    const passingScore = currentExam.passingScore ?? 5.0;
    const matchesStatus = statusFilter === 'all' 
      ? true 
      : statusFilter === 'graded' 
      ? sub.status === 'GRADED' 
      : statusFilter === 'review'
      ? sub.status === 'NEEDS_REVIEW' || sub.status === 'MULTIPLE_ANSWERS'
      : statusFilter === 'pass'
      ? sub.totalScore >= passingScore
      : sub.totalScore < passingScore;
    return matchesSearch && matchesStatus;
  });

  // Sorting
  filteredSubmissions.sort((a, b) => {
    return sortOrder === 'desc' ? b.totalScore - a.totalScore : a.totalScore - b.totalScore;
  });

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredSubmissions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSubmissions.map(s => s.id));
    }
  };

  const handleSingleDelete = (id: string) => {
    deleteSubmission(id);
    setSelectedIds(prev => prev.filter(item => item !== id));
    setConfirmDeleteId(null);
  };

  const handleBatchDelete = () => {
    if (selectedIds.length > 0) {
      deleteSubmissionsBatch(selectedIds);
      setSelectedIds([]);
      setShowBatchDeleteModal(false);
    }
  };

  const targetSubToDelete = submissions.find(s => s.id === confirmDeleteId);

  const handleExportExcel = () => {
    exportResultsToExcel(currentExam, examSubmissions);
  };

  const handleExportCSV = () => {
    exportResultsToCSV(currentExam, examSubmissions);
  };

  const handleExportPDF = () => {
    generateExamSummaryPDF(currentExam, examSubmissions, stats);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10">
                <BarChart3 className="w-6 h-6" />
              </div>
              <span>{t.analytics.title}</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Đề thi: <strong className="text-white">{currentExam.title}</strong> ({currentExam.code}) • Lớp {currentExam.className}
          </p>
        </div>

        {/* Right side: Exam selector + Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {exams.length > 1 && (
            <div className="flex items-center gap-2 bg-[#0E131F]/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-lg">
              <select
                value={currentExam.id}
                onChange={(e) => setActiveExamId(e.target.value)}
                className="text-xs font-bold text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-2 focus:outline-hidden"
              >
                {exams.map(e => (
                  <option key={e.id} value={e.id} className="bg-slate-900 text-white">
                    {e.title} ({e.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            id="btn-export-excel"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t.actions.exportExcel}</span>
          </button>

          <button
            id="btn-export-pdf"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>{t.actions.exportPdf}</span>
          </button>

          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-xs rounded-2xl border border-white/10 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0E131F]/80 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase">{t.analytics.avgScore}</span>
          <p className="text-2xl font-bold text-white">{(stats.averageScore ?? 0).toFixed(2)} <span className="text-sm font-normal text-slate-500">/ {currentExam.maxScore ?? 10}</span></p>
          <p className="text-xs text-slate-400">Trung vị: {(stats.medianScore ?? 0).toFixed(2)} • ĐLC: {stats.standardDeviation ?? 0}</p>
        </div>

        <div className="bg-[#0E131F]/80 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase">{t.analytics.passRate.replace('{passing}', (currentExam.passingScore ?? 5.0).toString())}</span>
          <p className="text-2xl font-bold text-emerald-400">{stats.passRate ?? 0}%</p>
          <p className="text-xs text-slate-400">{stats.passCount ?? 0} / {stats.totalSubmissions ?? 0} học sinh đạt</p>
        </div>

        <div className="bg-[#0E131F]/80 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase">Cao nhất / Thấp nhất</span>
          <p className="text-2xl font-bold text-cyan-400">{stats.highestScore ?? 0} <span className="text-sm font-normal text-slate-500">/ {stats.lowestScore ?? 0}</span></p>
          <p className="text-xs text-slate-400">Phổ điểm trải rộng {currentExam.maxScore ?? 10} bậc</p>
        </div>

        <div className="bg-[#0E131F]/80 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase">Đã chấm OMR / Cần duyệt</span>
          <p className="text-2xl font-bold text-purple-400">{stats.gradedCount} <span className="text-sm font-normal text-amber-400">({stats.needsReviewCount} duyệt)</span></p>
          <p className="text-xs text-slate-400">Tổng cộng {stats.totalSubmissions} bài làm</p>
        </div>
      </div>

      {/* Score Distribution Chart */}
      <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-6 shadow-2xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span>{t.analytics.scoreChartTitle}</span>
        </h3>

        <div className="h-60 w-full">
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

      {/* Master Student Result Table */}
      <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl overflow-hidden space-y-4 p-6">
        {/* Table Filters & Bulk Actions */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder={t.actions.search}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white/5 border border-white/10 text-white rounded-xl placeholder-slate-500 focus:outline-hidden focus:border-cyan-500/50"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-white/10 rounded-xl p-2 bg-white/5 text-slate-200 focus:outline-hidden"
              >
                <option value="all" className="bg-slate-900 text-white">Tất cả trạng thái</option>
                <option value="graded" className="bg-slate-900 text-white">Đã chấm chuẩn</option>
                <option value="review" className="bg-slate-900 text-white">Cần xem lại (Review)</option>
                <option value="pass" className="bg-slate-900 text-white">Đạt (≥ {currentExam.passingScore})</option>
                <option value="fail" className="bg-slate-900 text-white">Chưa đạt (&lt; {currentExam.passingScore})</option>
              </select>

              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1.5 px-3 py-2 border border-white/10 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5 transition cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Sắp xếp điểm ({sortOrder === 'desc' ? 'Cao → Thấp' : 'Thấp → Cao'})</span>
              </button>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {filteredSubmissions.length > 0 && (
            <div className="flex items-center justify-between bg-[#080C14] p-3 rounded-2xl border border-white/10 shadow-lg">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-xl border border-white/10 transition cursor-pointer"
                >
                  {selectedIds.length === filteredSubmissions.length && filteredSubmissions.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>{selectedIds.length === filteredSubmissions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả bài chấm'}</span>
                </button>

                {selectedIds.length > 0 && (
                  <span className="text-xs text-cyan-300 font-semibold px-2.5 py-1 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    Đã chọn {selectedIds.length} / {filteredSubmissions.length} bài
                  </span>
                )}
              </div>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedIds([])}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Hủy chọn
                  </button>
                  <button
                    id="btn-batch-delete-submissions"
                    onClick={() => setShowBatchDeleteModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa {selectedIds.length} bài đã chọn</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 text-slate-400 font-bold border-b border-white/10">
                <th className="py-3 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredSubmissions.length && filteredSubmissions.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">STT</th>
                <th className="py-3 px-3">Mã HS / SBD</th>
                <th className="py-3 px-3">Họ và Tên</th>
                <th className="py-3 px-3">Lớp</th>
                <th className="py-3 px-3 text-center">Mã đề</th>
                <th className="py-3 px-3 text-center">Số câu đúng</th>
                <th className="py-3 px-3 text-center">Sai</th>
                <th className="py-3 px-3 text-center">Bỏ trống</th>
                <th className="py-3 px-3 text-center">Điểm số</th>
                <th className="py-3 px-3">Trạng thái</th>
                <th className="py-3 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSubmissions.map((sub, idx) => {
                const isSelected = selectedIds.includes(sub.id);
                const isPass = sub.totalScore >= currentExam.passingScore;
                const isNeedsReview = sub.status === 'NEEDS_REVIEW' || sub.status === 'MULTIPLE_ANSWERS';

                return (
                  <tr
                    key={sub.id}
                    className={`transition cursor-pointer ${isSelected ? 'bg-rose-500/10' : 'hover:bg-white/5'}`}
                    onClick={() => setSelectedStudentSub(sub)}
                  >
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(sub.id)}
                        className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3 text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-3 font-mono font-bold text-cyan-300">{sub.studentId}</td>
                    <td className="py-3 px-3 font-semibold text-white">{sub.studentName}</td>
                    <td className="py-3 px-3 text-slate-400">{sub.className}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {sub.appliedVariantCode || sub.detectedExamCode || currentExam.code}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-400">
                      {sub.totalCorrect} / {currentExam.numQuestions}
                    </td>
                    <td className="py-3 px-3 text-center text-rose-400 font-medium">{sub.totalWrong}</td>
                    <td className="py-3 px-3 text-center text-slate-500">{sub.totalBlank}</td>
                    <td className="py-3 px-3 text-center font-extrabold text-sm text-cyan-400">
                      {sub.totalScore}
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
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedStudentSub(sub)}
                          className="px-2.5 py-1 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition"
                        >
                          Xem bài
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
        message="Các bài chấm đã chọn sẽ bị xóa vĩnh viễn khỏi kết quả đề thi này. Bạn có chắc chắn muốn tiếp tục?"
        confirmText="Xác nhận xóa tất cả"
        itemCount={selectedIds.length}
        onConfirm={handleBatchDelete}
        onCancel={() => setShowBatchDeleteModal(false)}
      />

      {/* Student Detailed Report Modal */}
      {selectedStudentSub && (
        <StudentReportModal
          exam={currentExam}
          submission={selectedStudentSub}
          onClose={() => setSelectedStudentSub(null)}
        />
      )}
    </div>
  );
};
