'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function FailPageContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('code');
  const errorMessage = searchParams.get('message');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#f7fafd] to-[#eef3f7] px-4">
      <div className="w-full max-w-md bg-white border border-slate-100 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 animate-pop-in">
        
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-3xl shadow-inner text-rose-600 animate-pulse">
          ✕
        </div>
        
        <div className="text-center">
          <h1 className="text-2xl font-black text-rose-600">결제 실패</h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">결제가 거절되었거나 중단되었습니다.</p>
        </div>

        <div className="w-full bg-rose-50 border border-rose-100 p-5 rounded-2xl flex flex-col gap-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-450 font-bold">오류 코드</span>
            <span className="font-extrabold text-rose-600">{errorCode || 'UNKNOWN_ERROR'}</span>
          </div>
          <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-3">
            <span className="text-slate-450 font-bold">실패 사유</span>
            <span className="font-bold text-slate-705 text-right max-w-[200px]">
              {errorMessage || '사용자에 의해 결제가 취소되었습니다.'}
            </span>
          </div>
        </div>

        <Link
          href="/"
          className="w-full py-4 bg-[#AECFD4] hover:bg-[#96c4c9] text-[#1e3a47] font-black text-center text-base rounded-2xl shadow-sm transition-all"
        >
          상점으로 돌아가기 🏠
        </Link>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#f7fafd] to-[#eef3f7] text-[#1e3a47]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#AECFD4] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400 font-semibold">로딩 중...</p>
        </div>
      </div>
    }>
      <FailPageContent />
    </Suspense>
  );
}
