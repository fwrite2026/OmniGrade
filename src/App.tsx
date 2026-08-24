import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Header } from './components/common/Header';
import { Sidebar, NavTab } from './components/common/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { TemplateList } from './components/templates/TemplateList';
import { TemplateEditor } from './components/templates/TemplateEditor';
import { ExamList } from './components/exams/ExamList';
import { ExamWizard } from './components/exams/ExamWizard';
import { ScannerHub } from './components/scanner/ScannerHub';
import { ReviewQueue } from './components/review/ReviewQueue';
import { ResultsDashboard } from './components/results/ResultsDashboard';
import { ItemAnalysis } from './components/results/ItemAnalysis';
import { StudentManager } from './components/students/StudentManager';
import { SettingsView } from './components/settings/SettingsView';
import { AdminUserManagement } from './components/admin/AdminUserManagement';
import { LoginPage } from './components/auth/LoginPage';
import { LoginModal } from './components/auth/LoginModal';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [editingTemplateId, setEditingTemplateId] = useState<string | undefined>(undefined);
  const [editingExamId, setEditingExamId] = useState<string | undefined>(undefined);
  const { currentUser } = useApp();

  // Show full-screen Login Page if not authenticated
  if (!currentUser) {
    return <LoginPage onLoginSuccess={() => setActiveTab('dashboard')} />;
  }

  const handleOpenEditor = (templateId?: string) => {
    setEditingTemplateId(templateId);
    setActiveTab('templateEditor');
  };

  const handleCloseEditor = () => {
    setEditingTemplateId(undefined);
    setActiveTab('templates');
  };

  const handleSelectTab = (tab: NavTab) => {
    if (tab === 'createExam') {
      setEditingExamId(undefined); // create new
    }
    setActiveTab(tab);
  };

  const handleEditExam = (examId: string) => {
    setEditingExamId(examId);
    setActiveTab('createExam');
  };

  const handleFinishExamWizard = () => {
    setEditingExamId(undefined);
    setActiveTab('exams');
  };

  const handleCancelExamWizard = () => {
    setEditingExamId(undefined);
    setActiveTab('exams');
  };

  return (
    <div className="min-h-screen bg-[#02050A] text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-white relative">
      {/* Subtle ambient lighting effect in the background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* Top Header */}
      <Header onNavigate={(tab) => handleSelectTab(tab as NavTab)} />

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Sidebar */}
        <Sidebar currentTab={activeTab} onSelectTab={handleSelectTab} />

        {/* Dynamic View Canvas */}
        <main className="flex-1 overflow-y-auto min-h-[calc(100vh-64px)] pb-12 p-4 md:p-8">
          <ErrorBoundary key={`${activeTab}_${editingExamId || ''}`} onReset={() => setActiveTab('dashboard')}>
            {activeTab === 'dashboard' && (
              <Dashboard onNavigate={handleSelectTab} />
            )}

            {activeTab === 'templates' && (
              <TemplateList onOpenEditor={handleOpenEditor} />
            )}

            {activeTab === 'templateEditor' && (
              <TemplateEditor
                initialTemplateId={editingTemplateId}
                onBack={handleCloseEditor}
              />
            )}

            {activeTab === 'exams' && (
              <ExamList onNavigate={handleSelectTab} onEditExam={handleEditExam} />
            )}

            {activeTab === 'createExam' && (
              <ExamWizard
                key={editingExamId || 'new_exam'}
                initialExamId={editingExamId}
                onFinish={handleFinishExamWizard}
                onCancel={handleCancelExamWizard}
              />
            )}

            {activeTab === 'scanner' && (
              <ScannerHub onNavigate={handleSelectTab} />
            )}

            {activeTab === 'review' && (
              <ReviewQueue />
            )}

            {activeTab === 'results' && (
              <ResultsDashboard />
            )}

            {activeTab === 'itemAnalysis' && (
              <ItemAnalysis />
            )}

            {activeTab === 'students' && (
              <StudentManager />
            )}

            {activeTab === 'admin' && (
              <AdminUserManagement />
            )}

            {activeTab === 'settings' && (
              <SettingsView onNavigate={(tab) => handleSelectTab(tab as NavTab)} />
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ErrorBoundary>
  );
}
