import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 text-center bg-[#0E131F]/90 backdrop-blur-xl border border-red-500/30 rounded-3xl shadow-2xl shadow-red-500/10 space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-500/10 animate-pulse">
            <AlertTriangle className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">
              {this.props.fallbackTitle || 'Đã xảy ra lỗi không mong muốn'}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {this.props.fallbackMessage || 'Hệ thống đã tự động bảo vệ dữ liệu của bạn. Bạn có thể làm mới lại giao diện hoặc chuyển về trang chính.'}
            </p>
          </div>

          {this.state.error && (
            <div className="p-3.5 bg-red-950/40 border border-red-500/20 rounded-2xl text-left font-mono text-[11px] text-red-300 max-h-32 overflow-y-auto">
              {this.state.error.message || String(this.state.error)}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Khôi phục & Tải lại</span>
            </button>

            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.href = '/';
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-medium text-xs rounded-xl transition cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Về Trang chủ</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
