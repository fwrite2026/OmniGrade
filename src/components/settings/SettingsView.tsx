import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import {
  Settings,
  School,
  Sliders,
  Database,
  RotateCcw,
  CheckCircle2,
  Download,
  Upload,
  Save,
  KeyRound,
  Shield,
  UserCheck,
  GitBranch,
  HardDrive,
  FileJson
} from 'lucide-react';
import { DEFAULT_120_TEMPLATE } from '../../services/demoData';
import { safeLocalStorageSet } from '../../services/imageStorage';

interface SettingsViewProps {
  onNavigate?: (tab: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate }) => {
  const {
    t,
    schoolName,
    setSchoolName,
    language,
    setLanguage,
    resetToDemoData,
    importBackupData,
    currentUser
  } = useApp();

  const [localSchoolName, setLocalSchoolName] = useState<string>(schoolName);
  const [darkThreshold, setDarkThreshold] = useState<number>(35);
  const [multipleThreshold, setMultipleThreshold] = useState<number>(75);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(70);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    setSchoolName(localSchoolName);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportBackup = () => {
    const data = {
      schoolName,
      exams: localStorage.getItem('omr_exams'),
      templates: localStorage.getItem('omr_templates'),
      submissions: localStorage.getItem('omr_submissions'),
      students: localStorage.getItem('omr_students'),
      classes: localStorage.getItem('omr_classes'),
      users: localStorage.getItem('omr_users'),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OmniGrade_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const res = importBackupData(text);
        if (res.success) {
          setImportStatus('Đã khôi phục / đồng bộ dữ liệu sao lưu thành công!');
          setTimeout(() => setImportStatus(null), 4000);
        } else {
          alert(res.message || 'Lỗi khi nhập dữ liệu');
        }
      } catch (err) {
        alert('File JSON không hợp lệ!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDemo = () => {
    if (window.confirm('Bạn có chắc chắn muốn đặt lại hệ thống về trạng thái phiếu chuẩn 120 câu? Hành động này sẽ xóa các bài thi hiện tại.')) {
      resetToDemoData();
      safeLocalStorageSet('omr_templates', JSON.stringify([DEFAULT_120_TEMPLATE]));
      safeLocalStorageSet('omr_exams', JSON.stringify([]));
      safeLocalStorageSet('omr_submissions', JSON.stringify([]));
      safeLocalStorageSet('omr_students', JSON.stringify([]));
      safeLocalStorageSet('omr_classes', JSON.stringify([]));
      window.location.reload();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Settings className="w-6 h-6" />
            </div>
            <span>{t.settings.title}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cấu hình đơn vị giáo dục, ngưỡng nhạy OMR và quản lý sao lưu dữ liệu hệ thống.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{t.actions.save}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Đã lưu thành công cấu hình hệ thống!</span>
        </div>
      )}

      {/* School Info Section */}
      <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-6 shadow-2xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
          <School className="w-4 h-4 text-cyan-400" />
          <span>Thông Tin Đơn Vị & Ngôn Ngữ</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              {t.settings.schoolName}
            </label>
            <input
              type="text"
              value={localSchoolName}
              onChange={(e) => setLocalSchoolName(e.target.value)}
              className="w-full text-xs font-semibold border border-white/10 rounded-xl p-2.5 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              {t.settings.language}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'vi' | 'en')}
              className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-[#0B0F17] text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="vi">Tiếng Việt (Mặc định)</option>
              <option value="en">English (US)</option>
            </select>
          </div>
        </div>
      </div>

      {/* OMR Sensitivity & Algorithm Calibration */}
      <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-6 shadow-2xl space-y-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>{t.settings.omrCalibration}</span>
        </h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">{t.settings.darkThreshold}</span>
              <span className="font-mono text-cyan-400 font-bold">{darkThreshold}%</span>
            </div>
            <input
              type="range"
              min={15}
              max={60}
              value={darkThreshold}
              onChange={(e) => setDarkThreshold(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-[11px] text-slate-400">Mật độ điểm tối tối thiểu bên trong ô tròn để tính là học sinh đã tô.</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">{t.settings.multipleMarkThreshold}</span>
              <span className="font-mono text-cyan-400 font-bold">{multipleThreshold}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={95}
              value={multipleThreshold}
              onChange={(e) => setMultipleThreshold(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-[11px] text-slate-400">Tỷ lệ so sánh giữa ô tô đậm thứ hai so với ô đậm nhất để phát hiện tô 2 đáp án.</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">{t.settings.confidenceMin}</span>
              <span className="font-mono text-cyan-400 font-bold">{confidenceThreshold}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={90}
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-[11px] text-slate-400">Ngưỡng độ tin cậy tối thiểu; nếu dưới mức này hệ thống sẽ gắn cờ NEEDS_REVIEW.</p>
          </div>
        </div>
      </div>

      {/* User Account & Security Section */}
      {currentUser && (
        <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-6 shadow-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              <span>Tài Khoản Đang Đăng Nhập & Bảo Mật</span>
            </div>
            <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
              currentUser.role === 'admin'
                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
            }`}>
              {currentUser.role === 'admin' ? <Shield className="w-3 h-3 text-purple-400" /> : <UserCheck className="w-3 h-3 text-emerald-400" />}
              <span>{currentUser.role === 'admin' ? t.auth.roleAdmin : t.auth.roleTeacher}</span>
            </div>
          </h3>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <div>
              <div className="text-base font-bold text-white">
                {currentUser.fullName}
              </div>
              <div className="text-xs text-cyan-400 font-mono mt-0.5">
                Tên đăng nhập: @{currentUser.username}
              </div>
              {currentUser.department && (
                <div className="text-xs text-slate-400 mt-1">
                  Đơn vị / Tổ: {currentUser.department}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                id="btn-settings-change-pass"
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/30 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{t.auth.changePassword}</span>
              </button>

              {currentUser.role === 'admin' && onNavigate && (
                <button
                  onClick={() => onNavigate('admin')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Quản trị User</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Backup, Storage & GitHub Sync */}
      <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Kho Lưu Trữ, Sao Lưu & Đồng Bộ Dữ Liệu</span>
          </h3>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-semibold">
            <GitBranch className="w-3 h-3 text-cyan-400" />
            <span>Đồng bộ GitHub / Local</span>
          </div>
        </div>

        {importStatus && (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{importStatus}</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <span>Chính sách lưu trữ & Giữ nguyên hiện trạng dữ liệu</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Toàn bộ dữ liệu do Admin và người dùng tạo mới, hiệu chỉnh hoặc xóa (gồm danh sách kỳ thi, phiếu trả lời, bài thi đã chấm, học sinh, lớp học và tài khoản) được lưu trữ bền vững và giữ nguyên hiện trạng. Hệ thống không tự động khôi phục dữ liệu mẫu hay thay đổi trạng thái của người dùng khi làm mới trang.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json,application/json"
              className="hidden"
            />

            <button
              id="btn-export-backup"
              onClick={handleExportBackup}
              className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-semibold text-xs rounded-xl border border-cyan-500/30 transition cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>{t.settings.exportBackup} (JSON)</span>
            </button>

            <button
              id="btn-import-backup"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-xs rounded-xl border border-white/10 transition cursor-pointer shadow-sm"
            >
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>Nhập sao lưu / Đồng bộ JSON</span>
            </button>
          </div>

          <button
            id="btn-reset-demo"
            onClick={handleResetDemo}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-950/30 hover:bg-rose-950/50 text-rose-400 font-semibold text-xs rounded-xl transition cursor-pointer border border-rose-500/30 shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.settings.resetDemo}</span>
          </button>
        </div>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
    </div>
  );
};
