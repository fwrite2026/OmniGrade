import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  GraduationCap, 
  KeyRound, 
  User, 
  Eye, 
  EyeOff, 
  LogIn, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck,
  Check
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { t, login, schoolName } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const cleanInput = (str: string) => {
    return str
      .replace(/[\u200B-\u200D\uFEFF\u00A0\u180E]/g, '') // remove zero-width & non-breaking spaces
      .trim();
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanUsername = cleanInput(username);
    const cleanPassword = password.trim();

    if (!cleanUsername) {
      setErrorMsg('Vui lòng nhập tên đăng nhập!');
      return;
    }

    if (!cleanPassword) {
      setErrorMsg('Vui lòng nhập mật khẩu!');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const res = login(cleanUsername, cleanPassword);
      setIsLoading(false);

      if (res.success) {
        setSuccessMsg('Đăng nhập thành công! Đang chuyển hướng vào hệ thống...');
        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess();
          }
        }, 400);
      } else {
        setErrorMsg(res.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin tài khoản!');
      }
    }, 200);
  };

  return (
    <div className="min-h-screen w-full bg-[#02050A] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Background ambient lighting effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -right-20 w-[450px] h-[450px] bg-cyan-500/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-32 left-1/3 w-[550px] h-[550px] bg-indigo-600/15 rounded-full blur-[120px]" />
      </div>

      {/* Top branding bar */}
      <header className="relative z-10 w-full px-6 py-5 flex items-center justify-between border-b border-white/5 bg-[#02050A]/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
              <span>OmniGrade</span>
              <span className="text-cyan-400 font-extrabold">OMR</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {schoolName || 'Hệ Thống Chấm Thi Trắc Nghiệm'}
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Hệ thống bảo mật nội bộ</span>
        </div>
      </header>

      {/* Center Login Box */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-[#0D121F]/90 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-xl p-7 sm:p-9 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-cyan-500/25 ring-1 ring-white/20">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Đăng Nhập Hệ Thống
            </h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              Vui lòng nhập tài khoản và mật khẩu được cấp để truy cập vào trung tâm quản lý và chấm thi.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <span className="font-medium">{successMsg}</span>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                {t.auth.username}
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="input-login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập (vd: admin, giaovien01)"
                  required
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                {t.auth.password}
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Quick Test Accounts for 1-tap fill on mobile/desktop */}
            <div className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-2">
              <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Nhấn để chọn nhanh tài khoản đăng nhập:</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin', 'admin@123')}
                  className="flex items-center justify-between p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-left transition cursor-pointer group"
                >
                  <div>
                    <p className="text-xs font-bold text-purple-300">admin</p>
                    <p className="text-[10px] text-slate-400">Quản trị viên</p>
                  </div>
                  <span className="text-[10px] font-mono text-purple-400 px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-500/30">
                    admin@123
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill('giaovien01', '123')}
                  className="flex items-center justify-between p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-left transition cursor-pointer group"
                >
                  <div>
                    <p className="text-xs font-bold text-cyan-300">giaovien01</p>
                    <p className="text-[10px] text-slate-400">Thầy An (Toán)</p>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
                    123
                  </span>
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              id="btn-submit-login"
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-blue-700 hover:from-cyan-400 hover:to-blue-600 text-white font-bold text-sm rounded-2xl shadow-xl shadow-cyan-500/25 transition duration-200 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Đăng Nhập Vào Hệ Thống</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-white/5 text-center text-xs text-slate-400">
            <span>Chưa có tài khoản hoặc quên mật khẩu? </span>
            <span className="text-cyan-400 font-medium">Liên hệ Quản trị viên để được cấp lại.</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-4 text-center text-xs text-slate-500 border-t border-white/5 bg-[#02050A]/40 backdrop-blur-xs">
        <p>© {new Date().getFullYear()} OmniGrade OMR • Phần Mềm Chấm Thi & Quản Lý Trắc Nghiệm Thông Minh</p>
      </footer>
    </div>
  );
};
