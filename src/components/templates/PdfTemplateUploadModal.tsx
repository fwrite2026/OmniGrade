import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AnswerSheetTemplate, RecognitionZone } from '../../types';
import { processUploadedFileToImages, PdfPageResult } from '../../services/pdfService';
import { detectBubblesFromImageData, DetectedBubbleGridResult } from '../../services/bubbleDetection';
import { generateAutoGridZones } from '../../services/templateGenerator';
import {
  FileUp,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Sparkles,
  RotateCcw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  FileText,
  AlertCircle,
  Loader2,
  Eye,
  Move,
  CheckCircle2,
  Grid
} from 'lucide-react';

interface PdfTemplateUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEditorWithTemplate?: (template: AnswerSheetTemplate) => void;
}

export const PdfTemplateUploadModal: React.FC<PdfTemplateUploadModalProps> = ({
  isOpen,
  onClose,
  onOpenEditorWithTemplate
}) => {
  const { addTemplate, setActiveTemplateId, schoolName } = useApp();

  // File & PDF Process States
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<PdfPageResult[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Full-screen Image Lightbox
  const [showFullPreview, setShowFullPreview] = useState<boolean>(false);
  const [modalZoom, setModalZoom] = useState<number>(1.0);
  const [showZoneOverlay, setShowZoneOverlay] = useState<boolean>(true);

  // Template Form State
  const [templateName, setTemplateName] = useState<string>('Phiếu Trắc Nghiệm Mới (Từ PDF)');
  const [localSchool, setLocalSchool] = useState<string>(schoolName || 'Trường THPT Chuyên');
  const [paperSize, setPaperSize] = useState<'A4' | 'A5' | 'Letter'>('A4');
  const [numQuestions, setNumQuestions] = useState<number>(60);
  const [numOptions, setNumOptions] = useState<number>(4);
  const [columnsCount, setColumnsCount] = useState<number>(4);
  const [direction, setDirection] = useState<'column_first' | 'row_first'>('column_first');
  const [gridYStart, setGridYStart] = useState<number>(0.28);
  const [gridYEnd, setGridYEnd] = useState<number>(0.95);
  const [gridXStart, setGridXStart] = useState<number>(0.06);
  const [gridXEnd, setGridXEnd] = useState<number>(0.94);
  const [bubbleScale, setBubbleScale] = useState<number>(1.0);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [numIdDigits, setNumIdDigits] = useState<number>(6);
  const [hasQrCode, setHasQrCode] = useState<boolean>(true);
  const [hasAnchorMarks, setHasAnchorMarks] = useState<boolean>(true);
  const [useAiDetectedZones, setUseAiDetectedZones] = useState<boolean>(true);

  // Auto detection result state
  const [detectedResult, setDetectedResult] = useState<DetectedBubbleGridResult | null>(null);
  const [isAutoDetecting, setIsAutoDetecting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightboxCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute Active Working Zones based on Detection or Manual Settings
  const getActiveZones = (): RecognitionZone[] => {
    const isAiMatching =
      useAiDetectedZones &&
      detectedResult &&
      detectedResult.detectedZones &&
      detectedResult.detectedZones.length > 0 &&
      detectedResult.numQuestions === numQuestions &&
      detectedResult.columnsCount === columnsCount &&
      detectedResult.numOptions === numOptions;

    let baseZones: RecognitionZone[];
    if (isAiMatching && detectedResult) {
      baseZones = detectedResult.detectedZones;
    } else {
      baseZones = generateAutoGridZones(numQuestions, numOptions, columnsCount, {
        direction,
        yStart: gridYStart,
        yEnd: gridYEnd,
        xStart: gridXStart,
        xEnd: gridXEnd,
        includeAnchors: hasAnchorMarks,
        includeQr: hasQrCode
      });
    }

    // Apply micro offsets and bubble scaling if altered
    if (offsetX !== 0 || offsetY !== 0 || bubbleScale !== 1.0) {
      return baseZones.map(z => {
        if (z.type === 'bubble' || z.type === 'student_id_bubble') {
          return {
            ...z,
            x: Math.max(0.01, Math.min(0.97, z.x + offsetX)),
            y: Math.max(0.01, Math.min(0.97, z.y + offsetY)),
            width: Math.max(0.015, Math.min(0.05, z.width * bubbleScale)),
            height: Math.max(0.018, Math.min(0.06, z.height * bubbleScale))
          };
        }
        return z;
      });
    }

    return baseZones;
  };

  // Render Canvas with Zone Overlay on Preview
  useEffect(() => {
    if (pdfPages.length === 0 || !pdfPages[selectedPageIndex]) return;
    const page = pdfPages[selectedPageIndex];
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = page.dataUrl;
    img.onload = () => {
      canvas.width = 600;
      canvas.height = 848;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (showZoneOverlay) {
        const zones = getActiveZones();
        zones.forEach(zone => {
          const zX = zone.x * canvas.width;
          const zY = zone.y * canvas.height;
          const zW = zone.width * canvas.width;
          const zH = zone.height * canvas.height;

          ctx.save();
          if (zone.type === 'bubble' || zone.type === 'student_id_bubble') {
            ctx.strokeStyle = '#06B6D4'; // Cyan
            ctx.fillStyle = 'rgba(6, 182, 212, 0.28)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(zX + zW / 2, zY + zH / 2, Math.min(zW, zH) / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else if (zone.type === 'student_id_qr') {
            ctx.strokeStyle = '#10B981';
            ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(zX, zY, zW, zH);
            ctx.fillRect(zX, zY, zW, zH);
          } else if (zone.type === 'anchor_mark') {
            ctx.strokeStyle = '#8B5CF6';
            ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(zX, zY, zW, zH);
            ctx.fillRect(zX, zY, zW, zH);
          }
          ctx.restore();
        });
      }
    };
  }, [
    pdfPages,
    selectedPageIndex,
    showZoneOverlay,
    numQuestions,
    numOptions,
    columnsCount,
    direction,
    gridYStart,
    gridYEnd,
    gridXStart,
    gridXEnd,
    offsetX,
    offsetY,
    bubbleScale,
    useAiDetectedZones,
    detectedResult
  ]);

  const handleFileProcess = async (file: File) => {
    if (!file) return;
    setErrorMessage(null);
    setIsConverting(true);
    setUploadedFile(file);

    try {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTemplateName(`Mẫu ${cleanName}`);

      const { pages } = await processUploadedFileToImages(file);
      if (pages.length === 0) {
        throw new Error('Không thể trích xuất trang từ tệp PDF này.');
      }
      setPdfPages(pages);
      setSelectedPageIndex(0);

      // Automatically run high-accuracy Computer Vision bubble detection on page 1
      if (pages[0]?.dataUrl) {
        setIsAutoDetecting(true);
        try {
          const cvResult = await detectBubblesFromImageData(pages[0].dataUrl);
          setDetectedResult(cvResult);
          if (cvResult.numQuestions) setNumQuestions(cvResult.numQuestions);
          if (cvResult.numOptions) setNumOptions(cvResult.numOptions);
          if (cvResult.columnsCount) setColumnsCount(cvResult.columnsCount);
          if (cvResult.gridBounds) {
            setGridXStart(cvResult.gridBounds.xStart);
            setGridXEnd(cvResult.gridBounds.xEnd);
            setGridYStart(cvResult.gridBounds.yStart);
            setGridYEnd(cvResult.gridBounds.yEnd);
          }
          setOffsetX(0);
          setOffsetY(0);
          setBubbleScale(1.0);
          setUseAiDetectedZones(true);
        } catch (cvErr) {
          console.warn('Auto CV detection notice:', cvErr);
        } finally {
          setIsAutoDetecting(false);
        }
      }
    } catch (err: any) {
      console.error('Error loading PDF file:', err);
      setErrorMessage(
        err.message || 'Lỗi đọc tệp PDF. Vui lòng kiểm tra lại định dạng tệp hoặc thử tệp ảnh.'
      );
      setPdfPages([]);
      setUploadedFile(null);
    } finally {
      setIsConverting(false);
    }
  };

  const handlePageChange = async (index: number) => {
    if (index < 0 || index >= pdfPages.length) return;
    setSelectedPageIndex(index);

    const page = pdfPages[index];
    if (page?.dataUrl) {
      setIsAutoDetecting(true);
      try {
        const cvResult = await detectBubblesFromImageData(page.dataUrl);
        setDetectedResult(cvResult);
        if (cvResult.numQuestions) setNumQuestions(cvResult.numQuestions);
        if (cvResult.numOptions) setNumOptions(cvResult.numOptions);
        if (cvResult.columnsCount) setColumnsCount(cvResult.columnsCount);
        if (cvResult.gridBounds) {
          setGridXStart(cvResult.gridBounds.xStart);
          setGridXEnd(cvResult.gridBounds.xEnd);
          setGridYStart(cvResult.gridBounds.yStart);
          setGridYEnd(cvResult.gridBounds.yEnd);
        }
        setOffsetX(0);
        setOffsetY(0);
        setBubbleScale(1.0);
        setUseAiDetectedZones(true);
      } catch (cvErr) {
        console.warn('Auto CV detection notice on page change:', cvErr);
      } finally {
        setIsAutoDetecting(false);
      }
    }
  };

  const handleReRunDetection = async () => {
    const page = pdfPages[selectedPageIndex];
    if (!page?.dataUrl) return;
    setIsAutoDetecting(true);
    try {
      const cvResult = await detectBubblesFromImageData(page.dataUrl);
      setDetectedResult(cvResult);
      if (cvResult.numQuestions) setNumQuestions(cvResult.numQuestions);
      if (cvResult.numOptions) setNumOptions(cvResult.numOptions);
      if (cvResult.columnsCount) setColumnsCount(cvResult.columnsCount);
      if (cvResult.gridBounds) {
        setGridXStart(cvResult.gridBounds.xStart);
        setGridXEnd(cvResult.gridBounds.xEnd);
        setGridYStart(cvResult.gridBounds.yStart);
        setGridYEnd(cvResult.gridBounds.yEnd);
      }
      setOffsetX(0);
      setOffsetY(0);
      setBubbleScale(1.0);
      setUseAiDetectedZones(true);
    } catch (err: any) {
      console.warn('Re-detect error:', err);
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleCreateTemplate = (openInEditor: boolean = false) => {
    if (pdfPages.length === 0) {
      setErrorMessage('Vui lòng tải lên tệp PDF hoặc ảnh mẫu phiếu trước.');
      return;
    }

    const selectedPage = pdfPages[selectedPageIndex];
    const finalZones = getActiveZones();

    const newTemplate: AnswerSheetTemplate = {
      id: `tpl_pdf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: templateName.trim() || 'Phiếu Trắc Nghiệm Tải Lên',
      schoolName: localSchool.trim(),
      version: '1.0',
      paperSize,
      numQuestions,
      numOptions,
      numIdDigits,
      hasQrCode,
      hasAnchorMarks,
      zones: finalZones,
      backgroundImageUrl: selectedPage.dataUrl,
      fillThreshold: 0.35,
      uncertainThreshold: 0.18,
      columnsCount,
      createdBy: 'Giáo viên',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSystemDefault: false
    };

    addTemplate(newTemplate);
    setActiveTemplateId(newTemplate.id);

    if (openInEditor && onOpenEditorWithTemplate) {
      onOpenEditorWithTemplate(newTemplate);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#0B0F17] rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span>Tải Lên Mẫu Phiếu Trắc Nghiệm (PDF / Ảnh)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ✨ Giữ nguyên 100% tiêu đề & nội dung gốc
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Nhập file PDF / Ảnh thiết kế của trường để in trực tiếp phiếu trả lời mà không cần chỉnh sửa lại tiêu đề hay nội dung câu hỏi.
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
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Error notice */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Upload Dropzone if no file or loading */}
          {pdfPages.length === 0 ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 text-center transition cursor-pointer flex flex-col items-center justify-center space-y-4 ${
                dragActive
                  ? 'border-cyan-500 bg-cyan-950/20'
                  : 'border-white/15 hover:border-cyan-500/50 bg-white/5 hover:bg-white/10'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />

              {isConverting ? (
                <div className="flex flex-col items-center space-y-3 py-6">
                  <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                  <p className="text-sm font-bold text-white">Đang xử lý và trích xuất trang PDF độ phân giải cao...</p>
                  <p className="text-xs text-slate-400">Động cơ chuyển đổi PDF.js đang chuẩn bị ma trận điểm ảnh OMR</p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                    <FileUp className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">
                      Kéo thả file <span className="text-cyan-400 font-mono font-bold">PDF</span> hoặc ảnh mẫu phiếu vào đây
                    </p>
                    <p className="text-xs text-slate-400">
                      Hỗ trợ tệp <span className="font-semibold text-slate-200">.PDF</span>, <span className="font-semibold text-slate-200">.PNG</span>, <span className="font-semibold text-slate-200">.JPG</span> (Khổ A4, A5, Letter)
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                  >
                    Chọn tệp PDF từ máy tính
                  </button>
                </>
              )}
            </div>
          ) : (
            /* File is loaded, Show 2-Column Inspector & Config */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: PDF Live Visual Canvas Preview & Overlay (5 Cols) */}
              <div className="lg:col-span-5 bg-black/40 rounded-3xl border border-white/10 p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5 truncate max-w-[200px]">
                      <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="truncate">{uploadedFile?.name}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowZoneOverlay(!showZoneOverlay)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition cursor-pointer flex items-center gap-1 ${
                          showZoneOverlay ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-slate-400'
                        }`}
                        title="Bật/Tắt hiển thị các ô tròn nhận diện OMR trên ảnh"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Ô tròn</span>
                      </button>
                      <button
                        onClick={() => {
                          setPdfPages([]);
                          setUploadedFile(null);
                        }}
                        className="text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
                      >
                        Đổi file
                      </button>
                    </div>
                  </div>

                  {/* Interactive Live Canvas Preview Container */}
                  <div className="mt-3 relative rounded-2xl overflow-hidden bg-slate-900 border border-white/10 max-h-[380px] min-h-[280px] flex items-center justify-center group">
                    <canvas
                      ref={previewCanvasRef}
                      className="w-full h-auto max-h-[380px] object-contain cursor-zoom-in"
                      onClick={() => setShowFullPreview(true)}
                    />
                    <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-mono text-cyan-300 border border-white/10 flex items-center gap-1.5 pointer-events-none">
                      <span>Trang {selectedPageIndex + 1} / {pdfPages.length}</span>
                    </div>

                    {/* Quick Full-Screen View Button */}
                    <button
                      onClick={() => setShowFullPreview(true)}
                      className="absolute bottom-2 right-2 px-2.5 py-1 rounded-xl bg-black/80 hover:bg-cyan-500 hover:text-black text-cyan-300 backdrop-blur-md text-[11px] font-bold border border-white/10 flex items-center gap-1.5 transition cursor-pointer shadow-lg"
                      title="Phóng to để kiểm tra toàn bộ chi tiết câu hỏi, tiêu đề và bảng biểu"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Xem toàn bộ phiếu</span>
                    </button>
                  </div>
                </div>

                {/* Multiple Pages Selector if PDF has > 1 page */}
                {pdfPages.length > 1 && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
                    <span className="text-slate-400 text-[11px]">Chọn trang làm mẫu phiếu:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePageChange(Math.max(0, selectedPageIndex - 1))}
                        disabled={selectedPageIndex === 0 || isAutoDetecting}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 transition cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="font-mono text-cyan-300 font-bold px-2">
                        {selectedPageIndex + 1} / {pdfPages.length}
                      </span>
                      <button
                        onClick={() => handlePageChange(Math.min(pdfPages.length - 1, selectedPageIndex + 1))}
                        disabled={selectedPageIndex === pdfPages.length - 1 || isAutoDetecting}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 transition cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Configuration Form (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* Auto Detection Badge / Status */}
                {isAutoDetecting ? (
                  <div className="p-3.5 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl flex items-center justify-between text-cyan-300 text-xs animate-pulse">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                      <span>Đang tự động quét & nhận diện ma trận ô tròn từ file mẫu...</span>
                    </div>
                  </div>
                ) : detectedResult ? (
                  <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        Tự động nhận diện cấu trúc phiếu OMR chuẩn xác
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {detectedResult.rawCirclesCount > 0 ? `${detectedResult.rawCirclesCount} ô tròn tìm thấy` : 'Ma trận chuẩn'}
                        </span>
                        <button
                          onClick={handleReRunDetection}
                          disabled={isAutoDetecting}
                          className="px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Quét lại</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-300 flex-wrap">
                      <span>• Phát hiện: <strong className="text-white">{detectedResult.numQuestions} câu</strong></span>
                      <span>• Lựa chọn: <strong className="text-white">{detectedResult.numOptions} đáp án</strong></span>
                      <span>• Cột: <strong className="text-white">{detectedResult.columnsCount} cột ({Math.ceil(detectedResult.numQuestions / detectedResult.columnsCount)} câu/cột)</strong></span>
                      <span>• Bán kính: <strong className="text-cyan-300 font-mono">R={detectedResult.averageRadius}px</strong></span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20 text-[11px]">
                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useAiDetectedZones}
                          onChange={(e) => setUseAiDetectedZones(e.target.checked)}
                          className="rounded border-white/20 text-emerald-500 focus:ring-0"
                        />
                        <span>Khớp tọa độ trực tiếp từ ô tròn AI phát hiện</span>
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Tên mẫu phiếu *
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="VD: Phiếu trắc nghiệm 60 câu FPT Schools"
                      className="w-full text-xs font-semibold border border-white/10 rounded-xl p-2.5 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Tên trường / Đơn vị
                      </label>
                      <input
                        type="text"
                        value={localSchool}
                        onChange={(e) => setLocalSchool(e.target.value)}
                        className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-white/5 text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Khổ giấy PDF
                      </label>
                      <select
                        value={paperSize}
                        onChange={(e) => setPaperSize(e.target.value as 'A4' | 'A5' | 'Letter')}
                        className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-[#0B0F17] text-white focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="A4">Khổ A4 (Chuẩn)</option>
                        <option value="A5">Khổ A5 (Nửa tờ)</option>
                        <option value="Letter">Khổ Letter</option>
                      </select>
                    </div>
                  </div>

                  {/* Question & Grid Specs */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-400 block uppercase tracking-wider flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5" />
                        Cấu hình ma trận câu hỏi:
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {Math.ceil(numQuestions / columnsCount)} câu/cột
                      </span>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-slate-400 mr-1">Mẫu nhanh:</span>
                      {[
                        { q: 20, col: 1, label: '20 câu (1 cột)' },
                        { q: 40, col: 2, label: '40 câu (2 cột)' },
                        { q: 50, col: 2, label: '50 câu (2 cột)' },
                        { q: 60, col: 4, label: '60 câu (4 cột - FPT)' },
                        { q: 80, col: 4, label: '80 câu (4 cột)' },
                        { q: 100, col: 4, label: '100 câu (4 cột)' },
                        { q: 120, col: 4, label: '120 câu (4 cột)' }
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setNumQuestions(preset.q);
                            setColumnsCount(preset.col);
                            setNumOptions(4);
                            setUseAiDetectedZones(false);
                            setOffsetX(0);
                            setOffsetY(0);
                          }}
                          className={`px-2 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                            numQuestions === preset.q && columnsCount === preset.col
                              ? 'bg-cyan-500 text-black shadow-sm'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Số câu hỏi:
                        </label>
                        <select
                          value={numQuestions}
                          onChange={(e) => {
                            setNumQuestions(parseInt(e.target.value, 10));
                            setUseAiDetectedZones(false);
                          }}
                          className="w-full text-xs border border-white/10 rounded-xl p-2 bg-[#0B0F17] text-white font-bold"
                        >
                          <option value="10">10 câu</option>
                          <option value="20">20 câu</option>
                          <option value="30">30 câu</option>
                          <option value="40">40 câu (Phổ biến)</option>
                          <option value="50">50 câu</option>
                          <option value="60">60 câu (Chuẩn FPT)</option>
                          <option value="80">80 câu</option>
                          <option value="100">100 câu</option>
                          <option value="120">120 câu</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Lựa chọn/câu:
                        </label>
                        <select
                          value={numOptions}
                          onChange={(e) => {
                            setNumOptions(parseInt(e.target.value, 10));
                            setUseAiDetectedZones(false);
                          }}
                          className="w-full text-xs border border-white/10 rounded-xl p-2 bg-[#0B0F17] text-white font-bold"
                        >
                          <option value="2">2 đáp án (Đúng / Sai)</option>
                          <option value="3">3 đáp án (A, B, C)</option>
                          <option value="4">4 đáp án (A, B, C, D)</option>
                          <option value="5">5 đáp án (A, B, C, D, E)</option>
                          <option value="6">6 đáp án (A, B, C, D, E, F)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Số cột bố cục:
                        </label>
                        <select
                          value={columnsCount}
                          onChange={(e) => {
                            setColumnsCount(parseInt(e.target.value, 10));
                            setUseAiDetectedZones(false);
                          }}
                          className="w-full text-xs border border-white/10 rounded-xl p-2 bg-[#0B0F17] text-white font-bold"
                        >
                          <option value="1">1 Cột</option>
                          <option value="2">2 Cột (Chuẩn BGD)</option>
                          <option value="3">3 Cột</option>
                          <option value="4">4 Cột (Chuẩn FPT 60c)</option>
                          <option value="5">5 Cột</option>
                        </select>
                      </div>
                    </div>

                    {/* Fine-Tuning Alignment Controls */}
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-300 flex items-center gap-1">
                          <Move className="w-3.5 h-3.5 text-cyan-400" />
                          Tinh chỉnh độ khớp vị trí ô tròn:
                        </span>
                        <button
                          onClick={() => {
                            setOffsetX(0);
                            setOffsetY(0);
                            setBubbleScale(1.0);
                          }}
                          className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                        >
                          Đặt lại vị trí gốc
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setOffsetY(prev => Number((prev - 0.005).toFixed(4)))}
                            className="flex-1 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white text-[10px] font-bold"
                            title="Dịch toàn bộ ô tròn lên trên"
                          >
                            ↑ Lên
                          </button>
                          <button
                            type="button"
                            onClick={() => setOffsetY(prev => Number((prev + 0.005).toFixed(4)))}
                            className="flex-1 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white text-[10px] font-bold"
                            title="Dịch toàn bộ ô tròn xuống dưới"
                          >
                            ↓ Xuống
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setOffsetX(prev => Number((prev - 0.005).toFixed(4)))}
                            className="flex-1 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white text-[10px] font-bold"
                            title="Dịch toàn bộ ô tròn sang trái"
                          >
                            ← Trái
                          </button>
                          <button
                            type="button"
                            onClick={() => setOffsetX(prev => Number((prev + 0.005).toFixed(4)))}
                            className="flex-1 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white text-[10px] font-bold"
                            title="Dịch toàn bộ ô tròn sang phải"
                          >
                            → Phải
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setBubbleScale(prev => Math.max(0.7, Number((prev - 0.05).toFixed(2))))}
                            className="flex-1 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white text-[10px] font-bold"
                            title="Thu nhỏ kích thước ô tròn"
                          >
                            - Kích cỡ
                          </button>
                          <button
                            type="button"
                            onClick={() => setBubbleScale(prev => Math.min(1.5, Number((prev + 0.05).toFixed(2))))}
                            className="flex-1 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white text-[10px] font-bold"
                            title="Phóng to kích thước ô tròn"
                          >
                            + Kích cỡ
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 text-xs border-t border-white/10">
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasQrCode}
                          onChange={(e) => setHasQrCode(e.target.checked)}
                          className="rounded border-white/20 text-cyan-500 focus:ring-0"
                        />
                        <span>Có vùng QR định danh HS</span>
                      </label>

                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasAnchorMarks}
                          onChange={(e) => setHasAnchorMarks(e.target.checked)}
                          className="rounded border-white/20 text-cyan-500 focus:ring-0"
                        />
                        <span>Có 4 điểm neo định vị góc</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer"
          >
            Hủy bỏ
          </button>

          {pdfPages.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCreateTemplate(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Mở trong Studio hiệu chỉnh</span>
              </button>

              <button
                id="btn-save-pdf-template"
                onClick={() => handleCreateTemplate(false)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Tạo mẫu từ PDF & Tự động tạo lưới OMR</span>
              </button>
            </div>
          )}
        </div>

        {/* Full-Screen PDF Sheet Lightbox Preview */}
        {showFullPreview && pdfPages[selectedPageIndex] && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col p-4">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border border-white/10 rounded-2xl mb-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  {uploadedFile?.name} (Trang {selectedPageIndex + 1} / {pdfPages.length})
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {pdfPages[selectedPageIndex].width} × {pdfPages[selectedPageIndex].height} px
                </span>
              </div>

              {/* Lightbox Zoom Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalZoom(prev => Math.max(0.4, Number((prev - 0.2).toFixed(2))))}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition cursor-pointer"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold text-cyan-400 min-w-[45px] text-center">
                  {Math.round(modalZoom * 100)}%
                </span>
                <button
                  onClick={() => setModalZoom(prev => Math.min(3.0, Number((prev + 0.2).toFixed(2))))}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition cursor-pointer"
                  title="Phóng to"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setModalZoom(1.0)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono transition cursor-pointer"
                >
                  100%
                </button>
                <div className="w-px h-5 bg-white/20 mx-1" />
                <button
                  onClick={() => setShowFullPreview(false)}
                  className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition cursor-pointer"
                  title="Đóng xem trước"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[#050811] rounded-2xl border border-white/10">
              <div 
                style={{ transform: `scale(${modalZoom})`, transformOrigin: 'center center' }}
                className="transition-transform duration-100 shadow-2xl bg-white rounded-lg p-1"
              >
                <img
                  src={pdfPages[selectedPageIndex].dataUrl}
                  alt={`Trang ${selectedPageIndex + 1}`}
                  className="max-h-[85vh] w-auto object-contain rounded"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
