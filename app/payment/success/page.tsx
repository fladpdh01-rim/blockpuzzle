'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import Link from 'next/link';

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { completePurchase, loading: authLoading } = useAuth();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [purchaseInfo, setPurchaseInfo] = useState<{
    itemType: string;
    itemName: string;
    amount: number;
  } | null>(null);

  useEffect(() => {
    if (authLoading) return;

    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amountStr = searchParams.get('amount');

    if (!orderId || !amountStr) {
      setStatus('error');
      setErrorMessage('결제 정보가 올바르지 않습니다.');
      return;
    }

    const amount = parseInt(amountStr, 10);

    // localStorage에서 대기 중인 결제 정보 가져오기
    const pendingDataStr = localStorage.getItem('block_puzzle_pending_purchase');
    if (!pendingDataStr) {
      setStatus('error');
      setErrorMessage('결제 대기 중인 내역을 찾을 수 없습니다.');
      return;
    }

    try {
      const pending = JSON.parse(pendingDataStr);
      
      // orderId 검증
      if (pending.orderId !== orderId) {
        setStatus('error');
        setErrorMessage('주문 ID가 일치하지 않습니다.');
        return;
      }

      // 아이템 지급 처리
      const itemType = pending.itemType;
      completePurchase(itemType).then(() => {
        let itemName = '상품';
        if (itemType === 'itemset') itemName = '아이템 세트 패키지';
        else if (itemType === 'gold10000') itemName = 'Gold 10000개';
        else if (itemType === 'gold5000') itemName = 'Gold 5000개';

        setPurchaseInfo({
          itemType,
          itemName,
          amount
        });
        setStatus('success');
        
        // 처리 완료 후 중복 지급 방지를 위해 pending 내역 삭제
        localStorage.removeItem('block_puzzle_pending_purchase');
      }).catch((e) => {
        setStatus('error');
        setErrorMessage('아이템 지급 처리 중 오류가 발생했습니다.');
      });

    } catch (e) {
      setStatus('error');
      setErrorMessage('결제 내역 데이터를 읽는 데 실패했습니다.');
    }
  }, [searchParams, authLoading]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#f7fafd] to-[#eef3f7] text-[#1e3a47]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#AECFD4] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400 font-semibold">결제 정보를 확인하고 아이템을 지급하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#f7fafd] to-[#eef3f7] px-4">
      <div className="w-full max-w-md bg-white border border-slate-100 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 animate-pop-in">
        
        {status === 'success' ? (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-3xl shadow-inner text-emerald-600 animate-bounce">
              ✓
            </div>
            
            <div className="text-center">
              <h1 className="text-2xl font-black text-[#1e3a47]">결제 완료</h1>
              <p className="text-slate-400 text-xs mt-1 font-semibold">주문하신 상품이 성공적으로 지급되었습니다!</p>
            </div>

            <div className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-450 font-bold">구매 상품</span>
                <span className="font-extrabold text-slate-800">{purchaseInfo?.itemName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-450 font-bold">결제 금액</span>
                <span className="font-black text-[#1e6068]">{purchaseInfo?.amount.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-3">
                <span className="text-slate-450 font-bold">지급 혜택</span>
                <span className="font-bold text-amber-600">
                  {purchaseInfo?.itemType === 'itemset' 
                    ? '🔄 블럭 변경 20개 + 💡 힌트 20개' 
                    : `🪙 ${purchaseInfo?.itemType === 'gold10000' ? '10000' : '5000'} Gold`}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-3xl shadow-inner text-rose-600 animate-pulse">
              ⚠️
            </div>
            
            <div className="text-center">
              <h1 className="text-2xl font-black text-rose-600">결제 처리 오류</h1>
              <p className="text-slate-400 text-xs mt-1 font-semibold">결제 도중 문제가 발생했습니다.</p>
            </div>

            <div className="w-full bg-rose-50 border border-rose-100 text-rose-650 text-xs p-4 rounded-2xl text-center font-bold">
              {errorMessage || '알 수 없는 오류가 발생했습니다.'}
            </div>
          </>
        )}

        <Link
          href="/"
          className="w-full py-4 bg-[#AECFD4] hover:bg-[#96c4c9] text-[#1e3a47] font-black text-center text-base rounded-2xl shadow-sm transition-all"
        >
          메인 화면으로 돌아가기 🏠
        </Link>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#f7fafd] to-[#eef3f7] text-[#1e3a47]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#AECFD4] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400 font-semibold">로딩 중...</p>
        </div>
      </div>
    }>
      <SuccessPageContent />
    </Suspense>
  );
}
