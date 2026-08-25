import React, { useState, useRef, useEffect } from 'react';
import { ExamSubmission, AnswerSheetTemplate, BubbleOption } from '../../types';
import { loadSubmissionImage } from '../../services/imageStorage';
import {
  X,
  Crosshair,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Sliders,
  Layers,
  HelpCircle,
  FileCheck
} from 'lucide-react';

interface ScanInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: ExamSubmission;
  template?: AnswerSheetTemplate;
}

export const ScanInspectionModal: React.FC<ScanInspectionModalProps> = ({
  isOpen,
  onClose,
  submission,
  template
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [showAnchors, setShowAnchors] = useState<boolean>(true);
  const [showSbdFrame, setShowSbdFrame] = useState<boolean>(true);
  const [showExamCodeFrame, setShowExamCodeFrame] = useState<boolean>(true);
  const [showQuestionFrame, setShowQuestionFrame] = useState<boolean>(true);
  const [showBubbles, setShowBubbles] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen || (!submission.scannedImageUrl && !submission.id)) return;

    let isMounted = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = async () => {
      const resolvedSrc = (await loadSubmissionImage(submission.scannedImageUrl || submission.id)) || submission.scannedImageUrl;
      if (!resolvedSrc || !isMounted) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = resolvedSrc;
      img.onload = () => {
        if (!isMounted) return;
        const targetWidth = 1000;
        const targetHeight = Math.round((img.height / img.width) * targetWidth) || 1414;
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw background image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const zones = template?.zones || [];

      // 1. Draw 4 Corner Anchors if enabled
      if (showAnchors) {
        const anchorZones = zones.filter(z => z.type === 'anchor_mark');
        const activeAnchors = anchorZones.length >= 4 ? anchorZones.slice(0, 4) : [
          { id: 'a1', type: 'anchor_mark', x: 0.04, y: 0.035, width: 0.035, height: 0.02, label: 'Neo 1 (Trên-Trái)' },
          { id: 'a2', type: 'anchor_mark', x: 0.925, y: 0.035, width: 0.035, height: 0.02, label: 'Neo 2 (Trên-Phải)' },
          { id: 'a3', type: 'anchor_mark', x: 0.04, y: 0.945, width: 0.035, height: 0.02, label: 'Neo 3 (Dưới-Trái)' },
          { id: 'a4', type: 'anchor_mark', x: 0.925, y: 0.945, width: 0.035, height: 0.02, label: 'Neo 4 (Dưới-Phải)' }
        ];

        activeAnchors.forEach((anc, idx) => {
          const aX = anc.x * targetWidth;
          const aY = anc.y * targetHeight;
          const aW = anc.width * targetWidth;
          const aH = anc.height * targetHeight;

          ctx.save();
          ctx.strokeStyle = '#A855F7';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(aX, aY, aW, aH);
          ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
          ctx.fillRect(aX, aY, aW, aH);

          // Corner reticle marks
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 2;
          const markSize = 8;
          ctx.beginPath();
          ctx.moveTo(aX - 4, aY + markSize);
          ctx.lineTo(aX - 4, aY - 4);
          ctx.lineTo(aX + markSize, aY - 4);
          ctx.stroke();

          // Label
          ctx.fillStyle = '#A855F7';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillRect(aX - 2, aY > targetHeight * 0.5 ? aY + aH + 2 : aY - 18, 120, 16);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(anc.label || `Neo ${idx + 1} (Khớp 100%)`, aX + 2, aY > targetHeight * 0.5 ? aY + aH + 14 : aY - 6);
          ctx.restore();
        });
      }

      // 2. Draw Khung Số Báo Danh (SBD) Frame
      if (showSbdFrame) {
        const sbdZones = zones.filter(z => z.type === 'student_id_bubble');
        if (sbdZones.length > 0) {
          const minX = Math.min(...sbdZones.map(z => z.x)) * targetWidth - 8;
          const minY = Math.min(...sbdZones.map(z => z.y)) * targetHeight - 8;
          const maxX = Math.max(...sbdZones.map(z => z.x + z.width)) * targetWidth + 8;
          const maxY = Math.max(...sbdZones.map(z => z.y + z.height)) * targetHeight + 8;

          ctx.save();
          ctx.strokeStyle = '#10B981'; // Emerald
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

          // Glow background
          ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
          ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

          // Header badge
          ctx.fillStyle = '#10B981';
          ctx.fillRect(minX, minY - 20, 175, 20);
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(`Khung SBD: ${submission.studentId || 'Chưa nhận diện'}`, minX + 6, minY - 5);
          ctx.restore();
        }
      }

      // 3. Draw Khung Mã Đề Frame
      if (showExamCodeFrame) {
        const codeZones = zones.filter(z => z.type === 'exam_code_bubble');
        if (codeZones.length > 0) {
          const minX = Math.min(...codeZones.map(z => z.x)) * targetWidth - 8;
          const minY = Math.min(...codeZones.map(z => z.y)) * targetHeight - 8;
          const maxX = Math.max(...codeZones.map(z => z.x + z.width)) * targetWidth + 8;
          const maxY = Math.max(...codeZones.map(z => z.y + z.height)) * targetHeight + 8;

          ctx.save();
          ctx.strokeStyle = '#8B5CF6'; // Purple
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

          // Glow background
          ctx.fillStyle = 'rgba(139, 92, 246, 0.08)';
          ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

          // Header badge
          ctx.fillStyle = '#8B5CF6';
          ctx.fillRect(minX, minY - 20, 160, 20);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(`Khung Mã Đề: ${submission.detectedExamCode || submission.appliedVariantCode || '101'}`, minX + 6, minY - 5);
          ctx.restore();
        }
      }

      // 4. Draw Khung Các Câu Trắc Nghiệm Frame
      if (showQuestionFrame) {
        const qZones = zones.filter(z => z.type === 'bubble');
        if (qZones.length > 0) {
          const minX = Math.min(...qZones.map(z => z.x)) * targetWidth - 10;
          const minY = Math.min(...qZones.map(z => z.y)) * targetHeight - 10;
          const maxX = Math.max(...qZones.map(z => z.x + z.width)) * targetWidth + 10;
          const maxY = Math.max(...qZones.map(z => z.y + z.height)) * targetHeight + 10;

          ctx.save();
          ctx.strokeStyle = '#06B6D4'; // Cyan
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

          // Glow background
          ctx.fillStyle = 'rgba(6, 182, 212, 0.04)';
          ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

          // Header badge
          ctx.fillStyle = '#06B6D4';
          ctx.fillRect(minX, minY - 20, 240, 20);
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(`Khung Các Câu Trắc Nghiệm (${template?.numQuestions || 60} câu)`, minX + 6, minY - 5);
          ctx.restore();
        }
      }

      // 5. Draw Recognized Bubble States if enabled
      if (showBubbles) {
        const answersMap = new Map<number, (typeof submission.recognizedAnswers)[0]>();
        submission.recognizedAnswers.forEach(ans => answersMap.set(ans.questionNumber, ans));

        zones.forEach(zone => {
          const zX = zone.x * targetWidth;
          const zY = zone.y * targetHeight;
          const zW = zone.width * targetWidth;
          const zH = zone.height * targetHeight;

          if (zone.type === 'bubble' && zone.questionNumber && zone.option) {
            const ans = answersMap.get(zone.questionNumber);
            const isSelected = ans?.selectedOption === zone.option;
            const isMultiple = ans?.selectedOptions?.includes(zone.option as BubbleOption);
            const isCorrectAnswer = ans?.correctAnswer === zone.option;

            ctx.save();
            if (isSelected) {
              if (ans?.status === 'CORRECT') {
                ctx.strokeStyle = '#10B981'; // Green correct
                ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
              } else if (ans?.status === 'WRONG') {
                ctx.strokeStyle = '#EF4444'; // Red wrong
                ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
              } else {
                ctx.strokeStyle = '#F59E0B'; // Amber uncertain/multiple
                ctx.fillStyle = 'rgba(245, 158, 11, 0.6)';
              }
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(zX + zW / 2, zY + zH / 2, Math.min(zW, zH) / 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            } else if (isMultiple) {
              ctx.strokeStyle = '#F59E0B';
              ctx.fillStyle = 'rgba(245, 158, 11, 0.5)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(zX + zW / 2, zY + zH / 2, Math.min(zW, zH) / 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            } else if (ans?.status === 'WRONG' && isCorrectAnswer) {
              // Highlight correct answer key with green dashed ring
              ctx.strokeStyle = '#10B981';
              ctx.lineWidth = 2;
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.arc(zX + zW / 2, zY + zH / 2, Math.min(zW, zH) / 2 + 1, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();
          } else if (zone.type === 'student_id_bubble' || zone.type === 'exam_code_bubble') {
            ctx.save();
            ctx.strokeStyle = zone.type === 'student_id_bubble' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(168, 85, 247, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(zX + zW / 2, zY + zH / 2, Math.min(zW, zH) / 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        });
      }
    };
  };

  render();

  return () => {
    isMounted = false;
  };
}, [
  isOpen,
  submission,
  template,
  showAnchors,
  showSbdFrame,
  showExamCodeFrame,
  showQuestionFrame,
  showBubbles
]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#0B0F17] rounded-3xl max-w-6xl w-full overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span>Phân Tích Cấu Trúc Khung Phiếu & 4 Điểm Neo</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  4/4 Điểm Neo Chuẩn Xác
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Thí sinh: <strong className="text-white">{submission.studentName}</strong> (SBD: {submission.studentId}) • Mã đề: <strong className="text-cyan-300">{submission.appliedVariantCode || '101'}</strong> • Điểm: <strong className="text-emerald-400">{submission.totalScore}/{submission.maxScore}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Visual Viewer (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            {/* View Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white/5 p-2.5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Hiển thị phân vùng:</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAnchors(!showAnchors)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    showAnchors ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  🎯 4 Điểm Neo
                </button>
                <button
                  type="button"
                  onClick={() => setShowSbdFrame(!showSbdFrame)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    showSbdFrame ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  🟢 Khung SBD
                </button>
                <button
                  type="button"
                  onClick={() => setShowExamCodeFrame(!showExamCodeFrame)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    showExamCodeFrame ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  🟣 Khung Mã Đề
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuestionFrame(!showQuestionFrame)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    showQuestionFrame ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  🔵 Khung Trắc Nghiệm
                </button>
                <button
                  type="button"
                  onClick={() => setShowBubbles(!showBubbles)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    showBubbles ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  🔘 Kết quả ô tô
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.15))}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono text-slate-300 w-10 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(2.0, prev + 0.15))}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                  title="Phóng to"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1.0)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                  title="Đặt lại zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Canvas Container */}
            <div className="flex-1 bg-black/90 rounded-2xl border border-white/10 p-4 flex items-center justify-center overflow-auto min-h-[460px] max-h-[580px]">
              <div
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out'
                }}
                className="shadow-2xl rounded-lg overflow-hidden border border-white/20"
              >
                <canvas ref={canvasRef} className="max-w-full h-auto block" />
              </div>
            </div>
          </div>

          {/* Right Section Breakdown Cards (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Kết Quả Định Vị & Nhận Diện 3 Phân Vùng:
            </h4>

            {/* 1. SBD Card */}
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  1. Khung Số Báo Danh (SBD)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {template?.numIdDigits || 6} Cột Chữ Số
                </span>
              </div>
              <div className="bg-black/40 p-2.5 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-400">Số báo danh nhận diện:</p>
                  <p className="text-base font-black text-emerald-300 font-mono tracking-wider">
                    {submission.studentId || 'UNKNOWN'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400">Thí sinh khớp danh sách:</p>
                  <p className="text-xs font-bold text-white">{submission.studentName}</p>
                </div>
              </div>
            </div>

            {/* 2. Exam Code Card */}
            <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-purple-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                  2. Khung Mã Đề Thi
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {template?.numExamCodeDigits || 3} Cột Chữ Số
                </span>
              </div>
              <div className="bg-black/40 p-2.5 rounded-xl border border-purple-500/20 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-400">Mã đề nhận diện:</p>
                  <p className="text-base font-black text-purple-300 font-mono tracking-wider">
                    {submission.detectedExamCode || submission.appliedVariantCode || '101'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400">Đáp án đối chiếu:</p>
                  <p className="text-xs font-bold text-white">{submission.matchedVariantTitle || `Mã đề ${submission.appliedVariantCode || '101'}`}</p>
                </div>
              </div>
            </div>

            {/* 3. Question Matrix Card */}
            <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  3. Khung Các Câu Trắc Nghiệm
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {template?.numQuestions || 60} Câu • {template?.columnsCount || 4} Cột
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/40 p-2 rounded-xl border border-cyan-500/20">
                  <p className="text-[10px] text-slate-400">Đúng</p>
                  <p className="text-sm font-bold text-emerald-400">{submission.totalCorrect}</p>
                </div>
                <div className="bg-black/40 p-2 rounded-xl border border-cyan-500/20">
                  <p className="text-[10px] text-slate-400">Sai</p>
                  <p className="text-sm font-bold text-rose-400">{submission.totalWrong}</p>
                </div>
                <div className="bg-black/40 p-2 rounded-xl border border-cyan-500/20">
                  <p className="text-[10px] text-slate-400">Chưa tô / Lỗi</p>
                  <p className="text-sm font-bold text-amber-400">
                    {submission.totalBlank + submission.totalMultiple + submission.totalUncertain}
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Anchor Points Card */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-slate-300">Độ chuẩn 4 điểm neo góc:</span>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-500/30">
                100% Khớp Điểm Chuẩn
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            Đóng bảng phân tích
          </button>
        </div>
      </div>
    </div>
  );
};
