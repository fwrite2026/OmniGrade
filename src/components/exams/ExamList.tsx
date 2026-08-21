import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Exam } from '../../types';
import { NavTab } from '../common/Sidebar';
import { TemplatePrintModal } from '../templates/TemplatePrintModal';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  FileCheck,
  Plus,
  ScanLine,
  BarChart3,
  Printer,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Search,
  Filter,
  CheckSquare,
  Square,
  Shield,
  Globe,
  Users,
  Share2,
  UserCheck
} from 'lucide-react';

interface ExamListProps {
  onNavigate: (tab: NavTab) => void;
}

export const ExamList: React.FC<ExamListProps> = ({ onNavigate }) => {
  const { 
    t, 
    exams, 
    activeExamId, 
    setActiveExamId, 
    submissions, 
    templates, 
    students, 
    deleteExam, 
    deleteExamsBatch, 
    currentUser 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedScopeFilter, setSelectedScopeFilter] = useState<'all' | 'admin_shared' | 'my_exams'>('all');
  const [printExamModal, setPrintExamModal] = useState<Exam | null>(null);

  // Selection & Bulk delete state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState<boolean>(false);

  const isAdmin = currentUser?.role === 'admin';

  // Role-based visibility and filter logic
  const visibleExams = exams.filter(exam => {
    // Admin sees all exams
    if (isAdmin) return true;

    // Teachers see:
    // 1. Exams shared by Admin or marked sharedWithAllTeachers
    // 2. School-wide / Grade-wide exams
    // 3. Exams created by themselves
    // 4. Default baseline exams
    const isCreatedBySelf = exam.createdById === currentUser?.id || exam.createdByUsername === currentUser?.username;
    const isShared = exam.isSharedWithAllTeachers !== false; // default true for sample exams or admin exams
    const isAdminCreated = exam.createdByRole === 'admin';
    const isSchoolWide = exam.targetScope === 'school_wide' || !exam.targetScope;

    return isCreatedBySelf || isShared || isAdminCreated || isSchoolWide;
  });

  const filteredExams = visibleExams.filter(exam => {
    const matchesSearch = 
      exam.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      exam.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exam.teacherName && exam.teacherName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesSubject = selectedSubject === 'all' || exam.subject === selectedSubject;

    const isAdminExam = exam.createdByRole === 'admin' || exam.isSharedWithAllTeachers;
    const isMyExam = exam.createdById === currentUser?.id || exam.createdByUsername === currentUser?.username;

    let matchesScope = true;
    if (selectedScopeFilter === 'admin_shared') {
      matchesScope = !!isAdminExam;
    } else if (selectedScopeFilter === 'my_exams') {
      matchesScope = isMyExam;
    }

    return matchesSearch && matchesSubject && matchesScope;
  });

  const subjects = Array.from(new Set(visibleExams.map(e => e.subject)));

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredExams.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredExams.map(e => e.id));
    }
  };

  const handleSingleDelete = (id: string) => {
    deleteExam(id);
    setSelectedIds(prev => prev.filter(item => item !== id));
    setConfirmDeleteId(null);
  };

  const handleBatchDelete = () => {
    if (selectedIds.length > 0) {
      deleteExamsBatch(selectedIds);
      setSelectedIds([]);
      setShowBatchDeleteModal(false);
    }
  };

  const targetExamToDelete = exams.find(e => e.id === confirmDeleteId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10">
              <FileCheck className="w-6 h-6" />
            </div>
            <span>{t.exam.editTitle.replace('Chỉnh sửa', 'Quản lý')}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isAdmin 
              ? 'Quản trị viên: Toàn quyền tạo và chia sẻ đề thi toàn trường đến tất cả giáo viên thành viên.'
              : `Giáo viên (${currentUser?.fullName}): Xem đề thi được phân công, đề thi chung từ Admin và đề thi của riêng bạn.`}
          </p>
        </div>

        <button
          id="btn-create-exam-top"
          onClick={() => onNavigate('createExam')}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isAdmin ? 'Tạo đề thi chia sẻ toàn trường' : t.dashboard.createNewExam}</span>
        </button>
      </div>

      {/* Scope quick filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedScopeFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            selectedScopeFilter === 'all'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
          }`}
        >
          Tất cả đề thi ({visibleExams.length})
        </button>

        <button
          onClick={() => setSelectedScopeFilter('admin_shared')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            selectedScopeFilter === 'admin_shared'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400'
              : 'bg-white/5 hover:bg-white/10 text-purple-300 border border-purple-500/20'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-purple-400" />
          <span>Đề thi chung toàn trường / Admin ({visibleExams.filter(e => e.createdByRole === 'admin' || e.isSharedWithAllTeachers).length})</span>
        </button>

        {!isAdmin && (
          <button
            onClick={() => setSelectedScopeFilter('my_exams')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              selectedScopeFilter === 'my_exams'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Đề thi của tôi ({visibleExams.filter(e => e.createdById === currentUser?.id || e.createdByUsername === currentUser?.username).length})</span>
          </button>
        )}
      </div>

      {/* Filters Bar & Bulk Actions */}
      <div className="space-y-3">
        <div className="bg-[#0E131F]/80 backdrop-blur-xl p-4 rounded-3xl border border-white/5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={t.actions.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>Môn học:</span>
            </div>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="text-xs border border-white/10 rounded-xl p-2 bg-white/5 text-slate-200 focus:outline-hidden"
            >
              <option value="all" className="bg-slate-900 text-white">Tất cả môn</option>
              {subjects.map(s => (
                <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {filteredExams.length > 0 && (
          <div className="flex items-center justify-between bg-[#0E131F]/90 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-lg">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-xl border border-white/10 transition cursor-pointer"
              >
                {selectedIds.length === filteredExams.length && filteredExams.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>{selectedIds.length === filteredExams.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả đề thi'}</span>
              </button>

              {selectedIds.length > 0 && (
                <span className="text-xs text-cyan-300 font-semibold px-2.5 py-1 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                  Đã chọn {selectedIds.length} / {filteredExams.length} đề thi
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
                  id="btn-batch-delete-exams"
                  onClick={() => setShowBatchDeleteModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa {selectedIds.length} đề thi đã chọn</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Exams Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredExams.map((exam) => {
          const isSelected = selectedIds.includes(exam.id);
          const examSubs = submissions.filter(s => s.examId === exam.id);
          const gradedCount = examSubs.filter(s => s.status === 'GRADED').length;
          const reviewCount = examSubs.filter(s => s.status === 'NEEDS_REVIEW' || s.status === 'MULTIPLE_ANSWERS' || s.status === 'LOW_CONFIDENCE').length;
          const template = templates.find(t => t.id === exam.templateId);
          const avgScore = examSubs.length > 0
            ? (examSubs.reduce((acc, s) => acc + s.totalScore, 0) / examSubs.length).toFixed(2)
            : '—';

          const isAdminExam = exam.createdByRole === 'admin';
          const isSharedToAll = exam.isSharedWithAllTeachers || isAdminExam;

          return (
            <div
              key={exam.id}
              className={`bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border p-6 shadow-2xl flex flex-col justify-between space-y-5 transition group ${
                isSelected
                  ? 'border-rose-500/60 ring-2 ring-rose-500/30'
                  : isAdminExam
                  ? 'border-purple-500/30 hover:border-purple-500/60'
                  : 'border-white/5 hover:border-cyan-500/30'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(exam.id)}
                      className="w-4 h-4 mt-1 accent-cyan-500 rounded cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-base group-hover:text-cyan-300 transition">{exam.title}</span>
                        <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          {exam.code}
                        </span>

                        {isAdminExam ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            <Shield className="w-3 h-3 text-purple-400" />
                            <span>Đề thi Ban Giám Hiệu / Admin</span>
                          </span>
                        ) : isSharedToAll ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            <Globe className="w-3 h-3 text-teal-400" />
                            <span>Chia sẻ toàn trường</span>
                          </span>
                        ) : null}
                      </div>
                      
                      <p className="text-xs text-slate-400 mt-1">
                        {exam.subject} • {exam.targetScope === 'school_wide' ? 'Phạm vi Toàn trường' : `Khối ${exam.grade} - Lớp ${exam.className}`} • Người tạo: <strong className="text-slate-300">{exam.createdByFullName || exam.teacherName}</strong>
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 shrink-0">
                    Đang thi
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Dung lượng:</span>
                    <span className="font-bold text-slate-200">{exam.numQuestions} câu (Thang {exam.maxScore})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Đã chấm OMR:</span>
                    <span className="font-bold text-cyan-400">{gradedCount} bài</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Điểm TB:</span>
                    <span className="font-bold text-emerald-400">{avgScore} / {exam.maxScore}</span>
                  </div>
                </div>

                {/* Template & Notice */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    Mẫu: <strong className="text-slate-200">{template?.name || 'Mẫu chuẩn 40 câu'}</strong>
                  </span>
                  {reviewCount > 0 && (
                    <span className="text-amber-400 font-semibold flex items-center gap-1 bg-amber-950/30 px-2 py-0.5 rounded-lg border border-amber-500/20">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {reviewCount} bài cần duyệt
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    id={`btn-print-exam-${exam.id}`}
                    onClick={() => setPrintExamModal(exam)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-xs rounded-xl border border-white/10 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{t.actions.print}</span>
                  </button>

                  <button
                    id={`btn-results-exam-${exam.id}`}
                    onClick={() => {
                      setActiveExamId(exam.id);
                      onNavigate('results');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-semibold text-xs rounded-xl border border-emerald-500/20 transition cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>{t.nav.results}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id={`btn-grade-now-exam-${exam.id}`}
                    onClick={() => {
                      setActiveExamId(exam.id);
                      onNavigate('scanner');
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-cyan-500/20"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>{t.actions.scanNow}</span>
                  </button>

                  <button
                    title="Xóa đề thi này"
                    onClick={() => setConfirmDeleteId(exam.id)}
                    className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition cursor-pointer border border-transparent hover:border-rose-500/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Single Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Xác nhận xóa đề thi"
        message={`Bạn có chắc chắn muốn xóa đề thi "${targetExamToDelete?.title}" (Mã: ${targetExamToDelete?.code})? Toàn bộ kết quả bài chấm liên quan cũng sẽ bị loại bỏ.`}
        confirmText="Xóa đề thi"
        onConfirm={() => confirmDeleteId && handleSingleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Batch Delete Confirm Modal */}
      <ConfirmModal
        isOpen={showBatchDeleteModal}
        title="Xác nhận xóa đồng loạt đề thi"
        message="Các đề thi đã chọn sẽ bị xóa vĩnh viễn khỏi hệ thống cùng toàn bộ bài chấm liên quan. Bạn có chắc chắn muốn tiếp tục?"
        confirmText="Xác nhận xóa tất cả"
        itemCount={selectedIds.length}
        onConfirm={handleBatchDelete}
        onCancel={() => setShowBatchDeleteModal(false)}
      />

      {/* Print Modal */}
      {printExamModal && (
        <TemplatePrintModal
          template={templates.find(t => t.id === printExamModal.templateId) || templates[0]}
          onClose={() => setPrintExamModal(null)}
        />
      )}
    </div>
  );
};

