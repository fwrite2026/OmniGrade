import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Student } from '../../types';
import * as XLSX from 'xlsx';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  Users,
  Plus,
  Upload,
  Download,
  Search,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  School,
  GraduationCap,
  CheckSquare,
  Square
} from 'lucide-react';

export const StudentManager: React.FC = () => {
  const { t, students, classes, addStudent, addStudentsBatch, deleteStudent, deleteStudentsBatch } = useApp();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Selection & Bulk delete state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState<boolean>(false);

  // New Student Form
  const [newStudentId, setNewStudentId] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newClass, setNewClass] = useState<string>(classes[0]?.name || '6A1');
  const [newGrade, setNewGrade] = useState<string>('6');
  const [newEmail, setNewEmail] = useState<string>('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.studentId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'all' || s.className === selectedClass;
    return matchesSearch && matchesClass;
  });

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map(s => s.id));
    }
  };

  const handleSingleDelete = (id: string) => {
    deleteStudent(id);
    setSelectedIds(prev => prev.filter(item => item !== id));
    setConfirmDeleteId(null);
  };

  const handleBatchDelete = () => {
    if (selectedIds.length > 0) {
      deleteStudentsBatch(selectedIds);
      setSelectedIds([]);
      setShowBatchDeleteModal(false);
    }
  };

  const targetStudentToDelete = students.find(s => s.id === confirmDeleteId);

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentId || !newName) return;

    const student: Student = {
      id: 'std_' + Math.random().toString(36).slice(2, 9),
      studentId: newStudentId.trim().toUpperCase(),
      name: newName.trim(),
      className: newClass,
      grade: newGrade,
      email: newEmail || `${newStudentId.toLowerCase()}@fpt.edu.vn`
    };

    addStudent(student);
    setNewStudentId('');
    setNewName('');
    setNewEmail('');
    setShowAddModal(false);
  };

  // Download Sample Excel Template
  const handleDownloadSampleExcel = () => {
    const wb = XLSX.utils.book_new();
    const sampleData = [
      { 'Mã Học Sinh': 'HS00150', 'Họ và Tên': 'Nguyễn Văn Hải', 'Lớp': '6A1', 'Khối': '6', 'Email': 'hai.nv@fpt.edu.vn' },
      { 'Mã Học Sinh': 'HS00151', 'Họ và Tên': 'Trần Ngọc Mai', 'Lớp': '6A1', 'Khối': '6', 'Email': 'mai.tn@fpt.edu.vn' },
      { 'Mã Học Sinh': 'HS00152', 'Họ và Tên': 'Lê Minh Tuấn', 'Lớp': '6A1', 'Khối': '6', 'Email': 'tuan.lm@fpt.edu.vn' },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'Danh Sách Học Sinh');
    XLSX.writeFile(wb, 'Mau_Danh_Sach_Hoc_Sinh_OMR.xlsx');
  };

  // Import Excel/CSV file
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const imported: Student[] = [];
        json.forEach((row, idx) => {
          const sId = row['Mã Học Sinh'] || row['Student ID'] || row['Ma_HS'] || row['ID'] || `HS${Date.now() + idx}`;
          const sName = row['Họ và Tên'] || row['Student Name'] || row['Ho_Ten'] || row['Name'] || 'Học sinh';
          const sClass = row['Lớp'] || row['Class'] || '6A1';
          const sGrade = row['Khối'] || row['Grade'] || '6';
          const sEmail = row['Email'] || `${sId.toLowerCase()}@fpt.edu.vn`;

          imported.push({
            id: 'std_' + Math.random().toString(36).slice(2, 9),
            studentId: String(sId).trim().toUpperCase(),
            name: String(sName).trim(),
            className: String(sClass).trim(),
            grade: String(sGrade).trim(),
            email: String(sEmail).trim()
          });
        });

        if (imported.length > 0) {
          addStudentsBatch(imported);
          setImportStatus(`Đã nhập thành công ${imported.length} học sinh từ tệp Excel!`);
          setTimeout(() => setImportStatus(null), 4000);
        }
      } catch (err) {
        console.error('Failed to parse excel', err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Users className="w-6 h-6" />
            </div>
            <span>{t.students.title}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý hồ sơ học sinh, mã định danh SBD và danh sách phân lớp để in phiếu & nhận diện OMR.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadSampleExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs rounded-xl border border-white/10 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>{t.students.downloadTemplate}</span>
          </button>

          <label className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/80 hover:bg-emerald-600 border border-emerald-500/30 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>{t.students.importExcel}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportExcel}
              className="hidden"
            />
          </label>

          <button
            id="btn-add-student-single"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.students.addStudent}</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {importStatus && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* Filters & Bulk Actions */}
      <div className="space-y-3">
        <div className="bg-[#0E131F]/80 backdrop-blur-xl p-4 rounded-3xl border border-white/5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={t.actions.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-xs border border-white/10 rounded-xl bg-white/5 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs text-slate-400">Lớp:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs border border-white/10 rounded-xl p-2 bg-[#0B0F17] text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">Tất cả lớp ({students.length} học sinh)</option>
              {classes.map(c => (
                <option key={c.id} value={c.name}>Lớp {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {filteredStudents.length > 0 && (
          <div className="flex items-center justify-between bg-[#0E131F]/90 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-lg">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-xl border border-white/10 transition cursor-pointer"
              >
                {selectedIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>{selectedIds.length === filteredStudents.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả học sinh'}</span>
              </button>

              {selectedIds.length > 0 && (
                <span className="text-xs text-cyan-300 font-semibold px-2.5 py-1 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                  Đã chọn {selectedIds.length} / {filteredStudents.length} học sinh
                </span>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Hủy chọn
                </button>
                <button
                  id="btn-batch-delete-students"
                  onClick={() => setShowBatchDeleteModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa {selectedIds.length} học sinh đã chọn</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Student Table */}
      <div className="bg-[#0E131F]/80 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 text-slate-400 font-bold border-b border-white/10">
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredStudents.length && filteredStudents.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Mã Học Sinh / SBD</th>
                <th className="py-3.5 px-4">Họ và Tên</th>
                <th className="py-3.5 px-4">Lớp</th>
                <th className="py-3.5 px-4">Khối</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredStudents.map((std) => {
                const isSelected = selectedIds.includes(std.id);
                return (
                  <tr key={std.id} className={`transition ${isSelected ? 'bg-rose-500/10' : 'hover:bg-white/5'}`}>
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(std.id)}
                        className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">{std.studentId}</td>
                    <td className="py-3 px-4 font-semibold text-white">{std.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 font-bold text-cyan-300">
                        {std.className}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">Khối {std.grade}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono">{std.email}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setConfirmDeleteId(std.id)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Xác nhận xóa học sinh"
        message={`Bạn có chắc chắn muốn xóa học sinh "${targetStudentToDelete?.name}" (${targetStudentToDelete?.studentId})? Thao tác này không thể hoàn tác.`}
        confirmText="Xóa học sinh"
        onConfirm={() => confirmDeleteId && handleSingleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Batch Delete Confirm Modal */}
      <ConfirmModal
        isOpen={showBatchDeleteModal}
        title="Xác nhận xóa đồng loạt học sinh"
        message="Các học sinh đã chọn sẽ bị xóa vĩnh viễn khỏi danh sách. Bạn có chắc chắn muốn tiếp tục?"
        confirmText="Xác nhận xóa tất cả"
        itemCount={selectedIds.length}
        onConfirm={handleBatchDelete}
        onCancel={() => setShowBatchDeleteModal(false)}
      />

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B0F17] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-white/10">
            <h3 className="font-bold text-white text-base flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Users className="w-5 h-5" />
              </div>
              <span>{t.students.addStudent}</span>
            </h3>

            <form onSubmit={handleAddSingle} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  {t.students.studentId} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: HS00199"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  className="w-full text-xs font-mono font-bold border border-white/10 rounded-xl p-2.5 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  {t.students.fullName} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Hoàng Long"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    {t.students.className}
                  </label>
                  <select
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-[#0B0F17] text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    {t.students.grade}
                  </label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-[#0B0F17] text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    {['6', '7', '8', '9', '10', '11', '12'].map(g => (
                      <option key={g} value={g}>Khối {g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  {t.students.email}
                </label>
                <input
                  type="email"
                  placeholder="long.nh@fpt.edu.vn"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                >
                  Thêm học sinh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
