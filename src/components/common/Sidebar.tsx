import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  FileCheck,
  FileSpreadsheet,
  ScanLine,
  AlertCircle,
  BarChart3,
  Users,
  Settings,
  Printer,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight
} from 'lucide-react';

export type NavTab = 
  | 'dashboard'
  | 'exams'
  | 'createExam'
  | 'templates'
  | 'templateEditor'
  | 'scanner'
  | 'review'
  | 'results'
  | 'itemAnalysis'
  | 'students'
  | 'settings'
  | 'admin';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  onSelectTab,
  isCollapsed: controlledCollapsed,
  onToggleCollapse: controlledToggle
}) => {
  const { t, submissions, currentUser } = useApp();

  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('omr_sidebar_collapsed') === 'true';
  });

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (controlledToggle) {
      controlledToggle();
    } else {
      setInternalCollapsed(prev => {
        const next = !prev;
        localStorage.setItem('omr_sidebar_collapsed', String(next));
        return next;
      });
    }
  };

  const pendingReviewCount = submissions.filter(s => s.status === 'NEEDS_REVIEW' || s.status === 'MULTIPLE_ANSWERS' || s.status === 'LOW_CONFIDENCE').length;

  const navItems = [
    { id: 'dashboard' as NavTab, label: t.nav.dashboard, icon: LayoutDashboard },
    { 
      id: 'exams' as NavTab, 
      label: t.nav.exams, 
      icon: FileCheck,
      subItems: [
        { id: 'exams' as NavTab, label: t.nav.allExams },
        { id: 'createExam' as NavTab, label: t.nav.createExam },
      ]
    },
    { 
      id: 'templates' as NavTab, 
      label: t.nav.templates, 
      icon: FileSpreadsheet,
      subItems: [
        { id: 'templates' as NavTab, label: t.nav.templates },
        { id: 'templateEditor' as NavTab, label: t.nav.templateEditor },
      ]
    },
    { id: 'scanner' as NavTab, label: t.nav.scanner, icon: ScanLine, highlight: true },
    { 
      id: 'review' as NavTab, 
      label: t.nav.reviewQueue, 
      icon: AlertCircle, 
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined 
    },
    { 
      id: 'results' as NavTab, 
      label: t.nav.results, 
      icon: BarChart3,
      subItems: [
        { id: 'results' as NavTab, label: t.nav.examResults },
        { id: 'itemAnalysis' as NavTab, label: t.nav.itemAnalysis },
      ]
    },
    { id: 'students' as NavTab, label: t.nav.students, icon: Users },
    { 
      id: 'admin' as NavTab, 
      label: t.nav.adminPanel, 
      icon: ShieldCheck,
      badge: currentUser?.role === 'admin' ? 'Admin' : undefined
    },
    { id: 'settings' as NavTab, label: t.nav.settings, icon: Settings },
  ];

  return (
    <aside 
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } bg-[#080C14]/90 backdrop-blur-xl text-slate-200 flex flex-col flex-shrink-0 min-h-[calc(100vh-4rem)] border-r border-white/5 shadow-2xl z-20 transition-all duration-300 ease-in-out select-none`}
    >
      {/* Header with Collapse/Expand Toggle Button */}
      <div className={`p-3 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-white/5`}>
        {!isCollapsed && (
          <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-widest truncate">
            {t.appName}
          </div>
        )}

        <button
          id="btn-sidebar-toggle-collapse"
          onClick={handleToggle}
          title={isCollapsed ? "Mở rộng menu (Ctrl+B)" : "Thu gọn menu để mở rộng màn hình"}
          className={`p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-white/5 border border-transparent hover:border-white/10 transition cursor-pointer flex items-center justify-center ${
            isCollapsed ? 'w-10 h-10' : ''
          }`}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-5 h-5 text-cyan-400" />
          ) : (
            <PanelLeftClose className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Navigation list */}
      <div className="p-3 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id || (item.subItems?.some(s => s.id === currentTab));

          return (
            <div key={item.id} className="space-y-1 relative group">
              <button
                id={`nav-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center p-3' : 'justify-between px-3 py-2.5'
                } rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 font-semibold border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center relative' : 'gap-3'}`}>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}

                  {/* Badge on collapsed mode */}
                  {isCollapsed && item.badge !== undefined && (
                    <span className="absolute -top-2 -right-2.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-slate-950 ring-2 ring-slate-900 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </div>

                {/* Badge on expanded mode */}
                {!isCollapsed && item.badge !== undefined && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>

              {/* Floating Tooltip in Collapsed Mode on hover */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
                  <div className="bg-[#0E131F] border border-cyan-500/30 text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-2xl whitespace-nowrap flex items-center gap-2">
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Sub items if active and expanded */}
              {item.subItems && isActive && !isCollapsed && (
                <div className="pl-9 pr-2 py-1 space-y-1 border-l border-white/10 ml-5">
                  {item.subItems.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => onSelectTab(sub.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                        currentTab === sub.id
                          ? 'bg-white/10 text-cyan-300 font-semibold border border-white/5'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Print Banner / Button */}
      {!isCollapsed ? (
        <div className="p-3 m-3 rounded-2xl bg-[#0E131F]/90 border border-white/10 shadow-lg">
          <div className="flex items-center gap-2 mb-1.5 text-cyan-400 font-semibold text-xs">
            <Printer className="w-4 h-4" />
            <span>In phiếu thi nhanh</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Tạo bản PDF phiếu trả lời trắc nghiệm chuẩn kèm mã QR học sinh.
          </p>
          <button
            onClick={() => onSelectTab('templates')}
            className="mt-2.5 w-full py-2 bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/50 hover:to-blue-600/50 text-cyan-200 border border-cyan-500/30 text-xs font-medium rounded-xl transition cursor-pointer shadow-xs"
          >
            {t.actions.print}
          </button>
        </div>
      ) : (
        <div className="p-3 flex justify-center border-t border-white/5">
          <button
            onClick={() => onSelectTab('templates')}
            title="In phiếu thi nhanh"
            className="p-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition cursor-pointer flex items-center justify-center group relative"
          >
            <Printer className="w-4 h-4" />
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
              <div className="bg-[#0E131F] border border-cyan-500/30 text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-2xl whitespace-nowrap">
                In phiếu thi nhanh
              </div>
            </div>
          </button>
        </div>
      )}
    </aside>
  );
};
