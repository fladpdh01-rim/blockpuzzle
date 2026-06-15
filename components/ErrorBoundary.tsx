'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#f7fafd] to-[#eef3f7] px-4 text-[#1e3a47]">
          <div className="w-full max-w-md bg-white border border-slate-100 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 animate-fade-in-up">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-3xl shadow-inner text-rose-600">
              ⚠️
            </div>
            
            <div className="text-center">
              <h1 className="text-2xl font-black text-rose-600">오류가 발생했습니다</h1>
              <p className="text-slate-400 text-xs mt-2 font-semibold leading-5">
                화면을 렌더링하는 중 예기치 않은 문제가 발생했습니다.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">상세 오류 메시지</span>
                <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50/50 p-2 rounded-lg break-all">
                  {this.state.error.message || this.state.error.toString()}
                </span>
              </div>
            )}

            <div className="flex w-full gap-3 mt-2">
              <button
                onClick={this.handleRetry}
                className="flex-1 py-3.5 bg-[#AECFD4] hover:bg-[#96c4c9] text-[#1e3a47] font-black text-sm rounded-2xl shadow-sm transition-all cursor-pointer text-center"
              >
                다시 시도 🔄
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-extrabold text-sm rounded-2xl shadow-sm transition-all cursor-pointer text-center"
              >
                홈으로 돌아가기 🏠
              </button>
            </div>
          </div>

          {/* Fallback footer matching design instructions */}
          <footer className="w-full max-w-md text-center text-[10px] text-slate-400 mt-8 flex flex-col gap-2">
            <span>제작자: 오예림</span>
            <div className="flex justify-center gap-3">
              <a 
                href="https://www.inu.ac.kr" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-slate-600 transition-colors underline"
              >
                인천대학교 홈페이지
              </a>
              <span>|</span>
              <a 
                href="https://portal.inu.ac.kr" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-slate-600 transition-colors underline"
              >
                INU 포털
              </a>
            </div>
          </footer>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
