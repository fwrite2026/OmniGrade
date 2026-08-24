import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { AnswerSheetTemplate, BubbleOption, RecognitionZone, ZoneType, CustomTemplateField, CustomTemplateLayoutConfig } from '../../types';
import { DEFAULT_120_TEMPLATE } from '../../services/demoData';
import { generateAutoGridZones, renderTemplateToCanvas, getTemplateRealStats, rebuildSbdZones, rebuildExamCodeZones, rebuildQuestionMatrixZones } from '../../services/templateGenerator';
import { processUploadedFileToImages, PdfPageResult } from '../../services/pdfService';
import { detectBubblesFromImageData } from '../../services/bubbleDetection';
import { TemplatePrintModal } from './TemplatePrintModal';
import {
  Save,
  Printer,
  MousePointer,
  CircleDot,
  Grid,
  QrCode,
  Crosshair,
  Trash2,
  Plus,
  Upload,
  Sparkles,
  Sliders,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle,
  HelpCircle,
  FileUp,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Move,
  Maximize2,
  Minimize2,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignCenter,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyCenter,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyEnd,
  Undo2,
  Redo2,
  Magnet,
  Copy,
  Layers,
  BoxSelect,
  ArrowDownUp,
  ArrowLeftRight,
  CheckSquare,
  ListOrdered,
  Type,
  Shuffle,
  Table2,
  FileText,
  Building2,
  GraduationCap,
  Calendar,
  Clock,
  UserCheck,
  Columns,
  Hash,
  SlidersHorizontal,
  Edit3,
  X,
  ChevronUp,
  ChevronDown,
  Palette,
  Paintbrush,
  Award,
  CornerDownLeft,
  Bold,
  Italic
} from 'lucide-react';

interface TemplateEditorProps {
  initialTemplateId?: string;
  onBack: () => void;
}

type DragMode = 'single' | 'row' | 'column' | 'all';
type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'center' | null;

interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ initialTemplateId, onBack }) => {
  const { t, templates, activeTemplate, addTemplate, updateTemplate, setActiveTemplateId } = useApp();

  const [currentTemplate, setCurrentTemplate] = useState<AnswerSheetTemplate>(() => {
    if (initialTemplateId) {
      const found = templates.find(tpl => tpl.id === initialTemplateId);
      if (found) return found;
    }
    return activeTemplate || templates[0] || DEFAULT_120_TEMPLATE;
  });

  // Multi-Selection State
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<'select' | 'marquee' | 'bubble' | 'qr' | 'anchor'>('select');
  const [dragMode, setDragMode] = useState<DragMode>('single');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [customBgImage, setCustomBgImage] = useState<string | null>(currentTemplate?.backgroundImageUrl || null);
  const [isAutoDetecting, setIsAutoDetecting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  // Marquee Drag Selection
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState<boolean>(false);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);

  // Undo / Redo History
  const [history, setHistory] = useState<RecognitionZone[][]>([currentTemplate?.zones || []]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Sync state if initialTemplateId changes or is provided
  useEffect(() => {
    if (initialTemplateId) {
      const found = templates.find(tpl => tpl.id === initialTemplateId);
      if (found) {
        setCurrentTemplate(found);
        setCustomBgImage(found.backgroundImageUrl || null);
        setHistory([found.zones || []]);
        setHistoryIndex(0);
        setSelectedZoneIds([]);
      }
    }
  }, [initialTemplateId, templates]);

  // PDF background navigation
  const [isUploadingBg, setIsUploadingBg] = useState<boolean>(false);
  const [loadedPdfPages, setLoadedPdfPages] = useState<PdfPageResult[]>([]);
  const [currentPdfPageIndex, setCurrentPdfPageIndex] = useState<number>(0);

  // Dragging & Interaction State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialZonesState, setInitialZonesState] = useState<RecognitionZone[]>([]);
  const [cursorStyle, setCursorStyle] = useState<string>('default');

  // Batch Editing Inputs State
  const [batchStartQuestion, setBatchStartQuestion] = useState<number>(1);
  const [batchTargetQuestion, setBatchTargetQuestion] = useState<number>(1);
  const [batchOptionChoice, setBatchOptionChoice] = useState<BubbleOption>('A');

  // Canvas Dynamic Dimensions & Aspect Ratio
  const [canvasDims, setCanvasDims] = useState<{ width: number; height: number; displayWidth: number; displayHeight: number }>({
    width: 1200,
    height: 1697,
    displayWidth: 650,
    displayHeight: 920
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Measure natural aspect ratio of background image
  useEffect(() => {
    if (customBgImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (img.width > 0 && img.height > 0) {
          const aspect = img.width / img.height;
          const canvasW = 1200;
          const canvasH = Math.round(canvasW / aspect);
          const dispW = 650;
          const dispH = Math.round(dispW / aspect);
          setCanvasDims({
            width: canvasW,
            height: canvasH,
            displayWidth: dispW,
            displayHeight: dispH
          });
        }
      };
      img.src = customBgImage;
    }
  }, [customBgImage]);

  // Fit to screen handler
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const availWidth = containerRef.current.clientWidth - 48;
    const availHeight = containerRef.current.clientHeight - 90;
    if (availWidth <= 0 || availHeight <= 0) return;

    const scaleX = availWidth / canvasDims.displayWidth;
    const scaleY = availHeight / canvasDims.displayHeight;
    const fitScale = Math.min(scaleX, scaleY);
    const clampedScale = Math.max(0.25, Math.min(1.4, Number(fitScale.toFixed(2))));
    setZoomLevel(clampedScale);
    setStatusMessage(`Đã căn vừa toàn bộ phiếu vào màn hình (${Math.round(clampedScale * 100)}%)`);
  }, [canvasDims]);

  const handleFitWidth = useCallback(() => {
    if (!containerRef.current) return;
    const availWidth = containerRef.current.clientWidth - 48;
    if (availWidth <= 0) return;
    const scaleX = availWidth / canvasDims.displayWidth;
    const clamped = Math.max(0.3, Math.min(2.0, Number(scaleX.toFixed(2))));
    setZoomLevel(clamped);
    setStatusMessage(`Đã căn vừa chiều rộng (${Math.round(clamped * 100)}%)`);
  }, [canvasDims]);

  // Auto-fit on initial load and when image changes
  useEffect(() => {
    const timer = setTimeout(() => {
      handleFitToScreen();
    }, 120);
    return () => clearTimeout(timer);
  }, [handleFitToScreen]);

  // Auto grid modal dialog
  const [autoGridConfig, setAutoGridConfig] = useState({
    numQuestions: currentTemplate.numQuestions || 40,
    numOptions: currentTemplate.numOptions || 4,
    columnsCount: currentTemplate.columnsCount || 2,
    direction: 'column_first' as 'column_first' | 'row_first',
    startQuestion: 1,
    yStart: 0.28,
    yEnd: 0.95,
    xStart: 0.06,
    xEnd: 0.94
  });
  const [showAutoGridModal, setShowAutoGridModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'tables' | 'info' | 'styling' | 'omr'>('tables');

  // Direct layout update helper
  const updateLayoutConfig = useCallback((changes: Partial<CustomTemplateLayoutConfig>) => {
    setCurrentTemplate(prev => ({
      ...prev,
      layoutConfig: {
        ...(prev.layoutConfig || {}),
        ...changes
      }
    }));
  }, []);

  // Push state to history
  const pushHistory = useCallback((newZones: RecognitionZone[]) => {
    setHistory(prev => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      return [...upToCurrent, newZones];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // SBD Table Controls
  const handleToggleSbd = useCallback((enable: boolean) => {
    const numDigits = currentTemplate.layoutConfig?.numStudentIdDigits || currentTemplate.numIdDigits || 6;
    if (enable) {
      const newZones = rebuildSbdZones(currentTemplate.zones, numDigits, 0.53, 0.045, 0.20, 0.25);
      setCurrentTemplate(prev => ({
        ...prev,
        hasStudentIdBubbles: true,
        numIdDigits: numDigits,
        layoutConfig: {
          ...(prev.layoutConfig || {}),
          showStudentIdBubbles: true,
          numStudentIdDigits: numDigits
        },
        zones: newZones
      }));
      pushHistory(newZones);
      setStatusMessage(`Đã bật bảng Số Báo Danh (${numDigits} chữ số)`);
    } else {
      const newZones = currentTemplate.zones.filter(z => z.type !== 'student_id_bubble');
      setCurrentTemplate(prev => ({
        ...prev,
        hasStudentIdBubbles: false,
        layoutConfig: {
          ...(prev.layoutConfig || {}),
          showStudentIdBubbles: false
        },
        zones: newZones
      }));
      pushHistory(newZones);
      setStatusMessage('Đã tắt bảng Số Báo Danh');
    }
  }, [currentTemplate, pushHistory]);

  const handleSetSbdDigits = useCallback((digits: number) => {
    const clamped = Math.max(2, Math.min(10, digits));
    const sbdZones = currentTemplate.zones.filter(z => z.type === 'student_id_bubble');
    const minX = sbdZones.length > 0 ? Math.min(...sbdZones.map(z => z.x)) : 0.53;
    const minY = sbdZones.length > 0 ? Math.min(...sbdZones.map(z => z.y)) - 0.05 : 0.045;
    const maxX = sbdZones.length > 0 ? Math.max(...sbdZones.map(z => z.x + z.width)) : (minX + 0.20);
    const width = Math.max(0.10, maxX - minX);

    const newZones = rebuildSbdZones(currentTemplate.zones, clamped, minX, minY, width, 0.25);
    setCurrentTemplate(prev => ({
      ...prev,
      hasStudentIdBubbles: true,
      numIdDigits: clamped,
      layoutConfig: {
        ...(prev.layoutConfig || {}),
        showStudentIdBubbles: true,
        numStudentIdDigits: clamped
      },
      zones: newZones
    }));
    pushHistory(newZones);
    setStatusMessage(`Đã cập nhật Bảng SBD thành ${clamped} chữ số`);
  }, [currentTemplate, pushHistory]);

  const handleMoveSbd = useCallback((deltaX: number, deltaY: number) => {
    const sbdZones = currentTemplate.zones.filter(z => z.type === 'student_id_bubble');
    if (sbdZones.length === 0) return;
    const newZones = currentTemplate.zones.map(z => {
      if (z.type === 'student_id_bubble') {
        return {
          ...z,
          x: Math.max(0.01, Math.min(0.95, Number((z.x + deltaX).toFixed(4)))),
          y: Math.max(0.01, Math.min(0.95, Number((z.y + deltaY).toFixed(4))))
        };
      }
      return z;
    });
    setCurrentTemplate(prev => ({ ...prev, zones: newZones }));
    pushHistory(newZones);
    setStatusMessage('Đã dịch chuyển Bảng Số Báo Danh');
  }, [currentTemplate, pushHistory]);

  // Exam Code Table Controls
  const handleToggleExamCode = useCallback((enable: boolean) => {
    const numDigits = currentTemplate.layoutConfig?.numExamCodeDigits || currentTemplate.numExamCodeDigits || 3;
    if (enable) {
      const newZones = rebuildExamCodeZones(currentTemplate.zones, numDigits, 0.74, 0.045, 0.12, 0.25);
      setCurrentTemplate(prev => ({
        ...prev,
        hasExamCodeBubbles: true,
        numExamCodeDigits: numDigits,
        layoutConfig: {
          ...(prev.layoutConfig || {}),
          showExamCodeBubbles: true,
          numExamCodeDigits: numDigits
        },
        zones: newZones
      }));
      pushHistory(newZones);
      setStatusMessage(`Đã bật bảng Mã Đề Thi (${numDigits} chữ số)`);
    } else {
      const newZones = currentTemplate.zones.filter(z => z.type !== 'exam_code_bubble');
      setCurrentTemplate(prev => ({
        ...prev,
        hasExamCodeBubbles: false,
        layoutConfig: {
          ...(prev.layoutConfig || {}),
          showExamCodeBubbles: false
        },
        zones: newZones
      }));
      pushHistory(newZones);
      setStatusMessage('Đã tắt bảng Mã Đề Thi');
    }
  }, [currentTemplate, pushHistory]);

  const handleSetExamCodeDigits = useCallback((digits: number) => {
    const clamped = Math.max(2, Math.min(6, digits));
    const codeZones = currentTemplate.zones.filter(z => z.type === 'exam_code_bubble');
    const minX = codeZones.length > 0 ? Math.min(...codeZones.map(z => z.x)) : 0.74;
    const minY = codeZones.length > 0 ? Math.min(...codeZones.map(z => z.y)) - 0.05 : 0.045;
    const maxX = codeZones.length > 0 ? Math.max(...codeZones.map(z => z.x + z.width)) : (minX + 0.12);
    const width = Math.max(0.08, maxX - minX);

    const newZones = rebuildExamCodeZones(currentTemplate.zones, clamped, minX, minY, width, 0.25);
    setCurrentTemplate(prev => ({
      ...prev,
      hasExamCodeBubbles: true,
      numExamCodeDigits: clamped,
      layoutConfig: {
        ...(prev.layoutConfig || {}),
        showExamCodeBubbles: true,
        numExamCodeDigits: clamped
      },
      zones: newZones
    }));
    pushHistory(newZones);
    setStatusMessage(`Đã cập nhật Bảng Mã Đề thành ${clamped} chữ số`);
  }, [currentTemplate, pushHistory]);

  const handleMoveExamCode = useCallback((deltaX: number, deltaY: number) => {
    const codeZones = currentTemplate.zones.filter(z => z.type === 'exam_code_bubble');
    if (codeZones.length === 0) return;
    const newZones = currentTemplate.zones.map(z => {
      if (z.type === 'exam_code_bubble') {
        return {
          ...z,
          x: Math.max(0.01, Math.min(0.95, Number((z.x + deltaX).toFixed(4)))),
          y: Math.max(0.01, Math.min(0.95, Number((z.y + deltaY).toFixed(4))))
        };
      }
      return z;
    });
    setCurrentTemplate(prev => ({ ...prev, zones: newZones }));
    pushHistory(newZones);
    setStatusMessage('Đã dịch chuyển Bảng Mã Đề Thi');
  }, [currentTemplate, pushHistory]);

  // Question Matrix Controls
  const handleApplyQuestionGridConfig = useCallback((
    numQ?: number,
    numOpt?: number,
    cols?: number,
    dir?: 'column_first' | 'row_first',
    yStart?: number,
    yEnd?: number,
    xStart?: number,
    xEnd?: number
  ) => {
    const qCount = numQ ?? currentTemplate.numQuestions ?? 40;
    const optCount = numOpt ?? currentTemplate.numOptions ?? 4;
    const colCount = cols ?? currentTemplate.columnsCount ?? 2;
    const direction = dir ?? currentTemplate.layoutConfig?.direction ?? 'column_first';
    const startY = yStart ?? (currentTemplate.layoutConfig?.questionGridYStart ?? 0.32);
    const endY = yEnd ?? (currentTemplate.layoutConfig?.questionGridYEnd ?? 0.96);
    const startX = xStart ?? (currentTemplate.layoutConfig?.questionGridXStart ?? 0.045);
    const endX = xEnd ?? (currentTemplate.layoutConfig?.questionGridXEnd ?? 0.955);

    const newZones = rebuildQuestionMatrixZones(
      currentTemplate.zones,
      qCount,
      optCount,
      colCount,
      direction,
      startY,
      endY,
      startX,
      endX
    );

    setCurrentTemplate(prev => ({
      ...prev,
      numQuestions: qCount,
      numOptions: optCount,
      columnsCount: colCount,
      layoutConfig: {
        ...(prev.layoutConfig || {}),
        direction,
        questionGridYStart: startY,
        questionGridYEnd: endY,
        questionGridXStart: startX,
        questionGridXEnd: endX
      },
      zones: newZones
    }));
    pushHistory(newZones);
    setStatusMessage(`Đã tái tạo lưới câu hỏi: ${qCount} câu, ${colCount} cột (${direction === 'column_first' ? 'Dọc theo cột' : 'Ngang hàng'})`);
  }, [currentTemplate, pushHistory]);

  // Custom Fields Handler (Student Box)
  const handleAddCustomField = useCallback(() => {
    const newField: CustomTemplateField = {
      id: `cf_${Date.now()}`,
      label: 'Thông tin mới',
      value: ''
    };
    const currentFields = currentTemplate.layoutConfig?.customFields || [];
    updateLayoutConfig({
      customFields: [...currentFields, newField]
    });
    setStatusMessage('Đã thêm trường thông tin cho Khung Thí sinh');
  }, [currentTemplate, updateLayoutConfig]);

  const handleUpdateCustomField = useCallback((id: string, label: string, value?: string, newline?: boolean) => {
    const currentFields = currentTemplate.layoutConfig?.customFields || [];
    const updated = currentFields.map(f => f.id === id ? { ...f, label, value, newline: newline !== undefined ? newline : f.newline } : f);
    updateLayoutConfig({ customFields: updated });
  }, [currentTemplate, updateLayoutConfig]);

  const handleDeleteCustomField = useCallback((id: string) => {
    const currentFields = currentTemplate.layoutConfig?.customFields || [];
    const updated = currentFields.filter(f => f.id !== id);
    updateLayoutConfig({ customFields: updated });
    setStatusMessage('Đã xóa trường thông tin');
  }, [currentTemplate, updateLayoutConfig]);

  // Header Custom Fields Handlers
  const handleAddHeaderCustomField = useCallback(() => {
    const newField: CustomTemplateField = {
      id: `hcf_${Date.now()}`,
      label: 'Học kỳ',
      value: '1',
      newline: false
    };
    const currentFields = currentTemplate.layoutConfig?.headerCustomFields || [];
    updateLayoutConfig({
      headerCustomFields: [...currentFields, newField]
    });
    setStatusMessage('Đã thêm trường thông tin chung');
  }, [currentTemplate, updateLayoutConfig]);

  const handleUpdateHeaderCustomField = useCallback((id: string, label: string, value?: string, newline?: boolean) => {
    const currentFields = currentTemplate.layoutConfig?.headerCustomFields || [];
    const updated = currentFields.map(f => f.id === id ? { ...f, label, value, newline: newline !== undefined ? newline : f.newline } : f);
    updateLayoutConfig({ headerCustomFields: updated });
  }, [currentTemplate, updateLayoutConfig]);

  const handleDeleteHeaderCustomField = useCallback((id: string) => {
    const currentFields = currentTemplate.layoutConfig?.headerCustomFields || [];
    const updated = currentFields.filter(f => f.id !== id);
    updateLayoutConfig({ headerCustomFields: updated });
    setStatusMessage('Đã xóa trường thông tin chung');
  }, [currentTemplate, updateLayoutConfig]);

  // Score Box Custom Fields Handlers
  const handleAddScoreBoxCustomField = useCallback(() => {
    const newField: CustomTemplateField = {
      id: `scf_${Date.now()}`,
      label: 'Ghi chú',
      value: ''
    };
    const currentFields = currentTemplate.layoutConfig?.scoreBoxCustomFields || [];
    updateLayoutConfig({
      scoreBoxCustomFields: [...currentFields, newField]
    });
    setStatusMessage('Đã thêm trường vào Khung Điểm số');
  }, [currentTemplate, updateLayoutConfig]);

  const handleUpdateScoreBoxCustomField = useCallback((id: string, label: string, value?: string) => {
    const currentFields = currentTemplate.layoutConfig?.scoreBoxCustomFields || [];
    const updated = currentFields.map(f => f.id === id ? { ...f, label, value } : f);
    updateLayoutConfig({ scoreBoxCustomFields: updated });
  }, [currentTemplate, updateLayoutConfig]);

  const handleDeleteScoreBoxCustomField = useCallback((id: string) => {
    const currentFields = currentTemplate.layoutConfig?.scoreBoxCustomFields || [];
    const updated = currentFields.filter(f => f.id !== id);
    updateLayoutConfig({ scoreBoxCustomFields: updated });
    setStatusMessage('Đã xóa trường ở Khung Điểm số');
  }, [currentTemplate, updateLayoutConfig]);

  // Selected Zones Helper
  const selectedZones = currentTemplate.zones.filter(z => selectedZoneIds.includes(z.id));
  const singleSelectedZone = selectedZones.length === 1 ? selectedZones[0] : null;

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      const prevZones = history[newIdx];
      setHistoryIndex(newIdx);
      setCurrentTemplate(prev => ({ ...prev, zones: prevZones }));
      setStatusMessage('Đã hoàn tác (Undo)');
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      const nextZones = history[newIdx];
      setHistoryIndex(newIdx);
      setCurrentTemplate(prev => ({ ...prev, zones: nextZones }));
      setStatusMessage('Đã làm lại (Redo)');
    }
  }, [history, historyIndex]);

  // Global Bubble Size Scaling
  const handleScaleAllBubbles = (scalePercent: number) => {
    const scaleFactor = scalePercent / 100;
    const targetZones = selectedZoneIds.length > 0 ? selectedZoneIds : null;

    const updated = currentTemplate.zones.map(z => {
      if ((targetZones ? targetZones.includes(z.id) : true) && (z.type === 'bubble' || z.type === 'student_id_bubble' || z.type === 'exam_code_bubble')) {
        const baseW = 0.024 * scaleFactor;
        const baseH = 0.03 * scaleFactor;
        return {
          ...z,
          width: Number(baseW.toFixed(4)),
          height: Number(baseH.toFixed(4))
        };
      }
      return z;
    });

    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã điều chỉnh kích thước ${targetZones ? `${targetZones.length} ô đã chọn` : 'toàn bộ ô'}: ${scalePercent}%`);
  };

  // Render canvas with high resolution and interactive bounding boxes
  useEffect(() => {
    let isCancelled = false;

    const render = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvasDims.width;
      const height = canvasDims.height;
      canvas.width = width;
      canvas.height = height;

      // 1. Draw background
      if (customBgImage) {
        const bgImg = new Image();
        bgImg.crossOrigin = 'anonymous';
        bgImg.onload = () => {
          if (!isCancelled) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(bgImg, 0, 0, width, height);
            drawZonesAndSelection(ctx, width, height);
          }
        };
        bgImg.onerror = () => {
          if (!isCancelled) {
            renderTemplateToCanvas(currentTemplate, undefined, '101', 'BÀI THI TRẮC NGHIỆM', width, height).then(renderedCanvas => {
              if (!isCancelled) {
                ctx.drawImage(renderedCanvas, 0, 0, width, height);
                drawZonesAndSelection(ctx, width, height);
              }
            });
          }
        };
        bgImg.src = customBgImage;
      } else {
        const renderedCanvas = await renderTemplateToCanvas(currentTemplate, undefined, '101', 'BÀI THI TRẮC NGHIỆM', width, height);
        if (!isCancelled) {
          ctx.drawImage(renderedCanvas, 0, 0, width, height);
          drawZonesAndSelection(ctx, width, height);
        }
      }
    };

    render();
    return () => {
      isCancelled = true;
    };
  }, [currentTemplate, selectedZoneIds, customBgImage, isDragging, dragMode, isMarqueeSelecting, marqueeRect, canvasDims]);

  // Draw overlay recognition zones and interactive handles
  const drawZonesAndSelection = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const selectedIdsSet = new Set(selectedZoneIds);
    const selectedQNum = singleSelectedZone?.questionNumber;

    // 1. Draw All Recognition Zones
    currentTemplate.zones.forEach((zone) => {
      const zX = zone.x * width;
      const zY = zone.y * height;
      const zW = zone.width * width;
      const zH = zone.height * height;
      const isSelected = selectedIdsSet.has(zone.id);
      const isInSameRow = selectedQNum && zone.questionNumber === selectedQNum && !isSelected;

      ctx.save();
      if (zone.type === 'bubble' || zone.type === 'student_id_bubble' || zone.type === 'exam_code_bubble') {
        if (isSelected) {
          ctx.strokeStyle = '#EF4444'; // Red for selected
          ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.lineWidth = 3;
        } else if (isInSameRow && dragMode === 'row') {
          ctx.strokeStyle = '#F59E0B'; // Amber for same row
          ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
          ctx.lineWidth = 2;
        } else if (zone.type === 'exam_code_bubble') {
          ctx.strokeStyle = '#3B82F6'; // Blue for exam code
          ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
          ctx.lineWidth = 1.5;
        } else if (zone.type === 'student_id_bubble') {
          ctx.strokeStyle = '#10B981'; // Emerald for student ID
          ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
          ctx.lineWidth = 1.5;
        } else {
          ctx.strokeStyle = '#06B6D4'; // Cyan for regular answer bubble
          ctx.fillStyle = 'rgba(6, 182, 212, 0.16)';
          ctx.lineWidth = 1.5;
        }

        ctx.beginPath();
        ctx.arc(zX + zW / 2, zY + zH / 2, Math.min(zW, zH) / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label
        if (isSelected || isInSameRow) {
          ctx.fillStyle = isSelected ? '#EF4444' : '#F59E0B';
          ctx.font = 'bold 14px sans-serif';
          if (zone.type === 'exam_code_bubble') {
            ctx.fillText(`Mã[${zone.digitPosition ?? 0}]=${zone.digitValue ?? 0}`, zX, zY - 5);
          } else if (zone.type === 'student_id_bubble') {
            ctx.fillText(`SBD[${zone.digitPosition ?? 0}]=${zone.digitValue ?? 0}`, zX, zY - 5);
          } else {
            ctx.fillText(`Q${zone.questionNumber || '?'}-${zone.option || 'A'}`, zX, zY - 5);
          }
        }
      } else if (zone.type === 'student_id_qr') {
        ctx.strokeStyle = isSelected ? '#EF4444' : '#10B981';
        ctx.fillStyle = isSelected ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.18)';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(zX, zY, zW, zH);
        ctx.fillRect(zX, zY, zW, zH);

        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('QR Code Zone', zX + 8, zY + 22);
      } else if (zone.type === 'anchor_mark') {
        ctx.strokeStyle = isSelected ? '#EF4444' : '#8B5CF6';
        ctx.fillStyle = isSelected ? 'rgba(239, 68, 68, 0.35)' : 'rgba(139, 92, 246, 0.25)';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(zX, zY, zW, zH);
        ctx.fillRect(zX, zY, zW, zH);
      }
      ctx.restore();
    });

    // 2. Draw Collective Bounding Box for Selected Zones
    if (selectedZones.length > 0) {
      const minX = Math.min(...selectedZones.map(z => z.x)) * width;
      const minY = Math.min(...selectedZones.map(z => z.y)) * height;
      const maxX = Math.max(...selectedZones.map(z => z.x + z.width)) * width;
      const maxY = Math.max(...selectedZones.map(z => z.y + z.height)) * height;
      const boxW = maxX - minX;
      const boxH = maxY - minY;

      ctx.save();
      // Outer collective bounding box
      ctx.strokeStyle = selectedZones.length > 1 ? '#06B6D4' : '#EF4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(minX - 5, minY - 5, boxW + 10, boxH + 10);
      ctx.setLineDash([]);

      // 4 Corner Resize Handles
      const handleSize = 10;
      const handles = [
        { x: minX - 5, y: minY - 5 },                  // NW
        { x: maxX + 5, y: minY - 5 },                  // NE
        { x: maxX + 5, y: maxY + 5 },                  // SE
        { x: minX - 5, y: maxY + 5 }                   // SW
      ];

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = selectedZones.length > 1 ? '#06B6D4' : '#EF4444';
      ctx.lineWidth = 2.5;
      handles.forEach(h => {
        ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      });

      // Count badge above the bounding box
      if (selectedZones.length > 1) {
        ctx.fillStyle = '#06B6D4';
        ctx.beginPath();
        ctx.roundRect(minX - 5, minY - 30, 160, 22, 6);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`Đã chọn: ${selectedZones.length} ô trắc nghiệm`, minX + 2, minY - 15);
      }

      // Alignment crosshair guides during dragging
      if (isDragging) {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        // Horizontal guide
        ctx.beginPath();
        ctx.moveTo(0, minY + boxH / 2);
        ctx.lineTo(width, minY + boxH / 2);
        ctx.stroke();
        // Vertical guide
        ctx.beginPath();
        ctx.moveTo(minX + boxW / 2, 0);
        ctx.lineTo(minX + boxW / 2, height);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 3. Draw Marquee Selection Rectangle
    if (isMarqueeSelecting && marqueeRect) {
      const left = Math.min(marqueeRect.startX, marqueeRect.currentX) * width;
      const top = Math.min(marqueeRect.startY, marqueeRect.currentY) * height;
      const mWidth = Math.abs(marqueeRect.currentX - marqueeRect.startX) * width;
      const mHeight = Math.abs(marqueeRect.currentY - marqueeRect.startY) * height;

      ctx.save();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.fillRect(left, top, mWidth, mHeight);
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(left, top, mWidth, mHeight);
      ctx.restore();
    }
  };

  // Helper: Find zone or resize handle under cursor
  const getHitTarget = (normX: number, normY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { zone: null, handle: null };
    const width = canvasDims.width;
    const height = canvasDims.height;

    // Check collective bounding box handles first
    if (selectedZones.length > 0) {
      const minX = Math.min(...selectedZones.map(z => z.x));
      const minY = Math.min(...selectedZones.map(z => z.y));
      const maxX = Math.max(...selectedZones.map(z => z.x + z.width));
      const maxY = Math.max(...selectedZones.map(z => z.y + z.height));
      const handleTolX = 16 / width;
      const handleTolY = 16 / height;

      if (Math.abs(normX - minX) < handleTolX && Math.abs(normY - minY) < handleTolY) return { zone: selectedZones[0], handle: 'nw' as ResizeHandle };
      if (Math.abs(normX - maxX) < handleTolX && Math.abs(normY - minY) < handleTolY) return { zone: selectedZones[0], handle: 'ne' as ResizeHandle };
      if (Math.abs(normX - maxX) < handleTolX && Math.abs(normY - maxY) < handleTolY) return { zone: selectedZones[0], handle: 'se' as ResizeHandle };
      if (Math.abs(normX - minX) < handleTolX && Math.abs(normY - maxY) < handleTolY) return { zone: selectedZones[0], handle: 'sw' as ResizeHandle };
    }

    // Check hit inside any individual zone (reverse order)
    const found = [...currentTemplate.zones].reverse().find(z => {
      const radiusX = z.width / 2;
      const radiusY = z.height / 2;
      const centerX = z.x + radiusX;
      const centerY = z.y + radiusY;
      const distSq = Math.pow((normX - centerX) / (radiusX * 1.3), 2) + Math.pow((normY - centerY) / (radiusY * 1.3), 2);
      return distSq <= 1.0;
    });

    return { zone: found || null, handle: found ? ('center' as ResizeHandle) : null };
  };

  // Mouse Down - Start Drag, Selection, or Marquee Box
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    if (activeTool === 'select' || activeTool === 'marquee') {
      const { zone, handle } = getHitTarget(clickX, clickY);

      if (handle && handle !== 'center') {
        // Clicked on a resize corner handle
        setIsDragging(true);
        setActiveHandle(handle);
        setDragStartPos({ x: clickX, y: clickY });
        setInitialZonesState(currentTemplate.zones.map(z => ({ ...z })));
      } else if (zone) {
        // Clicked on a zone
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          // Toggle selection in multi-select group
          setSelectedZoneIds(prev =>
            prev.includes(zone.id) ? prev.filter(id => id !== zone.id) : [...prev, zone.id]
          );
        } else {
          // If clicked zone is ALREADY in selected group, keep the group intact for moving!
          if (!selectedZoneIds.includes(zone.id)) {
            setSelectedZoneIds([zone.id]);
          }
        }
        setIsDragging(true);
        setActiveHandle('center');
        setDragStartPos({ x: clickX, y: clickY });
        setInitialZonesState(currentTemplate.zones.map(z => ({ ...z })));
      } else {
        // Clicked on empty space -> Start Marquee Selection!
        if (!e.shiftKey) {
          setSelectedZoneIds([]);
        }
        setIsMarqueeSelecting(true);
        setMarqueeRect({
          startX: clickX,
          startY: clickY,
          currentX: clickX,
          currentY: clickY
        });
      }
    } else if (activeTool === 'bubble') {
      const nextQ = (currentTemplate.zones.filter(z => z.type === 'bubble').length > 0)
        ? Math.max(...currentTemplate.zones.filter(z => z.questionNumber).map(z => z.questionNumber!)) + 1
        : 1;

      const newZone: RecognitionZone = {
        id: `zone_custom_${Date.now()}`,
        type: 'bubble',
        questionNumber: nextQ,
        option: 'A',
        x: Number((clickX - 0.012).toFixed(4)),
        y: Number((clickY - 0.015).toFixed(4)),
        width: 0.024,
        height: 0.03,
        label: `Q${nextQ}-A`
      };

      const updatedZones = [...currentTemplate.zones, newZone];
      setCurrentTemplate(prev => ({ ...prev, zones: updatedZones }));
      pushHistory(updatedZones);
      setSelectedZoneIds([newZone.id]);
      setActiveTool('select');
      setStatusMessage(`Đã thêm ô trắc nghiệm câu ${nextQ}-A`);
    } else if (activeTool === 'qr') {
      const newZone: RecognitionZone = {
        id: `zone_qr_${Date.now()}`,
        type: 'student_id_qr',
        x: Number((clickX - 0.08).toFixed(4)),
        y: Number((clickY - 0.06).toFixed(4)),
        width: 0.16,
        height: 0.12,
        label: 'Student QR Zone'
      };

      const updatedZones = [...currentTemplate.zones, newZone];
      setCurrentTemplate(prev => ({ ...prev, zones: updatedZones }));
      pushHistory(updatedZones);
      setSelectedZoneIds([newZone.id]);
      setActiveTool('select');
      setStatusMessage('Đã thêm vùng nhận diện mã QR');
    }
  };

  // Mouse Move - Dragging Coordinates, Marquee Box, & Cursor Updating
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const curX = (e.clientX - rect.left) / rect.width;
    const curY = (e.clientY - rect.top) / rect.height;

    // 1. Handling Marquee Drag Selection
    if (isMarqueeSelecting && marqueeRect) {
      setMarqueeRect(prev => prev ? { ...prev, currentX: curX, currentY: curY } : null);

      const left = Math.min(marqueeRect.startX, curX);
      const top = Math.min(marqueeRect.startY, curY);
      const right = Math.max(marqueeRect.startX, curX);
      const bottom = Math.max(marqueeRect.startY, curY);

      // Find all zones inside or intersecting the marquee box
      const enclosedIds = currentTemplate.zones
        .filter(z => {
          const zCenterX = z.x + z.width / 2;
          const zCenterY = z.y + z.height / 2;
          return zCenterX >= left && zCenterX <= right && zCenterY >= top && zCenterY <= bottom;
        })
        .map(z => z.id);

      setSelectedZoneIds(enclosedIds);
      setCursorStyle('crosshair');
      return;
    }

    // 2. Hover Cursor Style
    if (!isDragging) {
      const { zone, handle } = getHitTarget(curX, curY);
      if (handle === 'nw' || handle === 'se') {
        setCursorStyle('nwse-resize');
      } else if (handle === 'ne' || handle === 'sw') {
        setCursorStyle('nesw-resize');
      } else if (zone) {
        setCursorStyle('grab');
      } else if (activeTool === 'select' || activeTool === 'marquee') {
        setCursorStyle('default');
      } else {
        setCursorStyle('crosshair');
      }
      return;
    }

    // 3. Is Dragging / Moving / Resizing
    let dx = curX - dragStartPos.x;
    let dy = curY - dragStartPos.y;

    if (snapToGrid) {
      // Snap to 0.002 precision
      dx = Math.round(dx / 0.002) * 0.002;
      dy = Math.round(dy / 0.002) * 0.002;
    }

    if (activeHandle === 'center' || !activeHandle) {
      // Moving Selected Zones as a Group
      setCursorStyle('grabbing');

      let updatedZones: RecognitionZone[];
      const selectedSet = new Set(selectedZoneIds);

      if (dragMode === 'row' && selectedZoneIds.length === 1) {
        // Entire Question Row move
        const initSingle = initialZonesState.find(z => z.id === selectedZoneIds[0]);
        const qNum = initSingle?.questionNumber;
        updatedZones = initialZonesState.map(z => {
          if (z.questionNumber === qNum) {
            return {
              ...z,
              x: Number(Math.max(0.005, Math.min(0.97, z.x + dx)).toFixed(4)),
              y: Number(Math.max(0.005, Math.min(0.97, z.y + dy)).toFixed(4))
            };
          }
          return z;
        });
      } else if (dragMode === 'column' && selectedZoneIds.length === 1) {
        // Move column
        const initSingle = initialZonesState.find(z => z.id === selectedZoneIds[0]);
        const colCenterX = initSingle ? initSingle.x : 0;
        updatedZones = initialZonesState.map(z => {
          if (Math.abs(z.x - colCenterX) < 0.15 && (z.type === 'bubble' || z.type === 'student_id_bubble')) {
            return {
              ...z,
              x: Number(Math.max(0.005, Math.min(0.97, z.x + dx)).toFixed(4)),
              y: Number(Math.max(0.005, Math.min(0.97, z.y + dy)).toFixed(4))
            };
          }
          return z;
        });
      } else {
        // Move all selected zones by dx, dy
        updatedZones = initialZonesState.map(z => {
          if (selectedSet.has(z.id)) {
            return {
              ...z,
              x: Number(Math.max(0.002, Math.min(0.98, z.x + dx)).toFixed(4)),
              y: Number(Math.max(0.002, Math.min(0.98, z.y + dy)).toFixed(4))
            };
          }
          return z;
        });
      }

      setCurrentTemplate(prev => ({ ...prev, zones: updatedZones }));
    } else {
      // Group Resizing / Scaling Handles
      const minX = Math.min(...initialZonesState.filter(z => selectedZoneIds.includes(z.id)).map(z => z.x));
      const minY = Math.min(...initialZonesState.filter(z => selectedZoneIds.includes(z.id)).map(z => z.y));
      const maxX = Math.max(...initialZonesState.filter(z => selectedZoneIds.includes(z.id)).map(z => z.x + z.width));
      const maxY = Math.max(...initialZonesState.filter(z => selectedZoneIds.includes(z.id)).map(z => z.y + z.height));
      const origW = maxX - minX || 0.01;
      const origH = maxY - minY || 0.01;

      let scaleX = 1.0;
      let scaleY = 1.0;

      if (activeHandle === 'se') {
        scaleX = Math.max(0.2, (origW + dx) / origW);
        scaleY = Math.max(0.2, (origH + dy) / origH);
      } else if (activeHandle === 'sw') {
        scaleX = Math.max(0.2, (origW - dx) / origW);
        scaleY = Math.max(0.2, (origH + dy) / origH);
      } else if (activeHandle === 'ne') {
        scaleX = Math.max(0.2, (origW + dx) / origW);
        scaleY = Math.max(0.2, (origH - dy) / origH);
      } else if (activeHandle === 'nw') {
        scaleX = Math.max(0.2, (origW - dx) / origW);
        scaleY = Math.max(0.2, (origH - dy) / origH);
      }

      const selectedSet = new Set(selectedZoneIds);
      const updatedZones = initialZonesState.map(z => {
        if (selectedSet.has(z.id)) {
          const relX = z.x - minX;
          const relY = z.y - minY;
          return {
            ...z,
            x: Number((minX + relX * scaleX).toFixed(4)),
            y: Number((minY + relY * scaleY).toFixed(4)),
            width: Number(Math.max(0.01, z.width * scaleX).toFixed(4)),
            height: Number(Math.max(0.01, z.height * scaleY).toFixed(4))
          };
        }
        return z;
      });

      setCurrentTemplate(prev => ({ ...prev, zones: updatedZones }));
    }
  };

  // Mouse Up - Finish Marquee or Dragging & Save History
  const handleMouseUp = () => {
    if (isMarqueeSelecting) {
      setIsMarqueeSelecting(false);
      setMarqueeRect(null);
      if (selectedZoneIds.length > 0) {
        setStatusMessage(`Đã chọn ${selectedZoneIds.length} ô trắc nghiệm bằng quét chuột.`);
      }
    }

    if (isDragging) {
      setIsDragging(false);
      setActiveHandle(null);
      pushHistory(currentTemplate.zones);
    }
  };

  // Keyboard Shortcuts (Undo, Delete, Select All, Arrow Nudge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      // Select All (Ctrl+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Delete Selected Zones
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedZoneIds.length > 0) {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;
        e.preventDefault();
        handleDeleteSelectedZones();
        return;
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedZoneIds([]);
        setStatusMessage('Đã hủy chọn');
        return;
      }

      // Nudge with Arrow Keys
      if (selectedZoneIds.length > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;
        e.preventDefault();

        const step = e.shiftKey ? 0.005 : 0.001;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;

        const selectedSet = new Set(selectedZoneIds);
        const updated = currentTemplate.zones.map(z => {
          if (selectedSet.has(z.id)) {
            return {
              ...z,
              x: Number((z.x + dx).toFixed(4)),
              y: Number((z.y + dy).toFixed(4))
            };
          }
          return z;
        });

        setCurrentTemplate(prev => ({ ...prev, zones: updated }));
        pushHistory(updated);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedZoneIds, currentTemplate.zones, handleUndo, handleRedo, pushHistory]);

  // Select All Zones
  const handleSelectAll = () => {
    const allIds = currentTemplate.zones.map(z => z.id);
    setSelectedZoneIds(allIds);
    setStatusMessage(`Đã chọn toàn bộ ${allIds.length} ô trên mẫu`);
  };

  // Select only answer bubbles
  const handleSelectAllBubbles = () => {
    const bubbleIds = currentTemplate.zones.filter(z => z.type === 'bubble').map(z => z.id);
    setSelectedZoneIds(bubbleIds);
    setStatusMessage(`Đã chọn ${bubbleIds.length} ô đáp án`);
  };

  // Select SBD bubbles
  const handleSelectSbdBubbles = () => {
    const sbdIds = currentTemplate.zones.filter(z => z.type === 'student_id_bubble').map(z => z.id);
    setSelectedZoneIds(sbdIds);
    setStatusMessage(`Đã chọn ${sbdIds.length} ô Số Báo Danh`);
  };

  // Select Exam Code bubbles
  const handleSelectExamCodeBubbles = () => {
    const codeIds = currentTemplate.zones.filter(z => z.type === 'exam_code_bubble').map(z => z.id);
    setSelectedZoneIds(codeIds);
    setStatusMessage(`Đã chọn ${codeIds.length} ô Mã Đề`);
  };

  // Deselect All
  const handleDeselectAll = () => {
    setSelectedZoneIds([]);
    setStatusMessage('Đã bỏ chọn');
  };

  // BATCH ALIGNMENT FUNCTIONS
  // Align Left
  const handleAlignLeft = () => {
    if (selectedZones.length < 2) return;
    const minX = Math.min(...selectedZones.map(z => z.x));
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.map(z => selectedSet.has(z.id) ? { ...z, x: minX } : z);
    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã căn thẳng lề trái cho ${selectedZones.length} ô`);
  };

  // Align Center X
  const handleAlignCenterX = () => {
    if (selectedZones.length < 2) return;
    const avgCenterX = selectedZones.reduce((sum, z) => sum + (z.x + z.width / 2), 0) / selectedZones.length;
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.map(z =>
      selectedSet.has(z.id) ? { ...z, x: Number((avgCenterX - z.width / 2).toFixed(4)) } : z
    );
    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã căn giữa hàng dọc cho ${selectedZones.length} ô`);
  };

  // Align Right
  const handleAlignRight = () => {
    if (selectedZones.length < 2) return;
    const maxRight = Math.max(...selectedZones.map(z => z.x + z.width));
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.map(z =>
      selectedSet.has(z.id) ? { ...z, x: Number((maxRight - z.width).toFixed(4)) } : z
    );
    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã căn thẳng lề phải cho ${selectedZones.length} ô`);
  };

  // Align Top
  const handleAlignTop = () => {
    if (selectedZones.length < 2) return;
    const minY = Math.min(...selectedZones.map(z => z.y));
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.map(z => selectedSet.has(z.id) ? { ...z, y: minY } : z);
    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã căn thẳng lề trên cho ${selectedZones.length} ô`);
  };

  // Align Center Y
  const handleCenterY = () => {
    if (selectedZones.length < 2) return;
    const avgCenterY = selectedZones.reduce((sum, z) => sum + (z.y + z.height / 2), 0) / selectedZones.length;
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.map(z =>
      selectedSet.has(z.id) ? { ...z, y: Number((avgCenterY - z.height / 2).toFixed(4)) } : z
    );
    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã căn giữa hàng ngang cho ${selectedZones.length} ô`);
  };

  // Align Bottom
  const handleAlignBottom = () => {
    if (selectedZones.length < 2) return;
    const maxBottom = Math.max(...selectedZones.map(z => z.y + z.height));
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.map(z =>
      selectedSet.has(z.id) ? { ...z, y: Number((maxBottom - z.height).toFixed(4)) } : z
    );
    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã căn thẳng lề dưới cho ${selectedZones.length} ô`);
  };

  // Distribute Horizontally
  const handleDistributeH = () => {
    if (selectedZones.length < 3) return;
    const sorted = [...selectedZones].sort((a, b) => a.x - b.x);
    const firstX = sorted[0].x;
    const lastX = sorted[sorted.length - 1].x;
    const step = (lastX - firstX) / (sorted.length - 1);

    const posMap = new Map<string, number>();
    sorted.forEach((z, idx) => {
      posMap.set(z.id, Number((firstX + idx * step).toFixed(4)));
    });

    const updated = currentTemplate.zones.map(z => {
      if (posMap.has(z.id)) {
        return { ...z, x: posMap.get(z.id)! };
      }
      return z;
    });

    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã phân bố đều khoảng cách ngang cho ${selectedZones.length} ô`);
  };

  // Distribute Vertically
  const handleDistributeV = () => {
    if (selectedZones.length < 3) return;
    const sorted = [...selectedZones].sort((a, b) => a.y - b.y);
    const firstY = sorted[0].y;
    const lastY = sorted[sorted.length - 1].y;
    const step = (lastY - firstY) / (sorted.length - 1);

    const posMap = new Map<string, number>();
    sorted.forEach((z, idx) => {
      posMap.set(z.id, Number((firstY + idx * step).toFixed(4)));
    });

    const updated = currentTemplate.zones.map(z => {
      if (posMap.has(z.id)) {
        return { ...z, y: posMap.get(z.id)! };
      }
      return z;
    });

    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã phân bố đều khoảng cách dọc cho ${selectedZones.length} ô`);
  };

  // BATCH QUESTION NUMBERING
  // Sequential Numbering (Top-to-Bottom, Left-to-Right by row)
  const handleBatchSequentialNumbering = (startQ: number) => {
    if (selectedZones.length === 0) return;

    // Group selected bubbles into rows (tolerance 0.015)
    const bubbles = selectedZones.filter(z => z.type === 'bubble' || z.type === 'student_id_bubble');
    if (bubbles.length === 0) return;

    // Sort by X (column groups) first, then by Y
    // Find column buckets (e.g. left vs right column)
    const minX = Math.min(...bubbles.map(b => b.x));
    const maxX = Math.max(...bubbles.map(b => b.x));
    const isMultiColumn = maxX - minX > 0.3;

    // Sort bubbles
    let sortedBubbles: RecognitionZone[];
    if (isMultiColumn) {
      // Split into columns by X midpoint
      const midX = (minX + maxX) / 2;
      const leftCol = bubbles.filter(b => b.x < midX).sort((a, b) => a.y - b.y || a.x - b.x);
      const rightCol = bubbles.filter(b => b.x >= midX).sort((a, b) => a.y - b.y || a.x - b.x);
      sortedBubbles = [...leftCol, ...rightCol];
    } else {
      sortedBubbles = [...bubbles].sort((a, b) => a.y - b.y || a.x - b.x);
    }

    // Group by unique Y rows
    const rowGroups: RecognitionZone[][] = [];
    sortedBubbles.forEach(b => {
      const existingRow = rowGroups.find(row => Math.abs(row[0].y - b.y) < 0.012);
      if (existingRow) {
        existingRow.push(b);
      } else {
        rowGroups.push([b]);
      }
    });

    // Assign question number starting from startQ
    const qNumMap = new Map<string, number>();
    rowGroups.forEach((row, rowIdx) => {
      const qNum = startQ + rowIdx;
      row.forEach(b => {
        qNumMap.set(b.id, qNum);
      });
    });

    const updated = currentTemplate.zones.map(z => {
      if (qNumMap.has(z.id)) {
        const newQ = qNumMap.get(z.id)!;
        return {
          ...z,
          questionNumber: newQ,
          label: `Q${newQ}-${z.option || 'A'}`
        };
      }
      return z;
    });

    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã đánh số liên tiếp từ Câu ${startQ} đến Câu ${startQ + rowGroups.length - 1}`);
  };

  // Offset question numbers (+N or -N)
  const handleOffsetQuestionNumbers = (delta: number) => {
    if (selectedZones.length === 0) return;
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.map(z => {
      if (selectedSet.has(z.id) && z.questionNumber !== undefined) {
        const newQ = Math.max(1, z.questionNumber + delta);
        return {
          ...z,
          questionNumber: newQ,
          label: `Q${newQ}-${z.option || 'A'}`
        };
      }
      return z;
    });

    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã dịch chuyển số câu ${delta > 0 ? `+${delta}` : delta} cho các ô đã chọn`);
  };

  // Set all selected question numbers to fixed value
  const handleSetFixedQuestionNumber = (qNum: number) => {
    if (selectedZones.length === 0) return;
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.map(z => {
      if (selectedSet.has(z.id)) {
        return {
          ...z,
          questionNumber: qNum,
          label: `Q${qNum}-${z.option || 'A'}`
        };
      }
      return z;
    });

    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã gán tất cả ${selectedZones.length} ô thành Câu ${qNum}`);
  };

  // BATCH OPTION ASSIGNMENT
  // Auto-assign Options A-B-C-D-E in each row from Left-to-Right
  const handleBatchAutoAssignOptions = () => {
    if (selectedZones.length === 0) return;
    const bubbles = selectedZones.filter(z => z.type === 'bubble' || z.type === 'student_id_bubble');

    // Group into rows
    const rowGroups: RecognitionZone[][] = [];
    bubbles.forEach(b => {
      const existingRow = rowGroups.find(row => Math.abs(row[0].y - b.y) < 0.012);
      if (existingRow) {
        existingRow.push(b);
      } else {
        rowGroups.push([b]);
      }
    });

    const optLetters: BubbleOption[] = ['A', 'B', 'C', 'D', 'E', 'F'];
    const optMap = new Map<string, BubbleOption>();

    rowGroups.forEach(row => {
      // Sort left to right
      const sortedRow = [...row].sort((a, b) => a.x - b.x);
      sortedRow.forEach((b, idx) => {
        optMap.set(b.id, optLetters[idx % optLetters.length]);
      });
    });

    const updated = currentTemplate.zones.map(z => {
      if (optMap.has(z.id)) {
        const newOpt = optMap.get(z.id)!;
        return {
          ...z,
          option: newOpt,
          label: `Q${z.questionNumber || 1}-${newOpt}`
        };
      }
      return z;
    });

    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã tự động gán đáp án A, B, C, D từ trái qua phải cho ${bubbles.length} ô`);
  };

  // Set all selected options to single letter (e.g. all A, all B, ...)
  const handleBatchSetSingleOption = (opt: BubbleOption) => {
    if (selectedZones.length === 0) return;
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.map(z => {
      if (selectedSet.has(z.id)) {
        return {
          ...z,
          option: opt,
          label: `Q${z.questionNumber || 1}-${opt}`
        };
      }
      return z;
    });

    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã gán tất cả ${selectedZones.length} ô thành lựa chọn [${opt}]`);
  };

  // Batch Set Zone Type
  const handleBatchSetZoneType = (type: ZoneType) => {
    if (selectedZones.length === 0) return;
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.map(z => {
      if (selectedSet.has(z.id)) {
        return { ...z, type };
      }
      return z;
    });

    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã đổi loại ${selectedZones.length} vùng nhận diện`);
  };

  // Batch Duplicate Selected Zones
  const handleDuplicateSelectedZones = () => {
    if (selectedZones.length === 0) return;

    // Detect max question number in current template
    const currentMaxQ = Math.max(
      ...currentTemplate.zones.filter(z => z.questionNumber).map(z => z.questionNumber!),
      0
    );

    const newZones: RecognitionZone[] = selectedZones.map((z, idx) => {
      const newId = `zone_copy_${Date.now()}_${idx}`;
      return {
        ...z,
        id: newId,
        x: Number(Math.min(0.96, z.x + 0.18).toFixed(4)), // Shift horizontally to next column
        y: Number(z.y.toFixed(4)),
        questionNumber: z.questionNumber ? z.questionNumber + (currentMaxQ > 0 ? 20 : 1) : undefined
      };
    });

    const updated = [...currentTemplate.zones, ...newZones];
    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setSelectedZoneIds(newZones.map(z => z.id));
    setStatusMessage(`Đã nhân bản ${newZones.length} ô trắc nghiệm sang cột mới!`);
  };

  // Batch Delete Selected Zones
  const handleDeleteSelectedZones = () => {
    if (selectedZoneIds.length === 0) return;
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.filter(z => !selectedSet.has(z.id));
    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
    setStatusMessage(`Đã xóa ${selectedZoneIds.length} vùng nhận diện`);
    setSelectedZoneIds([]);
  };

  // Update single zone attributes
  const updateSingleZone = (updates: Partial<RecognitionZone>) => {
    if (selectedZoneIds.length !== 1) return;
    const targetId = selectedZoneIds[0];
    const updated = currentTemplate.zones.map(z => z.id === targetId ? { ...z, ...updates } : z);
    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
  };

  // Batch update coordinates / dimensions
  const handleBatchUpdateDimensions = (prop: 'width' | 'height', val: number) => {
    if (selectedZoneIds.length === 0) return;
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.map(z => selectedSet.has(z.id) ? { ...z, [prop]: val } : z);
    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
  };

  // Batch update fill threshold
  const handleBatchUpdateThreshold = (thresh: number) => {
    if (selectedZoneIds.length === 0) return;
    const selectedSet = new Set(selectedZoneIds);
    const updated = currentTemplate.zones.map(z => selectedSet.has(z.id) ? { ...z, threshold: thresh } : z);
    setCurrentTemplate(prev => ({ ...prev, zones: updated }));
    pushHistory(updated);
  };

  // Upload Custom School Template Image or PDF
  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBg(true);
    setStatusMessage('Đang xử lý và quét nhận diện ô tròn từ tệp mẫu...');

    try {
      const { pages, isPdf } = await processUploadedFileToImages(file);
      if (pages.length === 0) {
        throw new Error('Không thể trích xuất nội dung từ tệp đã chọn.');
      }

      setLoadedPdfPages(pages);
      setCurrentPdfPageIndex(0);

      const firstPage = pages[0];
      setCustomBgImage(firstPage.dataUrl);

      // Run automatic Computer Vision Circle & Bubble Detection
      const cvResult = await detectBubblesFromImageData(firstPage.dataUrl);

      const updatedTemplate: AnswerSheetTemplate = {
        ...currentTemplate,
        backgroundImageUrl: firstPage.dataUrl,
        numQuestions: cvResult.numQuestions || currentTemplate.numQuestions,
        numOptions: cvResult.numOptions || currentTemplate.numOptions,
        columnsCount: cvResult.columnsCount || currentTemplate.columnsCount,
        zones: cvResult.detectedZones && cvResult.detectedZones.length > 0 ? cvResult.detectedZones : currentTemplate.zones
      };

      setCurrentTemplate(updatedTemplate);
      pushHistory(updatedTemplate.zones);

      setStatusMessage(
        `✨ Đã nạp ${isPdf ? 'PDF' : 'Ảnh'} và tự động nhận diện được ${cvResult.detectedZones.filter(z => z.type === 'bubble').length} ô tròn OMR (Bán kính R=${cvResult.averageRadius}px)!`
      );
    } catch (err: any) {
      console.error('Failed to load PDF/Image template:', err);
      setStatusMessage('Lỗi đọc tệp: ' + (err.message || 'Không thể chuyển đổi file.'));
    } finally {
      setIsUploadingBg(false);
    }
  };

  const handleSelectPdfPage = async (index: number) => {
    if (index < 0 || index >= loadedPdfPages.length) return;
    setCurrentPdfPageIndex(index);
    const page = loadedPdfPages[index];
    setCustomBgImage(page.dataUrl);

    // Re-detect circles on the selected page
    try {
      setStatusMessage(`Đang phân tích trang ${index + 1}/${loadedPdfPages.length}...`);
      const cvResult = await detectBubblesFromImageData(page.dataUrl);
      if (cvResult.detectedZones.length > 0) {
        setCurrentTemplate(prev => ({
          ...prev,
          backgroundImageUrl: page.dataUrl,
          numQuestions: cvResult.numQuestions,
          numOptions: cvResult.numOptions,
          columnsCount: cvResult.columnsCount,
          zones: cvResult.detectedZones
        }));
        pushHistory(cvResult.detectedZones);
        setStatusMessage(`✨ Đã nhận diện ${cvResult.detectedZones.filter(z => z.type === 'bubble').length} ô tròn trên trang ${index + 1}!`);
      }
    } catch (e) {
      setCurrentTemplate(prev => ({ ...prev, backgroundImageUrl: page.dataUrl }));
    }
  };

  // Run Auto Detect Answer Bubbles via CV
  const handleAutoDetect = async () => {
    setIsAutoDetecting(true);
    setStatusMessage('Đang quét tự động các ô tròn trên ảnh mẫu...');

    try {
      if (customBgImage) {
        const cvResult = await detectBubblesFromImageData(customBgImage);
        setCurrentTemplate(prev => ({
          ...prev,
          numQuestions: cvResult.numQuestions,
          numOptions: cvResult.numOptions,
          columnsCount: cvResult.columnsCount,
          zones: cvResult.detectedZones
        }));
        pushHistory(cvResult.detectedZones);
        setStatusMessage(`✨ Đã tự động nhận diện thành công ${cvResult.detectedZones.filter(z => z.type === 'bubble').length} ô tròn OMR (Kích thước R=${cvResult.averageRadius}px)!`);
      } else {
        const newZones = generateAutoGridZones(
          currentTemplate.numQuestions || 40,
          currentTemplate.numOptions || 4,
          currentTemplate.columnsCount || 2
        );
        setCurrentTemplate(prev => ({
          ...prev,
          zones: newZones
        }));
        pushHistory(newZones);
        setStatusMessage(`Đã tự động căn chỉnh lưới ${newZones.filter(z => z.type === 'bubble').length} ô tròn OMR!`);
      }
    } catch (err: any) {
      console.error('Auto detection error:', err);
      setStatusMessage('Lỗi nhận diện ô tròn: ' + (err.message || 'Thử lại với ảnh rõ hơn.'));
    } finally {
      setIsAutoDetecting(false);
    }
  };

  // Apply Auto-Grid
  const handleApplyAutoGrid = () => {
    const newZones = generateAutoGridZones(
      autoGridConfig.numQuestions,
      autoGridConfig.numOptions,
      autoGridConfig.columnsCount,
      {
        direction: autoGridConfig.direction,
        startQuestion: autoGridConfig.startQuestion,
        yStart: autoGridConfig.yStart,
        yEnd: autoGridConfig.yEnd,
        xStart: autoGridConfig.xStart,
        xEnd: autoGridConfig.xEnd,
        includeAnchors: currentTemplate.hasAnchorMarks !== false,
        includeQr: currentTemplate.hasQrCode !== false
      }
    );

    setCurrentTemplate(prev => ({
      ...prev,
      numQuestions: autoGridConfig.numQuestions,
      numOptions: autoGridConfig.numOptions,
      columnsCount: autoGridConfig.columnsCount,
      zones: newZones
    }));

    pushHistory(newZones);
    setShowAutoGridModal(false);
    setStatusMessage(`Đã tạo lưới ma trận ${autoGridConfig.numQuestions} câu × ${autoGridConfig.numOptions} lựa chọn (${autoGridConfig.columnsCount} cột)!`);
  };

  // Save Template
  const handleSave = () => {
    const existing = templates.find(t => t.id === currentTemplate.id);
    const realStats = getTemplateRealStats(currentTemplate);
    const updated = {
      ...currentTemplate,
      numQuestions: realStats.numQuestions,
      numOptions: realStats.numOptions,
      columnsCount: realStats.columnsCount,
      backgroundImageUrl: customBgImage || currentTemplate.backgroundImageUrl,
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      updateTemplate(updated);
    } else {
      addTemplate(updated);
    }
    setCurrentTemplate(updated);
    setActiveTemplateId(updated.id);
    setStatusMessage(`Đã lưu mẫu phiếu (${realStats.numQuestions} câu, ${realStats.numOptions} lựa chọn, ${realStats.columnsCount} cột) thành công!`);
  };

  const isCustomUploaded = Boolean(customBgImage || currentTemplate.backgroundImageUrl);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#02050A] overflow-hidden text-slate-100">
      {/* Top Action Toolbar */}
      <div className="bg-[#0B0F17]/95 backdrop-blur-xl border-b border-white/10 px-5 py-2.5 flex items-center justify-between shadow-2xl z-20 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-xs font-semibold text-slate-300 hover:text-white border border-white/10 px-3 py-1.5 rounded-xl hover:bg-white/5 transition cursor-pointer"
          >
            ← {t.actions.back}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={currentTemplate.name}
                onChange={(e) => setCurrentTemplate(prev => ({ ...prev, name: e.target.value }))}
                className="font-bold text-white text-sm bg-transparent border-b border-transparent hover:border-cyan-500/50 focus:border-cyan-400 focus:outline-hidden px-1"
              />
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300 font-semibold">
                v{currentTemplate.version}
              </span>
              {isCustomUploaded && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1" title="Phiếu sử dụng tệp gốc: Giữ nguyên 100% tiêu đề và nội dung câu hỏi để in ấn trực tiếp">
                  ✨ Giữ nguyên tiêu đề & file gốc
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {currentTemplate.numQuestions} câu hỏi • {currentTemplate.zones.length} ô nhận diện OMR
              {selectedZoneIds.length > 0 && (
                <span className="ml-2 font-bold text-cyan-400">
                  (Đang chọn: {selectedZoneIds.length} ô)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div className="px-3 py-1 bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-medium rounded-full flex items-center gap-1.5 shadow-md shadow-cyan-950/30">
            <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Quick Tools & Selection Selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Undo / Redo */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
            <button
              onClick={handleUndo}
              disabled={historyIndex === 0}
              title="Hoàn tác (Ctrl+Z)"
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Làm lại (Ctrl+Y)"
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Selection Quick Buttons */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 text-xs">
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1"
              title="Chọn tất cả các ô (Ctrl+A)"
            >
              <CheckSquare className="w-3 h-3 text-cyan-400" />
              <span>Chọn hết</span>
            </button>
            <button
              onClick={handleSelectAllBubbles}
              className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition cursor-pointer"
              title="Chỉ chọn các ô đáp án trắc nghiệm"
            >
              Ô đáp án
            </button>
            {selectedZoneIds.length > 0 && (
              <button
                onClick={handleDeselectAll}
                className="px-2 py-1 text-rose-300 hover:text-rose-200 hover:bg-rose-950/30 rounded-lg font-medium transition cursor-pointer"
                title="Bỏ chọn (Esc)"
              >
                Bỏ chọn
              </button>
            )}
          </div>

          {/* Drag Mode Selector */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 text-xs">
            <span className="text-[11px] text-slate-400 px-2 font-medium">Kéo:</span>
            <button
              onClick={() => setDragMode('single')}
              className={`px-2 py-1 rounded-lg font-medium transition cursor-pointer ${
                dragMode === 'single' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
              title="Kéo di chuyển các ô được chọn"
            >
              Nhóm/Ô
            </button>
            <button
              onClick={() => setDragMode('row')}
              className={`px-2 py-1 rounded-lg font-medium transition cursor-pointer ${
                dragMode === 'row' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
              title="Kéo thả di chuyển cả hàng câu hỏi"
            >
              Cả câu
            </button>
            <button
              onClick={() => setDragMode('column')}
              className={`px-2 py-1 rounded-lg font-medium transition cursor-pointer ${
                dragMode === 'column' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
              title="Kéo thả di chuyển cả cột câu hỏi"
            >
              Cả cột
            </button>
          </div>

          {/* Snap toggle */}
          <button
            onClick={() => setSnapToGrid(prev => !prev)}
            title="Bật/Tắt Hít Lưới Tự Động (Grid Snapping)"
            className={`p-2 rounded-xl border transition cursor-pointer ${
              snapToGrid
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>

          {/* PDF Page navigator if multi-page */}
          {loadedPdfPages.length > 1 && (
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded-xl text-xs">
              <span className="text-[11px] text-slate-400">PDF:</span>
              <button
                onClick={() => handleSelectPdfPage(currentPdfPageIndex - 1)}
                disabled={currentPdfPageIndex === 0}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-cyan-300 font-bold text-[11px]">
                {currentPdfPageIndex + 1}/{loadedPdfPages.length}
              </span>
              <button
                onClick={() => handleSelectPdfPage(currentPdfPageIndex + 1)}
                disabled={currentPdfPageIndex === loadedPdfPages.length - 1}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Upload Background File */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-xs rounded-xl cursor-pointer transition border border-white/10">
            {isUploadingBg ? (
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            ) : (
              <FileUp className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>{isUploadingBg ? 'Đang đọc...' : 'Tải lên PDF / Ảnh'}</span>
            <input
              type="file"
              accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg"
              onChange={handleUploadBg}
              disabled={isUploadingBg}
              className="hidden"
            />
          </label>

          {/* Auto-detect button */}
          <button
            id="btn-auto-detect"
            onClick={handleAutoDetect}
            disabled={isAutoDetecting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-xs rounded-xl transition cursor-pointer"
            title="Tự động nhận diện số lượng và vị trí ô tròn trực tiếp từ ảnh phiếu"
          >
            {isAutoDetecting ? (
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>{isAutoDetecting ? 'Đang quét...' : 'Tự nhận diện ô tròn'}</span>
          </button>

          {/* Auto-Grid Dialog */}
          <button
            id="btn-auto-grid"
            onClick={() => setShowAutoGridModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold text-xs rounded-xl transition cursor-pointer"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Tạo Lưới</span>
          </button>

          {/* Print Template Button */}
          <button
            id="btn-print-from-editor"
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-xs rounded-xl transition cursor-pointer shadow-sm"
            title="Xem trước và in trực tiếp mẫu phiếu này ra giấy hoặc tải tệp PDF"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>In phiếu</span>
          </button>

          {/* Save Button */}
          <button
            id="btn-save-template"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t.actions.save}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <div className="w-16 bg-[#0B0F17]/95 backdrop-blur-xl border-r border-white/10 flex flex-col items-center py-4 space-y-3 z-10 shadow-xl">
          <button
            title="Con trỏ chọn & Quét kéo chọn vùng (Select / Marquee Box)"
            onClick={() => setActiveTool('select')}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              activeTool === 'select'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BoxSelect className="w-5 h-5" />
          </button>

          <button
            title="Thêm ô tròn đáp án (Add Bubble)"
            onClick={() => setActiveTool('bubble')}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              activeTool === 'bubble'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CircleDot className="w-5 h-5" />
          </button>

          <button
            title="Thêm vùng mã QR (Add QR Zone)"
            onClick={() => setActiveTool('qr')}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              activeTool === 'qr'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <QrCode className="w-5 h-5" />
          </button>

          <div className="w-8 h-px bg-white/10 my-1" />

          {/* Zoom controls */}
          <button
            title="Căn vừa toàn bộ phiếu vào màn hình (Fit Page)"
            onClick={handleFitToScreen}
            className="p-2 text-cyan-400 hover:text-white hover:bg-cyan-500/20 rounded-xl transition cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            title="Phóng to"
            onClick={() => setZoomLevel(prev => Math.min(2.5, Number((prev + 0.15).toFixed(2))))}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-mono text-cyan-400 font-bold">{Math.round(zoomLevel * 100)}%</span>
          <button
            title="Thu nhỏ"
            onClick={() => setZoomLevel(prev => Math.max(0.25, Number((prev - 0.15).toFixed(2))))}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            title="Kích thước chuẩn 100%"
            onClick={() => setZoomLevel(1.0)}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center Canvas Stage */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto p-4 md:p-6 flex flex-col items-center bg-[#050811] relative select-none"
        >
          {/* Floating Quick View Bar */}
          <div className="sticky top-0 z-20 mb-4 px-3 py-1.5 rounded-2xl bg-[#0B0F17]/90 backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-2xl text-xs shrink-0">
            <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Khung nhìn:
            </span>
            <button
              onClick={handleFitToScreen}
              className="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold text-[11px] flex items-center gap-1.5 transition cursor-pointer border border-cyan-500/30"
              title="Căn vừa toàn bộ trang phiếu vào cửa sổ để nhìn thấy 100% tiêu đề, câu hỏi & lề"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Toàn bộ phiếu (Fit)</span>
            </button>
            <button
              onClick={handleFitWidth}
              className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-[11px] flex items-center gap-1.5 transition cursor-pointer border border-white/10"
              title="Căn vừa chiều rộng"
            >
              <Move className="w-3.5 h-3.5" />
              <span>Vừa chiều ngang</span>
            </button>
            <button
              onClick={() => setZoomLevel(1.0)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-mono transition cursor-pointer border ${
                zoomLevel === 1.0 
                  ? 'bg-cyan-500 text-black font-bold border-cyan-400 shadow-md shadow-cyan-500/20' 
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 border-white/10'
              }`}
              title="Kích thước gốc 100%"
            >
              100%
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.25, Number((prev - 0.1).toFixed(2))))}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-cyan-400 font-bold px-1 min-w-[42px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(2.5, Number((prev + 0.1).toFixed(2))))}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Phóng to"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <div 
            style={{ 
              transform: `scale(${zoomLevel})`, 
              transformOrigin: 'top center',
              width: canvasDims.displayWidth,
              height: canvasDims.displayHeight,
              marginBottom: `${Math.max(32, (canvasDims.displayHeight * (zoomLevel - 1)) + 32)}px`
            }}
            className="transition-transform duration-100 shadow-2xl bg-white rounded-md border border-white/20 relative shrink-0"
          >
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ 
                width: canvasDims.displayWidth, 
                height: canvasDims.displayHeight, 
                cursor: cursorStyle 
              }}
              className="block rounded-sm"
            />
          </div>
        </div>

        {/* Right Property Inspector Sidebar */}
        <div className="w-96 bg-[#0B0F17]/95 backdrop-blur-xl border-l border-white/10 flex flex-col shadow-2xl shrink-0 h-full overflow-hidden">
          {/* Sidebar Tabs Header */}
          <div className="p-3 border-b border-white/10 bg-black/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-cyan-400" />
                {t.template.propInspector}
              </h3>
              {selectedZones.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {selectedZones.length} ô chọn
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setSidebarTab('tables')}
                className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                  sidebarTab === 'tables'
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>Bảng</span>
              </button>

              <button
                onClick={() => setSidebarTab('info')}
                className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                  sidebarTab === 'info'
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Khung</span>
              </button>

              <button
                onClick={() => setSidebarTab('styling')}
                className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                  sidebarTab === 'styling'
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Màu Sắc</span>
              </button>

              <button
                onClick={() => setSidebarTab('omr')}
                className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer relative ${
                  sidebarTab === 'omr'
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <CircleDot className="w-3.5 h-3.5" />
                <span>Ô OMR</span>
                {selectedZones.length > 0 && sidebarTab !== 'omr' && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse absolute top-1 right-1" />
                )}
              </button>
            </div>
          </div>

          {/* Sidebar Content Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* ================= TAB 1: BẢNG BIỂU (TABLES & GRIDS) ================= */}
            {sidebarTab === 'tables' && (
              <div className="space-y-4">
                {/* 1. SBD (Student ID) Table */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-cyan-400" />
                      <span className="font-bold text-white text-xs">Bảng Số Báo Danh (SBD)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={currentTemplate.hasStudentIdBubbles ?? currentTemplate.layoutConfig?.showStudentIdBubbles ?? true}
                      onChange={(e) => handleToggleSbd(e.target.checked)}
                      className="w-4 h-4 accent-cyan-400 cursor-pointer rounded"
                    />
                  </div>

                  {(currentTemplate.hasStudentIdBubbles ?? currentTemplate.layoutConfig?.showStudentIdBubbles ?? true) && (
                    <div className="space-y-3 pt-1 border-t border-white/5">
                      <div>
                        <label className="text-slate-400 text-[11px] block mb-1">Tiêu đề bảng SBD:</label>
                        <input
                          type="text"
                          value={currentTemplate.layoutConfig?.sbdTitle ?? 'SỐ BÁO DANH'}
                          onChange={(e) => updateLayoutConfig({ sbdTitle: e.target.value })}
                          placeholder="SỐ BÁO DANH"
                          className="w-full p-1.5 bg-black/40 border border-white/10 rounded-lg text-white font-bold text-xs focus:border-cyan-500/50"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Số chữ số SBD:</span>
                        <div className="flex items-center gap-1.5">
                          {[4, 5, 6, 8].map(d => (
                            <button
                              key={d}
                              onClick={() => handleSetSbdDigits(d)}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer transition ${
                                (currentTemplate.layoutConfig?.numStudentIdDigits || currentTemplate.numIdDigits || 6) === d
                                  ? 'bg-cyan-500 text-black border-cyan-400'
                                  : 'bg-black/30 text-slate-300 border-white/10 hover:border-cyan-400/50'
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Directional fine mover for SBD */}
                      <div>
                        <span className="text-slate-400 text-[10px] block mb-1">Dịch chuyển vị trí bảng SBD:</span>
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={() => handleMoveSbd(-0.01, 0)}
                            className="py-1 px-1.5 bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-lg text-center font-bold"
                            title="Sang trái 1%"
                          >
                            ← Trái
                          </button>
                          <button
                            onClick={() => handleMoveSbd(0.01, 0)}
                            className="py-1 px-1.5 bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-lg text-center font-bold"
                            title="Sang phải 1%"
                          >
                            Phải →
                          </button>
                          <button
                            onClick={() => handleMoveSbd(0, -0.01)}
                            className="py-1 px-1.5 bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-lg text-center font-bold"
                            title="Lên trên 1%"
                          >
                            ↑ Lên
                          </button>
                          <button
                            onClick={() => handleMoveSbd(0, 0.01)}
                            className="py-1 px-1.5 bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-lg text-center font-bold"
                            title="Xuống dưới 1%"
                          >
                            ↓ Xuống
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Exam Code Table */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-white text-xs">Bảng Mã Đề Thi</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={currentTemplate.hasExamCodeBubbles ?? currentTemplate.layoutConfig?.showExamCodeBubbles ?? true}
                      onChange={(e) => handleToggleExamCode(e.target.checked)}
                      className="w-4 h-4 accent-emerald-400 cursor-pointer rounded"
                    />
                  </div>

                  {(currentTemplate.hasExamCodeBubbles ?? currentTemplate.layoutConfig?.showExamCodeBubbles ?? true) && (
                    <div className="space-y-3 pt-1 border-t border-white/5">
                      <div>
                        <label className="text-slate-400 text-[11px] block mb-1">Tiêu đề bảng Mã đề:</label>
                        <input
                          type="text"
                          value={currentTemplate.layoutConfig?.examCodeTitle ?? 'MÃ ĐỀ THI'}
                          onChange={(e) => updateLayoutConfig({ examCodeTitle: e.target.value })}
                          placeholder="MÃ ĐỀ THI"
                          className="w-full p-1.5 bg-black/40 border border-white/10 rounded-lg text-white font-bold text-xs focus:border-cyan-500/50"
                        />
                      </div>

                      {/* BLANK EXAM CODE FOR STUDENTS OPTION */}
                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <label htmlFor="blank-exam-code-cb" className="text-[11px] text-emerald-300 font-semibold cursor-pointer">
                            Ô mã đề để trống cho HS tự điền:
                          </label>
                          <input
                            id="blank-exam-code-cb"
                            type="checkbox"
                            checked={currentTemplate.layoutConfig?.leaveExamCodeBlankForStudent ?? true}
                            onChange={(e) => updateLayoutConfig({ leaveExamCodeBlankForStudent: e.target.checked })}
                            className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Khi bật, ô viết tay ở trên sẽ để trống hoàn toàn khi in/xuất để học sinh tự điền mã đề của mình bằng bút.
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Số chữ số mã đề:</span>
                        <div className="flex items-center gap-1.5">
                          {[2, 3, 4, 6].map(d => (
                            <button
                              key={d}
                              onClick={() => handleSetExamCodeDigits(d)}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer transition ${
                                (currentTemplate.layoutConfig?.numExamCodeDigits || currentTemplate.numExamCodeDigits || 3) === d
                                  ? 'bg-emerald-500 text-black border-emerald-400'
                                  : 'bg-black/30 text-slate-300 border-white/10 hover:border-emerald-400/50'
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Directional fine mover for Exam Code */}
                      <div>
                        <span className="text-slate-400 text-[10px] block mb-1">Dịch chuyển vị trí bảng Mã đề:</span>
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={() => handleMoveExamCode(-0.01, 0)}
                            className="py-1 px-1.5 bg-black/40 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 rounded-lg text-center font-bold"
                            title="Sang trái 1%"
                          >
                            ← Trái
                          </button>
                          <button
                            onClick={() => handleMoveExamCode(0.01, 0)}
                            className="py-1 px-1.5 bg-black/40 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 rounded-lg text-center font-bold"
                            title="Sang phải 1%"
                          >
                            Phải →
                          </button>
                          <button
                            onClick={() => handleMoveExamCode(0, -0.01)}
                            className="py-1 px-1.5 bg-black/40 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 rounded-lg text-center font-bold"
                            title="Lên trên 1%"
                          >
                            ↑ Lên
                          </button>
                          <button
                            onClick={() => handleMoveExamCode(0, 0.01)}
                            className="py-1 px-1.5 bg-black/40 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 rounded-lg text-center font-bold"
                            title="Xuống dưới 1%"
                          >
                            ↓ Xuống
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Question Grid Matrix Config */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-2">
                      <Columns className="w-4 h-4 text-indigo-400" />
                      Cột & Khung Câu Hỏi Trắc Nghiệm
                    </span>
                    <button
                      onClick={() => setShowAutoGridModal(true)}
                      className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      Mở bảng chi tiết
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Số lượng câu:</span>
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={currentTemplate.numQuestions || 40}
                        onChange={(e) => handleApplyQuestionGridConfig(parseInt(e.target.value, 10) || 40)}
                        className="w-full p-1.5 bg-black/40 border border-white/10 rounded-lg font-bold text-cyan-300 text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Số cột hiển thị:</span>
                      <select
                        value={currentTemplate.columnsCount || 2}
                        onChange={(e) => handleApplyQuestionGridConfig(undefined, undefined, parseInt(e.target.value, 10) || 2)}
                        className="w-full p-1.5 bg-black/40 border border-white/10 rounded-lg font-bold text-white text-center"
                      >
                        <option value={1} className="bg-slate-900">1 Cột</option>
                        <option value={2} className="bg-slate-900">2 Cột</option>
                        <option value={3} className="bg-slate-900">3 Cột</option>
                        <option value={4} className="bg-slate-900">4 Cột</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Số đáp án/câu:</span>
                      <select
                        value={currentTemplate.numOptions || 4}
                        onChange={(e) => handleApplyQuestionGridConfig(undefined, parseInt(e.target.value, 10) || 4)}
                        className="w-full p-1.5 bg-black/40 border border-white/10 rounded-lg font-bold text-white text-center"
                      >
                        <option value={2} className="bg-slate-900">2 (Đúng / Sai)</option>
                        <option value={3} className="bg-slate-900">3 (A - C)</option>
                        <option value={4} className="bg-slate-900">4 (A - D)</option>
                        <option value={5} className="bg-slate-900">5 (A - E)</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Thứ tự đánh số:</span>
                      <select
                        value={currentTemplate.layoutConfig?.direction || 'column_first'}
                        onChange={(e) => handleApplyQuestionGridConfig(undefined, undefined, undefined, e.target.value as 'column_first' | 'row_first')}
                        className="w-full p-1.5 bg-black/40 border border-white/10 rounded-lg font-bold text-white text-center"
                      >
                        <option value="column_first" className="bg-slate-900">Dọc theo cột</option>
                        <option value="row_first" className="bg-slate-900">Ngang theo hàng</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => handleApplyQuestionGridConfig()}
                    className="w-full py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>Tái tạo khung lưới câu hỏi</span>
                  </button>
                </div>

                {/* 4. Khung Phụ Trợ */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-2.5">
                  <span className="font-bold text-white text-xs block">Khung phụ trợ trên phiếu:</span>
                  
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Khung Điểm Số & Chữ Ký Giám Thị</span>
                    <input
                      type="checkbox"
                      checked={(currentTemplate.layoutConfig?.showTeacherScoreBox ?? currentTemplate.layoutConfig?.showScoresTable) ?? true}
                      onChange={(e) => {
                        updateLayoutConfig({
                          showTeacherScoreBox: e.target.checked,
                          showScoresTable: e.target.checked
                        });
                      }}
                      className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span>Khung Hướng Dẫn Tô Ô Tròn</span>
                    <input
                      type="checkbox"
                      checked={(currentTemplate.layoutConfig?.showInstructionsBox ?? currentTemplate.layoutConfig?.showInstructions) ?? true}
                      onChange={(e) => {
                        updateLayoutConfig({
                          showInstructionsBox: e.target.checked,
                          showInstructions: e.target.checked
                        });
                      }}
                      className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span>Mã QR Code Định Danh</span>
                    <input
                      type="checkbox"
                      checked={currentTemplate.hasQrCode ?? currentTemplate.layoutConfig?.showQrCode ?? true}
                      onChange={(e) => {
                        setCurrentTemplate(prev => ({ ...prev, hasQrCode: e.target.checked }));
                        updateLayoutConfig({ showQrCode: e.target.checked });
                      }}
                      className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span>Điểm Neo Căn Chỉnh Góc (Anchors)</span>
                    <input
                      type="checkbox"
                      checked={currentTemplate.hasAnchorMarks ?? currentTemplate.layoutConfig?.showAnchorMarks ?? true}
                      onChange={(e) => {
                        setCurrentTemplate(prev => ({ ...prev, hasAnchorMarks: e.target.checked }));
                        updateLayoutConfig({ showAnchorMarks: e.target.checked });
                      }}
                      className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 2: Ô THÔNG TIN & KHUNG ================= */}
            {sidebarTab === 'info' && (
              <div className="space-y-4">
                {/* 1. Header Information Box */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    Tiêu Đề & Thông Tin Chung
                  </span>

                  {/* Sheet Title */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400">Tiêu đề phiếu (Dòng lớn):</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateLayoutConfig({ sheetTitleBold: !(currentTemplate.layoutConfig?.sheetTitleBold ?? true) })}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                            (currentTemplate.layoutConfig?.sheetTitleBold ?? true)
                              ? 'bg-cyan-500 text-black border-cyan-400 font-black'
                              : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                          }`}
                          title="In đậm tiêu đề phiếu"
                        >
                          <Bold className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLayoutConfig({ sheetTitleItalic: !(currentTemplate.layoutConfig?.sheetTitleItalic ?? false) })}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                            (currentTemplate.layoutConfig?.sheetTitleItalic ?? false)
                              ? 'bg-cyan-500 text-black border-cyan-400'
                              : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                          }`}
                          title="In nghiêng tiêu đề phiếu"
                        >
                          <Italic className="w-3 h-3" />
                        </button>
                        <input
                          type="checkbox"
                          checked={currentTemplate.layoutConfig?.showSheetTitle ?? true}
                          onChange={(e) => updateLayoutConfig({ showSheetTitle: e.target.checked })}
                          className="w-3.5 h-3.5 accent-cyan-400 rounded cursor-pointer"
                          title="Bật/tắt tiêu đề phiếu"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={currentTemplate.layoutConfig?.sheetTitle ?? 'PHIẾU TRẢ LỜI TRẮC NGHIỆM'}
                      onChange={(e) => updateLayoutConfig({ sheetTitle: e.target.value })}
                      className="w-full p-2 bg-black/40 border border-white/10 rounded-xl text-white font-bold focus:border-cyan-500/50"
                    />
                  </div>

                  {/* Department Name */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400">Sở GD&ĐT / Đơn vị quản lý:</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateLayoutConfig({ deptBold: !(currentTemplate.layoutConfig?.deptBold ?? true) })}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                            (currentTemplate.layoutConfig?.deptBold ?? true)
                              ? 'bg-cyan-500 text-black border-cyan-400 font-black'
                              : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                          }`}
                          title="In đậm Sở GD&ĐT"
                        >
                          <Bold className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLayoutConfig({ deptItalic: !(currentTemplate.layoutConfig?.deptItalic ?? false) })}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                            (currentTemplate.layoutConfig?.deptItalic ?? false)
                              ? 'bg-cyan-500 text-black border-cyan-400'
                              : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                          }`}
                          title="In nghiêng Sở GD&ĐT"
                        >
                          <Italic className="w-3 h-3" />
                        </button>
                        <input
                          type="checkbox"
                          checked={currentTemplate.layoutConfig?.showDepartmentName ?? true}
                          onChange={(e) => updateLayoutConfig({ showDepartmentName: e.target.checked })}
                          className="w-3.5 h-3.5 accent-cyan-400 rounded cursor-pointer"
                          title="Bật/tắt dòng này"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={currentTemplate.layoutConfig?.departmentName ?? 'SỞ GIÁO DỤC VÀ ĐÀO TẠO'}
                      onChange={(e) => updateLayoutConfig({ departmentName: e.target.value })}
                      className="w-full p-2 bg-black/40 border border-white/10 rounded-xl text-white font-medium focus:border-cyan-500/50"
                    />
                  </div>

                  {/* School Name */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400">Tên trường / Đơn vị:</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateLayoutConfig({ schoolNameBold: !(currentTemplate.layoutConfig?.schoolNameBold ?? true) })}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                            (currentTemplate.layoutConfig?.schoolNameBold ?? true)
                              ? 'bg-cyan-500 text-black border-cyan-400 font-black'
                              : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                          }`}
                          title="In đậm tên trường"
                        >
                          <Bold className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLayoutConfig({ schoolNameItalic: !(currentTemplate.layoutConfig?.schoolNameItalic ?? false) })}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                            (currentTemplate.layoutConfig?.schoolNameItalic ?? false)
                              ? 'bg-cyan-500 text-black border-cyan-400'
                              : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                          }`}
                          title="In nghiêng tên trường"
                        >
                          <Italic className="w-3 h-3" />
                        </button>
                        <input
                          type="checkbox"
                          checked={currentTemplate.layoutConfig?.showSchoolName ?? true}
                          onChange={(e) => updateLayoutConfig({ showSchoolName: e.target.checked })}
                          className="w-3.5 h-3.5 accent-cyan-400 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={currentTemplate.layoutConfig?.schoolName || currentTemplate.schoolName || ''}
                      onChange={(e) => {
                        setCurrentTemplate(prev => ({ ...prev, schoolName: e.target.value }));
                        updateLayoutConfig({ schoolName: e.target.value });
                      }}
                      placeholder="VD: TRƯỜNG THPT CHUYÊN..."
                      className="w-full p-2 bg-black/40 border border-white/10 rounded-xl text-white font-medium focus:border-cyan-500/50"
                    />
                  </div>

                  {/* Exam Title */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400">Tên kỳ thi / Đợt kiểm tra:</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateLayoutConfig({ examTitleBold: !(currentTemplate.layoutConfig?.examTitleBold ?? true) })}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                            (currentTemplate.layoutConfig?.examTitleBold ?? true)
                              ? 'bg-cyan-500 text-black border-cyan-400 font-black'
                              : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                          }`}
                          title="In đậm tên kỳ thi"
                        >
                          <Bold className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLayoutConfig({ examTitleItalic: !(currentTemplate.layoutConfig?.examTitleItalic ?? false) })}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                            (currentTemplate.layoutConfig?.examTitleItalic ?? false)
                              ? 'bg-cyan-500 text-black border-cyan-400'
                              : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                          }`}
                          title="In nghiêng tên kỳ thi"
                        >
                          <Italic className="w-3 h-3" />
                        </button>
                        <input
                          type="checkbox"
                          checked={currentTemplate.layoutConfig?.showExamTitle ?? true}
                          onChange={(e) => updateLayoutConfig({ showExamTitle: e.target.checked })}
                          className="w-3.5 h-3.5 accent-cyan-400 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={currentTemplate.layoutConfig?.examTitle ?? 'KỲ THI ĐÁNH GIÁ NĂNG LỰC / KIỂM TRA ĐỊNH KỲ'}
                      onChange={(e) => updateLayoutConfig({ examTitle: e.target.value })}
                      className="w-full p-2 bg-black/40 border border-white/10 rounded-xl text-cyan-300 font-bold focus:border-cyan-500/50"
                    />
                  </div>

                  {/* Subject, Duration & Date */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-black/30 p-2 rounded-xl border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-300">Môn thi</label>
                        <input
                          type="checkbox"
                          checked={(currentTemplate.layoutConfig?.showSubjectName ?? currentTemplate.layoutConfig?.showSubject) ?? true}
                          onChange={(e) => updateLayoutConfig({ showSubjectName: e.target.checked, showSubject: e.target.checked })}
                          className="w-3.5 h-3.5 accent-cyan-400 rounded"
                          title="Bật/Tắt hiển thị môn thi"
                        />
                      </div>
                      <input
                        type="text"
                        value={currentTemplate.layoutConfig?.subjectName || currentTemplate.layoutConfig?.subject || 'Toán học'}
                        onChange={(e) => updateLayoutConfig({ subjectName: e.target.value, subject: e.target.value })}
                        className="w-full p-1 bg-black/40 border border-white/10 rounded-lg text-white font-medium text-xs"
                      />
                      <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer pt-0.5" title="Bắt đầu một dòng mới cho thông tin này">
                        <input
                          type="checkbox"
                          checked={currentTemplate.layoutConfig?.subjectNewline ?? false}
                          onChange={(e) => updateLayoutConfig({ subjectNewline: e.target.checked })}
                          className="w-3 h-3 accent-cyan-400 rounded"
                        />
                        <CornerDownLeft className="w-2.5 h-2.5 text-cyan-400" />
                        <span>Xuống dòng</span>
                      </label>
                    </div>

                    <div className="bg-black/30 p-2 rounded-xl border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-300">Thời gian (phút)</label>
                        <input
                          type="checkbox"
                          checked={(currentTemplate.layoutConfig?.showDurationMinutes ?? currentTemplate.layoutConfig?.showDuration) ?? true}
                          onChange={(e) => updateLayoutConfig({ showDurationMinutes: e.target.checked, showDuration: e.target.checked })}
                          className="w-3.5 h-3.5 accent-cyan-400 rounded"
                          title="Bật/Tắt hiển thị thời gian"
                        />
                      </div>
                      <input
                        type="text"
                        value={currentTemplate.layoutConfig?.durationMinutes ?? currentTemplate.layoutConfig?.duration ?? 50}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 50;
                          updateLayoutConfig({ durationMinutes: val, duration: val });
                        }}
                        className="w-full p-1 bg-black/40 border border-white/10 rounded-lg text-white font-medium text-xs"
                      />
                      <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer pt-0.5" title="Bắt đầu một dòng mới cho thông tin này">
                        <input
                          type="checkbox"
                          checked={currentTemplate.layoutConfig?.durationNewline ?? false}
                          onChange={(e) => updateLayoutConfig({ durationNewline: e.target.checked })}
                          className="w-3 h-3 accent-cyan-400 rounded"
                        />
                        <CornerDownLeft className="w-2.5 h-2.5 text-cyan-400" />
                        <span>Xuống dòng</span>
                      </label>
                    </div>

                    <div className="bg-black/30 p-2 rounded-xl border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-300">Ngày thi</label>
                        <input
                          type="checkbox"
                          checked={(currentTemplate.layoutConfig?.showExamDate ?? currentTemplate.layoutConfig?.showDate) ?? true}
                          onChange={(e) => updateLayoutConfig({ showExamDate: e.target.checked, showDate: e.target.checked })}
                          className="w-3.5 h-3.5 accent-cyan-400 rounded"
                          title="Bật/Tắt hiển thị ngày thi"
                        />
                      </div>
                      <input
                        type="text"
                        value={currentTemplate.layoutConfig?.examDate || currentTemplate.layoutConfig?.date || ''}
                        onChange={(e) => updateLayoutConfig({ examDate: e.target.value, date: e.target.value })}
                        placeholder="DD/MM/YYYY"
                        className="w-full p-1 bg-black/40 border border-white/10 rounded-lg text-white text-xs"
                      />
                      <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer pt-0.5" title="Bắt đầu một dòng mới cho thông tin này">
                        <input
                          type="checkbox"
                          checked={currentTemplate.layoutConfig?.examDateNewline ?? false}
                          onChange={(e) => updateLayoutConfig({ examDateNewline: e.target.checked })}
                          className="w-3 h-3 accent-cyan-400 rounded"
                        />
                        <CornerDownLeft className="w-2.5 h-2.5 text-cyan-400" />
                        <span>Xuống dòng</span>
                      </label>
                    </div>
                  </div>

                  {/* Custom Fields in Header */}
                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        Trường tùy chỉnh thông tin chung:
                      </span>
                      <button
                        onClick={handleAddHeaderCustomField}
                        className="px-2 py-0.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Thêm trường</span>
                      </button>
                    </div>

                    {(currentTemplate.layoutConfig?.headerCustomFields || []).length > 0 && (
                      <div className="space-y-1.5">
                        {(currentTemplate.layoutConfig?.headerCustomFields || []).map((field) => (
                          <div key={field.id} className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5">
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => handleUpdateHeaderCustomField(field.id, e.target.value, field.value, field.newline)}
                              placeholder="Nhãn (VD: Học kỳ)"
                              className="flex-1 p-1 bg-transparent text-white font-medium text-xs focus:outline-none border-b border-transparent focus:border-cyan-400"
                            />
                            <input
                              type="text"
                              value={field.value || ''}
                              onChange={(e) => handleUpdateHeaderCustomField(field.id, field.label, e.target.value, field.newline)}
                              placeholder="Giá trị (VD: I)"
                              className="w-20 p-1 bg-transparent text-slate-300 text-xs focus:outline-none border-b border-transparent focus:border-cyan-400"
                            />
                            <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer bg-white/5 px-1.5 py-1 rounded-lg border border-white/5" title="Bắt đầu dòng mới">
                              <input
                                type="checkbox"
                                checked={field.newline ?? false}
                                onChange={(e) => handleUpdateHeaderCustomField(field.id, field.label, field.value, e.target.checked)}
                                className="w-3 h-3 accent-cyan-400 rounded"
                              />
                              <CornerDownLeft className="w-2.5 h-2.5 text-cyan-400" />
                              <span>Xuống dòng</span>
                            </label>
                            <button
                              onClick={() => handleDeleteHeaderCustomField(field.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                              title="Xóa trường này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Line Spacing for Header Meta */}
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                        Dãn dòng thông tin chung:
                      </span>
                      <span className="font-mono text-cyan-300 font-bold">
                        {Math.round((currentTemplate.layoutConfig?.headerLineSpacing ?? 1.0) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const cur = currentTemplate.layoutConfig?.headerLineSpacing ?? 1.0;
                          updateLayoutConfig({ headerLineSpacing: Math.max(0.7, Number((cur - 0.1).toFixed(1))) });
                        }}
                        className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min="0.7"
                        max="2.5"
                        step="0.1"
                        value={currentTemplate.layoutConfig?.headerLineSpacing ?? 1.0}
                        onChange={(e) => updateLayoutConfig({ headerLineSpacing: parseFloat(e.target.value) })}
                        className="flex-1 accent-cyan-400 h-1.5 bg-black/40 rounded-lg cursor-pointer"
                      />
                      <button
                        onClick={() => {
                          const cur = currentTemplate.layoutConfig?.headerLineSpacing ?? 1.0;
                          updateLayoutConfig({ headerLineSpacing: Math.min(2.5, Number((cur + 0.1).toFixed(1))) });
                        }}
                        className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Khung Thông Tin Thí Sinh */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      Khung Thông Tin Thí Sinh
                    </span>
                    <input
                      type="checkbox"
                      checked={currentTemplate.layoutConfig?.showStudentInfoBox ?? true}
                      onChange={(e) => updateLayoutConfig({ showStudentInfoBox: e.target.checked })}
                      className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
                    />
                  </div>

                  {(currentTemplate.layoutConfig?.showStudentInfoBox ?? true) && (
                    <div className="space-y-2.5 pt-1 border-t border-white/5">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-[10px] text-slate-400">Tiêu đề khung:</label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateLayoutConfig({ studentBoxTitleBold: !(currentTemplate.layoutConfig?.studentBoxTitleBold ?? true) })}
                              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                                (currentTemplate.layoutConfig?.studentBoxTitleBold ?? true)
                                  ? 'bg-emerald-500 text-black border-emerald-400 font-black'
                                  : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                              }`}
                              title="In đậm tiêu đề khung thí sinh"
                            >
                              <Bold className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateLayoutConfig({ studentBoxTitleItalic: !(currentTemplate.layoutConfig?.studentBoxTitleItalic ?? false) })}
                              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                                (currentTemplate.layoutConfig?.studentBoxTitleItalic ?? false)
                                  ? 'bg-emerald-500 text-black border-emerald-400'
                                  : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                              }`}
                              title="In nghiêng tiêu đề khung thí sinh"
                            >
                              <Italic className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={currentTemplate.layoutConfig?.studentInfoBoxTitle ?? 'THÔNG TIN THÍ SINH'}
                          onChange={(e) => updateLayoutConfig({ studentInfoBoxTitle: e.target.value })}
                          className="w-full p-1.5 bg-black/40 border border-white/10 rounded-lg text-white font-bold text-xs"
                        />
                      </div>

                      {/* Custom labels, visibility toggles & newline options */}
                      <div className="space-y-1.5 text-slate-300 text-[11px]">
                        {/* Họ và tên */}
                        <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5">
                          <input
                            type="checkbox"
                            checked={currentTemplate.layoutConfig?.showStudentName ?? true}
                            onChange={(e) => updateLayoutConfig({ showStudentName: e.target.checked })}
                            className="w-3.5 h-3.5 accent-emerald-400 rounded"
                            title="Hiện / Ẩn dòng Họ tên"
                          />
                          <span className="w-16 text-[10px] text-slate-400">Họ tên:</span>
                          <input
                            type="text"
                            value={currentTemplate.layoutConfig?.studentNameLabel ?? 'Họ và tên:'}
                            onChange={(e) => updateLayoutConfig({ studentNameLabel: e.target.value })}
                            className="flex-1 p-1 bg-black/40 border border-white/10 rounded-lg text-white text-xs"
                          />
                          <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer bg-white/5 px-1.5 py-1 rounded-lg border border-white/5" title="Bắt đầu một dòng mới">
                            <input
                              type="checkbox"
                              checked={currentTemplate.layoutConfig?.studentNameNewline ?? true}
                              onChange={(e) => updateLayoutConfig({ studentNameNewline: e.target.checked })}
                              className="w-3 h-3 accent-emerald-400 rounded"
                            />
                            <CornerDownLeft className="w-2.5 h-2.5 text-emerald-400" />
                            <span>Xuống dòng</span>
                          </label>
                        </div>

                        {/* Lớp */}
                        <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5">
                          <input
                            type="checkbox"
                            checked={(currentTemplate.layoutConfig?.showExamClassInStudentBox ?? currentTemplate.layoutConfig?.showExamClass) ?? true}
                            onChange={(e) => updateLayoutConfig({ showExamClassInStudentBox: e.target.checked, showExamClass: e.target.checked })}
                            className="w-3.5 h-3.5 accent-emerald-400 rounded"
                            title="Hiện / Ẩn mục Lớp trong khung"
                          />
                          <span className="w-16 text-[10px] text-slate-400">Lớp:</span>
                          <input
                            type="text"
                            value={currentTemplate.layoutConfig?.examClassLabel ?? 'Lớp'}
                            onChange={(e) => updateLayoutConfig({ examClassLabel: e.target.value })}
                            className="flex-1 p-1 bg-black/40 border border-white/10 rounded-lg text-white text-xs"
                          />
                          <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer bg-white/5 px-1.5 py-1 rounded-lg border border-white/5" title="Bắt đầu một dòng mới">
                            <input
                              type="checkbox"
                              checked={currentTemplate.layoutConfig?.examClassNewline ?? false}
                              onChange={(e) => updateLayoutConfig({ examClassNewline: e.target.checked })}
                              className="w-3 h-3 accent-emerald-400 rounded"
                            />
                            <CornerDownLeft className="w-2.5 h-2.5 text-emerald-400" />
                            <span>Xuống dòng</span>
                          </label>
                        </div>

                        {/* Ngày sinh */}
                        <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5">
                          <input
                            type="checkbox"
                            checked={currentTemplate.layoutConfig?.showStudentDob ?? true}
                            onChange={(e) => updateLayoutConfig({ showStudentDob: e.target.checked })}
                            className="w-3.5 h-3.5 accent-emerald-400 rounded"
                            title="Hiện / Ẩn mục Ngày sinh"
                          />
                          <span className="w-16 text-[10px] text-slate-400">Ngày sinh:</span>
                          <input
                            type="text"
                            value={currentTemplate.layoutConfig?.studentDobLabel ?? 'Ngày sinh'}
                            onChange={(e) => updateLayoutConfig({ studentDobLabel: e.target.value })}
                            className="flex-1 p-1 bg-black/40 border border-white/10 rounded-lg text-white text-xs"
                          />
                          <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer bg-white/5 px-1.5 py-1 rounded-lg border border-white/5" title="Bắt đầu một dòng mới">
                            <input
                              type="checkbox"
                              checked={currentTemplate.layoutConfig?.studentDobNewline ?? false}
                              onChange={(e) => updateLayoutConfig({ studentDobNewline: e.target.checked })}
                              className="w-3 h-3 accent-emerald-400 rounded"
                            />
                            <CornerDownLeft className="w-2.5 h-2.5 text-emerald-400" />
                            <span>Xuống dòng</span>
                          </label>
                        </div>

                        {/* Phòng thi */}
                        <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5">
                          <input
                            type="checkbox"
                            checked={(currentTemplate.layoutConfig?.showRoomNumberInStudentBox ?? currentTemplate.layoutConfig?.showRoomNumber) ?? true}
                            onChange={(e) => updateLayoutConfig({ showRoomNumberInStudentBox: e.target.checked, showRoomNumber: e.target.checked })}
                            className="w-3.5 h-3.5 accent-emerald-400 rounded"
                            title="Hiện / Ẩn mục Phòng trong khung"
                          />
                          <span className="w-16 text-[10px] text-slate-400">Phòng:</span>
                          <input
                            type="text"
                            value={currentTemplate.layoutConfig?.roomNumberLabel ?? 'Phòng'}
                            onChange={(e) => updateLayoutConfig({ roomNumberLabel: e.target.value })}
                            className="flex-1 p-1 bg-black/40 border border-white/10 rounded-lg text-white text-xs"
                          />
                          <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer bg-white/5 px-1.5 py-1 rounded-lg border border-white/5" title="Bắt đầu một dòng mới">
                            <input
                              type="checkbox"
                              checked={currentTemplate.layoutConfig?.roomNumberNewline ?? false}
                              onChange={(e) => updateLayoutConfig({ roomNumberNewline: e.target.checked })}
                              className="w-3 h-3 accent-emerald-400 rounded"
                            />
                            <CornerDownLeft className="w-2.5 h-2.5 text-emerald-400" />
                            <span>Xuống dòng</span>
                          </label>
                        </div>

                        {/* Chữ ký */}
                        <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5">
                          <input
                            type="checkbox"
                            checked={currentTemplate.layoutConfig?.showStudentSignature ?? true}
                            onChange={(e) => updateLayoutConfig({ showStudentSignature: e.target.checked })}
                            className="w-3.5 h-3.5 accent-emerald-400 rounded"
                            title="Hiện / Ẩn dòng Chữ ký"
                          />
                          <span className="w-16 text-[10px] text-slate-400">Chữ ký:</span>
                          <input
                            type="text"
                            value={currentTemplate.layoutConfig?.studentSignatureLabel ?? 'Chữ ký thí sinh:'}
                            onChange={(e) => updateLayoutConfig({ studentSignatureLabel: e.target.value })}
                            className="flex-1 p-1 bg-black/40 border border-white/10 rounded-lg text-white text-xs"
                          />
                          <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer bg-white/5 px-1.5 py-1 rounded-lg border border-white/5" title="Bắt đầu một dòng mới">
                            <input
                              type="checkbox"
                              checked={currentTemplate.layoutConfig?.studentSignatureNewline ?? true}
                              onChange={(e) => updateLayoutConfig({ studentSignatureNewline: e.target.checked })}
                              className="w-3 h-3 accent-emerald-400 rounded"
                            />
                            <CornerDownLeft className="w-2.5 h-2.5 text-emerald-400" />
                            <span>Xuống dòng</span>
                          </label>
                        </div>
                      </div>

                      {/* Custom Fields in Student Box */}
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                            Trường tùy chỉnh khung thí sinh:
                          </span>
                          <button
                            onClick={handleAddCustomField}
                            className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm trường</span>
                          </button>
                        </div>

                        {(currentTemplate.layoutConfig?.customFields || []).length > 0 && (
                          <div className="space-y-1.5">
                            {(currentTemplate.layoutConfig?.customFields || []).map((field) => (
                              <div key={field.id} className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5">
                                <input
                                  type="text"
                                  value={field.label}
                                  onChange={(e) => handleUpdateCustomField(field.id, e.target.value, field.value, field.newline)}
                                  placeholder="Nhãn trường"
                                  className="flex-1 p-1 bg-transparent text-white font-medium text-xs focus:outline-none border-b border-transparent focus:border-emerald-400"
                                />
                                <input
                                  type="text"
                                  value={field.value || ''}
                                  onChange={(e) => handleUpdateCustomField(field.id, field.label, e.target.value, field.newline)}
                                  placeholder="Nội dung/Giá trị"
                                  className="w-20 p-1 bg-transparent text-slate-300 text-xs focus:outline-none border-b border-transparent focus:border-emerald-400"
                                />
                                <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer bg-white/5 px-1.5 py-1 rounded-lg border border-white/5" title="Bắt đầu dòng mới">
                                  <input
                                    type="checkbox"
                                    checked={field.newline ?? false}
                                    onChange={(e) => handleUpdateCustomField(field.id, field.label, field.value, e.target.checked)}
                                    className="w-3 h-3 accent-emerald-400 rounded"
                                  />
                                  <CornerDownLeft className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>Xuống dòng</span>
                                </label>
                                <button
                                  onClick={() => handleDeleteCustomField(field.id)}
                                  className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                                  title="Xóa trường này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Line Spacing for Student Box */}
                      <div className="pt-2 border-t border-white/5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 font-bold flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                            Dãn dòng thông tin thí sinh:
                          </span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {Math.round((currentTemplate.layoutConfig?.studentLineSpacing ?? 1.0) * 100)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.studentLineSpacing ?? 1.0;
                              updateLayoutConfig({ studentLineSpacing: Math.max(0.7, Number((cur - 0.1).toFixed(1))) });
                            }}
                            className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="range"
                            min="0.7"
                            max="2.5"
                            step="0.1"
                            value={currentTemplate.layoutConfig?.studentLineSpacing ?? 1.0}
                            onChange={(e) => updateLayoutConfig({ studentLineSpacing: parseFloat(e.target.value) })}
                            className="flex-1 accent-emerald-400 h-1.5 bg-black/40 rounded-lg cursor-pointer"
                          />
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.studentLineSpacing ?? 1.0;
                              updateLayoutConfig({ studentLineSpacing: Math.min(2.5, Number((cur + 0.1).toFixed(1))) });
                            }}
                            className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Position & Size Adjusters */}
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <span className="text-[10px] font-bold text-slate-300 block">Kích thước & Vị trí khung Thí sinh:</span>
                        
                        {/* Width & Height Sliders */}
                        <div className="grid grid-cols-2 gap-2 bg-black/30 p-2 rounded-xl border border-white/5">
                          <div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span>Độ rộng (W):</span>
                              <span className="font-mono text-emerald-400">
                                {Math.round((currentTemplate.layoutConfig?.studentInfoBoxW ?? 0.46) * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  const cur = currentTemplate.layoutConfig?.studentInfoBoxW ?? 0.46;
                                  updateLayoutConfig({ studentInfoBoxW: Math.max(0.2, Number((cur - 0.02).toFixed(3))) });
                                }}
                                className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                              >-</button>
                              <input
                                type="range"
                                min="0.2"
                                max="0.95"
                                step="0.01"
                                value={currentTemplate.layoutConfig?.studentInfoBoxW ?? 0.46}
                                onChange={(e) => updateLayoutConfig({ studentInfoBoxW: parseFloat(e.target.value) })}
                                className="flex-1 h-1.5 bg-white/10 rounded-lg accent-emerald-400 cursor-pointer"
                              />
                              <button
                                onClick={() => {
                                  const cur = currentTemplate.layoutConfig?.studentInfoBoxW ?? 0.46;
                                  updateLayoutConfig({ studentInfoBoxW: Math.min(0.95, Number((cur + 0.02).toFixed(3))) });
                                }}
                                className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                              >+</button>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span>Độ cao (H):</span>
                              <span className="font-mono text-emerald-400">
                                {currentTemplate.layoutConfig?.studentInfoBoxH
                                  ? `${Math.round(currentTemplate.layoutConfig.studentInfoBoxH * 100)}%`
                                  : 'Tự động'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  const cur = currentTemplate.layoutConfig?.studentInfoBoxH ?? 0.11;
                                  updateLayoutConfig({ studentInfoBoxH: Math.max(0.05, Number((cur - 0.01).toFixed(3))) });
                                }}
                                className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                              >-</button>
                              <input
                                type="range"
                                min="0.05"
                                max="0.35"
                                step="0.01"
                                value={currentTemplate.layoutConfig?.studentInfoBoxH ?? 0.11}
                                onChange={(e) => updateLayoutConfig({ studentInfoBoxH: parseFloat(e.target.value) })}
                                className="flex-1 h-1.5 bg-white/10 rounded-lg accent-emerald-400 cursor-pointer"
                              />
                              <button
                                onClick={() => {
                                  const cur = currentTemplate.layoutConfig?.studentInfoBoxH ?? 0.11;
                                  updateLayoutConfig({ studentInfoBoxH: Math.min(0.35, Number((cur + 0.01).toFixed(3))) });
                                }}
                                className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                              >+</button>
                            </div>
                          </div>
                        </div>

                        {/* Directional Shift */}
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.studentInfoBoxX ?? 0.05;
                              updateLayoutConfig({ studentInfoBoxX: Math.max(0.01, Number((cur - 0.01).toFixed(3))) });
                            }}
                            className="py-1 px-1 bg-black/40 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 rounded-lg text-[10px] font-bold text-center"
                          >
                            ← Trái
                          </button>
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.studentInfoBoxX ?? 0.05;
                              updateLayoutConfig({ studentInfoBoxX: Math.min(0.8, Number((cur + 0.01).toFixed(3))) });
                            }}
                            className="py-1 px-1 bg-black/40 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 rounded-lg text-[10px] font-bold text-center"
                          >
                            Phải →
                          </button>
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.studentInfoBoxY ?? 0.155;
                              updateLayoutConfig({ studentInfoBoxY: Math.max(0.05, Number((cur - 0.01).toFixed(3))) });
                            }}
                            className="py-1 px-1 bg-black/40 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 rounded-lg text-[10px] font-bold text-center"
                          >
                            ↑ Lên
                          </button>
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.studentInfoBoxY ?? 0.155;
                              updateLayoutConfig({ studentInfoBoxY: Math.min(0.4, Number((cur + 0.01).toFixed(3))) });
                            }}
                            className="py-1 px-1 bg-black/40 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 rounded-lg text-[10px] font-bold text-center"
                          >
                            ↓ Xuống
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Khung Điểm Số & Chữ Ký Giám Thị */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      Khung Điểm Số & Chữ Ký Giám Thị
                    </span>
                    <input
                      type="checkbox"
                      checked={(currentTemplate.layoutConfig?.showTeacherScoreBox ?? currentTemplate.layoutConfig?.showScoresTable) ?? true}
                      onChange={(e) => {
                        updateLayoutConfig({
                          showTeacherScoreBox: e.target.checked,
                          showScoresTable: e.target.checked
                        });
                      }}
                      className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                    />
                  </div>

                  {((currentTemplate.layoutConfig?.showTeacherScoreBox ?? currentTemplate.layoutConfig?.showScoresTable) ?? true) && (
                    <div className="space-y-2.5 pt-1 border-t border-white/5">
                      <p className="text-[10px] text-slate-400 italic">
                        Tiêu đề hiển thị nhỏ gọn ở thanh đầu ô, chừa toàn bộ khoảng trống bên dưới để chấm điểm và ký tên.
                      </p>

                      {/* Score in numbers */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={currentTemplate.layoutConfig?.showScoreNumber ?? true}
                          onChange={(e) => updateLayoutConfig({ showScoreNumber: e.target.checked })}
                          className="w-3.5 h-3.5 accent-amber-400 rounded"
                          title="Bật/tắt ô Điểm bằng số"
                        />
                        <span className="w-20 text-[10px] text-slate-400">Ô Điểm số:</span>
                        <input
                          type="text"
                          value={currentTemplate.layoutConfig?.scoreBoxTitle ?? 'ĐIỂM BẰNG SỐ'}
                          onChange={(e) => updateLayoutConfig({ scoreBoxTitle: e.target.value })}
                          className="flex-1 p-1.5 bg-black/40 border border-white/10 rounded-lg text-white font-bold text-xs"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateLayoutConfig({ scoreBoxTitleBold: !(currentTemplate.layoutConfig?.scoreBoxTitleBold ?? true) })}
                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                              (currentTemplate.layoutConfig?.scoreBoxTitleBold ?? true)
                                ? 'bg-amber-500 text-black border-amber-400 font-black'
                                : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                            }`}
                            title="In đậm tiêu đề khung điểm số"
                          >
                            <Bold className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateLayoutConfig({ scoreBoxTitleItalic: !(currentTemplate.layoutConfig?.scoreBoxTitleItalic ?? false) })}
                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                              (currentTemplate.layoutConfig?.scoreBoxTitleItalic ?? false)
                                ? 'bg-amber-500 text-black border-amber-400'
                                : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                            }`}
                            title="In nghiêng tiêu đề khung điểm số"
                          >
                            <Italic className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Score in words */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={currentTemplate.layoutConfig?.showScoreText ?? true}
                          onChange={(e) => updateLayoutConfig({ showScoreText: e.target.checked })}
                          className="w-3.5 h-3.5 accent-amber-400 rounded"
                          title="Bật/tắt ô Điểm bằng chữ"
                        />
                        <span className="w-24 text-[10px] text-slate-400">Ô Điểm bằng chữ:</span>
                        <input
                          type="text"
                          value={currentTemplate.layoutConfig?.scoreTextLabel ?? 'ĐIỂM BẰNG CHỮ'}
                          onChange={(e) => updateLayoutConfig({ scoreTextLabel: e.target.value })}
                          className="flex-1 p-1.5 bg-black/40 border border-white/10 rounded-lg text-white font-bold text-xs"
                        />
                      </div>

                      {/* Proctors 1 & 2 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-slate-400">Cán bộ chấm / Giám thị 1:</label>
                            <input
                              type="checkbox"
                              checked={currentTemplate.layoutConfig?.showProctor1 ?? true}
                              onChange={(e) => updateLayoutConfig({ showProctor1: e.target.checked })}
                              className="w-3 h-3 accent-amber-400 rounded"
                            />
                          </div>
                          <input
                            type="text"
                            value={currentTemplate.layoutConfig?.proctor1Label ?? 'CB CHẤM THI 1'}
                            onChange={(e) => updateLayoutConfig({ proctor1Label: e.target.value })}
                            className="w-full p-1 bg-black/40 border border-white/10 rounded-lg text-white text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-slate-400">Cán bộ chấm / Giám thị 2:</label>
                            <input
                              type="checkbox"
                              checked={currentTemplate.layoutConfig?.showProctor2 ?? true}
                              onChange={(e) => updateLayoutConfig({ showProctor2: e.target.checked })}
                              className="w-3 h-3 accent-amber-400 rounded"
                            />
                          </div>
                          <input
                            type="text"
                            value={currentTemplate.layoutConfig?.proctor2Label ?? 'CB CHẤM THI 2'}
                            onChange={(e) => updateLayoutConfig({ proctor2Label: e.target.value })}
                            className="w-full p-1 bg-black/40 border border-white/10 rounded-lg text-white text-xs font-semibold"
                          />
                        </div>
                      </div>

                      {/* Custom Fields in Score Box */}
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            Trường tùy chỉnh khung điểm số:
                          </span>
                          <button
                            onClick={handleAddScoreBoxCustomField}
                            className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm trường</span>
                          </button>
                        </div>

                        {(currentTemplate.layoutConfig?.scoreBoxCustomFields || []).length > 0 && (
                          <div className="space-y-1.5">
                            {(currentTemplate.layoutConfig?.scoreBoxCustomFields || []).map((field) => (
                              <div key={field.id} className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/5">
                                <input
                                  type="text"
                                  value={field.label}
                                  onChange={(e) => handleUpdateScoreBoxCustomField(field.id, e.target.value, field.value)}
                                  placeholder="Tiêu đề cột (VD: Mã phách)"
                                  className="flex-1 p-1 bg-transparent text-white font-medium text-xs focus:outline-none border-b border-transparent focus:border-amber-400"
                                />
                                <input
                                  type="text"
                                  value={field.value || ''}
                                  onChange={(e) => handleUpdateScoreBoxCustomField(field.id, field.label, e.target.value)}
                                  placeholder="Giá trị sẵn (để trống nếu viết tay)"
                                  className="w-28 p-1 bg-transparent text-slate-300 text-xs focus:outline-none border-b border-transparent focus:border-amber-400"
                                />
                                <button
                                  onClick={() => handleDeleteScoreBoxCustomField(field.id)}
                                  className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                                  title="Xóa trường này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dimensions & Position */}
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <span className="text-[10px] font-bold text-slate-300 block">Kích thước & Vị trí khung Điểm số:</span>

                        {/* Width & Height Sliders */}
                        <div className="grid grid-cols-2 gap-2 bg-black/30 p-2 rounded-xl border border-white/5">
                          <div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span>Độ rộng (W):</span>
                              <span className="font-mono text-amber-400">
                                {Math.round((currentTemplate.layoutConfig?.scoreBoxW ?? 0.46) * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  const cur = currentTemplate.layoutConfig?.scoreBoxW ?? 0.46;
                                  updateLayoutConfig({ scoreBoxW: Math.max(0.2, Number((cur - 0.02).toFixed(3))) });
                                }}
                                className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                              >-</button>
                              <input
                                type="range"
                                min="0.2"
                                max="0.95"
                                step="0.01"
                                value={currentTemplate.layoutConfig?.scoreBoxW ?? 0.46}
                                onChange={(e) => updateLayoutConfig({ scoreBoxW: parseFloat(e.target.value) })}
                                className="flex-1 h-1.5 bg-white/10 rounded-lg accent-amber-400 cursor-pointer"
                              />
                              <button
                                onClick={() => {
                                  const cur = currentTemplate.layoutConfig?.scoreBoxW ?? 0.46;
                                  updateLayoutConfig({ scoreBoxW: Math.min(0.95, Number((cur + 0.02).toFixed(3))) });
                                }}
                                className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                              >+</button>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span>Độ cao (H):</span>
                              <span className="font-mono text-amber-400">
                                {Math.round((currentTemplate.layoutConfig?.scoreBoxH ?? 0.055) * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  const cur = currentTemplate.layoutConfig?.scoreBoxH ?? 0.055;
                                  updateLayoutConfig({ scoreBoxH: Math.max(0.03, Number((cur - 0.005).toFixed(3))) });
                                }}
                                className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                              >-</button>
                              <input
                                type="range"
                                min="0.03"
                                max="0.20"
                                step="0.005"
                                value={currentTemplate.layoutConfig?.scoreBoxH ?? 0.055}
                                onChange={(e) => updateLayoutConfig({ scoreBoxH: parseFloat(e.target.value) })}
                                className="flex-1 h-1.5 bg-white/10 rounded-lg accent-amber-400 cursor-pointer"
                              />
                              <button
                                onClick={() => {
                                  const cur = currentTemplate.layoutConfig?.scoreBoxH ?? 0.055;
                                  updateLayoutConfig({ scoreBoxH: Math.min(0.20, Number((cur + 0.005).toFixed(3))) });
                                }}
                                className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                              >+</button>
                            </div>
                          </div>
                        </div>

                        {/* Directional Shift */}
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.scoreBoxX ?? 0.05;
                              updateLayoutConfig({ scoreBoxX: Math.max(0.01, Number((cur - 0.01).toFixed(3))) });
                            }}
                            className="py-1 px-1 bg-black/40 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-white/10 rounded-lg text-[10px] font-bold text-center"
                          >
                            ← Trái
                          </button>
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.scoreBoxX ?? 0.05;
                              updateLayoutConfig({ scoreBoxX: Math.min(0.8, Number((cur + 0.01).toFixed(3))) });
                            }}
                            className="py-1 px-1 bg-black/40 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-white/10 rounded-lg text-[10px] font-bold text-center"
                          >
                            Phải →
                          </button>
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.scoreBoxY ?? 0.22;
                              updateLayoutConfig({ scoreBoxY: Math.max(0.05, Number((cur - 0.01).toFixed(3))) });
                            }}
                            className="py-1 px-1 bg-black/40 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-white/10 rounded-lg text-[10px] font-bold text-center"
                          >
                            ↑ Lên
                          </button>
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.scoreBoxY ?? 0.22;
                              updateLayoutConfig({ scoreBoxY: Math.min(0.45, Number((cur + 0.01).toFixed(3))) });
                            }}
                            className="py-1 px-1 bg-black/40 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-white/10 rounded-lg text-[10px] font-bold text-center"
                          >
                            ↓ Xuống
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Khung Hướng Dẫn Tô Ô Tròn */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-2">
                      <CircleDot className="w-4 h-4 text-purple-400" />
                      Khung Hướng Dẫn Tô Ô Tròn
                    </span>
                    <input
                      type="checkbox"
                      checked={(currentTemplate.layoutConfig?.showInstructionsBox ?? currentTemplate.layoutConfig?.showInstructions) ?? true}
                      onChange={(e) => {
                        updateLayoutConfig({
                          showInstructionsBox: e.target.checked,
                          showInstructions: e.target.checked
                        });
                      }}
                      className="w-4 h-4 accent-purple-400 rounded cursor-pointer"
                    />
                  </div>

                  {((currentTemplate.layoutConfig?.showInstructionsBox ?? currentTemplate.layoutConfig?.showInstructions) ?? true) && (
                    <div className="space-y-2.5 pt-1 border-t border-white/5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-slate-400">Nội dung hướng dẫn:</label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateLayoutConfig({ instructionsBold: !(currentTemplate.layoutConfig?.instructionsBold ?? false) })}
                              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                                (currentTemplate.layoutConfig?.instructionsBold ?? false)
                                  ? 'bg-purple-500 text-white border-purple-400 font-black'
                                  : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                              }`}
                              title="In đậm hướng dẫn tô ô tròn"
                            >
                              <Bold className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateLayoutConfig({ instructionsItalic: !(currentTemplate.layoutConfig?.instructionsItalic ?? true) })}
                              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                                (currentTemplate.layoutConfig?.instructionsItalic ?? true)
                                  ? 'bg-purple-500 text-white border-purple-400'
                                  : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                              }`}
                              title="In nghiêng hướng dẫn tô ô tròn"
                            >
                              <Italic className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          value={currentTemplate.layoutConfig?.instructionsText ?? 'HƯỚNG DẪN TÔ ĐÁP ÁN: Dùng bút chì 2B tô tròn kín ô: [●] Đúng   |   [○] [◐] [x] [✓] Sai   |   Tẩy sạch nếu muốn đổi đáp án'}
                          onChange={(e) => updateLayoutConfig({ instructionsText: e.target.value })}
                          className="w-full p-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:border-cyan-500/50"
                        />
                      </div>

                      {/* Dimensions & Position */}
                      <div className="space-y-2 pt-1 border-t border-white/5">
                        <span className="text-[10px] font-bold text-slate-300 block">Kích thước & Vị trí khung Hướng dẫn:</span>

                        {/* Width & Height Sliders */}
                        <div className="grid grid-cols-2 gap-2 bg-black/30 p-2 rounded-xl border border-white/5">
                          <div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span>Độ rộng (W):</span>
                              <span className="font-mono text-purple-400">
                                {Math.round((currentTemplate.layoutConfig?.instructionsBoxW ?? 0.90) * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  const cur = currentTemplate.layoutConfig?.instructionsBoxW ?? 0.90;
                                  updateLayoutConfig({ instructionsBoxW: Math.max(0.3, Number((cur - 0.02).toFixed(3))) });
                                }}
                                className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                              >-</button>
                              <input
                                type="range"
                                min="0.3"
                                max="0.98"
                                step="0.01"
                                value={currentTemplate.layoutConfig?.instructionsBoxW ?? 0.90}
                                onChange={(e) => updateLayoutConfig({ instructionsBoxW: parseFloat(e.target.value) })}
                                className="flex-1 h-1.5 bg-white/10 rounded-lg accent-purple-400 cursor-pointer"
                              />
                              <button
                                onClick={() => {
                                  const cur = currentTemplate.layoutConfig?.instructionsBoxW ?? 0.90;
                                  updateLayoutConfig({ instructionsBoxW: Math.min(0.98, Number((cur + 0.02).toFixed(3))) });
                                }}
                                className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                              >+</button>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span>Độ cao (H):</span>
                              <span className="font-mono text-purple-400">
                                {Math.round((currentTemplate.layoutConfig?.instructionsBoxH ?? 0.03) * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  const cur = currentTemplate.layoutConfig?.instructionsBoxH ?? 0.03;
                                  updateLayoutConfig({ instructionsBoxH: Math.max(0.015, Number((cur - 0.005).toFixed(3))) });
                                }}
                                className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                              >-</button>
                              <input
                                type="range"
                                min="0.015"
                                max="0.12"
                                step="0.005"
                                value={currentTemplate.layoutConfig?.instructionsBoxH ?? 0.03}
                                onChange={(e) => updateLayoutConfig({ instructionsBoxH: parseFloat(e.target.value) })}
                                className="flex-1 h-1.5 bg-white/10 rounded-lg accent-purple-400 cursor-pointer"
                              />
                              <button
                                onClick={() => {
                                  const cur = currentTemplate.layoutConfig?.instructionsBoxH ?? 0.03;
                                  updateLayoutConfig({ instructionsBoxH: Math.min(0.12, Number((cur + 0.005).toFixed(3))) });
                                }}
                                className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                              >+</button>
                            </div>
                          </div>
                        </div>

                        {/* Directional Shift */}
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.instructionsBoxX ?? 0.05;
                              updateLayoutConfig({ instructionsBoxX: Math.max(0.01, Number((cur - 0.01).toFixed(3))) });
                            }}
                            className="py-1 px-1 bg-black/40 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 border border-white/10 rounded-lg text-[10px] font-bold text-center"
                          >
                            ← Trái
                          </button>
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.instructionsBoxX ?? 0.05;
                              updateLayoutConfig({ instructionsBoxX: Math.min(0.8, Number((cur + 0.01).toFixed(3))) });
                            }}
                            className="py-1 px-1 bg-black/40 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 border border-white/10 rounded-lg text-[10px] font-bold text-center"
                          >
                            Phải →
                          </button>
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.instructionsBoxY ?? (currentTemplate.layoutConfig?.instructionsYOffset ?? 0.26);
                              updateLayoutConfig({
                                instructionsBoxY: Math.max(0.08, Number((cur - 0.01).toFixed(3))),
                                instructionsYOffset: Math.max(0.08, Number((cur - 0.01).toFixed(3)))
                              });
                            }}
                            className="py-1 px-1 bg-black/40 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 border border-white/10 rounded-lg text-[10px] font-bold text-center"
                          >
                            ↑ Lên
                          </button>
                          <button
                            onClick={() => {
                              const cur = currentTemplate.layoutConfig?.instructionsBoxY ?? (currentTemplate.layoutConfig?.instructionsYOffset ?? 0.26);
                              updateLayoutConfig({
                                instructionsBoxY: Math.min(0.45, Number((cur + 0.01).toFixed(3))),
                                instructionsYOffset: Math.min(0.45, Number((cur + 0.01).toFixed(3)))
                              });
                            }}
                            className="py-1 px-1 bg-black/40 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 border border-white/10 rounded-lg text-[10px] font-bold text-center"
                          >
                            ↓ Xuống
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Chân Trang Phiếu Trả Lời (Footer) */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      5. Chân Trang Phiếu Trả Lời (Footer)
                    </span>
                    <input
                      type="checkbox"
                      checked={currentTemplate.layoutConfig?.showFooter !== false}
                      onChange={(e) => {
                        updateLayoutConfig({
                          showFooter: e.target.checked
                        });
                      }}
                      className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
                    />
                  </div>

                  {currentTemplate.layoutConfig?.showFooter !== false && (
                    <div className="space-y-3 pt-1 border-t border-white/5">
                      {/* Main Footer Text */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-slate-400">Nội dung chính chân trang:</label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateLayoutConfig({ footerBold: !(currentTemplate.layoutConfig?.footerBold ?? false) })}
                              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                                (currentTemplate.layoutConfig?.footerBold ?? false)
                                  ? 'bg-emerald-500 text-white border-emerald-400 font-black'
                                  : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                              }`}
                              title="In đậm chữ chân trang"
                            >
                              <Bold className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateLayoutConfig({ footerItalic: !(currentTemplate.layoutConfig?.footerItalic ?? false) })}
                              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition ${
                                (currentTemplate.layoutConfig?.footerItalic ?? false)
                                  ? 'bg-emerald-500 text-white border-emerald-400'
                                  : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                              }`}
                              title="In nghiêng chữ chân trang"
                            >
                              <Italic className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={currentTemplate.layoutConfig?.footerText ?? `Hệ thống chấm thi trắc nghiệm OMR • Phiên bản ${currentTemplate.version} • Mã phiếu: ${currentTemplate.id}`}
                          onChange={(e) => updateLayoutConfig({ footerText: e.target.value })}
                          placeholder="Ví dụ: Trường THPT Chu Văn An • Phiếu trả lời {numQuestions} câu"
                          className="w-full p-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:border-emerald-500/50"
                        />
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <span className="text-[9px] text-slate-500 self-center mr-0.5">Chèn thẻ:</span>
                          {[
                            { label: '+ Trường', tag: '{schoolName}' },
                            { label: '+ Số câu', tag: '{numQuestions}' },
                            { label: '+ Phiên bản', tag: '{version}' },
                            { label: '+ Mã phiếu', tag: '{templateId}' },
                            { label: '+ Khổ giấy', tag: '{paperSize}' }
                          ].map((t) => (
                            <button
                              key={t.tag}
                              type="button"
                              onClick={() => {
                                const cur = currentTemplate.layoutConfig?.footerText ?? `Hệ thống chấm thi trắc nghiệm OMR • Phiên bản ${currentTemplate.version} • Mã phiếu: ${currentTemplate.id}`;
                                updateLayoutConfig({ footerText: cur + ' ' + t.tag });
                              }}
                              className="px-1.5 py-0.5 bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 border border-white/10 rounded text-[9px]"
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Secondary Footer Text */}
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Dòng phụ / Ghi chú bảo mật / Bản quyền:</label>
                        <input
                          type="text"
                          value={currentTemplate.layoutConfig?.footerSecondaryText ?? ''}
                          onChange={(e) => updateLayoutConfig({ footerSecondaryText: e.target.value })}
                          placeholder="Ví dụ: Lưu hành nội bộ • Cấm sao chép dưới mọi hình thức"
                          className="w-full p-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:border-emerald-500/50"
                        />
                      </div>

                      {/* Footer Alignment */}
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1.5">Kiểu căn lề chân trang:</span>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { id: 'center', label: 'Căn giữa' },
                            { id: 'left', label: 'Căn trái' },
                            { id: 'right', label: 'Căn phải' },
                            { id: 'split', label: '2 Bên' }
                          ].map((al) => (
                            <button
                              key={al.id}
                              type="button"
                              onClick={() => updateLayoutConfig({ footerAlign: al.id as any })}
                              className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border transition ${
                                (currentTemplate.layoutConfig?.footerAlign || 'center') === al.id
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                                  : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                              }`}
                            >
                              {al.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Font Size and Y Offset */}
                      <div className="grid grid-cols-2 gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5">
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>Cỡ chữ:</span>
                            <span className="font-mono text-emerald-400">
                              {currentTemplate.layoutConfig?.footerFontSize || 15}px
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const cur = currentTemplate.layoutConfig?.footerFontSize || 15;
                                updateLayoutConfig({ footerFontSize: Math.max(10, cur - 1) });
                              }}
                              className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                            >-</button>
                            <input
                              type="range"
                              min="10"
                              max="24"
                              step="1"
                              value={currentTemplate.layoutConfig?.footerFontSize || 15}
                              onChange={(e) => updateLayoutConfig({ footerFontSize: parseInt(e.target.value) })}
                              className="flex-1 h-1.5 bg-white/10 rounded-lg accent-emerald-400 cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const cur = currentTemplate.layoutConfig?.footerFontSize || 15;
                                updateLayoutConfig({ footerFontSize: Math.min(24, cur + 1) });
                              }}
                              className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                            >+</button>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>Vị trí mép dưới (Y):</span>
                            <span className="font-mono text-emerald-400">
                              {Math.round((currentTemplate.layoutConfig?.footerYOffset ?? 0.985) * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const cur = currentTemplate.layoutConfig?.footerYOffset ?? 0.985;
                                updateLayoutConfig({ footerYOffset: Math.max(0.92, Number((cur - 0.005).toFixed(3))) });
                              }}
                              className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                            >-</button>
                            <input
                              type="range"
                              min="0.92"
                              max="0.995"
                              step="0.002"
                              value={currentTemplate.layoutConfig?.footerYOffset ?? 0.985}
                              onChange={(e) => updateLayoutConfig({ footerYOffset: parseFloat(e.target.value) })}
                              className="flex-1 h-1.5 bg-white/10 rounded-lg accent-emerald-400 cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const cur = currentTemplate.layoutConfig?.footerYOffset ?? 0.985;
                                updateLayoutConfig({ footerYOffset: Math.min(0.995, Number((cur + 0.005).toFixed(3))) });
                              }}
                              className="w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                            >+</button>
                          </div>
                        </div>
                      </div>

                      {/* Divider & Page Number toggles */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                        <label className="flex items-center gap-2 p-2 bg-black/20 rounded-xl border border-white/5 cursor-pointer hover:bg-white/5">
                          <input
                            type="checkbox"
                            checked={currentTemplate.layoutConfig?.showFooterDivider ?? false}
                            onChange={(e) => updateLayoutConfig({ showFooterDivider: e.target.checked })}
                            className="w-3.5 h-3.5 accent-emerald-400 rounded"
                          />
                          <span className="text-[10px] text-slate-300 font-medium">Kẻ vạch ngăn cách</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 bg-black/20 rounded-xl border border-white/5 cursor-pointer hover:bg-white/5">
                          <input
                            type="checkbox"
                            checked={currentTemplate.layoutConfig?.showFooterPageNumber ?? false}
                            onChange={(e) => updateLayoutConfig({ showFooterPageNumber: e.target.checked })}
                            className="w-3.5 h-3.5 accent-emerald-400 rounded"
                          />
                          <span className="text-[10px] text-slate-300 font-medium">Hiện số trang</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================= TAB 3: MÀU SẮC & GIAO DIỆN (STYLING & COLORS) ================= */}
            {sidebarTab === 'styling' && (
              <div className="space-y-4">
                {/* 1. Bubble Color & Palettes */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <CircleDot className="w-4 h-4 text-cyan-400" />
                    Màu Sắc Ô Tô Tròn (OMR Bubbles)
                  </span>

                  {/* Current color and hex picker */}
                  <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={currentTemplate.layoutConfig?.bubbleColor || '#000000'}
                        onChange={(e) => updateLayoutConfig({ bubbleColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-white/20 bg-transparent"
                      />
                      <div>
                        <span className="text-white font-mono font-bold text-xs block">
                          {currentTemplate.layoutConfig?.bubbleColor || '#000000'}
                        </span>
                        <span className="text-slate-400 text-[10px]">Mã màu viền & chữ ô tô</span>
                      </div>
                    </div>
                    <span
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold border"
                      style={{
                        borderColor: currentTemplate.layoutConfig?.bubbleColor || '#000000',
                        color: currentTemplate.layoutConfig?.bubbleColor || '#000000',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      (A) [●]
                    </span>
                  </div>

                  {/* Bubble Color Presets */}
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1.5">Bảng màu OMR chuyên dụng:</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { name: 'Đen OMR', color: '#000000' },
                        { name: 'Xanh Navy', color: '#1e3a8a' },
                        { name: 'Đỏ Mận', color: '#991b1b' },
                        { name: 'Xanh Rêu', color: '#166534' },
                        { name: 'Tím Than', color: '#581c87' },
                        { name: 'Xám Than', color: '#374151' }
                      ].map((item) => (
                        <button
                          key={item.color}
                          onClick={() => updateLayoutConfig({ bubbleColor: item.color })}
                          className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                            (currentTemplate.layoutConfig?.bubbleColor || '#000000').toLowerCase() === item.color.toLowerCase()
                              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold'
                              : 'border-white/10 bg-black/20 text-slate-300 hover:border-white/30'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-[10px] truncate">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bubble Inner Fill Color */}
                  <div className="pt-2 border-t border-white/5">
                    <span className="text-[10px] text-slate-400 block mb-1.5">Màu nền bên trong ô tròn:</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { name: 'Trắng', color: '#FFFFFF' },
                        { name: 'Xám nhạt', color: '#F1F5F9' },
                        { name: 'Xanh nhạt', color: '#EFF6FF' },
                        { name: 'Trong suốt', color: 'transparent' }
                      ].map((fill) => (
                        <button
                          key={fill.color}
                          onClick={() => updateLayoutConfig({ bubbleFillColor: fill.color })}
                          className={`py-1.5 px-1 rounded-lg border text-center text-[10px] font-semibold cursor-pointer transition ${
                            (currentTemplate.layoutConfig?.bubbleFillColor || '#FFFFFF') === fill.color
                              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                              : 'border-white/10 bg-black/20 text-slate-300 hover:border-white/20'
                          }`}
                        >
                          {fill.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Frames & Banner Colors */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-emerald-400" />
                    Khung Viền & Thanh Tiêu Đề
                  </span>

                  {/* Frame Border Color */}
                  <div className="flex items-center justify-between bg-black/30 p-2 rounded-xl border border-white/10">
                    <span className="text-slate-300 text-[11px]">Màu viền khung bảng:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentTemplate.layoutConfig?.frameBorderColor || '#000000'}
                        onChange={(e) => updateLayoutConfig({ frameBorderColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border border-white/20 bg-transparent"
                      />
                      <span className="text-white font-mono text-[11px]">
                        {currentTemplate.layoutConfig?.frameBorderColor || '#000000'}
                      </span>
                    </div>
                  </div>

                  {/* Header Banner Color */}
                  <div className="flex items-center justify-between bg-black/30 p-2 rounded-xl border border-white/10">
                    <span className="text-slate-300 text-[11px]">Màu nền thanh tiêu đề:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentTemplate.layoutConfig?.headerBannerColor || '#000000'}
                        onChange={(e) => updateLayoutConfig({ headerBannerColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border border-white/20 bg-transparent"
                      />
                      <span className="text-white font-mono text-[11px]">
                        {currentTemplate.layoutConfig?.headerBannerColor || '#000000'}
                      </span>
                    </div>
                  </div>

                  {/* Header Banner Text Color */}
                  <div className="flex items-center justify-between bg-black/30 p-2 rounded-xl border border-white/10">
                    <span className="text-slate-300 text-[11px]">Màu chữ thanh tiêu đề:</span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { name: 'Trắng', color: '#FFFFFF' },
                        { name: 'Đen', color: '#000000' },
                        { name: 'Vàng', color: '#FEF08A' }
                      ].map((tCol) => (
                        <button
                          key={tCol.color}
                          onClick={() => updateLayoutConfig({ headerBannerTextColor: tCol.color })}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                            (currentTemplate.layoutConfig?.headerBannerTextColor || '#FFFFFF') === tCol.color
                              ? 'bg-cyan-500 text-black border-cyan-400'
                              : 'bg-black/30 text-slate-300 border-white/10'
                          }`}
                        >
                          {tCol.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Typography & Text Colors */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                    Màu Chữ Từng Khu Vực (Typography Colors)
                  </span>

                  {/* General / Default Text Color */}
                  <div className="flex items-center justify-between bg-black/30 p-2 rounded-xl border border-white/10">
                    <div>
                      <span className="text-slate-300 text-[11px] block">Màu chữ mặc định toàn phiếu:</span>
                      <span className="text-slate-500 text-[9px]">Áp dụng cho các phần không cấu hình riêng</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentTemplate.layoutConfig?.textColor || '#000000'}
                        onChange={(e) => updateLayoutConfig({ textColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border border-white/20 bg-transparent"
                      />
                      <span className="text-white font-mono text-[11px]">
                        {currentTemplate.layoutConfig?.textColor || '#000000'}
                      </span>
                    </div>
                  </div>

                  {/* Header & Meta Text Color */}
                  <div className="flex items-center justify-between bg-black/30 p-2 rounded-xl border border-white/10">
                    <span className="text-slate-300 text-[11px]">Chữ Thông tin & Tiêu đề đầu trang:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentTemplate.layoutConfig?.headerTextColor || currentTemplate.layoutConfig?.textColor || '#000000'}
                        onChange={(e) => updateLayoutConfig({ headerTextColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border border-white/20 bg-transparent"
                      />
                      <span className="text-white font-mono text-[11px]">
                        {currentTemplate.layoutConfig?.headerTextColor || currentTemplate.layoutConfig?.textColor || '#000000'}
                      </span>
                    </div>
                  </div>

                  {/* Student Box Text Color */}
                  <div className="flex items-center justify-between bg-black/30 p-2 rounded-xl border border-white/10">
                    <span className="text-slate-300 text-[11px]">Chữ Khung thông tin thí sinh:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentTemplate.layoutConfig?.studentBoxTextColor || currentTemplate.layoutConfig?.textColor || '#000000'}
                        onChange={(e) => updateLayoutConfig({ studentBoxTextColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border border-white/20 bg-transparent"
                      />
                      <span className="text-white font-mono text-[11px]">
                        {currentTemplate.layoutConfig?.studentBoxTextColor || currentTemplate.layoutConfig?.textColor || '#000000'}
                      </span>
                    </div>
                  </div>

                  {/* Score Box Text Color */}
                  <div className="flex items-center justify-between bg-black/30 p-2 rounded-xl border border-white/10">
                    <span className="text-slate-300 text-[11px]">Chữ Khung điểm số & Cán bộ chấm:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentTemplate.layoutConfig?.scoreBoxTextColor || currentTemplate.layoutConfig?.textColor || '#000000'}
                        onChange={(e) => updateLayoutConfig({ scoreBoxTextColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border border-white/20 bg-transparent"
                      />
                      <span className="text-white font-mono text-[11px]">
                        {currentTemplate.layoutConfig?.scoreBoxTextColor || currentTemplate.layoutConfig?.textColor || '#000000'}
                      </span>
                    </div>
                  </div>

                  {/* Instructions Text Color */}
                  <div className="flex items-center justify-between bg-black/30 p-2 rounded-xl border border-white/10">
                    <span className="text-slate-300 text-[11px]">Chữ Khung hướng dẫn tô đáp án:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentTemplate.layoutConfig?.instructionsTextColor || currentTemplate.layoutConfig?.textColor || '#000000'}
                        onChange={(e) => updateLayoutConfig({ instructionsTextColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border border-white/20 bg-transparent"
                      />
                      <span className="text-white font-mono text-[11px]">
                        {currentTemplate.layoutConfig?.instructionsTextColor || currentTemplate.layoutConfig?.textColor || '#000000'}
                      </span>
                    </div>
                  </div>

                  {/* Footer Text Color */}
                  <div className="flex items-center justify-between bg-black/30 p-2 rounded-xl border border-white/10">
                    <span className="text-slate-300 text-[11px]">Chữ Chân trang phiếu (Footer):</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentTemplate.layoutConfig?.footerTextColor || currentTemplate.layoutConfig?.textColor || '#000000'}
                        onChange={(e) => updateLayoutConfig({ footerTextColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border border-white/20 bg-transparent"
                      />
                      <span className="text-white font-mono text-[11px]">
                        {currentTemplate.layoutConfig?.footerTextColor || currentTemplate.layoutConfig?.textColor || '#000000'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Quick Visual Themes */}
                <div className="p-3.5 bg-gradient-to-r from-cyan-950/40 to-blue-950/40 rounded-2xl border border-cyan-500/30 space-y-2.5">
                  <span className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Bộ Giao Diện Phối Màu Nhanh
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        updateLayoutConfig({
                          bubbleColor: '#000000',
                          bubbleFillColor: '#FFFFFF',
                          frameBorderColor: '#000000',
                          headerBannerColor: '#000000',
                          headerBannerTextColor: '#FFFFFF'
                        });
                      }}
                      className="p-2 bg-black/50 hover:bg-black/80 border border-white/20 rounded-xl text-left cursor-pointer transition hover:border-cyan-400"
                    >
                      <span className="font-bold text-white text-[11px] block">Đen Trắng OMR</span>
                      <span className="text-[9px] text-slate-400">Tiêu chuẩn in offset & photocopy</span>
                    </button>

                    <button
                      onClick={() => {
                        updateLayoutConfig({
                          bubbleColor: '#1e3a8a',
                          bubbleFillColor: '#FFFFFF',
                          frameBorderColor: '#1e3a8a',
                          headerBannerColor: '#1e3a8a',
                          headerBannerTextColor: '#FFFFFF'
                        });
                      }}
                      className="p-2 bg-blue-950/50 hover:bg-blue-950/80 border border-blue-500/30 rounded-xl text-left cursor-pointer transition hover:border-blue-400"
                    >
                      <span className="font-bold text-blue-300 text-[11px] block">Xanh Navy</span>
                      <span className="text-[9px] text-slate-400">Học đường trang trọng</span>
                    </button>

                    <button
                      onClick={() => {
                        updateLayoutConfig({
                          bubbleColor: '#991b1b',
                          bubbleFillColor: '#FFFFFF',
                          frameBorderColor: '#991b1b',
                          headerBannerColor: '#991b1b',
                          headerBannerTextColor: '#FFFFFF'
                        });
                      }}
                      className="p-2 bg-rose-950/50 hover:bg-rose-950/80 border border-rose-500/30 rounded-xl text-left cursor-pointer transition hover:border-rose-400"
                    >
                      <span className="font-bold text-rose-300 text-[11px] block">Đỏ Mận Năng Động</span>
                      <span className="text-[9px] text-slate-400">Kiểm tra định kỳ nổi bật</span>
                    </button>

                    <button
                      onClick={() => {
                        updateLayoutConfig({
                          bubbleColor: '#166534',
                          bubbleFillColor: '#FFFFFF',
                          frameBorderColor: '#166534',
                          headerBannerColor: '#166534',
                          headerBannerTextColor: '#FFFFFF'
                        });
                      }}
                      className="p-2 bg-emerald-950/50 hover:bg-emerald-950/80 border border-emerald-500/30 rounded-xl text-left cursor-pointer transition hover:border-emerald-400"
                    >
                      <span className="font-bold text-emerald-300 text-[11px] block">Xanh Lá Hiện Đại</span>
                      <span className="text-[9px] text-slate-400">Tươi sáng, thân thiện</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 4: Ô NHẬN DIỆN OMR (INSPECTOR) ================= */}
            {sidebarTab === 'omr' && (
              <div className="space-y-4">
                {/* MULTI-SELECTION BATCH INSPECTOR */}
                {selectedZones.length > 1 ? (
                  <div className="space-y-4">
                    {/* Multi-Selection Badge */}
                    <div className="p-3.5 bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border border-cyan-500/40 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                          <BoxSelect className="w-4 h-4 text-cyan-400" />
                          Đang chọn {selectedZones.length} ô trắc nghiệm
                        </span>
                        <button
                          onClick={handleDeselectAll}
                          className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {selectedZones.filter(z => z.type === 'bubble').length} ô đáp án •{' '}
                        {Array.from(new Set(selectedZones.map(z => z.questionNumber).filter(Boolean))).length} câu hỏi
                      </p>
                    </div>

                    {/* 1. BATCH ALIGNMENT & DISTRIBUTION */}
                    <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                        Căn Chỉnh Hàng & Cột
                      </span>

                      {/* Horizontal Alignment */}
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium block mb-1">Căn theo chiều dọc (X):</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            onClick={handleAlignLeft}
                            className="py-1.5 px-2 bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                            title="Căn thẳng lề trái"
                          >
                            <AlignLeft className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Căn trái</span>
                          </button>
                          <button
                            onClick={handleAlignCenterX}
                            className="py-1.5 px-2 bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                            title="Căn giữa trục dọc"
                          >
                            <AlignCenter className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Căn giữa</span>
                          </button>
                          <button
                            onClick={handleAlignRight}
                            className="py-1.5 px-2 bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                            title="Căn thẳng lề phải"
                          >
                            <AlignRight className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Căn phải</span>
                          </button>
                        </div>
                      </div>

                      {/* Vertical Alignment */}
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium block mb-1">Căn theo chiều ngang (Y):</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            onClick={handleAlignTop}
                            className="py-1.5 px-2 bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                            title="Căn thẳng hàng mép trên"
                          >
                            <AlignVerticalJustifyStart className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Căn trên</span>
                          </button>
                          <button
                            onClick={handleCenterY}
                            className="py-1.5 px-2 bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                            title="Căn giữa hàng ngang"
                          >
                            <AlignVerticalJustifyCenter className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Giữa hàng</span>
                          </button>
                          <button
                            onClick={handleAlignBottom}
                            className="py-1.5 px-2 bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                            title="Căn thẳng hàng mép dưới"
                          >
                            <AlignVerticalJustifyEnd className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Căn dưới</span>
                          </button>
                        </div>
                      </div>

                      {/* Distribution */}
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium block mb-1">Dàn đều khoảng cách:</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={handleDistributeH}
                            className="py-1.5 px-2 bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                            title="Chia đều khoảng cách các cột ngang"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Dàn đều ngang</span>
                          </button>
                          <button
                            onClick={handleDistributeV}
                            className="py-1.5 px-2 bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                            title="Chia đều khoảng cách các hàng dọc"
                          >
                            <ArrowDownUp className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Dàn đều dọc</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 2. BATCH QUESTION NUMBERING */}
                    <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <ListOrdered className="w-3.5 h-3.5 text-indigo-400" />
                        Đánh Số Câu Hỏi Hàng Loạt
                      </span>

                      {/* Sequential numbering */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-slate-400 font-medium block">
                          Đánh số thứ tự liên tiếp các hàng:
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs text-slate-300">
                            <span>Từ câu:</span>
                            <input
                              type="number"
                              min={1}
                              max={120}
                              value={batchStartQuestion}
                              onChange={(e) => setBatchStartQuestion(parseInt(e.target.value, 10) || 1)}
                              className="w-16 p-1.5 text-xs font-bold bg-black/40 border border-white/10 rounded-lg text-cyan-300 text-center"
                            />
                          </div>
                          <button
                            onClick={() => handleBatchSequentialNumbering(batchStartQuestion)}
                            className="flex-1 py-1.5 px-2.5 bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                          >
                            Đánh số liên tiếp
                          </button>
                        </div>
                      </div>

                      {/* Offset / Shift question numbers */}
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium block mb-1">
                          Dịch chuyển số câu (+/-):
                        </span>
                        <div className="grid grid-cols-6 gap-1">
                          {[-10, -5, -1, 1, 5, 10].map(delta => (
                            <button
                              key={delta}
                              onClick={() => handleOffsetQuestionNumbers(delta)}
                              className="py-1 text-[11px] font-mono font-bold bg-black/40 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-300 border border-white/10 rounded-lg transition cursor-pointer"
                            >
                              {delta > 0 ? `+${delta}` : delta}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Set all to fixed question number */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] text-slate-400 shrink-0">Đổi tất cả thành câu:</span>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={batchTargetQuestion}
                          onChange={(e) => setBatchTargetQuestion(parseInt(e.target.value, 10) || 1)}
                          className="w-14 p-1 text-xs font-bold bg-black/40 border border-white/10 rounded-lg text-cyan-300 text-center"
                        />
                        <button
                          onClick={() => handleSetFixedQuestionNumber(batchTargetQuestion)}
                          className="py-1 px-2 text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-lg transition cursor-pointer"
                        >
                          Gán
                        </button>
                      </div>
                    </div>

                    {/* 3. BATCH OPTION ASSIGNMENT */}
                    <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Type className="w-3.5 h-3.5 text-emerald-400" />
                        Phương Án Lựa Chọn (A-B-C-D)
                      </span>

                      {/* Auto Assign A-D in each row */}
                      <button
                        onClick={handleBatchAutoAssignOptions}
                        className="w-full py-2 px-3 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                      >
                        <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Tự động gán A → D theo hàng ngang</span>
                      </button>

                      {/* Batch set single option */}
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium block mb-1">
                          Gán tất cả thành cùng một phương án:
                        </span>
                        <div className="grid grid-cols-5 gap-1.5">
                          {(['A', 'B', 'C', 'D', 'E'] as BubbleOption[]).map(opt => (
                            <button
                              key={opt}
                              onClick={() => handleBatchSetSingleOption(opt)}
                              className="py-1.5 font-bold text-xs bg-black/40 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 rounded-xl transition cursor-pointer"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 4. BATCH ACTIONS (DUPLICATE & DELETE) */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={handleDuplicateSelectedZones}
                        className="py-2 px-3 bg-blue-950/50 hover:bg-blue-900/60 text-blue-300 border border-blue-500/30 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                        title="Nhân bản các ô đã chọn sang cột mới"
                      >
                        <Copy className="w-3.5 h-3.5 text-blue-400" />
                        <span>Nhân bản ({selectedZones.length})</span>
                      </button>

                      <button
                        onClick={handleDeleteSelectedZones}
                        className="py-2 px-3 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Xóa ({selectedZones.length} ô)</span>
                      </button>
                    </div>
                  </div>
                ) : singleSelectedZone ? (
                  /* SINGLE ZONE INSPECTOR */
                  <div className="space-y-4">
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                      <span className="text-[11px] font-bold text-cyan-400 uppercase">Ô trắc nghiệm đang chọn</span>
                      <p className="text-sm font-bold text-white">
                        {singleSelectedZone.type === 'bubble'
                          ? `Câu ${singleSelectedZone.questionNumber || 1} - Lựa chọn ${singleSelectedZone.option || 'A'}`
                          : singleSelectedZone.label || singleSelectedZone.type}
                      </p>
                    </div>

                    {/* Zone Type */}
                    <div>
                      <label className="text-xs font-semibold text-slate-300">{t.template.zoneType}</label>
                      <select
                        value={singleSelectedZone.type}
                        onChange={(e) => {
                          const newType = e.target.value as ZoneType;
                          let newLabel = singleSelectedZone.label;
                          if (newType === 'exam_code_bubble') {
                            newLabel = `Mã[${singleSelectedZone.digitPosition ?? 0}]=${singleSelectedZone.digitValue ?? 0}`;
                          } else if (newType === 'student_id_bubble') {
                            newLabel = `SBD[${singleSelectedZone.digitPosition ?? 0}]=${singleSelectedZone.digitValue ?? 0}`;
                          } else if (newType === 'bubble') {
                            newLabel = `Q${singleSelectedZone.questionNumber || 1}-${singleSelectedZone.option || 'A'}`;
                          }
                          updateSingleZone({ type: newType, label: newLabel });
                        }}
                        className="w-full mt-1 text-xs border border-white/10 rounded-xl p-2.5 bg-white/5 text-white font-medium focus:outline-hidden focus:border-cyan-500/50"
                      >
                        <option value="bubble" className="bg-slate-900 text-white">Ô Tròn Đáp Án (Answer Bubble)</option>
                        <option value="student_id_bubble" className="bg-slate-900 text-white">Ô Mã Học Sinh / SBD (Số Báo Danh)</option>
                        <option value="exam_code_bubble" className="bg-slate-900 text-white">Ô Mã Đề Thi (Exam Code Bubble)</option>
                        <option value="student_id_qr" className="bg-slate-900 text-white">Vùng Mã QR / Barcode</option>
                        <option value="anchor_mark" className="bg-slate-900 text-white">Điểm Neo Căn Chỉnh (Anchor Mark)</option>
                      </select>
                    </div>

                    {/* If bubble: Question number & Option */}
                    {singleSelectedZone.type === 'bubble' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-300">{t.template.questionNum}</label>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            value={singleSelectedZone.questionNumber || 1}
                            onChange={(e) => updateSingleZone({
                              questionNumber: parseInt(e.target.value, 10) || 1,
                              label: `Q${parseInt(e.target.value, 10) || 1}-${singleSelectedZone.option || 'A'}`
                            })}
                            className="w-full mt-1 text-xs border border-white/10 rounded-xl p-2 bg-white/5 text-white font-bold focus:outline-hidden focus:border-cyan-500/50"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-300">{t.template.optionLetter}</label>
                          <select
                            value={singleSelectedZone.option || 'A'}
                            onChange={(e) => updateSingleZone({
                              option: e.target.value as BubbleOption,
                              label: `Q${singleSelectedZone.questionNumber || 1}-${e.target.value}`
                            })}
                            className="w-full mt-1 text-xs border border-white/10 rounded-xl p-2 bg-white/5 text-white font-bold focus:outline-hidden focus:border-cyan-500/50"
                          >
                            <option value="A" className="bg-slate-900 text-white">Lựa chọn A</option>
                            <option value="B" className="bg-slate-900 text-white">Lựa chọn B</option>
                            <option value="C" className="bg-slate-900 text-white">Lựa chọn C</option>
                            <option value="D" className="bg-slate-900 text-white">Lựa chọn D</option>
                            <option value="E" className="bg-slate-900 text-white">Lựa chọn E</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* If student_id_bubble or exam_code_bubble: Digit Position & Digit Value */}
                    {(singleSelectedZone.type === 'student_id_bubble' || singleSelectedZone.type === 'exam_code_bubble') && (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-blue-950/20 rounded-2xl border border-blue-500/20">
                        <div>
                          <label className="text-xs font-semibold text-cyan-300">
                            {singleSelectedZone.type === 'exam_code_bubble' ? 'Cột Mã Đề (0-based)' : 'Cột SBD (0-based)'}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={9}
                            value={singleSelectedZone.digitPosition ?? 0}
                            onChange={(e) => {
                              const pos = parseInt(e.target.value, 10) || 0;
                              const val = singleSelectedZone.digitValue ?? 0;
                              const prefix = singleSelectedZone.type === 'exam_code_bubble' ? 'Mã' : 'SBD';
                              updateSingleZone({
                                digitPosition: pos,
                                label: `${prefix}[${pos}]=${val}`
                              });
                            }}
                            className="w-full mt-1 text-xs border border-white/10 rounded-xl p-2 bg-white/5 text-white font-bold focus:outline-hidden focus:border-cyan-500/50"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-cyan-300">Chữ số (0 - 9)</label>
                          <select
                            value={singleSelectedZone.digitValue ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              const pos = singleSelectedZone.digitPosition ?? 0;
                              const prefix = singleSelectedZone.type === 'exam_code_bubble' ? 'Mã' : 'SBD';
                              updateSingleZone({
                                digitValue: val,
                                label: `${prefix}[${pos}]=${val}`
                              });
                            }}
                            className="w-full mt-1 text-xs border border-white/10 rounded-xl p-2 bg-white/5 text-white font-bold focus:outline-hidden focus:border-cyan-500/50"
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                              <option key={num} value={num} className="bg-slate-900 text-white">Số {num}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Normalized Coordinates */}
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-2 text-xs">
                      <span className="font-bold text-slate-200 block text-[11px]">{t.template.normCoords}</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-400 text-[10px]">Tọa độ X:</span>
                          <input
                            type="number"
                            step="0.001"
                            value={singleSelectedZone.x}
                            onChange={(e) => updateSingleZone({ x: parseFloat(e.target.value) || 0 })}
                            className="w-full text-xs font-mono border border-white/10 rounded-lg p-1 bg-black/40 text-cyan-300"
                          />
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px]">Tọa độ Y:</span>
                          <input
                            type="number"
                            step="0.001"
                            value={singleSelectedZone.y}
                            onChange={(e) => updateSingleZone({ y: parseFloat(e.target.value) || 0 })}
                            className="w-full text-xs font-mono border border-white/10 rounded-lg p-1 bg-black/40 text-cyan-300"
                          />
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px]">Rộng (W):</span>
                          <input
                            type="number"
                            step="0.001"
                            value={singleSelectedZone.width}
                            onChange={(e) => updateSingleZone({ width: parseFloat(e.target.value) || 0 })}
                            className="w-full text-xs font-mono border border-white/10 rounded-lg p-1 bg-black/40 text-cyan-300"
                          />
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px]">Cao (H):</span>
                          <input
                            type="number"
                            step="0.001"
                            value={singleSelectedZone.height}
                            onChange={(e) => updateSingleZone({ height: parseFloat(e.target.value) || 0 })}
                            className="w-full text-xs font-mono border border-white/10 rounded-lg p-1 bg-black/40 text-cyan-300"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Fill threshold */}
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300">{t.template.thresholdSetting}</span>
                        <span className="font-mono font-bold text-cyan-400">
                          {Math.round((singleSelectedZone.threshold || currentTemplate.fillThreshold || 0.35) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.8"
                        step="0.02"
                        value={singleSelectedZone.threshold || currentTemplate.fillThreshold || 0.35}
                        onChange={(e) => updateSingleZone({ threshold: parseFloat(e.target.value) })}
                        className="w-full mt-2 accent-cyan-400"
                      />
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={handleDeleteSelectedZones}
                      className="w-full py-2 bg-rose-950/40 hover:bg-rose-950/60 text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa vùng nhận diện này</span>
                    </button>
                  </div>
                ) : (
                  /* NO SELECTION GUIDE */
                  <div className="space-y-4">
                    <div className="text-center py-6 px-4 border border-dashed border-white/10 rounded-2xl space-y-2 text-slate-400">
                      <BoxSelect className="w-8 h-8 mx-auto text-cyan-400" />
                      <p className="text-xs font-bold text-white">Kéo chuột trên phiếu để chọn nhiều ô</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Nhấp chuột vào vùng trống và kéo hộp (Marquee Box) để quét chọn nhiều câu hỏi cùng lúc, hoặc giữ phím <kbd className="px-1 py-0.5 bg-white/10 rounded text-cyan-300">Shift</kbd> + nhấp để chọn thêm.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="py-2 px-2.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-xl transition cursor-pointer"
                      >
                        Chọn tất cả (Ctrl+A)
                      </button>
                      <button
                        onClick={handleSelectAllBubbles}
                        className="py-2 px-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold rounded-xl transition cursor-pointer"
                      >
                        Chọn các ô đáp án
                      </button>
                      <button
                        onClick={handleSelectSbdBubbles}
                        className="py-2 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-xl transition cursor-pointer"
                      >
                        Chọn các ô SBD
                      </button>
                      <button
                        onClick={handleSelectExamCodeBubbles}
                        className="py-2 px-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold rounded-xl transition cursor-pointer"
                      >
                        Chọn các ô Mã Đề
                      </button>
                    </div>
                  </div>
                )}

                {/* Batch Bubble Sizing Slider */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                      Kích thước ô tròn ({selectedZoneIds.length > 0 ? `${selectedZoneIds.length} ô chọn` : 'Toàn bộ'}):
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {[80, 100, 120, 140].map(scale => (
                      <button
                        key={scale}
                        onClick={() => handleScaleAllBubbles(scale)}
                        className="py-1 px-1.5 text-[11px] font-mono font-bold bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/40 rounded-lg transition cursor-pointer"
                      >
                        {scale}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auto-Grid Modal */}
      {showAutoGridModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#0E131F] rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-cyan-500/30">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-base">
              <Grid className="w-5 h-5 text-cyan-400" />
              <span>Tạo Lưới Câu Hỏi OMR Tự Động</span>
            </div>
            <p className="text-xs text-slate-400">
              Hệ thống sẽ tự động tính toán và rải đều các ô tròn OMR theo cấu trúc cột và vị trí bạn chọn.
            </p>

            <div className="space-y-3.5">
              {/* Quick Presets */}
              <div>
                <label className="text-xs font-semibold text-slate-300">Mẫu nhanh theo số câu:</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {[
                    { q: 20, col: 1 },
                    { q: 40, col: 2 },
                    { q: 50, col: 2 },
                    { q: 60, col: 4 },
                    { q: 80, col: 4 },
                    { q: 100, col: 4 },
                    { q: 120, col: 4 }
                  ].map(item => (
                    <button
                      key={item.q}
                      type="button"
                      onClick={() => setAutoGridConfig(prev => ({ ...prev, numQuestions: item.q, columnsCount: item.col }))}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        autoGridConfig.numQuestions === item.q && autoGridConfig.columnsCount === item.col
                          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                          : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {item.q} câu ({item.col} cột)
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Số lượng câu:</label>
                  <input
                    type="number"
                    min={1}
                    max={150}
                    value={autoGridConfig.numQuestions}
                    onChange={(e) => setAutoGridConfig(prev => ({ ...prev, numQuestions: parseInt(e.target.value, 10) || 40 }))}
                    className="w-full mt-1 text-xs border border-white/10 rounded-xl p-2.5 bg-white/5 text-white font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Số đáp án / câu:</label>
                  <select
                    value={autoGridConfig.numOptions}
                    onChange={(e) => setAutoGridConfig(prev => ({ ...prev, numOptions: parseInt(e.target.value, 10) || 4 }))}
                    className="w-full mt-1 text-xs border border-white/10 rounded-xl p-2.5 bg-white/5 text-white"
                  >
                    <option value={2} className="bg-slate-900 text-white">2 đáp án (Đúng/Sai)</option>
                    <option value={3} className="bg-slate-900 text-white">3 đáp án (A-C)</option>
                    <option value={4} className="bg-slate-900 text-white">4 đáp án (A-D)</option>
                    <option value={5} className="bg-slate-900 text-white">5 đáp án (A-E)</option>
                    <option value={6} className="bg-slate-900 text-white">6 đáp án (A-F)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Số cột hiển thị:</label>
                  <select
                    value={autoGridConfig.columnsCount}
                    onChange={(e) => setAutoGridConfig(prev => ({ ...prev, columnsCount: parseInt(e.target.value, 10) || 2 }))}
                    className="w-full mt-1 text-xs border border-white/10 rounded-xl p-2.5 bg-white/5 text-white font-bold"
                  >
                    <option value={1} className="bg-slate-900 text-white">1 Cột</option>
                    <option value={2} className="bg-slate-900 text-white">2 Cột (Chuẩn)</option>
                    <option value={3} className="bg-slate-900 text-white">3 Cột</option>
                    <option value={4} className="bg-slate-900 text-white">4 Cột</option>
                    <option value={5} className="bg-slate-900 text-white">5 Cột</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Hướng đánh số thứ tự:</label>
                  <select
                    value={autoGridConfig.direction}
                    onChange={(e) => setAutoGridConfig(prev => ({ ...prev, direction: e.target.value as 'column_first' | 'row_first' }))}
                    className="w-full mt-1 text-xs border border-white/10 rounded-xl p-2.5 bg-white/5 text-white"
                  >
                    <option value="column_first" className="bg-slate-900 text-white">Dọc từng cột (Q1..20, Q21..40)</option>
                    <option value="row_first" className="bg-slate-900 text-white">Ngang hàng (Q1, Q2, Q3...)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Bắt đầu từ câu số:</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={autoGridConfig.startQuestion}
                    onChange={(e) => setAutoGridConfig(prev => ({ ...prev, startQuestion: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full mt-1 text-xs border border-white/10 rounded-xl p-2.5 bg-white/5 text-white font-bold"
                  />
                </div>
              </div>

              {/* Offset Position */}
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Vị trí bắt đầu câu hỏi (Từ trên xuống):</span>
                  <span className="font-mono text-cyan-400 font-bold">{Math.round(autoGridConfig.yStart * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="0.45"
                  step="0.01"
                  value={autoGridConfig.yStart}
                  onChange={(e) => setAutoGridConfig(prev => ({ ...prev, yStart: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAutoGridModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer"
              >
                {t.actions.cancel}
              </button>
              <button
                type="button"
                onClick={handleApplyAutoGrid}
                className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                Khởi tạo lưới ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print & Export PDF Modal */}
      {showPrintModal && (
        <TemplatePrintModal
          template={{
            ...currentTemplate,
            backgroundImageUrl: customBgImage || currentTemplate.backgroundImageUrl
          }}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
