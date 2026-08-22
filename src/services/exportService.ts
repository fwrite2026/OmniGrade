import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { Exam, ExamStatistics, ExamSubmission } from '../types';

/**
 * Exports complete exam results and individual question responses to Excel (.xlsx)
 */
export function exportResultsToExcel(exam: Exam, submissions: ExamSubmission[]): void {
  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: Master Gradebook
  const gradebookRows = submissions.map((sub, idx) => {
    const row: Record<string, string | number> = {
      'STT': idx + 1,
      'Mã Học Sinh': sub.studentId || 'N/A',
      'Họ và Tên': sub.studentName || 'Chưa rõ',
      'Lớp': sub.className || exam.className,
      'Mã Đề': sub.appliedVariantCode || sub.detectedExamCode || exam.code,
      'Điểm Số': sub.totalScore,
      'Thang Điểm': sub.maxScore,
      'Số Câu Đúng': sub.totalCorrect,
      'Số Câu Sai': sub.totalWrong,
      'Bỏ Trống': sub.totalBlank,
      'Tô Nhiều Ô': sub.totalMultiple,
      'Trạng Thái': sub.status,
      'Ngày Chấm': new Date(sub.scanDate).toLocaleDateString('vi-VN')
    };

    // Add individual question columns
    exam.questions.forEach((q) => {
      const recognized = sub.recognizedAnswers.find(r => r.questionNumber === q.questionNumber);
      const studentAns = recognized?.selectedOption || (recognized?.status === 'MULTIPLE' ? '[2+]' : '—');
      row[`Câu ${q.questionNumber} (ĐA: ${q.correctAnswer})`] = `${studentAns} ${recognized?.isCorrect ? '✓' : '✗'}`;
    });

    return row;
  });

  const wsGradebook = XLSX.utils.json_to_sheet(gradebookRows);
  XLSX.utils.book_append_sheet(wb, wsGradebook, 'Bảng Điểm Chi Tiết');

  // 2. Sheet 2: Exam Information & Stats
  const avgScore = submissions.length > 0
    ? Number((submissions.reduce((acc, s) => acc + s.totalScore, 0) / submissions.length).toFixed(2))
    : 0;

  const summaryRows = [
    { 'Thông số': 'Tên bài thi', 'Giá trị': exam.title },
    { 'Thông số': 'Môn học', 'Giá trị': exam.subject },
    { 'Thông số': 'Khối / Lớp', 'Giá trị': `${exam.grade} - ${exam.className}` },
    { 'Thông số': 'Mã đề thi', 'Giá trị': exam.code },
    { 'Thông số': 'Số lượng câu hỏi', 'Giá trị': exam.numQuestions },
    { 'Thông số': 'Thang điểm tối đa', 'Giá trị': exam.maxScore },
    { 'Thông số': 'Tổng số bài đã nộp', 'Giá trị': submissions.length },
    { 'Thông số': 'Điểm trung bình', 'Giá trị': avgScore },
    { 'Thông số': 'Ngày xuất báo cáo', 'Giá trị': new Date().toLocaleString('vi-VN') }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Thông Tin Đề Thi');

  // Trigger download
  const fileName = `Bang_Diem_${exam.code}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Exports CSV format
 */
export function exportResultsToCSV(exam: Exam, submissions: ExamSubmission[]): void {
  const rows = [
    ['STT', 'Ma_HS', 'Ho_Ten', 'Lop', 'Ma_De', 'Diem_So', 'So_Cau_Dung', 'Trang_Thai']
  ];

  submissions.forEach((sub, idx) => {
    rows.push([
      (idx + 1).toString(),
      sub.studentId || '',
      `"${sub.studentName || ''}"`,
      sub.className || '',
      sub.appliedVariantCode || sub.detectedExamCode || exam.code,
      sub.totalScore.toString(),
      sub.totalCorrect.toString(),
      sub.status
    ]);
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Ket_Qua_${exam.code}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates an executive PDF Report for the Exam
 */
export function generateExamSummaryPDF(
  exam: Exam,
  submissions: ExamSubmission[],
  stats: ExamStatistics
): void {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 138); // Blue
  doc.text('OMNIGRADE - BÁO CÁO TỔNG KẾT KỲ THI', 14, 20);

  doc.setFontSize(13);
  doc.setTextColor(33, 33, 33);
  doc.text(`Đề thi: ${exam.title} (${exam.code})`, 14, 30);
  doc.text(`Môn học: ${exam.subject} | Lớp: ${exam.className} | Khối: ${exam.grade}`, 14, 38);
  doc.text(`Ngày chấm: ${new Date().toLocaleDateString('vi-VN')} | Giáo viên: ${exam.teacherName}`, 14, 46);

  // Line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 52, 196, 52);

  // Key stats table
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('1. Thống kê chung:', 14, 62);

  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81);
  doc.text(`• Tổng số bài làm: ${stats.totalSubmissions}`, 20, 72);
  doc.text(`• Đã hoàn thành chấm: ${stats.gradedCount}`, 20, 80);
  doc.text(`• Bài cần xem lại: ${stats.needsReviewCount}`, 20, 88);
  doc.text(`• Điểm trung bình: ${stats.averageScore.toFixed(2)} / ${exam.maxScore}`, 20, 96);
  doc.text(`• Điểm cao nhất: ${stats.highestScore} | Điểm thấp nhất: ${stats.lowestScore}`, 20, 104);
  doc.text(`• Tỷ lệ đạt (>= ${exam.passingScore}): ${stats.passRate.toFixed(1)}%`, 20, 112);

  // Score distribution summary
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('2. Phổ điểm chi tiết:', 14, 126);

  let currentY = 136;
  stats.scoreDistribution.forEach((dist) => {
    doc.setFontSize(10);
    doc.text(`• Phân khúc ${dist.range}: ${dist.count} học sinh (${dist.percentage.toFixed(1)}%)`, 20, currentY);
    currentY += 8;
  });

  // Top/Bottom questions
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('3. Phân tích câu hỏi điển hình:', 14, currentY + 10);
  currentY += 20;

  const sortedQuestions = [...stats.questionAnalytics].sort((a, b) => a.correctPercentage - b.correctPercentage);
  const hardest = sortedQuestions.slice(0, 3);
  const easiest = [...sortedQuestions].reverse().slice(0, 3);

  doc.setFontSize(10);
  doc.setTextColor(185, 28, 28);
  doc.text('Top 3 câu khó nhất (Tỷ lệ làm đúng thấp):', 20, currentY);
  currentY += 7;
  hardest.forEach((q) => {
    doc.text(`- Câu ${q.questionNumber}: chỉ ${q.correctPercentage.toFixed(1)}% đúng (Đáp án đúng: ${q.correctAnswer})`, 25, currentY);
    currentY += 6;
  });

  currentY += 4;
  doc.setTextColor(22, 101, 52);
  doc.text('Top 3 câu dễ nhất (Tỷ lệ làm đúng cao):', 20, currentY);
  currentY += 7;
  easiest.forEach((q) => {
    doc.text(`- Câu ${q.questionNumber}: ${q.correctPercentage.toFixed(1)}% đúng (Đáp án đúng: ${q.correctAnswer})`, 25, currentY);
    currentY += 6;
  });

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('Được tạo tự động bởi Hệ thống Chấm thi OmniGrade OMR System', 14, 285);

  doc.save(`Bao_Cao_Tong_Ket_${exam.code}.pdf`);
}
