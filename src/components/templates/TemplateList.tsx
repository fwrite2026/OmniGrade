import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AnswerSheetTemplate } from '../../types';
import { getTemplateRealStats } from '../../services/templateGenerator';
import { TemplatePrintModal } from './TemplatePrintModal';
import { PdfTemplateUploadModal } from './PdfTemplateUploadModal';
import { DirectTemplateDesignerModal } from './DirectTemplateDesignerModal';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  FileSpreadsheet,
  Plus,
  Printer,
  Edit3,
  Trash2,
  Copy,
  CheckCircle2,
  QrCode,
  Layers,
  Sparkles,
  FileUp,
  Sliders,
  Hash,
  CheckSquare,
  Square
} from 'lucide-react';

interface TemplateListProps {
  onOpenEditor: (templateId?: string) => void;
}

export const TemplateList: React.FC<TemplateListProps> = ({ onOpenEditor }) => {
  const { t, templates, activeTemplateId, setActiveTemplateId, deleteTemplate, deleteTemplatesBatch, addTemplate } = useApp();
  const [printModalTemplate, setPrintModalTemplate] = useState<AnswerSheetTemplate | null>(null);
  const [showPdfUploadModal, setShowPdfUploadModal] = useState<boolean>(false);
  const [showDirectDesignerModal, setShowDirectDesignerModal] = useState<boolean>(false);

  // Selection & Bulk delete state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState<boolean>(false);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === templates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(templates.map(t => t.id));
    }
  };

  const handleSingleDelete = (id: string) => {
    deleteTemplate(id);
    setSelectedIds(prev => prev.filter(item => item !== id));
    setConfirmDeleteId(null);
  };

  const handleBatchDelete = () => {
    if (selectedIds.length > 0) {
      deleteTemplatesBatch(selectedIds);
      setSelectedIds([]);
      setShowBatchDeleteModal(false);
    }
  };

  const handleDuplicate = (template: AnswerSheetTemplate) => {
    const clone: AnswerSheetTemplate = {
      ...template,
      id: 'tpl_' + Math.random().toString(36).slice(2, 9),
      name: `${template.name} (Bản sao)`,
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSystemDefault: false
    };
    addTemplate(clone);
  };

  const targetTemplateToDelete = templates.find(t => t.id === confirmDeleteId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-cyan-400" />
            <span>{t.template.title}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Hệ thống quản lý và tự tạo mẫu phiếu trắc nghiệm trực tiếp tùy biến trường thông tin, SBD, mã đề tô ô, ma trận câu hỏi và chân trang (Footer).
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="btn-direct-designer"
            onClick={() => setShowDirectDesignerModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Tự tạo phiếu trực tiếp</span>
          </button>

          <button
            id="btn-upload-pdf-template"
            onClick={() => setShowPdfUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/50 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/5 transition cursor-pointer"
          >
            <FileUp className="w-4 h-4 text-cyan-400" />
            <span>Tải lên mẫu PDF</span>
          </button>

          <button
            id="btn-create-new-template"
            onClick={() => onOpenEditor()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>Studio hiệu chỉnh</span>
          </button>
        </div>
      </div>

      {/* Bulk Action & Selection Bar */}
      {templates.length > 0 && (
        <div className="flex items-center justify-between bg-[#0E131F]/90 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 shadow-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-xl border border-white/10 transition cursor-pointer"
            >
              {selectedIds.length === templates.length && templates.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-cyan-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{selectedIds.length === templates.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả mẫu phiếu'}</span>
            </button>

            {selectedIds.length > 0 && (
              <span className="text-xs text-cyan-300 font-semibold px-2.5 py-1 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                Đã chọn {selectedIds.length} / {templates.length} mẫu
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
              >
                Hủy chọn
              </button>
              <button
                id="btn-batch-delete-templates"
                onClick={() => setShowBatchDeleteModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa {selectedIds.length} mẫu đã chọn</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((tpl) => {
          const isActive = tpl.id === activeTemplateId;
          const isSelected = selectedIds.includes(tpl.id);
          const realStats = getTemplateRealStats(tpl);
          const zonesList = tpl.zones || [];
          const bubbleCount = zonesList.filter(z => z.type === 'bubble').length;
          const sbdZonesCount = zonesList.filter(z => z.type === 'student_id_bubble').length;
          const examCodeZonesCount = zonesList.filter(z => z.type === 'exam_code_bubble').length;

          return (
            <div
              key={tpl.id}
              className={`bg-[#0E131F]/80 backdrop-blur-md rounded-3xl border transition duration-200 shadow-xl flex flex-col justify-between overflow-hidden relative ${
                isSelected 
                  ? 'border-rose-500/60 ring-2 ring-rose-500/30'
                  : isActive 
                  ? 'border-cyan-500/60 ring-2 ring-cyan-500/20 shadow-[0_0_25px_rgba(6,182,212,0.15)]' 
                  : 'border-white/5 hover:border-cyan-500/30'
              }`}
            >
              <div className="p-6 space-y-4">
                {/* Header info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(tpl.id)}
                      className="w-4 h-4 mt-0.5 accent-cyan-500 rounded cursor-pointer"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-base leading-tight">
                          {tpl.name}
                        </span>
                        {tpl.isSystemDefault && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            Chuẩn
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-medium">{tpl.schoolName}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300 font-semibold shrink-0">
                    v{tpl.version}
                  </span>
                </div>

                {/* Specs badges */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-0.5">
                    <span className="text-slate-400 text-[11px]">Dung lượng câu:</span>
                    <p className="font-bold text-slate-100">{realStats.numQuestions} câu ({realStats.numOptions} lựa chọn: {realStats.optionLabels})</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-0.5">
                    <span className="text-slate-400 text-[11px]">Cấu trúc cột:</span>
                    <p className="font-bold text-slate-100">{realStats.columnsCount} Cột ({realStats.questionsPerColumn} câu/cột) • {tpl.paperSize}</p>
                  </div>
                </div>

                {/* Features tags */}
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-300">
                  {sbdZonesCount > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                      <Hash className="w-3 h-3" />
                      Tô SBD ({sbdZonesCount / 10} số)
                    </span>
                  )}
                  {examCodeZonesCount > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      <Hash className="w-3 h-3" />
                      Tô Mã đề ({examCodeZonesCount / 10} số)
                    </span>
                  )}
                  {tpl.hasQrCode && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                      <QrCode className="w-3 h-3" />
                      Mã QR học sinh
                    </span>
                  )}
                  {tpl.hasAnchorMarks && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                      <Layers className="w-3 h-3" />
                      4 Điểm neo góc
                    </span>
                  )}
                  <span className="text-slate-400 text-[10px]">
                    {bubbleCount} zones
                  </span>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="px-6 py-4 bg-[#080C14]/80 border-t border-white/5 flex items-center justify-between gap-2">
                <button
                  id={`btn-print-tpl-${tpl.id}`}
                  onClick={() => setPrintModalTemplate(tpl)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-xs rounded-xl border border-white/10 transition cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t.actions.print}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    title="Nhân bản mẫu"
                    onClick={() => handleDuplicate(tpl)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    id={`btn-edit-tpl-${tpl.id}`}
                    onClick={() => {
                      setActiveTemplateId(tpl.id);
                      onOpenEditor(tpl.id);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Thiết kế</span>
                  </button>

                  <button
                    id={`btn-delete-tpl-${tpl.id}`}
                    title="Xóa mẫu này"
                    onClick={() => setConfirmDeleteId(tpl.id)}
                    className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Single Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Xác nhận xóa mẫu phiếu"
        message={`Bạn có chắc chắn muốn xóa mẫu phiếu "${targetTemplateToDelete?.name}"? Thao tác này không thể hoàn tác.`}
        confirmText="Xóa mẫu phiếu"
        onConfirm={() => confirmDeleteId && handleSingleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Batch Delete Confirm Modal */}
      <ConfirmModal
        isOpen={showBatchDeleteModal}
        title="Xác nhận xóa đồng loạt mẫu phiếu"
        message="Các mẫu phiếu đã chọn sẽ bị xóa vĩnh viễn khỏi danh sách. Bạn có chắc chắn muốn tiếp tục?"
        confirmText="Xác nhận xóa tất cả"
        itemCount={selectedIds.length}
        onConfirm={handleBatchDelete}
        onCancel={() => setShowBatchDeleteModal(false)}
      />

      {/* Direct Template Designer Modal */}
      {showDirectDesignerModal && (
        <DirectTemplateDesignerModal
          onClose={() => setShowDirectDesignerModal(false)}
          onSavedAndEdit={(tpl) => {
            setShowDirectDesignerModal(false);
            setActiveTemplateId(tpl.id);
            onOpenEditor(tpl.id);
          }}
        />
      )}

      {/* Print Modal */}
      {printModalTemplate && (
        <TemplatePrintModal
          template={printModalTemplate}
          onClose={() => setPrintModalTemplate(null)}
        />
      )}

      {/* PDF Template Upload Modal */}
      {showPdfUploadModal && (
        <PdfTemplateUploadModal
          isOpen={showPdfUploadModal}
          onClose={() => setShowPdfUploadModal(false)}
          onOpenEditorWithTemplate={(tpl) => {
            setShowPdfUploadModal(false);
            onOpenEditor(tpl.id);
          }}
        />
      )}
    </div>
  );
};

