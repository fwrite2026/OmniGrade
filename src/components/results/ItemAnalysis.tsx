import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { QuestionAnalytics } from '../../types';
import {
  BarChart3,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Filter,
  Layers,
  ArrowUpDown,
  Sparkles
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const ItemAnalysis: React.FC = () => {
  const { t, activeExam, exams, setActiveExamId, getExamStatistics, submissions } = useApp();

  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [sortBy, setSortBy] = useState<'num_asc' | 'accuracy_asc' | 'accuracy_desc'>('num_asc');
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionAnalytics | null>(null);

  const currentExam = exams.find(e => e.id === selectedExamId) || activeExam || exams[0];

  if (!currentExam && submissions.length === 0) {
    return (
      <div className="p-12 max-w-xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/10">
          <BarChart3 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Chưa có đề thi nào để phân tích</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Vui lòng tạo đề thi và thực hiện chấm bài để hệ thống phân tích độ phân biệt, độ khó và các phương án gây nhiễu của từng câu hỏi.
        </p>
      </div>
    );
  }

  const stats = getExamStatistics(selectedExamId);
  const questionAnalytics = stats.questionAnalytics || [];

  const filteredQuestions = questionAnalytics.filter(q => {
    if (difficultyFilter === 'all') return true;
    return q.difficultyLabel === difficultyFilter;
  });

  filteredQuestions.sort((a, b) => {
    if (sortBy === 'accuracy_asc') return a.correctPercentage - b.correctPercentage;
    if (sortBy === 'accuracy_desc') return b.correctPercentage - a.correctPercentage;
    return a.questionNumber - b.questionNumber;
  });

  const activeQ = selectedQuestion || filteredQuestions[0] || questionAnalytics[0];

  // Prepare chart data for the active question's distractor distribution
  const distractorData = activeQ ? [
    { name: 'Lựa chọn A', count: activeQ.distractorCounts['A'] || 0, isCorrect: activeQ.correctAnswer === 'A' },
    { name: 'Lựa chọn B', count: activeQ.distractorCounts['B'] || 0, isCorrect: activeQ.correctAnswer === 'B' },
    { name: 'Lựa chọn C', count: activeQ.distractorCounts['C'] || 0, isCorrect: activeQ.correctAnswer === 'C' },
    { name: 'Lựa chọn D', count: activeQ.distractorCounts['D'] || 0, isCorrect: activeQ.correctAnswer === 'D' },
    { name: 'Bỏ trống', count: activeQ.distractorCounts['blank'] || 0, isCorrect: false },
  ] : [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10">
              <BarChart3 className="w-6 h-6" />
            </div>
            <span>Phân Tích Câu Hỏi (Item Analysis)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Đánh giá độ khó, tỷ lệ phương án gây nhiễu và độ phân loại từng câu hỏi trong đề thi.
          </p>
        </div>

        {/* Filter Pills & Exam Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedExamId}
            onChange={(e) => {
              setSelectedExamId(e.target.value);
              if (e.target.value !== 'all') {
                setActiveExamId(e.target.value);
              }
            }}
            className="text-xs font-bold text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-2 focus:outline-hidden"
          >
            <option value="all" className="bg-slate-900 text-cyan-300 font-bold">
              ★ Toàn bộ đề thi
            </option>
            {exams.map(e => (
              <option key={e.id} value={e.id} className="bg-slate-900 text-white">
                {e.title} ({e.code})
              </option>
            ))}
          </select>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 rounded-xl p-2 focus:outline-hidden"
          >
            <option value="num_asc" className="bg-slate-900 text-white">Số thứ tự (1 → N)</option>
            <option value="accuracy_asc" className="bg-slate-900 text-white">% Đúng: Thấp → Cao (Khó nhất)</option>
            <option value="accuracy_desc" className="bg-slate-900 text-white">% Đúng: Cao → Thấp (Dễ nhất)</option>
          </select>
        </div>
      </div>

      {/* Difficulty Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'hard', 'medium', 'easy'] as const).map((diff) => (
          <button
            key={diff}
            onClick={() => setDifficultyFilter(diff)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
              difficultyFilter === diff
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-500/40 shadow-lg shadow-cyan-500/20'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            {diff === 'all' && `Tất cả (${questionAnalytics.length} câu)`}
            {diff === 'hard' && `Khó (< 40% đúng)`}
            {diff === 'medium' && `Vừa (40% - 70%)`}
            {diff === 'easy' && `Dễ (> 70% đúng)`}
          </button>
        ))}
      </div>

      {/* Grid: Left Question List & Right Distractor Deep-dive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs font-bold text-slate-400 uppercase">
            <span>Danh sách {filteredQuestions.length} câu hỏi</span>
            <span>Tỷ lệ làm đúng</span>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Chưa có dữ liệu phân tích câu hỏi cho bộ lọc này.
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredQuestions.map((q) => {
                const isSelected = activeQ?.questionNumber === q.questionNumber;

                return (
                  <div
                    key={q.questionNumber}
                    onClick={() => setSelectedQuestion(q)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/50 ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-500/10'
                        : 'border-white/5 hover:border-white/15 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-white/10 font-bold text-xs text-cyan-300 flex items-center justify-center border border-white/10">
                        Q{q.questionNumber}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            Đáp án đúng: <span className="text-cyan-400 font-extrabold">{q.correctAnswer}</span>
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            q.difficultyLabel === 'easy'
                              ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30'
                              : q.difficultyLabel === 'medium'
                              ? 'bg-blue-950/50 text-blue-400 border border-blue-500/30'
                              : 'bg-rose-950/50 text-rose-400 border border-rose-500/30'
                          }`}>
                            {q.difficultyLabel === 'easy' ? 'Dễ' : q.difficultyLabel === 'medium' ? 'Vừa' : 'Khó'}
                          </span>
                        </div>
                        {q.mostCommonDistractor && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Bẫy phổ biến: <strong className="text-amber-300">{q.mostCommonDistractor}</strong> ({q.distractorCounts[q.mostCommonDistractor]} em chọn)
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-bold text-white">{q.correctPercentage}%</span>
                      <div className="w-20 h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            q.correctPercentage >= 70
                              ? 'bg-emerald-500'
                              : q.correctPercentage >= 40
                              ? 'bg-cyan-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${q.correctPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Distractor Deep-Dive Visualizer (5 Cols) */}
        <div className="lg:col-span-5 bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-5 sm:p-6 shadow-2xl space-y-6">
          {activeQ ? (
            <>
              <div className="border-b border-white/10 pb-3 space-y-1">
                <span className="text-xs font-bold uppercase text-cyan-400">Chi tiết phân tích câu hỏi:</span>
                <h3 className="text-xl font-bold text-white">
                  Câu hỏi số {activeQ.questionNumber}
                </h3>
                <p className="text-xs text-slate-400">
                  Đáp án chuẩn: <strong className="text-emerald-400">{activeQ.correctAnswer}</strong> • Tổng lượt trả lời: {activeQ.totalResponses}
                </p>
              </div>

              {/* Bar Chart of Distractor Choices */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 block">
                  Phân bố lựa chọn phương án (Distractor Distribution):
                </span>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distractorData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip
                        formatter={(val: any) => [`${val} học sinh`, 'Số lượng chọn']}
                        contentStyle={{ fontSize: 12, borderRadius: 12, backgroundColor: '#0B0F17', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#06b6d4"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Distractor Assessment Insights */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2 text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-cyan-400" />
                  Đánh giá chuyên môn sư phạm:
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                  <li>Chỉ số độ khó (Difficulty Index): <strong className="text-white">p = {activeQ.difficultyIndex}</strong></li>
                  <li>
                    {activeQ.correctPercentage >= 70
                      ? 'Câu hỏi có tính nhận biết tốt, đa số học sinh nắm vững kiến thức cốt lõi.'
                      : activeQ.correctPercentage >= 40
                      ? 'Câu hỏi có độ phân loại tốt, phương án gây nhiễu hoạt động hiệu quả.'
                      : 'Câu hỏi có độ khó cao hoặc chứa bẫy kiến thức cần được giáo viên chữa bài kỹ.'}
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-slate-400 text-xs">
              Chọn một câu hỏi ở danh sách bên trái để xem phân bố đáp án.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
