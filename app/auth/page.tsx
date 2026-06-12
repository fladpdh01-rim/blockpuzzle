'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AuthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 이미 로그인된 사용자는 메인 페이지로 리다이렉트
  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // 로그인 후 메인 페이지로 리다이렉트되도록 설정
          redirectTo: `${window.location.origin}`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
      }
    } catch (e: any) {
      setErrorMessage(e.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-zinc-400 font-semibold">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 py-12 relative overflow-hidden">
      {/* 백그라운드 오라 효과 */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800 p-8 rounded-3xl shadow-2xl backdrop-blur-md flex flex-col items-center gap-8 animate-pop-in relative z-10">
        
        {/* 뒤로가기 버튼 */}
        <Link 
          href="/" 
          className="self-start text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1.5"
        >
          ← 홈으로 돌아가기
        </Link>

        {/* 헤더 */}
        <div className="text-center">
          <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
            SIGN IN
          </h1>
          <p className="text-zinc-400 text-xs mt-2 font-medium">로그인하고 랭킹 경쟁과 내 최고 기록을 관리하세요!</p>
        </div>

        {/* 에러 피드백 */}
        {errorMessage && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3.5 rounded-xl text-center">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* 소셜 로그인 버튼 */}
        <div className="w-full flex flex-col gap-4">
          <button
            onClick={handleGoogleLogin}
            disabled={authLoading}
            className="w-full py-4 bg-white text-zinc-900 hover:bg-zinc-100 font-extrabold text-base rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {authLoading ? (
              <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              // 구글 로고 SVG
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.49 3.77v3.12h4.02c2.36-2.17 3.72-5.37 3.72-8.74z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-4.02-3.12c-1.12.75-2.54 1.19-3.94 1.19-3.04 0-5.62-2.06-6.54-4.83H1.31v3.23A12 12 0 0 0 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.46 14.33a7.22 7.22 0 0 1 0-4.66V6.44H1.31a12 12 0 0 0 0 11.12l4.15-3.23z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.31 6.44l4.15 3.23C6.38 6.81 8.96 4.75 12 4.75z"
                />
              </svg>
            )}
            Google 계정으로 로그인
          </button>
        </div>

        {/* 하단 캡션 */}
        <div className="text-center text-[10px] text-zinc-500">
          계정이 없는 경우 구글 로그인과 동시에 자동으로 회원가입이 완료됩니다.
        </div>

      </div>
    </div>
  );
}
