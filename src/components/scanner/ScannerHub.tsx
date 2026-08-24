import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { BubbleOption, ExamSubmission, Exam } from '../../types';
import { processAnswerSheet } from '../../services/omrEngine';
import { createSimulatedFilledSheet } from '../../services/templateGenerator';
import { processUploadedFileToImages } from '../../services/pdfService';
import { NavTab } from '../common/Sidebar';
import { ScanInspectionModal } from './ScanInspectionModal';
import {
  ScanLine,
  Upload,
  Camera,
  Play,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Eye,
  Sliders,
  Layers,
  ArrowRight,
  Sparkles,
  FileText,
  Crosshair,
  Maximize2,
  SwitchCamera,
  Flashlight
} from 'lucide-react';

interface ScannerHubProps {
  onNavigate: (tab: NavTab) => void;
}

export const ScannerHub: React.FC<ScannerHubProps> = ({ onNavigate }) => {
  const { t, exams, activeExam, setActiveExamId, templates, students, addSubmissions, addExam } = useApp();

  const [activeTab, setActiveTab] = useState<'upload' | 'camera' | 'demo'>('upload');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [currentPipelineStep, setCurrentPipelineStep] = useState<string>('');
  const [processedBatchResults, setProcessedBatchResults] = useState<ExamSubmission[]>([]);
  const [inspectingSubmission, setInspectingSubmission] = useState<ExamSubmission | null>(null);

  // Camera guides state
  const [showHudSectionFrames, setShowHudSectionFrames] = useState<boolean>(true);
  const [showHudAnchors, setShowHudAnchors] = useState<boolean>(true);

  // Camera state & mobile facing mode
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Selected Exam & Template
  const currentExam = activeExam || exams[0];
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    return currentExam?.templateId || templates[0]?.id || '';
  });

  // Keep selectedTemplateId in sync if currentExam changes
  useEffect(() => {
    if (currentExam?.templateId) {
      setSelectedTemplateId(currentExam.templateId);
    }
  }, [currentExam?.templateId]);

  const currentTemplate = templates.find(t => t.id === selectedTemplateId) || templates.find(t => t.id === currentExam?.templateId) || templates[0];

  // Extract or compute 4 anchor marks according to the selected template
  const templateAnchors = (currentTemplate?.zones || []).filter(z => z.type === 'anchor_mark');
  const activeAnchors = (() => {
    if (templateAnchors.length >= 4) {
      return templateAnchors.slice(0, 4);
    }
    if (templateAnchors.length > 0) {
      return templateAnchors;
    }
    // Fallback standard 4 corner anchors (Normalized coordinates on A4 sheet)
    return [
      { id: 'anchor_tl', type: 'anchor_mark' as const, x: 0.04, y: 0.035, width: 0.035, height: 0.02, label: 'Neo 1 (Trên-Trái)' },
      { id: 'anchor_tr', type: 'anchor_mark' as const, x: 0.925, y: 0.035, width: 0.035, height: 0.02, label: 'Neo 2 (Trên-Phải)' },
      { id: 'anchor_bl', type: 'anchor_mark' as const, x: 0.04, y: 0.945, width: 0.035, height: 0.02, label: 'Neo 3 (Dưới-Trái)' },
      { id: 'anchor_br', type: 'anchor_mark' as const, x: 0.925, y: 0.945, width: 0.035, height: 0.02, label: 'Neo 4 (Dưới-Phải)' }
    ];
  })();

  // Compute normalized section bounds for HUD viewfinder overlay
  const sectionBounds = (() => {
    const zones = currentTemplate?.zones || [];
    const sbdZones = zones.filter(z => z.type === 'student_id_bubble');
    const codeZones = zones.filter(z => z.type === 'exam_code_bubble');
    const qZones = zones.filter(z => z.type === 'bubble');
    const qrZones = zones.filter(z => z.type === 'student_id_qr');

    return {
      sbd: sbdZones.length > 0 ? {
        x: Math.min(...sbdZones.map(z => z.x)),
        y: Math.min(...sbdZones.map(z => z.y)),
        w: Math.max(...sbdZones.map(z => z.x + z.width)) - Math.min(...sbdZones.map(z => z.x)),
        h: Math.max(...sbdZones.map(z => z.y + z.height)) - Math.min(...sbdZones.map(z => z.y)),
        digits: currentTemplate?.numIdDigits || 6
      } : null,
      examCode: codeZones.length > 0 ? {
        x: Math.min(...codeZones.map(z => z.x)),
        y: Math.min(...codeZones.map(z => z.y)),
        w: Math.max(...codeZones.map(z => z.x + z.width)) - Math.min(...codeZones.map(z => z.x)),
        h: Math.max(...codeZones.map(z => z.y + z.height)) - Math.min(...codeZones.map(z => z.y)),
        digits: currentTemplate?.numExamCodeDigits || 3
      } : null,
      questions: qZones.length > 0 ? {
        x: Math.min(...qZones.map(z => z.x)),
        y: Math.min(...qZones.map(z => z.y)),
        w: Math.max(...qZones.map(z => z.x + z.width)) - Math.min(...qZones.map(z => z.x)),
        h: Math.max(...qZones.map(z => z.y + z.height)) - Math.min(...qZones.map(z => z.y)),
        count: currentTemplate?.numQuestions || 60,
        cols: currentTemplate?.columnsCount || 4
      } : null,
      qr: qrZones.length > 0 ? {
        x: qrZones[0].x,
        y: qrZones[0].y,
        w: qrZones[0].width,
        h: qrZones[0].height
      } : null
    };
  })();

  // Helper to ensure an active exam exists for scanning/testing
  const getOrCreateActiveExam = (): Exam => {
    if (currentExam) return currentExam;
    const tpl = currentTemplate || templates[0];
    const numQ = tpl?.numQuestions || 120;
    const fallbackExam: Exam = {
      id: 'exam_' + Date.now(),
      title: `Đề thi trắc nghiệm (${numQ} câu)`,
      subject: 'Kiểm tra tổng hợp',
      grade: '12',
      className: '12A1',
      academicYear: '2025-2026',
      semester: 'Học kỳ I',
      examType: 'quiz',
      code: 'EXAM-101',
      examDate: new Date().toISOString().slice(0, 10),
      durationMinutes: 90,
      teacherName: 'Giáo viên',
      templateId: tpl?.id || 'tpl_standard_120',
      numQuestions: numQ,
      numOptions: 4,
      maxScore: 10,
      passingScore: 5.0,
      decimalPrecision: 2,
      questions: Array.from({ length: numQ }, (_, idx) => {
        const opts: BubbleOption[] = ['A', 'B', 'C', 'D'];
        return {
          questionNumber: idx + 1,
          correctAnswer: opts[idx % 4],
          points: Number((10 / numQ).toFixed(3))
        };
      }),
      instructions: 'Dùng bút chì 2B tô kín ô tròn tương ứng với đáp án đúng.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    };
    addExam(fallbackExam);
    return fallbackExam;
  };

  // Safe camera stop helper - immediately halts all media tracks and releases hardware
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping camera track:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStream(null);
    setIsCameraActive(false);
  };

  const startCamera = async (targetFacing: 'environment' | 'user' = facingMode) => {
    try {
      stopCamera(); // Ensure previous stream is cleanly stopped
      setCameraError(null);
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError('Trình duyệt hoặc môi trường hiện tại không hỗ trợ camera trực tiếp. Vui lòng sử dụng tính năng "Tải tệp ảnh" hoặc "Chấm thử mẫu".');
        return;
      }

      let stream: MediaStream | null = null;
      
      // Tier 1: Try high resolution with desired facing mode
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 }
          },
          audio: false
        });
      } catch (err1) {
        console.warn('Tier 1 camera constraint failed, trying basic facingMode constraint:', err1);
        // Tier 2: Try basic facing mode
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: targetFacing },
            audio: false
          });
        } catch (err2) {
          console.warn('Tier 2 camera constraint failed, fallback to any available video stream:', err2);
          // Tier 3: Fallback to any default camera device
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      if (!stream) {
        throw new Error('Không thể khởi tạo luồng dữ liệu camera');
      }

      streamRef.current = stream;
      setCameraStream(stream);
      setIsCameraActive(true);

      // Connect video stream immediately if element is already attached
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => {
          console.warn('Camera video play caught in startCamera:', e);
        });
      }
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setCameraError('Không thể kết nối máy ảnh. Vui lòng cấp quyền truy cập camera trong trình duyệt hoặc sử dụng chế độ Tải tệp ảnh.');
      stopCamera();
    }
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Sync cameraStream to videoRef whenever stream or active state updates
  useEffect(() => {
    if (videoRef.current && cameraStream && isCameraActive) {
      if (videoRef.current.srcObject !== cameraStream) {
        videoRef.current.srcObject = cameraStream;
      }
      videoRef.current.play().catch(e => {
        console.warn('Camera play triggered in useEffect:', e);
      });
    }
  }, [cameraStream, isCameraActive]);

  // 1. Camera Stream Lifecycle for activeTab (Switching between Upload / Camera / Demo tabs)
  useEffect(() => {
    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab]);

  // 2. Auto shut-off camera when user switches browser tabs or hides the app
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCamera();
      }
    };

    const handlePageHide = () => {
      stopCamera();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      stopCamera();
    };
  }, []);

  // Capture Snapshot from Camera and Grade with multi-stage anchor and section pipeline
  const handleCaptureCamera = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);
    setCurrentPipelineStep('Đang xác định 4 điểm neo góc & Căn chỉnh phối cảnh...');
    setProcessingProgress(20);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    setTimeout(async () => {
      setCurrentPipelineStep('Đang nhận diện Khung Số Báo Danh, Khung Mã Đề & Ma trận câu hỏi...');
      setProcessingProgress(55);

      setTimeout(async () => {
        try {
          setCurrentPipelineStep('Đang chấm điểm & đối chiếu đáp án...');
          setProcessingProgress(85);

          const targetExam = getOrCreateActiveExam();
          const submission = await processAnswerSheet(
            dataUrl,
            currentTemplate,
            targetExam,
            students
          );

          setCurrentPipelineStep('Hoàn tất nhận diện!');
          setProcessingProgress(100);

          addSubmissions([submission]);
          setProcessedBatchResults(prev => [submission, ...prev]);
        } catch (e) {
          console.error(e);
        } finally {
          setIsProcessing(false);
        }
      }, 350);
    }, 450);
  };

  // Handle Multi-File Upload (Images and Multi-page PDFs)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(5);
    setCurrentPipelineStep(t.scanner.pipelineSteps.pageDetect);

    const newSubmissions: ExamSubmission[] = [];

    try {
      const targetExam = getOrCreateActiveExam();

      // First collect all page image data URLs from uploaded files (including multi-page PDFs)
      const pageImages: { fileName: string; pageNumber: number; dataUrl: string }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentPipelineStep(`Đang đọc tệp ${i + 1}/${files.length} (${file.name})...`);
        try {
          const { pages } = await processUploadedFileToImages(file);
          pages.forEach((p) => {
            pageImages.push({
              fileName: file.name,
              pageNumber: p.pageNumber,
              dataUrl: p.dataUrl
            });
          });
        } catch (err) {
          console.error('Error reading file:', file.name, err);
        }
      }

      if (pageImages.length === 0) {
        throw new Error('Không thể đọc dữ liệu hình ảnh từ các tệp đã chọn.');
      }

      // Process each page through the OMR pipeline
      for (let i = 0; i < pageImages.length; i++) {
        const pageItem = pageImages[i];
        const progress = Math.round(15 + ((i + 1) / pageImages.length) * 80);
        setProcessingProgress(progress);
        setCurrentPipelineStep(
          `Đang chấm bài ${i + 1}/${pageImages.length} (${pageItem.fileName}${
            pageItem.pageNumber > 1 ? ` - Trang ${pageItem.pageNumber}` : ''
          })...`
        );

        try {
          const sub = await processAnswerSheet(
            pageItem.dataUrl,
            currentTemplate,
            targetExam,
            students
          );
          newSubmissions.push(sub);
        } catch (err) {
          console.error('Error processing answer sheet page', pageItem.fileName, err);
        }
      }

      setProcessingProgress(100);
      setCurrentPipelineStep(t.scanner.pipelineSteps.scoring);
      addSubmissions(newSubmissions);
      setProcessedBatchResults((prev) => [...newSubmissions, ...prev]);
    } catch (error: any) {
      console.error('Batch upload error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Run Demo Simulated Test Sheet
  const handleRunDemoSheet = async (
    type: 'perfect' | 'normal' | 'multiple_marks' | 'faint_marks',
    studentIndex = 0
  ) => {
    setIsProcessing(true);
    setProcessingProgress(25);
    setCurrentPipelineStep('Đang tạo phiếu bài làm thực tế...');

    const targetExam = getOrCreateActiveExam();
    const student = students[studentIndex] || {
      id: 'std_test',
      studentId: '102345',
      name: 'Học sinh kiểm thử OMR',
      className: targetExam.className || '12A1',
      grade: targetExam.grade || '12'
    };
    const answers: Record<number, BubbleOption | 'MULTIPLE' | 'UNCERTAIN' | 'BLANK'> = {};

    targetExam.questions.forEach((q, idx) => {
      if (type === 'perfect') {
        answers[q.questionNumber] = q.correctAnswer;
      } else if (type === 'normal') {
        if (idx % 6 === 0) {
          answers[q.questionNumber] = (q.correctAnswer === 'A' ? 'B' : 'A') as BubbleOption;
        } else {
          answers[q.questionNumber] = q.correctAnswer;
        }
      } else if (type === 'multiple_marks') {
        if (idx === 4 || idx === 17) {
          answers[q.questionNumber] = 'MULTIPLE';
        } else {
          answers[q.questionNumber] = q.correctAnswer;
        }
      } else if (type === 'faint_marks') {
        if (idx === 11) {
          answers[q.questionNumber] = 'UNCERTAIN';
        } else {
          answers[q.questionNumber] = q.correctAnswer;
        }
      }
    });

    try {
      const simulatedDataUrl = await createSimulatedFilledSheet(
        currentTemplate,
        student,
        targetExam.code,
        targetExam.title,
        answers
      );

      setProcessingProgress(65);
      setCurrentPipelineStep(t.scanner.pipelineSteps.evaluating);

      const submission = await processAnswerSheet(
        simulatedDataUrl,
        currentTemplate,
        targetExam,
        students.length > 0 ? students : [student]
      );

      setProcessingProgress(100);
      setCurrentPipelineStep(t.scanner.pipelineSteps.scoring);

      addSubmissions([submission]);
      setProcessedBatchResults(prev => [submission, ...prev]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-cyan-400" />
            <span>{t.scanner.title}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Camera tự động căn 4 điểm neo theo mẫu, phân vùng Khung Số Báo Danh, Khung Mã Đề và Ma trận câu hỏi trắc nghiệm.
          </p>
        </div>

        {/* Select Active Exam and Template */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0E131F]/80 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-lg">
            <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">{t.scanner.selectExam}</span>
            <select
              value={currentExam?.id || 'auto'}
              onChange={(e) => {
                if (e.target.value !== 'auto') {
                  setActiveExamId(e.target.value);
                }
              }}
              className="text-xs font-bold text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-1.5 focus:outline-hidden"
            >
              {exams.length === 0 ? (
                <option value="auto" className="bg-slate-900 text-white">
                  Tự động khởi tạo ({currentTemplate?.numQuestions || 120} câu)
                </option>
              ) : (
                exams.map(e => (
                  <option key={e.id} value={e.id} className="bg-slate-900 text-white">
                    {e.title} ({e.code})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-[#0E131F]/80 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-lg">
            <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">Mẫu phiếu OMR:</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="text-xs font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-1.5 focus:outline-hidden max-w-[200px] truncate"
            >
              {templates.map(tpl => (
                <option key={tpl.id} value={tpl.id} className="bg-slate-900 text-white">
                  {tpl.name} ({tpl.numQuestions} câu)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs selector */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>{t.scanner.uploadTab}</span>
        </button>

        <button
          onClick={() => setActiveTab('camera')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'camera'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>{t.scanner.cameraTab}</span>
        </button>

        <button
          onClick={() => setActiveTab('demo')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'demo'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-purple-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{t.scanner.demoTab}</span>
        </button>
      </div>

      {/* Main Scanner Body */}
      <div className="bg-[#0E131F]/80 backdrop-blur-md rounded-3xl border border-white/5 p-6 shadow-2xl space-y-6">
        {/* TAB 1: Batch Upload */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <label className="block border-2 border-dashed border-cyan-500/30 hover:border-cyan-400 rounded-3xl p-10 text-center cursor-pointer bg-cyan-950/10 hover:bg-cyan-950/20 transition group">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-white mb-1">
                {t.scanner.dropzoneTitle}
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {t.scanner.dropzoneHint}
              </p>
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* TAB 2: Live Camera */}
        {activeTab === 'camera' && (
          <div className="space-y-4">
            {/* Camera Control & Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-xs font-bold text-white">
                  {isCameraActive ? 'Camera đang hoạt động' : 'Camera đã tắt (Tiết kiệm pin & bảo mật)'}
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  • Căn 4 điểm neo & 3 khung OMR
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHudAnchors(!showHudAnchors)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    showHudAnchors ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>4 Điểm Neo ({activeAnchors.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowHudSectionFrames(!showHudSectionFrames)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    showHudSectionFrames ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>3 Khung Định Vị (SBD, Mã đề, Câu hỏi)</span>
                </button>

                {isCameraActive ? (
                  <button
                    onClick={stopCamera}
                    className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Tắt Camera
                  </button>
                ) : (
                  <button
                    onClick={() => startCamera()}
                    className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Bật lại Camera
                  </button>
                )}
              </div>
            </div>

            {cameraError ? (
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold mb-1">{cameraError}</p>
                  <button
                    onClick={() => startCamera()}
                    className="mt-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Thử kết nối lại camera
                  </button>
                </div>
              </div>
            ) : !isCameraActive ? (
              <div className="rounded-2xl overflow-hidden bg-black/90 border border-white/10 flex flex-col items-center justify-center p-12 text-center min-h-[420px] space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Camera đang tạm dừng</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Camera được tự động tắt để bảo mật phần cứng khi bạn chuyển tab. Nhấn nút bên dưới để tiếp tục quét phiếu.
                  </p>
                </div>
                <button
                  onClick={() => startCamera()}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Bật Camera quét bài</span>
                </button>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 flex flex-col items-center justify-center min-h-[440px] w-full">
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && cameraStream && el.srcObject !== cameraStream) {
                      el.srcObject = cameraStream;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    const vid = e.target as HTMLVideoElement;
                    vid.play().catch(err => console.warn('Video play onLoadedMetadata:', err));
                  }}
                  className="w-full h-full min-h-[400px] max-h-[580px] object-cover bg-black block"
                />

                {/* Top Control Bar for Camera Mode */}
                <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-black/80 hover:bg-black/95 text-cyan-300 hover:text-white border border-cyan-500/30 rounded-xl text-xs font-semibold backdrop-blur-md shadow-lg transition cursor-pointer"
                    title="Chuyển đổi giữa Camera Sau và Camera Trước"
                  >
                    <SwitchCamera className="w-4 h-4 text-cyan-400" />
                    <span className="hidden sm:inline">{facingMode === 'environment' ? 'Camera Sau' : 'Camera Trước'}</span>
                  </button>
                </div>

                {/* Viewfinder Guide Overlay with Dynamic Anchors & 3 Section Frames */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-3 sm:p-5">
                  {/* Outer Sheet Aspect Ratio Container matching standard portrait A4 format */}
                  <div className="w-full max-w-[380px] sm:max-w-[420px] aspect-[210/297] max-h-[92%] border-2 border-dashed border-cyan-400/70 rounded-xl relative shadow-[0_0_35px_rgba(6,182,212,0.25)] bg-cyan-950/5">
                    {/* Animated Scanning Laser Line */}
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(6,182,212,1)] animate-bounce opacity-75" />

                    {/* 1. Dynamic 4 Template Anchors rendered exactly at template coordinates */}
                    {showHudAnchors && activeAnchors.map((anchor, idx) => {
                      const posX = anchor.x * 100;
                      const posY = anchor.y * 100;
                      const isTop = anchor.y < 0.5;
                      const isLeft = anchor.x < 0.5;
                      const label = anchor.label || `Neo ${idx + 1} (${isTop ? 'Trên' : 'Dưới'}-${isLeft ? 'Trái' : 'Phải'})`;

                      return (
                        <div
                          key={anchor.id || `anchor_${idx}`}
                          className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
                          style={{
                            left: `${posX}%`,
                            top: `${posY}%`,
                          }}
                        >
                          {/* Anchor Optical Box & Reticle */}
                          <div className="relative flex items-center justify-center">
                            {/* Optical Black Marker Square */}
                            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-black/90 border-2 border-purple-400 rounded-sm shadow-[0_0_14px_#c084fc] flex items-center justify-center backdrop-blur-xs">
                              <div className="w-3 h-3 bg-purple-400/90 rounded-xs shadow-[0_0_6px_#c084fc]" />
                            </div>

                            {/* Precise corner reticles */}
                            <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-emerald-400" />
                            <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-emerald-400" />
                            <div className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-emerald-400" />
                            <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-emerald-400" />
                          </div>

                          {/* Anchor Label Tag */}
                          <span
                            className={`text-[9px] font-bold text-purple-200 bg-black/90 px-1.5 py-0.5 rounded-md border border-purple-500/40 whitespace-nowrap shadow-lg ${
                              isTop ? 'mt-1.5' : 'mb-1.5 order-first'
                            }`}
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}

                    {/* 2. Real-Time HUD 3-Section Frame Overlays */}
                    {showHudSectionFrames && (
                      <>
                        {/* Frame 1: Khung Số Báo Danh (SBD) */}
                        {sectionBounds.sbd && (
                          <div
                            className="absolute border border-dashed border-emerald-400/90 bg-emerald-500/10 rounded-lg pointer-events-none flex flex-col justify-start p-1 shadow-[0_0_10px_rgba(16,185,129,0.2)] z-10"
                            style={{
                              left: `${sectionBounds.sbd.x * 100}%`,
                              top: `${sectionBounds.sbd.y * 100}%`,
                              width: `${sectionBounds.sbd.w * 100}%`,
                              height: `${sectionBounds.sbd.h * 100}%`
                            }}
                          >
                            <span className="text-[8px] font-bold text-emerald-300 bg-black/90 px-1 py-0.2 rounded-xs self-start border border-emerald-500/40">
                              Khung SBD ({sectionBounds.sbd.digits} số)
                            </span>
                          </div>
                        )}

                        {/* Frame 2: Khung Mã Đề */}
                        {sectionBounds.examCode && (
                          <div
                            className="absolute border border-dashed border-purple-400/90 bg-purple-500/10 rounded-lg pointer-events-none flex flex-col justify-start p-1 shadow-[0_0_10px_rgba(168,85,247,0.2)] z-10"
                            style={{
                              left: `${sectionBounds.examCode.x * 100}%`,
                              top: `${sectionBounds.examCode.y * 100}%`,
                              width: `${sectionBounds.examCode.w * 100}%`,
                              height: `${sectionBounds.examCode.h * 100}%`
                            }}
                          >
                            <span className="text-[8px] font-bold text-purple-300 bg-black/90 px-1 py-0.2 rounded-xs self-start border border-purple-500/40">
                              Khung Mã Đề ({sectionBounds.examCode.digits} số)
                            </span>
                          </div>
                        )}

                        {/* Frame 3: Khung Các Câu Trắc Nghiệm */}
                        {sectionBounds.questions && (
                          <div
                            className="absolute border border-dashed border-cyan-400/90 bg-cyan-500/10 rounded-lg pointer-events-none flex flex-col justify-start p-1 shadow-[0_0_10px_rgba(6,182,212,0.2)] z-10"
                            style={{
                              left: `${sectionBounds.questions.x * 100}%`,
                              top: `${sectionBounds.questions.y * 100}%`,
                              width: `${sectionBounds.questions.w * 100}%`,
                              height: `${sectionBounds.questions.h * 100}%`
                            }}
                          >
                            <span className="text-[8px] font-bold text-cyan-300 bg-black/90 px-1 py-0.2 rounded-xs self-start border border-cyan-500/40">
                              Khung Trắc Nghiệm ({sectionBounds.questions.count} câu - {sectionBounds.questions.cols} cột)
                            </span>
                          </div>
                        )}

                        {/* QR Code Frame if present */}
                        {sectionBounds.qr && (
                          <div
                            className="absolute border border-dashed border-amber-400/90 bg-amber-500/10 rounded-lg pointer-events-none flex flex-col justify-start p-1 z-10"
                            style={{
                              left: `${sectionBounds.qr.x * 100}%`,
                              top: `${sectionBounds.qr.y * 100}%`,
                              width: `${sectionBounds.qr.w * 100}%`,
                              height: `${sectionBounds.qr.h * 100}%`
                            }}
                          >
                            <span className="text-[8px] font-bold text-amber-300 bg-black/90 px-1 py-0.2 rounded-xs self-start border border-amber-500/40">
                              Mã QR Định Danh
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Header Instruction Badge */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-cyan-300 border border-cyan-500/40 shadow-xl flex items-center gap-1.5 whitespace-nowrap z-30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Căn 4 điểm đen góc & 3 khung OMR vào đúng vùng hướng dẫn
                    </div>
                  </div>
                </div>

                {/* Floating Bottom Action Bar */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="p-3 bg-black/80 hover:bg-black text-cyan-300 hover:text-white border border-cyan-500/30 rounded-full shadow-lg backdrop-blur-md transition cursor-pointer"
                    title="Chuyển Camera Trước / Sau"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </button>

                  <button
                    id="btn-capture-camera"
                    onClick={handleCaptureCamera}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm rounded-full shadow-lg shadow-emerald-500/25 hover:scale-105 active:scale-95 transition cursor-pointer whitespace-nowrap"
                  >
                    <Camera className="w-5 h-5" />
                    <span>{t.scanner.captureButton}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Demo Test Sheets */}
        {activeTab === 'demo' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-indigo-300">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Phiếu Mẫu Thử Nghiệm Thực Tế:
              </p>
              <p className="text-indigo-200/80 leading-relaxed">
                Tạo tự động các bài làm có nét bút chì thực tế để bạn kiểm thử khả năng nhận diện điểm mờ, xử lý tô 2 đáp án và quy trình duyệt bài nghi vấn.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Test 1 */}
              <div className="p-4 rounded-2xl border border-white/10 hover:border-emerald-500/40 bg-white/5 transition flex flex-col justify-between space-y-3">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Trường hợp 1: Bài làm chuẩn 100%
                  </span>
                  <h4 className="font-bold text-sm text-white mt-1">Học sinh tô rõ ràng, đạt điểm cao</h4>
                  <p className="text-xs text-slate-400">Mực bút chì 2B đậm, tất cả các câu nhận diện tự động với độ tin cậy 99%.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRunDemoSheet('perfect', 0)}
                  disabled={isProcessing}
                  className="w-full py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-xs"
                >
                  Chấm thử bài đạt điểm tuyệt đối
                </button>
              </div>

              {/* Test 2 */}
              <div className="p-4 rounded-2xl border border-white/10 hover:border-cyan-500/40 bg-white/5 transition flex flex-col justify-between space-y-3">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Trường hợp 2: Bài làm bình thường
                  </span>
                  <h4 className="font-bold text-sm text-white mt-1">Phân bố điểm tự nhiên</h4>
                  <p className="text-xs text-slate-400">Học sinh làm đúng khoảng 80% số câu, có câu đúng câu sai thông thường.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRunDemoSheet('normal', 1)}
                  disabled={isProcessing}
                  className="w-full py-2 bg-cyan-600/80 hover:bg-cyan-600 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-xs"
                >
                  Chấm thử bài phân bố điểm tự nhiên
                </button>
              </div>

              {/* Test 3 (Flagged: Multiple marks) */}
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 hover:border-amber-400 transition flex flex-col justify-between space-y-3">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Trường hợp 3: Tô 2 đáp án (Cần duyệt)
                  </span>
                  <h4 className="font-bold text-sm text-amber-200 mt-1">Học sinh tô cả A và B ở câu 5, 18</h4>
                  <p className="text-xs text-amber-300/80">Hệ thống sẽ gắn cờ NEEDS_REVIEW và chuyển sang Bàn Duyệt Bài Nghi Vấn.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRunDemoSheet('multiple_marks', 2)}
                  disabled={isProcessing}
                  className="w-full py-2 bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-xs"
                >
                  Chấm thử bài tô 2 đáp án
                </button>
              </div>

              {/* Test 4 (Flagged: Faint marks) */}
              <div className="p-4 rounded-2xl border border-purple-500/30 bg-purple-950/20 hover:border-purple-400 transition flex flex-col justify-between space-y-3">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Trường hợp 4: Tô mờ / Tẩy chưa sạch
                  </span>
                  <h4 className="font-bold text-sm text-purple-200 mt-1">Nét chì mờ ở câu 12</h4>
                  <p className="text-xs text-purple-300/80">Kiểm tra thuật toán tính mật độ điểm ảnh pixel density và độ tin cậy OMR.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRunDemoSheet('faint_marks', 3)}
                  disabled={isProcessing}
                  className="w-full py-2 bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-xs"
                >
                  Chấm thử bài tô mờ / nghi vấn
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Processing Progress Bar Modal Overlay */}
        {isProcessing && (
          <div className="p-5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                {currentPipelineStep}
              </span>
              <span>{processingProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden border border-cyan-500/20">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 rounded-full"
                style={{ width: `${processingProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Processed Batch Feed */}
        {processedBatchResults.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                Kết Quả Chấm Phiếu Đợt Này ({processedBatchResults.length} bài):
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('review')}
                  className="text-xs font-bold text-amber-300 bg-amber-950/40 hover:bg-amber-950/60 px-3 py-1.5 rounded-xl border border-amber-500/30 transition cursor-pointer"
                >
                  Mở Bàn Duyệt ({processedBatchResults.filter(r => r.status === 'NEEDS_REVIEW' || r.status === 'MULTIPLE_ANSWERS' || r.status === 'LOW_CONFIDENCE').length})
                </button>
                <button
                  onClick={() => onNavigate('results')}
                  className="text-xs font-bold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-950/60 px-3 py-1.5 rounded-xl border border-cyan-500/30 transition cursor-pointer"
                >
                  Xem Bảng Điểm
                </button>
              </div>
            </div>

            <div className="divide-y divide-white/5 max-h-[360px] overflow-y-auto space-y-2">
              {processedBatchResults.map((res) => {
                const isNeedsReview = res.status === 'NEEDS_REVIEW' || res.status === 'MULTIPLE_ANSWERS' || res.status === 'LOW_CONFIDENCE';
                return (
                  <div key={res.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        isNeedsReview ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {isNeedsReview ? '⚠' : '✓'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{res.studentName}</span>
                          <span className="font-mono text-emerald-300 bg-emerald-950/60 px-1.5 py-0.2 rounded-md text-[10px] border border-emerald-500/30">
                            SBD: {res.studentId}
                          </span>
                          <span className="font-mono text-purple-300 bg-purple-950/60 px-1.5 py-0.2 rounded-md text-[10px] border border-purple-500/30">
                            Mã đề: {res.detectedExamCode || res.appliedVariantCode || '101'}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Đúng {res.totalCorrect}/{currentExam.numQuestions} câu • Độ tin cậy: {res.overallConfidence}% • 4 Điểm neo chuẩn
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-right">
                        <span className="text-base font-bold text-cyan-400">
                          {res.totalScore} <span className="text-xs font-normal text-slate-400">/ {res.maxScore}</span>
                        </span>
                        <p className={`text-[10px] font-semibold ${isNeedsReview ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {isNeedsReview ? res.needsReviewReason || 'Cần duyệt' : 'Đã chấm chuẩn'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setInspectingSubmission(res)}
                        className="px-3 py-1.5 text-xs font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-xl transition cursor-pointer border border-cyan-500/30 flex items-center gap-1"
                        title="Xem chi tiết 3 khung & 4 điểm neo"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>Xem 3 Khung & Neo</span>
                      </button>

                      <button
                        onClick={() => onNavigate('review')}
                        className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl transition cursor-pointer border border-white/10"
                      >
                        Kiểm tra
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Section & Anchor Inspection Modal */}
      {inspectingSubmission && (
        <ScanInspectionModal
          isOpen={true}
          onClose={() => setInspectingSubmission(null)}
          submission={inspectingSubmission}
          template={currentTemplate}
        />
      )}
    </div>
  );
};

