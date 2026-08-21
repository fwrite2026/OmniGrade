import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { LoginModal } from '../auth/LoginModal';
import { 
  GraduationCap, 
  Globe, 
  School, 
  Sparkles,
  User,
  Shield,
  ShieldCheck,
  KeyRound,
  LogIn,
  LogOut,
  ChevronDown,
  UserCheck
} from 'lucide-react';

interface HeaderProps {
  onNavigate?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  const { 
    language, 
    setLanguage, 
    t, 
    schoolName, 
    currentUser, 
    logout 
  } = useApp();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="h-16 bg-[#0B0F17]/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-lg shadow-black/20">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 ring-1 ring-white/20">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-lg tracking-tight">
                OmniGrade <span className="text-cyan-400 font-extrabold">OMR</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                v2.5 Pro
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden md:block">
              {t.tagline}
            </p>
          </div>
        </div>

        {/* Campus Info & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* School Name Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-slate-300">
            <School className="w-4 h-4 text-cyan-400" />
            <span>{schoolName}</span>
          </div>

          {/* Language Switcher */}
          <button
            id="btn-lang-toggle"
            onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 transition cursor-pointer"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">{language === 'vi' ? 'VI (Tiếng Việt)' : 'EN (English)'}</span>
            <span className="sm:hidden">{language === 'vi' ? 'VI' : 'EN'}</span>
          </button>

          {/* User Profile / Auth Button */}
          {currentUser ? (
            <div className="relative" ref={dropdownRef}>
              <button
                id="btn-user-profile"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium transition cursor-pointer group"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs ring-1 ring-white/20 ${
                  currentUser.role === 'admin' 
                    ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-sm shadow-purple-500/30' 
                    : 'bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-sm shadow-cyan-500/30'
                }`}>
                  {currentUser.fullName.substring(0, 1).toUpperCase()}
                </div>

                <div className="text-left hidden md:block">
                  <div className="font-bold text-white text-xs leading-tight truncate max-w-[120px]">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    @{currentUser.username}
                  </div>
                </div>

                <div className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  currentUser.role === 'admin'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {currentUser.role === 'admin' ? (
                    <>
                      <Shield className="w-2.5 h-2.5 text-purple-400" />
                      <span>Admin</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-2.5 h-2.5 text-emerald-400" />
                      <span>{t.auth.roleTeacher}</span>
                    </>
                  )}
                </div>

                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition" />
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#0E131F] border border-white/10 shadow-2xl p-2 z-50 text-slate-200 animate-fadeIn">
                  {/* User info box */}
                  <div className="p-3 mb-1 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="font-bold text-white text-sm">
                      {currentUser.fullName}
                    </div>
                    <div className="text-xs text-cyan-400 font-mono mt-0.5">
                      @{currentUser.username}
                    </div>
                    {currentUser.department && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        {currentUser.department}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-1">
                    {/* Admin Page Link */}
                    {currentUser.role === 'admin' && onNavigate && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onNavigate('admin');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-purple-300 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition cursor-pointer text-left"
                      >
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                        <span>{t.admin.title}</span>
                      </button>
                    )}

                    {/* Change Password */}
                    <button
                      id="btn-header-change-pass"
                      onClick={() => {
                        setShowUserDropdown(false);
                        setShowChangePassword(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition cursor-pointer text-left"
                    >
                      <KeyRound className="w-4 h-4 text-cyan-400" />
                      <span>{t.auth.changePassword}</span>
                    </button>

                    {/* Switch user */}
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        setShowLoginModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition cursor-pointer text-left"
                    >
                      <LogIn className="w-4 h-4 text-blue-400" />
                      <span>{t.auth.switchAccount}</span>
                    </button>

                    <div className="border-t border-white/5 my-1" />

                    {/* Logout */}
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t.auth.logout}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t.auth.login}</span>
            </button>
          )}
        </div>
      </header>

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePasswordModal
          isOpen={showChangePassword}
          onClose={() => setShowChangePassword(false)}
        />
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </>
  );
};
