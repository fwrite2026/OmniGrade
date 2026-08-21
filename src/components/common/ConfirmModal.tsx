import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  itemCount?: number;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Xóa dữ liệu',
  cancelText = 'Hủy bỏ',
  itemCount,
  isDestructive = true,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div 
        className="bg-[#0D131F] border border-white/15 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/5 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className={`p-3 rounded-2xl border shrink-0 ${
            isDestructive 
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            {isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-snug">
              {title}
            </h3>
            {itemCount !== undefined && itemCount > 0 && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-500/30">
                Đã chọn {itemCount} mục
              </span>
            )}
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 rounded-xl border border-white/10 transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-lg transition cursor-pointer ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
                : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/25'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
