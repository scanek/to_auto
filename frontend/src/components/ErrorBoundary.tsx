import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReload = () => {
    window.location.reload();
  };

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white">Произошла ошибка интерфейса</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Компонент страницы вызвал непредвиденное исключение.
            </p>
            {this.state.error && (
              <div className="bg-slate-950/80 p-3.5 rounded-xl text-left font-mono text-[11px] text-rose-300 border border-rose-500/20 overflow-x-auto max-h-40">
                <div className="font-bold">{this.state.error.toString()}</div>
                {this.state.errorInfo?.componentStack && (
                  <div className="text-[10px] text-slate-500 mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold transition-all"
              >
                Попробовать снова
              </button>
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-lg shadow-brand-500/25"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Перезагрузить страницу</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
