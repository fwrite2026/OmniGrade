import React from 'react';
import { useApp } from '../../context/AppContext';
import { NavTab } from '../common/Sidebar';
import {
  FileCheck,
  ScanLine,
  AlertTriangle,
  Award,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Activity
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: NavTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t, exams, submissions, students, activeExam, setActiveExamId } = useApp();

  const totalGraded = submissions.filter(s => s.status === 'GRADED').length;
  const totalPendingReview = submissions.filter(s => s.status === 'NEEDS_REVIEW' || s.status === 'MULTIPLE_ANSWERS' || s.status === 'LOW_CONFIDENCE').length;
  
  const avgScore = submissions.length > 0
    ? (submissions.reduce((sum, s) => sum + s.totalScore, 0) / submissions.length).toFixed(2)
    : '0.0';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Top Banner Greeting */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950/80 via-slate-900/90 to-cyan-950/80 border border-cyan-500/20 p-6 md:p-8 text-white shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-semibold backdrop-blur-md">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.dashboard.schoolName}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              {t.dashboard.greeting}
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Hệ thống chấm phiếu trắc nghiệm tự động bằng thị giác máy tính OMR. Nhận diện chính xác, hỗ trợ tùy biến 100% mẫu phiếu của nhà trường.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              id="btn-dash-grade-now"
              onClick={() => onNavigate('scanner')}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-2xl text-sm shadow-lg shadow-cyan-500/25 transition duration-200 cursor-pointer active:scale-98"
            >
              <ScanLine className="w-4 h-4" />
              <span>{t.dashboard.gradeNow}</span>
            </button>
            <button
              id="btn-dash-create-exam"
              onClick={() => onNavigate('createExam')}
              className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-2xl text-sm border border-white/10 transition cursor-pointer backdrop-blur-md"
            >
              <PlusCircle className="w-4 h-4 text-cyan-400" />
              <span>{t.dashboard.createNewExam}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active Exams */}
        <div className="bg-[#0E131F]/80 backdrop-blur-md p-5 rounded-2xl border border-white/5 shadow-xl hover:border-cyan-500/30 transition duration-200 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.dashboard.activeExams}</p>
            <p className="text-2xl font-bold text-white">{exams.length}</p>
            <p className="text-xs text-cyan-400 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Đang tiến hành chấm</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <FileCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Graded Papers */}
        <div className="bg-[#0E131F]/80 backdrop-blur-md p-5 rounded-2xl border border-white/5 shadow-xl hover:border-emerald-500/30 transition duration-200 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.dashboard.gradedPapers}</p>
            <p className="text-2xl font-bold text-white">{totalGraded}</p>
            <p className="text-xs text-slate-400">
              Tổng {submissions.length} bài đã nộp
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Reviews */}
        <div 
          onClick={() => onNavigate('review')}
          className={`p-5 rounded-2xl border transition duration-200 cursor-pointer flex items-center justify-between ${
            totalPendingReview > 0 
              ? 'bg-amber-950/30 border-amber-500/40 hover:bg-amber-950/40 shadow-lg shadow-amber-950/20' 
              : 'bg-[#0E131F]/80 backdrop-blur-md border-white/5 hover:border-white/20 shadow-xl'
          }`}
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">{t.dashboard.pendingReviews}</p>
            <p className="text-2xl font-bold text-amber-200">{totalPendingReview}</p>
            <p className="text-xs text-amber-300/80 font-medium">
              {totalPendingReview > 0 ? 'Cần giáo viên duyệt đáp án' : 'Không có bài nghi vấn'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-[#0E131F]/80 backdrop-blur-md p-5 rounded-2xl border border-white/5 shadow-xl hover:border-purple-500/30 transition duration-200 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.dashboard.averageScore}</p>
            <p className="text-2xl font-bold text-white">{avgScore} <span className="text-sm font-normal text-slate-400">/ 10</span></p>
            <p className="text-xs text-emerald-400 font-medium">
              Tỷ lệ đạt: 91.7%
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Exams & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Exams List */}
        <div className="lg:col-span-2 bg-[#0E131F]/80 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-cyan-400" />
              <span>{t.dashboard.recentExams}</span>
            </h2>
            <button
              onClick={() => onNavigate('exams')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-white/5">
            {exams.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-xs text-slate-400">Chưa có đề thi nào. Hãy tạo đề thi mới để bắt đầu chấm bài và quản lý kết quả!</p>
                <button
                  onClick={() => onNavigate('createExam')}
                  className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Tạo đề thi mới ngay
                </button>
              </div>
            ) : (
              exams.map((exam) => {
                const examSubs = submissions.filter(s => s.examId === exam.id);
                const gradedCount = examSubs.filter(s => s.status === 'GRADED').length;
                const reviewCount = examSubs.filter(s => s.status === 'NEEDS_REVIEW' || s.status === 'MULTIPLE_ANSWERS').length;

                return (
                  <div key={exam.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 text-sm hover:text-cyan-400 transition cursor-pointer" onClick={() => { setActiveExamId(exam.id); onNavigate('results'); }}>
                          {exam.title}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-white/5 border border-white/10 text-cyan-300">
                          {exam.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>Môn: {exam.subject}</span>
                        <span>Lớp: {exam.className}</span>
                        <span>{exam.numQuestions} câu (Thang {exam.maxScore})</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(exam.examDate).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {/* Status badges */}
                      <div className="text-right">
                        <div className="text-xs font-medium text-slate-300">
                          Đã chấm: <span className="font-bold text-cyan-400">{gradedCount}</span> / {students.length}
                        </div>
                        {reviewCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            {reviewCount} bài cần duyệt
                          </span>
                        )}
                      </div>

                      <button
                        id={`btn-grade-exam-${exam.id}`}
                        onClick={() => {
                          setActiveExamId(exam.id);
                          onNavigate('scanner');
                        }}
                        className="px-3.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-xs rounded-xl transition cursor-pointer"
                      >
                        {t.actions.scanNow}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 Col: Quick Tools & Engine Status */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <div className="bg-[#0E131F]/80 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-white">{t.dashboard.quickActions}</h3>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                id="btn-qa-scan"
                onClick={() => onNavigate('scanner')}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/5 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <ScanLine className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-100 group-hover:text-cyan-300 transition">{t.dashboard.gradeNow}</p>
                    <p className="text-[11px] text-slate-400">Tải ảnh hoặc quét camera</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition" />
              </button>

              <button
                id="btn-qa-template"
                onClick={() => onNavigate('templateEditor')}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/5 hover:border-indigo-500/40 hover:bg-indigo-500/10 transition cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-100 group-hover:text-indigo-300 transition">{t.dashboard.designTemplate}</p>
                    <p className="text-[11px] text-slate-400">Tùy biến tọa độ ô trắc nghiệm</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" />
              </button>

              <button
                id="btn-qa-results"
                onClick={() => onNavigate('results')}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-100 group-hover:text-emerald-300 transition">Bảng điểm & Xuất Excel</p>
                    <p className="text-[11px] text-slate-400">Xem thống kê và xuất báo cáo</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
              </button>
            </div>
          </div>

          {/* OMR System Status */}
          <div className="bg-[#080C14]/90 border border-white/10 text-white rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">OMR Engine Core</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Active
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t.dashboard.systemHealth}
            </p>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span>Độ trễ trung bình:</span>
              <span className="font-mono text-cyan-300 font-semibold">120ms / bài</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
