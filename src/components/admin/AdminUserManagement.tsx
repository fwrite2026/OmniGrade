import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserAccount, UserRole } from '../../types';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import {
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  Search,
  KeyRound,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Phone,
  Building,
  Calendar,
  Clock,
  LogIn,
  RefreshCw,
  Copy
} from 'lucide-react';

export const AdminUserManagement: React.FC = () => {
  const { 
    t, 
    users, 
    currentUser, 
    addUser, 
    updateUser, 
    deleteUser, 
    switchUserDirect 
  } = useApp();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [passwordTargetUser, setPasswordTargetUser] = useState<UserAccount | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserAccount | null>(null);

  // Password visibility map (for admin auditing)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Toast / Notification
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Form State for Add/Edit
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('teacher');
  const [formDepartment, setFormDepartment] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formShowPassword, setFormShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Toggle password visibility for table item
  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormUsername('');
    setFormPassword('');
    setFormFullName('');
    setFormRole('teacher');
    setFormDepartment('');
    setFormPhone('');
    setFormNotes('');
    setFormStatus('active');
    setFormShowPassword(false);
    setFormError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword(user.password);
    setFormFullName(user.fullName);
    setFormRole(user.role);
    setFormDepartment(user.department || '');
    setFormPhone(user.phone || '');
    setFormNotes(user.notes || '');
    setFormStatus(user.status);
    setFormError(null);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formUsername.trim()) {
      setFormError('Vui lòng nhập tên đăng nhập!');
      return;
    }
    if (!formPassword) {
      setFormError('Vui lòng nhập mật khẩu!');
      return;
    }
    if (!formFullName.trim()) {
      setFormError('Vui lòng nhập họ và tên!');
      return;
    }

    const res = addUser({
      username: formUsername.trim(),
      password: formPassword,
      fullName: formFullName.trim(),
      role: formRole,
      department: formDepartment.trim() || undefined,
      phone: formPhone.trim() || undefined,
      notes: formNotes.trim() || undefined,
      status: formStatus
    });

    if (res.success) {
      showToast(`Đã tạo tài khoản @${formUsername.trim()} thành công!`);
      setShowAddModal(false);
      resetForm();
    } else {
      setFormError(res.message || 'Không thể tạo tài khoản');
    }
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError(null);

    if (!formUsername.trim()) {
      setFormError('Vui lòng nhập tên đăng nhập!');
      return;
    }
    if (!formFullName.trim()) {
      setFormError('Vui lòng nhập họ và tên!');
      return;
    }

    const res = updateUser({
      ...editingUser,
      username: formUsername.trim(),
      password: formPassword || editingUser.password,
      fullName: formFullName.trim(),
      role: formRole,
      department: formDepartment.trim() || undefined,
      phone: formPhone.trim() || undefined,
      notes: formNotes.trim() || undefined,
      status: formStatus
    });

    if (res.success) {
      showToast(`Đã cập nhật thông tin tài khoản @${formUsername.trim()}!`);
      setEditingUser(null);
      resetForm();
    } else {
      setFormError(res.message || 'Không thể cập nhật tài khoản');
    }
  };

  const handleToggleStatus = (user: UserAccount) => {
    if (user.id === currentUser?.id) {
      showToast('Không thể khóa tài khoản đang đăng nhập!', 'error');
      return;
    }
    if (user.username.toLowerCase() === 'admin' && user.status === 'active') {
      showToast('Không thể khóa tài khoản Quản trị viên mặc định (admin)!', 'error');
      return;
    }

    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    updateUser({ ...user, status: newStatus });
    showToast(`Đã ${newStatus === 'active' ? 'kích hoạt' : 'khóa'} tài khoản @${user.username}!`);
  };

  const handleDeleteUser = () => {
    if (!deleteConfirmUser) return;

    const res = deleteUser(deleteConfirmUser.id);
    if (res.success) {
      showToast(`Đã xóa tài khoản @${deleteConfirmUser.username}!`);
      setDeleteConfirmUser(null);
    } else {
      showToast(res.message || 'Không thể xóa tài khoản', 'error');
      setDeleteConfirmUser(null);
    }
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$';
    let pass = '';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormPassword(pass);
  };

  // Filtered list
  const filteredUsers = users.filter(user => {
    const matchSearch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.department && user.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.phone && user.phone.includes(searchTerm));
    
    const matchRole = roleFilter === 'all' || user.role === roleFilter;
    const matchStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchSearch && matchRole && matchStatus;
  });

  // KPI Stats
  const totalCount = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const teacherCount = users.filter(u => u.role === 'teacher').length;
  const activeCount = users.filter(u => u.status === 'active').length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-medium transition-all animate-bounce ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30' 
            : 'bg-red-950/90 text-red-300 border-red-500/30'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-[#0E131F] via-[#101726] to-[#0A0D14] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Control Center</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {t.admin.title}
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              {t.admin.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-add-user"
              onClick={handleOpenAddModal}
              className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm rounded-2xl shadow-xl shadow-cyan-500/20 transition duration-200 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t.admin.addUser}</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>{t.admin.totalUsers}</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              {totalCount}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>{t.admin.adminCount}</span>
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-purple-400 tracking-tight">
              {adminCount}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>{t.admin.teacherCount}</span>
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 tracking-tight">
              {teacherCount}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>{t.admin.activeCount}</span>
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400 tracking-tight">
              {activeCount} / {totalCount}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#0B0F17]/80 border border-white/10 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo username, tên, tổ bộ môn..."
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {/* Role filter */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                roleFilter === 'all' ? 'bg-cyan-500 text-black font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất cả vai trò
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                roleFilter === 'admin' ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Admin ({adminCount})
            </button>
            <button
              onClick={() => setRoleFilter('teacher')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                roleFilter === 'teacher' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Giáo viên ({teacherCount})
            </button>
          </div>

          {/* Status filter */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'all' ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'active' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hoạt động
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'inactive' ? 'bg-red-500/20 text-red-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Đã khóa
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#0E131F] border border-white/10 rounded-3xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-white/10 bg-[#0B0F17]/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {t.admin.userList} ({filteredUsers.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            * Mật khẩu có thể được đổi bởi người dùng hoặc Quản trị viên
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/[0.02] text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-white/5">
              <tr>
                <th className="px-6 py-3.5">{t.admin.fullName} / {t.admin.department}</th>
                <th className="px-6 py-3.5">{t.admin.username}</th>
                <th className="px-6 py-3.5">{t.admin.password} (Admin Audit)</th>
                <th className="px-6 py-3.5">{t.admin.role}</th>
                <th className="px-6 py-3.5">{t.admin.status}</th>
                <th className="px-6 py-3.5">{t.admin.lastLogin}</th>
                <th className="px-6 py-3.5 text-right">{t.admin.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Không tìm thấy tài khoản người dùng phù hợp.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = currentUser?.id === user.id;
                  const isPasswordVisible = visiblePasswords[user.id];

                  return (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-white/[0.02] transition ${
                        isCurrent ? 'bg-cyan-500/[0.03]' : ''
                      }`}
                    >
                      {/* Name & Avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ring-1 ring-white/10 ${
                            user.role === 'admin' 
                              ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20' 
                              : 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                          }`}>
                            {user.fullName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">
                                {user.fullName}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              {user.department && (
                                <span className="flex items-center gap-1">
                                  <Building className="w-3 h-3 text-slate-500" />
                                  {user.department}
                                </span>
                              )}
                              {user.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-500" />
                                  {user.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-cyan-300 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-500/20 font-semibold">
                          @{user.username}
                        </span>
                      </td>

                      {/* Password */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-slate-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 min-w-[100px] flex items-center justify-between">
                            <span>
                              {isPasswordVisible ? user.password : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="ml-2 text-slate-400 hover:text-cyan-400 transition cursor-pointer"
                              title={isPasswordVisible ? t.admin.hidePassword : t.admin.showPassword}
                            >
                              {isPasswordVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setPasswordTargetUser(user)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 border border-white/10 hover:border-cyan-500/30 transition cursor-pointer"
                            title="Cấp đổi mật khẩu"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            <Shield className="w-3 h-3 text-purple-400" />
                            <span>{t.auth.roleAdmin}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            <UserCheck className="w-3 h-3 text-emerald-400" />
                            <span>{t.auth.roleTeacher}</span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={user.username.toLowerCase() === 'admin' || isCurrent}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            user.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                          }`}
                          title="Bấm để thay đổi trạng thái"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span>{user.status === 'active' ? t.auth.statusActive : t.auth.statusInactive}</span>
                        </button>
                      </td>

                      {/* Last Login & Created */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5 text-[11px]">
                          <div className="text-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</span>
                          </div>
                          <div className="text-slate-500 flex items-center gap-1 text-[10px]">
                            <Calendar className="w-3 h-3 text-slate-600" />
                            <span>Tạo: {new Date(user.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Switch Account (Impersonate for testing) */}
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => {
                                switchUserDirect(user.id);
                                showToast(`Đã chuyển sang tài khoản @${user.username}!`);
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-300 border border-white/10 hover:border-blue-500/30 transition cursor-pointer"
                              title={t.admin.quickLoginAsThisUser}
                            >
                              <LogIn className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit user */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition cursor-pointer"
                            title={t.admin.editUser}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete user */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmUser(user)}
                            disabled={user.username.toLowerCase() === 'admin' || isCurrent}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={user.username.toLowerCase() === 'admin' ? t.admin.cannotDeleteAdmin : t.actions.delete}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0E131F] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#0B0F17]/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-lg">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {t.admin.addUser}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tạo tài khoản cán bộ giáo viên hoặc quản trị viên
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {t.admin.username} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="vd: giaovien_toan"
                    required
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Đăng nhập trực tiếp, không cần Email</span>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      {t.admin.password} <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPassword}
                      className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Tạo ngẫu nhiên
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={formShowPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Nhập mật khẩu ban đầu"
                      required
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setFormShowPassword(!formShowPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {formShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {t.admin.fullName} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="Ví dụ: Thầy Trần Quang Vinh"
                  required
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Role */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {t.admin.role}
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 bg-[#141B2D] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="teacher">Giáo viên (Chấm thi, Quản lý đề)</option>
                    <option value="admin">Quản trị viên (Toàn quyền hệ thống)</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {t.admin.status}
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full px-3.5 py-2.5 bg-[#141B2D] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="active">Hoạt động (Được phép đăng nhập)</option>
                    <option value="inactive">Khóa tài khoản</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Department */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {t.admin.department}
                  </label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="vd: Tổ Toán - Tin"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {t.admin.phone}
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="vd: 0987654321"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {t.admin.notes}
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ghi chú về phân công, môn dạy..."
                  className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{t.actions.create}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0E131F] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#0B0F17]/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-lg">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {t.admin.editUser}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cập nhật thông tin tài khoản @{editingUser.username}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingUser(null)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {t.admin.username} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formUsername}
                    disabled={editingUser.username.toLowerCase() === 'admin'}
                    onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    required
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono disabled:opacity-60"
                  />
                  {editingUser.username.toLowerCase() === 'admin' && (
                    <span className="text-[10px] text-amber-400">Không thể đổi username admin mặc định</span>
                  )}
                </div>

                {/* Password Direct Edit */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {t.admin.password}
                  </label>
                  <div className="relative">
                    <input
                      type={formShowPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Mật khẩu"
                      required
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setFormShowPassword(!formShowPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {formShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {t.admin.fullName} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Role */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {t.admin.role}
                  </label>
                  <select
                    value={formRole}
                    disabled={editingUser.username.toLowerCase() === 'admin'}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 bg-[#141B2D] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-60"
                  >
                    <option value="teacher">Giáo viên</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {t.admin.status}
                  </label>
                  <select
                    value={formStatus}
                    disabled={editingUser.username.toLowerCase() === 'admin' || editingUser.id === currentUser?.id}
                    onChange={(e) => setFormStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full px-3.5 py-2.5 bg-[#141B2D] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-60"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Khóa tài khoản</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Department */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {t.admin.department}
                  </label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {t.admin.phone}
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {t.admin.notes}
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t.actions.save}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal for specific user */}
      {passwordTargetUser && (
        <ChangePasswordModal
          isOpen={Boolean(passwordTargetUser)}
          onClose={() => setPasswordTargetUser(null)}
          targetUser={passwordTargetUser}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0E131F] border border-red-500/30 rounded-3xl w-full max-w-md shadow-2xl p-6 text-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-500/10">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white">
              Xác nhận xóa tài khoản?
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài khoản <span className="text-white font-bold">{deleteConfirmUser.fullName}</span> (@{deleteConfirmUser.username}) không? Hành động này không thể hoàn tác.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
              >
                {t.actions.cancel}
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/20 transition cursor-pointer"
              >
                Xác nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
