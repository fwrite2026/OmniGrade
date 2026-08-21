import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { BubbleOption, ExamSubmission, Exam } from '../../types';
import { processAnswerSheet } from '../../services/omrEngine';
import { createSimulatedFilledSheet } from '../../services/templateGenerator';
import { processUploadedFileToImages } from '../../services/pdfService';
import { NavTab } from '../common/Sidebar';
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
  FileText
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

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Selected Exam & Template
  const currentExam = activeExam || exams[0];
  const currentTemplate = templates.find(t => t.id === currentExam?.templateId) || templates[0];

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

  // Camera Stream Lifecycle
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

  const startCamera = async () => {
    try {
      setCameraError(null);
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError('Trình duyệt hoặc môi trường hiện tại không hỗ trợ camera trực tiếp. Vui lòng sử dụng tính năng "Tải tệp ảnh" hoặc "Chấm thử mẫu".');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => {
          console.warn('Camera video play caught:', e);
        });
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setCameraError('Không thể kết nối máy ảnh. Vui lòng cấp quyền truy cập camera trong trình duyệt hoặc sử dụng chế độ Tải tệp ảnh.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  // Capture Snapshot from Camera and Grade
  const handleCaptureCamera = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);
    setCurrentPipelineStep(t.scanner.pipelineSteps.pageDetect);
    setProcessingProgress(20);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    setTimeout(async () => {
      setCurrentPipelineStep(t.scanner.pipelineSteps.evaluating);
      setProcessingProgress(60);

      try {
        const targetExam = getOrCreateActiveExam();
        const submission = await processAnswerSheet(
          dataUrl,
          currentTemplate,
          targetExam,
          students
        );

        setCurrentPipelineStep(t.scanner.pipelineSteps.scoring);
        setProcessingProgress(100);

        addSubmissions([submission]);
        setProcessedBatchResults(prev => [submission, ...prev]);
      } catch (e) {
        console.error(e);
      } finally {
        setIsProcessing(false);
      }
    }, 600);
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
            Động cơ OMR nhận diện mật độ điểm ảnh, phát hiện tô 2 đáp án và tính điểm tự động.
          </p>
        </div>

        {/* Select Active Exam */}
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
            {cameraError ? (
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <p>{cameraError}</p>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden bg-black/90 border border-white/10 flex flex-col items-center justify-center min-h-[420px]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-[500px] object-cover"
                />

                {/* Viewfinder Guide Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="w-full max-w-[360px] h-[85%] border-2 border-dashed border-cyan-400/80 rounded-2xl relative shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                    {/* 4 Corner Markers */}
                    <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-md" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-md" />
                    <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-md" />
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-md" />

                    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-semibold text-cyan-300 border border-cyan-500/30">
                      Khung Căn Chỉnh Phiếu OMR
                    </div>
                  </div>
                </div>

                {/* Floating Capture Button */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                  <button
                    id="btn-capture-camera"
                    onClick={handleCaptureCamera}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm rounded-full shadow-lg shadow-emerald-500/25 hover:scale-105 active:scale-95 transition cursor-pointer"
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
                  <p className="text-xs text-slate-400">Mực bút chì 2B đậm, tất cả 40 câu nhận diện tự động với độ tin cậy 99%.</p>
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
                  <p className="text-xs text-slate-400">Học sinh làm đúng khoảng 32-35 câu, có câu đúng câu sai thông thường.</p>
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

            <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
              {processedBatchResults.map((res) => {
                const isNeedsReview = res.status === 'NEEDS_REVIEW' || res.status === 'MULTIPLE_ANSWERS' || res.status === 'LOW_CONFIDENCE';
                return (
                  <div key={res.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        isNeedsReview ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {isNeedsReview ? '⚠' : '✓'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">
                          {res.studentName} <span className="font-normal text-slate-400 font-mono">({res.studentId})</span>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Đúng {res.totalCorrect}/{currentExam.numQuestions} câu • Độ tin cậy: {res.overallConfidence}%
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-bold text-cyan-400">
                          {res.totalScore} <span className="text-xs font-normal text-slate-400">/ {res.maxScore}</span>
                        </span>
                        <p className={`text-[10px] font-semibold ${isNeedsReview ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {isNeedsReview ? res.needsReviewReason || 'Cần duyệt' : 'Đã chấm chuẩn'}
                        </p>
                      </div>

                      <button
                        onClick={() => onNavigate('review')}
                        className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 rounded-lg transition cursor-pointer border border-white/10"
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
    </div>
  );
};
