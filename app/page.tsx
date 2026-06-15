'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import ErrorBoundary from '../components/ErrorBoundary';

// ==========================================
// 1. Types & Data Definitions
// ==========================================

interface Player {
  name: string;
  score: number;
}

interface Block {
  id: string;
  shape: number[][]; // 1: block present, 0: empty
  color: string;     // Tailwind gradient or flat color class
  width: number;
  height: number;
}

type ScreenType = 'home' | 'playing' | 'clear';
type DifficultyType = '하' | '중' | '상';
type TabType = 'play' | 'leaderboard' | 'profile';

// 5x5, 7x7, 10x10 패턴 정의 (사과, 꽃, 케이크)
const PATTERNS: Record<DifficultyType, Record<'사과' | '꽃' | '케이크', boolean[][]>> = {
  '하': {
    '사과': [
      [false, false, true,  false, false],
      [false, true,  true,  true,  false],
      [true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  true ],
      [false, true,  true,  true,  false]
    ],
    '꽃': [
      [false, true,  false, true,  false],
      [true,  true,  true,  true,  true ],
      [false, true,  true,  true,  false],
      [false, false, true,  false, false],
      [false, true,  true,  false, false]
    ],
    '케이크': [
      [false, false, true,  false, false],
      [false, true,  true,  true,  false],
      [true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  true ]
    ]
  },
  '중': {
    '사과': [
      [false, false, false, true,  true,  false, false],
      [false, false, true,  false, false, false, false],
      [false, true,  true,  true,  true,  true,  false],
      [true,  true,  true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  true,  true,  true ],
      [false, true,  true,  true,  true,  true,  false],
      [false, false, true,  true,  true,  false, false]
    ],
    '꽃': [
      [false, false, true,  false, true,  false, false],
      [false, true,  true,  true,  true,  true,  false],
      [true,  true,  true,  true,  true,  true,  true ],
      [false, true,  true,  true,  true,  true,  false],
      [false, false, true,  true,  true,  false, false],
      [false, false, false, true,  false, false, false],
      [false, false, true,  true,  false, false, false]
    ],
    '케이크': [
      [false, false, false, true,  false, false, false],
      [false, false, true,  true,  true,  false, false],
      [false, true,  true,  true,  true,  true,  false],
      [true,  true,  true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  true,  true,  true ],
      [false, true,  true,  true,  true,  true,  false]
    ]
  },
  '상': {
    '사과': [
      [false, false, false, false, false, true,  true,  false, false, false],
      [false, false, false, false, true,  false, false, false, false, false],
      [false, false, true,  true,  true,  true,  true,  true,  false, false],
      [false, true,  true,  true,  true,  true,  true,  true,  true,  false],
      [true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
      [false, true,  true,  true,  true,  true,  true,  true,  true,  false],
      [false, false, true,  true,  true,  true,  true,  true,  false, false],
      [false, false, false, true,  true,  true,  true,  false, false, false]
    ],
    '꽃': [
      [false, false, false, false, true,  true,  false, false, false, false],
      [false, false, true,  true,  false, false, true,  true,  false, false],
      [false, true,  true,  true,  true,  true,  true,  true,  true,  false],
      [true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  false, false, true,  true,  true,  true ],
      [false, true,  true,  true,  true,  true,  true,  true,  true,  false],
      [false, false, true,  true,  true,  true,  true,  true,  false, false],
      [false, false, false, false, true,  true,  false, false, false, false],
      [false, false, false, false, true,  true,  false, false, false, false],
      [false, false, false, true,  true,  true,  true,  false, false, false]
    ],
    '케이크': [
      [false, false, false, false, true,  true,  false, false, false, false],
      [false, false, false, false, true,  true,  false, false, false, false],
      [false, false, true,  true,  true,  true,  true,  true,  false, false],
      [false, true,  true,  true,  true,  true,  true,  true,  true,  false],
      [true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
      [true,  true,  false,  false, true,  true,  false,  false, true,  true ],
      [true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
      [false, true,  true,  true,  true,  true,  true,  true,  true,  false]
    ]
  }
};

// 디폴트 로컬 랭킹 데이터 (Supabase 동기화 전 혹은 게스트용)
const DEFAULT_PLAYERS: Player[] = [
  { name: 'ZenMaster', score: 2450 },
  { name: 'CloudCatcher', score: 1800 },
  { name: 'BlockBuster', score: 1000 }
];

// 블록 템플릿 정의 (파스텔 블루 / 골드 매핑)
const BLOCK_TEMPLATES: { shape: number[][]; color: string }[] = [
  { shape: [[1]], color: 'from-[#BCE3E6] to-[#A2CBD0]' }, // 1x1 (Blue)
  { shape: [[1, 1]], color: 'from-[#FEE282] to-[#FED650]' }, // 2x1 가로 (Gold)
  { shape: [[1], [1]], color: 'from-[#FEE282] to-[#FED650]' }, // 1x2 세로 (Gold)
  { shape: [[1, 1, 1]], color: 'from-[#BCE3E6] to-[#A2CBD0]' }, // 3x1 가로 (Blue)
  { shape: [[1], [1], [1]], color: 'from-[#BCE3E6] to-[#A2CBD0]' }, // 1x3 세로 (Blue)
  { shape: [[1, 1, 1, 1]], color: 'from-[#BCE3E6] to-[#A2CBD0]' }, // 4x1 가로 (Blue)
  { shape: [[1], [1], [1], [1]], color: 'from-[#BCE3E6] to-[#A2CBD0]' }, // 1x4 세로 (Blue)
  { shape: [[1, 1], [1, 1]], color: 'from-[#FEE282] to-[#FED650]' }, // 2x2 사각형 (Gold)
  { shape: [[1, 0], [1, 1]], color: 'from-[#FEE282] to-[#FED650]' }, // L자 (Gold)
  { shape: [[0, 1, 0], [1, 1, 1]], color: 'from-[#BCE3E6] to-[#A2CBD0]' } // T자 (Blue)
];

// 리그 구분을 스코어에 따라 반환
const getDivisionName = (score: number) => {
  if (score >= 2450) return 'Pro League';
  if (score >= 1800) return 'Diamond III';
  if (score >= 1200) return 'Diamond II';
  if (score >= 800) return 'Diamond I';
  return 'Platinum I';
};

// 완성된 그림의 주제에 맞는 테마 색상을 반환하는 헬퍼 함수
const getThematicCellColor = (shapeName: '사과' | '꽃' | '케이크' | string, r: number, c: number, size: number): string => {
  if (shapeName === '사과') {
    // 사과: 윗부분(줄기/잎)은 녹색/갈색, 몸통은 빨간색
    if (r <= 1) {
      if (size === 5 && r === 0 && c === 2) return 'from-emerald-500 to-green-600';
      if (size === 7 && r === 0 && (c === 3 || c === 4)) return 'from-emerald-500 to-green-600';
      if (size === 7 && r === 1 && c === 2) return 'from-amber-700 to-amber-800';
      if (size === 10 && r === 0 && (c === 5 || c === 6)) return 'from-emerald-500 to-green-600';
      if (size === 10 && r === 1 && c === 4) return 'from-amber-700 to-amber-800';
    }
    return 'from-rose-500 to-red-600'; // 사과 몸통
  }
  
  if (shapeName === '꽃') {
    // 꽃: 하단(줄기/잎)은 녹색, 가운데는 노란색, 꽃잎은 분홍색
    if (size === 5) {
      if (r >= 3) return 'from-emerald-500 to-green-600'; // 줄기/잎
      if ((r === 1 && c === 2) || (r === 2 && c === 2)) return 'from-yellow-400 to-amber-500'; // 꽃술
      return 'from-pink-400 to-rose-450'; // 꽃잎
    }
    if (size === 7) {
      if (r >= 4) return 'from-emerald-500 to-green-600'; // 줄기
      if ((r === 1 && c === 3) || (r === 2 && c === 3) || (r === 3 && c === 3)) return 'from-yellow-400 to-amber-500'; // 꽃술
      return 'from-pink-400 to-rose-450'; // 꽃잎
    }
    if (size === 10) {
      if (r >= 6) return 'from-emerald-500 to-green-600'; // 줄기
      if ((r === 2 && (c === 4 || c === 5)) || (r === 3 && (c === 4 || c === 5)) || (r === 4 && (c === 3 || c === 6))) {
        return 'from-yellow-400 to-amber-500'; // 꽃술
      }
      return 'from-pink-400 to-rose-450'; // 꽃잎
    }
    return 'from-pink-400 to-rose-450';
  }
  
  if (shapeName === '케이크') {
    // 케이크: 맨위 체리는 빨간색, 휘핑크림은 흰색/크림색, 빵은 초콜릿색, 접시는 은색/회색
    if (size === 5) {
      if (r === 0) return 'from-red-500 to-rose-600'; // 체리
      if (r === 1) return 'from-[#FFFEE6] to-[#FEDE80]'; // 크림
      if (r === 2 || r === 3) return 'from-[#6E4933] to-[#4A3020]'; // 초코빵
      return 'from-slate-350 to-slate-400'; // 접시
    }
    if (size === 7) {
      if (r === 0) return 'from-red-500 to-rose-600'; // 체리
      if (r === 1 || r === 2) return 'from-[#FFFEE6] to-[#FEDE80]'; // 크림
      if (r === 3 || r === 4 || r === 5) return 'from-[#6E4933] to-[#4A3020]'; // 초코빵
      return 'from-slate-350 to-slate-400'; // 접시
    }
    if (size === 10) {
      if (r === 0 || r === 1) return 'from-red-500 to-rose-600'; // 체리
      if (r >= 2 && r <= 5) return 'from-[#FFFEE6] to-[#FEDE80]'; // 크림
      if (r >= 6 && r <= 8) return 'from-[#6E4933] to-[#4A3020]'; // 초코빵
      return 'from-slate-350 to-slate-400'; // 접시
    }
    return 'from-[#6E4933] to-[#4A3020]';
  }
  
  return 'from-indigo-400 to-purple-500';
};

function balanceBlocks(blocks: { shape: number[][]; color: string }[]) {
  const getShapeStr = (shape: number[][]) => JSON.stringify(shape);
  const shapesBySize: Record<number, number[][][]> = {
    1: [[[1]]],
    2: [[[1, 1]], [[1], [1]]],
    3: [[[1, 1, 1]], [[1], [1], [1]], [[1, 0], [1, 1]]],
    4: [[[1, 1, 1, 1]], [[1], [1], [1], [1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]]]
  };

  const getBlockSize = (shape: number[][]) => {
    let size = 0;
    shape.forEach(row => row.forEach(val => { if (val === 1) size++; }));
    return size;
  };

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 100) {
    iterations++;
    changed = false;
    const freq: Record<string, number> = {};
    blocks.forEach(b => {
      const s = getShapeStr(b.shape);
      freq[s] = (freq[s] || 0) + 1;
    });

    const overUsedShapeStr = Object.keys(freq).find(s => freq[s] > 3);
    if (overUsedShapeStr) {
      const overUsedShape = JSON.parse(overUsedShapeStr);
      const size = getBlockSize(overUsedShape);
      const overUsedIdx = blocks.findIndex(b => getShapeStr(b.shape) === overUsedShapeStr);
      if (overUsedIdx === -1) continue;

      const candidates = shapesBySize[size] || [];
      const bestReplacement = candidates.find(cand => {
        const candStr = getShapeStr(cand);
        return (freq[candStr] || 0) < 3;
      });

      if (bestReplacement) {
        blocks[overUsedIdx].shape = bestReplacement;
        changed = true;
      } else {
        if (size === 1) {
          const size2Candidates = shapesBySize[2];
          const bestSize2 = size2Candidates.find(cand => (freq[getShapeStr(cand)] || 0) < 3);
          if (bestSize2) {
            const second1x1Idx = blocks.findIndex((b, idx) => idx !== overUsedIdx && getShapeStr(b.shape) === overUsedShapeStr);
            if (second1x1Idx !== -1) {
              blocks[overUsedIdx].shape = bestSize2;
              blocks.splice(second1x1Idx, 1);
              changed = true;
            }
          }
        } else if (size === 2) {
          const size1Str = getShapeStr([[1]]);
          if ((freq[size1Str] || 0) < 2) {
            blocks[overUsedIdx].shape = [[1]];
            blocks.push({ shape: [[1]], color: blocks[overUsedIdx].color });
            changed = true;
          }
        } else if (size === 3) {
          const size2Candidates = shapesBySize[2];
          const bestSize2 = size2Candidates.find(cand => (freq[getShapeStr(cand)] || 0) < 3);
          const size1Str = getShapeStr([[1]]);
          if (bestSize2 && (freq[size1Str] || 0) < 3) {
            blocks[overUsedIdx].shape = bestSize2;
            blocks.push({ shape: [[1]], color: blocks[overUsedIdx].color });
            changed = true;
          }
        } else if (size === 4) {
          const size2Candidates = shapesBySize[2];
          const availableSize2 = size2Candidates.filter(cand => (freq[getShapeStr(cand)] || 0) < 3);
          if (availableSize2.length >= 1) {
            const shp = availableSize2[0];
            blocks[overUsedIdx].shape = shp;
            const secondShp = availableSize2[1] || shp;
            blocks.push({ shape: secondShp, color: blocks[overUsedIdx].color });
            changed = true;
          }
        }
      }
    }
  }
  return blocks;
}

// KPI Card count-up number component
function AnimatedCounter({ value, enabled = true }: { value: number; enabled?: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    if (!enabled) {
      setDisplayValue(value);
      return;
    }
    
    let start = 0;
    const duration = 1000; // 1 second
    const stepTime = 16; // ~60fps
    const totalSteps = Math.ceil(duration / stepTime);
    const increment = value / totalSteps;
    let currentStep = 0;
    
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= totalSteps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        start += increment;
        setDisplayValue(Math.floor(start));
      }
    }, stepTime);
    
    return () => clearInterval(timer);
  }, [value, enabled]);

  return <>{displayValue.toLocaleString()}</>;
}

// League/Rank progress chart component
function RankProgressChart({ score }: { score: number }) {
  let currentTier = 'Platinum I';
  let nextTier = 'Diamond I';
  let percentage = 0;
  let text = '';

  if (score < 800) {
    currentTier = 'Platinum I';
    nextTier = 'Diamond I';
    percentage = (score / 800) * 100;
    text = `${score} / 800`;
  } else if (score < 1200) {
    currentTier = 'Diamond I';
    nextTier = 'Diamond II';
    percentage = ((score - 800) / (1200 - 800)) * 100;
    text = `${score} / 1200`;
  } else if (score < 1800) {
    currentTier = 'Diamond II';
    nextTier = 'Diamond III';
    percentage = ((score - 1200) / (1800 - 1200)) * 100;
    text = `${score} / 1800`;
  } else if (score < 2450) {
    currentTier = 'Diamond III';
    nextTier = 'Pro League';
    percentage = ((score - 1800) / (2450 - 1800)) * 100;
    text = `${score} / 2450`;
  } else {
    currentTier = 'Pro League';
    nextTier = 'Max Tier 🎉';
    percentage = 100;
    text = `${score} 점 (PRO)`;
  }

  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth(percentage);
    }, 150);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="flex flex-col gap-2 w-full mt-4 bg-slate-50 border border-slate-100 p-5 rounded-2xl">
      <div className="flex justify-between items-center text-xs font-bold">
        <span className="text-[#1e3a47]">{currentTier}</span>
        <span className="text-slate-400 font-medium">다음 리그: {nextTier}</span>
      </div>
      <div className="w-full h-3.5 bg-slate-200/50 rounded-full overflow-hidden relative shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-[#AECFD4] to-[#1e6068] rounded-full transition-all duration-1000 ease-out shadow-sm"
          style={{ width: `${animatedWidth}%` }}
        />
      </div>
      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase mt-1">
        <span>리그 진행도</span>
        <span>{text} 점 ({Math.floor(percentage)}%)</span>
      </div>
    </div>
  );
}

export default function BlockPuzzleGame() {
  // ==========================================
  // 2. States & Auth Context
  // ==========================================
  const { 
    user, 
    guestId, 
    isGuest, 
    userScore, 
    gold,
    blockChanges,
    hints,
    hasBoughtItemSet,
    hasBoughtTimeSale,
    loading,
    signOut,
    updateUserScore,
    purchaseItem,
    useBlockChangeItem,
    useHintItem,
    pendingMigrationScore, 
    migrateGuestScore 
  } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('play');
  const [screen, setScreen] = useState<ScreenType>('home');
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [shopTab, setShopTab] = useState<'gold' | 'cash'>('gold');
  const [selectedShopItem, setSelectedShopItem] = useState<{
    id: string;
    name: string;
    description: string;
    priceText: string;
    originalPriceText?: string;
    badge?: string;
    icon: string;
  } | null>(null);
  const [shopMessage, setShopMessage] = useState<{ text: string; success: boolean } | null>(null);
  
  // 결제 관련 상태
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerNameError, setPayerNameError] = useState('');
  const [payerEmailError, setPayerEmailError] = useState('');
  const [payerLoading, setPayerLoading] = useState(false);

  // 게임 아이템 사용 관련 상태
  const [usingItem, setUsingItem] = useState<'blockchange' | 'hint' | null>(null);
  const [hintHighlightCell, setHintHighlightCell] = useState<{ r: number; c: number; width: number; height: number } | null>(null);
  const [selectedPoolBlockIdxToChange, setSelectedPoolBlockIdxToChange] = useState<number | null>(null);
  const [showShapeSelectorModal, setShowShapeSelectorModal] = useState(false);

  // Refined block change & 6-step Hint states
  const [showPoolBlockSelectorModal, setShowPoolBlockSelectorModal] = useState(false);
  const [generatedShapesLog, setGeneratedShapesLog] = useState<string[]>([]);
  const [hintSelectMode, setHintSelectMode] = useState(false);
  const [selectedHintBlockIdx, setSelectedHintBlockIdx] = useState<number | null>(null);
  const [hintHighlightCells, setHintHighlightCells] = useState<{ r: number; c: number }[]>([]);
  const [hintTimer, setHintTimer] = useState<number | null>(null);
  const [hintFadeOut, setHintFadeOut] = useState(false);
  const hintIntervalRef = useRef<any>(null);

  const [difficulty, setDifficulty] = useState<DifficultyType | null>(null);
  const [gridSize, setGridSize] = useState<number>(5);
  
  // 게임 판 정보: null 이면 빈 칸, string 이면 채워진 블록의 색상
  const [grid, setGrid] = useState<(string | null)[][]>([]);
  const [targetShapeName, setTargetShapeName] = useState<'사과' | '꽃' | '케이크' | ''>('');
  const [targetPattern, setTargetPattern] = useState<boolean[][]>([]);
  
  // Gemini 블록 큐 및 현재 활성화된 3개 블록 풀
  const [geminiBlockQueue, setGeminiBlockQueue] = useState<Omit<Block, 'id' | 'width' | 'height'>[]>([]);
  const [blockPool, setBlockPool] = useState<(Block | null)[]>([]);
  const [history, setHistory] = useState<{ grid: (string | null)[][]; blockPool: (Block | null)[]; geminiBlockQueue: Omit<Block, 'id' | 'width' | 'height'>[] }[]>([]);
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);
  const [isAiMode, setIsAiMode] = useState<boolean>(true);
  
  // 랭킹 & 최고 기록 (로컬 저장소 백업용)
  const [players, setPlayers] = useState<Player[]>([]);
  const [bestTimes, setBestTimes] = useState<Record<string, number | null>>({ '하': null, '중': null, '상': null });
  const [rank, setRank] = useState<number>(1);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  
  // 추가된 UI/UX 개선 상태
  const [leaderboardLoading, setLeaderboardLoading] = useState<boolean>(false);
  const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(true);
  const [aiGeneratingProgress, setAiGeneratingProgress] = useState<number>(0);
  
  // 타이머 및 경고 알림
  const [time, setTime] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [warningTimeout, setWarningTimeout] = useState<NodeJS.Timeout | null>(null);

  // 클리어 연출
  const [clearedAnimation, setClearedAnimation] = useState<boolean>(false);
  const [particles, setParticles] = useState<{ id: number; emoji: string; left: string; delay: string; duration: string }[]>([]);
  
  // 클리어 화면 누적 점수 애니메이션용 최상위 상태
  const [animatedScore, setAnimatedScore] = useState<number>(0);

  // 드래그앤드롭 상태
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [previewCell, setPreviewCell] = useState<{ r: number; c: number } | null>(null);

  // DOM Refs
  const gridRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Supabase 실시간 리더보드 동기화 (is_guest = false 대상)
  const fetchLeaderboard = async (overrideScore?: number) => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        let mapped = await res.json();
        if (mapped.length > 0) {
          // 게스트인 경우 로컬 점수를 수동으로 병합하여 리더보드에 반영
          const activeUser = user;
          const activeScore = overrideScore !== undefined ? overrideScore : userScore;

          if (!activeUser && activeScore > 0) {
            const currentGuestId = guestId || 'guestGuest';
            const guestIdx = mapped.findIndex((p: any) => p.name === currentGuestId);
            if (guestIdx !== -1) {
              mapped[guestIdx].score = Math.max(mapped[guestIdx].score, activeScore);
            } else {
              mapped.push({ name: currentGuestId, score: activeScore });
            }
            mapped.sort((a: any, b: any) => b.score - a.score);
          }

          setPlayers(mapped);
          localStorage.setItem('block_puzzle_players', JSON.stringify(mapped));
        }
      }
    } catch (e) {
      console.error('리더보드 조회 오류:', e);
    } finally {
      setTimeout(() => {
        setLeaderboardLoading(false);
      }, 500);
    }
  };

  // 사용자 로그인/아웃 시점 리더보드 실시간 동기화
  useEffect(() => {
    fetchLeaderboard();
  }, [user]);

  // AI 블록 생성 프로그레스 시뮬레이션
  useEffect(() => {
    let progressTimer: NodeJS.Timeout | null = null;
    if (aiGenerating) {
      setAiGeneratingProgress(0);
      progressTimer = setInterval(() => {
        setAiGeneratingProgress((prev) => {
          if (prev >= 95) return 95;
          const inc = Math.floor(Math.random() * 8) + 4; // 4% ~ 11%씩 증가
          return Math.min(prev + inc, 95);
        });
      }, 250);
    } else {
      setAiGeneratingProgress(100);
    }
    return () => {
      if (progressTimer) clearInterval(progressTimer);
    };
  }, [aiGenerating]);

  // ==========================================
  // 3. Initial Load & Storage Sync
  // ==========================================
  useEffect(() => {
    // 애니메이션 활성화 선호도 로드
    if (typeof window !== 'undefined') {
      const savedAnim = localStorage.getItem('block_puzzle_animationsEnabled');
      if (savedAnim !== null) {
        setAnimationsEnabled(savedAnim === 'true');
      }
    }

    // 플레이어 랭킹 로드
    const storedPlayers = localStorage.getItem('block_puzzle_players');
    if (storedPlayers) {
      try {
        setPlayers(JSON.parse(storedPlayers));
      } catch (e) {
        console.error(e);
      }
    } else {
      localStorage.setItem('block_puzzle_players', JSON.stringify(DEFAULT_PLAYERS));
      setPlayers(DEFAULT_PLAYERS);
    }

    // 최고 기록 로드
    const storedBestTimes = localStorage.getItem('block_puzzle_bestTimes');
    if (storedBestTimes) {
      try {
        setBestTimes(JSON.parse(storedBestTimes));
      } catch (e) {
        console.error(e);
      }
    } else {
      const initial = { '하': null, '중': null, '상': null };
      localStorage.setItem('block_puzzle_bestTimes', JSON.stringify(initial));
    }
  }, []);

  // 점수와 플레이어 랭킹 변화에 따른 내 등수 계산
  useEffect(() => {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    // 내 등수 산출: 나보다 높은 사람의 수 + 1
    const currentRank = sorted.filter(p => p.score > userScore).length + 1;
    setRank(currentRank);
  }, [userScore, players]);

  // ==========================================
  // 4. Timer Hooks
  // ==========================================
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive]);

  // 클리어 화면 누적 점수 롤링 애니메이션 처리 이펙트
  useEffect(() => {
    if (screen === 'clear') {
      const acquired = difficulty === '하' ? 100 : difficulty === '중' ? 250 : 1000;
      let start = userScore - acquired;
      const end = userScore;
      setAnimatedScore(start);

      if (start === end) return;

      const duration = 1000;
      const stepTime = Math.abs(Math.floor(duration / (end - start)));
      const timer = setInterval(() => {
        start += 1;
        setAnimatedScore(start);
        if (start >= end) {
          clearInterval(timer);
        }
      }, Math.max(stepTime, 20));

      return () => clearInterval(timer);
    }
  }, [screen, userScore, difficulty]);

  // ==========================================
  // 5. Game Core Logic & Gemini AI Integration
  // ==========================================
  
  const triggerWarning = (msg: string) => {
    if (warningTimeout) clearTimeout(warningTimeout);
    setWarningMessage(msg);
    const to = setTimeout(() => {
      setWarningMessage(null);
    }, 2000);
    setWarningTimeout(to);
  };

  // 랜덤 블록 생성 (Fallback 모드용)
  const generateRandomBlock = (): Block => {
    const availableTemplates = BLOCK_TEMPLATES.filter(tmpl => {
      const shapeStr = JSON.stringify(tmpl.shape);
      const count = generatedShapesLog.filter(s => s === shapeStr).length;
      return count < 3;
    });

    const templatesToUse = availableTemplates.length > 0 ? availableTemplates : BLOCK_TEMPLATES;
    const template = templatesToUse[Math.floor(Math.random() * templatesToUse.length)];
    const shape = template.shape;
    const shapeStr = JSON.stringify(shape);

    setGeneratedShapesLog(prev => [...prev, shapeStr]);

    return {
      id: Math.random().toString(36).substr(2, 9),
      shape,
      color: template.color,
      width: shape[0].length,
      height: shape.length
    };
  };

  // 게임 시작 (난이도 선택 시 호출)
  const startGame = async (diff: DifficultyType) => {
    setDifficulty(diff);
    let size = 5;
    if (diff === '중') size = 7;
    if (diff === '상') size = 10;
    setGridSize(size);

    // 격자 초기화
    const newGrid: (string | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
    setGrid(newGrid);
    setHistory([]);

    // 그림 랜덤 선택
    const shapes: ('사과' | '꽃' | '케이크')[] = ['사과', '꽃', '케이크'];
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    setTargetShapeName(randomShape);
    const pattern = PATTERNS[diff][randomShape];
    setTargetPattern(pattern);

    // 모달을 닫고 AI 생성 모드 진입
    setShowDiffModal(false);
    setAiGenerating(true);
    setAiGeneratingProgress(0); // AI 생성 진행도 초기화
    setScreen('playing');
    setActiveTab('play');

    try {
      // 1. Gemini AI 블록 생성 API 호출
      const res = await fetch('/api/generate-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          difficulty: diff,
          gridSize: size,
          targetShapeName: randomShape,
          targetPattern: pattern
        })
      });

      if (!res.ok) {
        throw new Error('Gemini API 호출 실패');
      }

      const data = await res.json();
      const generated: Omit<Block, 'id' | 'width' | 'height'>[] = data.blocks;

      // Balance blocks using the same algorithm
      const balancedGenerated = balanceBlocks(generated as any);

      // AI 모드 활성화
      setIsAiMode(true);

      // 2. 받아온 블록 리스트를 큐에 보관
      setGeminiBlockQueue(balancedGenerated);

      // 3. 큐에서 최초 3개 블록을 꺼내 풀(Pool) 구성
      const initialPool: (Block | null)[] = [];
      const blocksToTake = balancedGenerated.slice(0, 3);
      const remainingQueue = balancedGenerated.slice(3);

      blocksToTake.forEach((b) => {
        initialPool.push({
          id: Math.random().toString(36).substr(2, 9),
          shape: b.shape,
          color: b.color,
          width: b.shape[0].length,
          height: b.shape.length
        });
      });

      // 3개가 안 채워졌다면 null로 채움
      while (initialPool.length < 3) {
        initialPool.push(null);
      }

      const initialLog = balancedGenerated.map(b => JSON.stringify(b.shape));
      setGeneratedShapesLog(initialLog);

      setBlockPool(initialPool);
      setGeminiBlockQueue(remainingQueue);

    } catch (err) {
      console.error('Gemini 블록 구성 에러:', err);
      triggerWarning('AI 블록 생성에 실패하여 로컬 기본 블록으로 시작합니다.');
      
      // AI 모드 비활성화 (무한 기본 블록 모드)
      setIsAiMode(false);

      // Fallback: Gemini 실패 시 기본 블록 템플릿 무한 모드로 세팅
      const fallbackTemplates = BLOCK_TEMPLATES;

      const initialLog: string[] = [];
      const initialPool = Array(3).fill(null).map(() => {
        const availableTemplates = fallbackTemplates.filter(t => {
          const s = JSON.stringify(t.shape);
          const count = initialLog.filter(x => x === s).length;
          return count < 3;
        });
        const templatesToUse = availableTemplates.length > 0 ? availableTemplates : fallbackTemplates;
        const t = templatesToUse[Math.floor(Math.random() * templatesToUse.length)];
        initialLog.push(JSON.stringify(t.shape));
        return {
          id: Math.random().toString(36).substr(2, 9),
          shape: t.shape,
          color: t.color,
          width: t.shape[0].length,
          height: t.shape.length
        };
      });
      setGeneratedShapesLog(initialLog);
      setBlockPool(initialPool);
      setGeminiBlockQueue([]); // 큐는 없음
    } finally {
      setAiGenerating(false);
      setTime(0);
      setTimerActive(true);
      setClearedAnimation(false);
    }
  };

  const restartGame = () => {
    if (difficulty) {
      startGame(difficulty);
    }
  };

  const quitGame = () => {
    setTimerActive(false);
    setScreen('home');
    setUsingItem(null);
    setHintHighlightCell(null);
    clearHint();
    setGeneratedShapesLog([]);
  };

  // Toss Payments 결제 실행
  const handleTossPayment = async () => {
    let isValid = true;
    if (!payerName.trim()) {
      setPayerNameError('이름을 입력해주세요.');
      isValid = false;
    } else {
      setPayerNameError('');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!payerEmail.trim()) {
      setPayerEmailError('이메일을 입력해주세요.');
      isValid = false;
    } else if (!emailRegex.test(payerEmail.trim())) {
      setPayerEmailError('올바른 이메일 주소를 입력해주세요.');
      isValid = false;
    } else {
      setPayerEmailError('');
    }

    if (!isValid) return;
    if (!selectedShopItem) return;

    setPayerLoading(true);

    try {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_D5GePWvy4GKWpbvL152jVNZ4LM9Q';
      const tossPayments = await loadTossPayments(clientKey);

      const customerKey = user?.id || guestId || 'guest-' + Math.floor(1000 + Math.random() * 9000);
      const orderId = 'INU-' + Date.now();
      const orderName = '인천대학교 기초교육원 교양 교과목 결제';
      
      let amount = 4900;
      if (selectedShopItem.id === 'gold10000') amount = 10000;
      else if (selectedShopItem.id === 'gold5000') amount = 5000;

      const successUrl = `${window.location.origin}/payment/success`;
      const failUrl = `${window.location.origin}/payment/fail`;

      localStorage.setItem('block_puzzle_pending_purchase', JSON.stringify({
        orderId,
        itemType: selectedShopItem.id,
        userId: customerKey
      }));

      const payment = tossPayments.payment({ customerKey });
      
      await payment.requestPayment({
        method: 'CARD',
        amount: {
          currency: 'KRW',
          value: amount
        },
        orderId,
        orderName,
        successUrl,
        failUrl,
        customerName: payerName.trim(),
        customerEmail: payerEmail.trim()
      });
    } catch (e: any) {
      console.error('Toss Payment failed:', e);
      alert('결제 창 실행 중 오류가 발생했습니다: ' + (e.message || e));
    } finally {
      setPayerLoading(false);
    }
  };

  // 블럭 변경 아이템 사용 트리거
  const triggerBlockChangeUsage = () => {
    if (usingItem === 'blockchange') {
      setUsingItem(null);
      return;
    }
    if (blockChanges <= 0) {
      triggerWarning('블럭 변경 아이템이 부족합니다.');
      return;
    }
    clearHint();
    setUsingItem('blockchange');
    triggerWarning('변경할 블록을 아래에서 선택해 주세요.');
  };

  // 힌트 아이템 사용 트리거
  const triggerHintUsage = () => {
    if (usingItem === 'hint') {
      clearHint();
      return;
    }
    if (hints <= 0) {
      triggerWarning('힌트를 모두 사용했습니다');
      return;
    }
    clearHint();
    setHintSelectMode(true);
    setUsingItem('hint');
    triggerWarning('힌트를 받을 블록을 아래에서 선택해 주세요.');
  };

  // 블록 풀의 블록 클릭 핸들러 (아이템 사용 모드일 때 동작 분기)
  const handleBlockPoolSlotClick = (idx: number) => {
    const block = blockPool[idx];
    if (!block) return;
    setSelectedPoolBlockIdxToChange(idx);
    setShowPoolBlockSelectorModal(false);
    setShowShapeSelectorModal(true);
  };

  const clearHint = () => {
    if (hintIntervalRef.current) {
      clearInterval(hintIntervalRef.current);
      hintIntervalRef.current = null;
    }
    setHintHighlightCells([]);
    setSelectedHintBlockIdx(null);
    setHintTimer(null);
    setHintFadeOut(false);
    setHintSelectMode(false);
    setUsingItem(null);
  };

  const handleBlockPoolSlotClickForHint = async (idx: number) => {
    const block = blockPool[idx];
    if (!block) return;

    setSelectedHintBlockIdx(idx);

    const validPositions: { r: number; c: number }[] = [];
    const bh = block.shape.length;
    const bw = block.shape[0].length;
    for (let r = 0; r <= gridSize - bh; r++) {
      for (let c = 0; c <= gridSize - bw; c++) {
        if (canPlaceBlock(block.shape, r, c)) {
          for (let br = 0; br < bh; br++) {
            for (let bc = 0; bc < bw; bc++) {
              if (block.shape[br][bc] === 1) {
                const gr = r + br;
                const gc = c + bc;
                if (!validPositions.some(p => p.r === gr && p.c === gc)) {
                  validPositions.push({ r: gr, c: gc });
                }
              }
            }
          }
        }
      }
    }

    if (validPositions.length === 0) {
      triggerWarning('이 블록을 배치할 수 있는 유효한 공간이 없습니다!');
      clearHint();
      return;
    }

    const success = await useHintItem();
    if (success) {
      setHintHighlightCells(validPositions);
      setHintSelectMode(false);
      setUsingItem(null);

      setHintTimer(5);
      if (hintIntervalRef.current) {
        clearInterval(hintIntervalRef.current);
      }

      let currentSec = 5;
      hintIntervalRef.current = setInterval(() => {
        currentSec -= 1;
        if (currentSec <= 0) {
          if (hintIntervalRef.current) {
            clearInterval(hintIntervalRef.current);
            hintIntervalRef.current = null;
          }
          setHintFadeOut(true);
          setTimeout(() => {
            setHintHighlightCells([]);
            setSelectedHintBlockIdx(null);
            setHintTimer(null);
            setHintFadeOut(false);
          }, 500);
        } else {
          setHintTimer(currentSec);
        }
      }, 1000);
    } else {
      triggerWarning('힌트 아이템 사용에 실패했습니다.');
      clearHint();
    }
  };

  // 블록 형상 선택기에서 템플릿 선택 완료 시 호출
  const handleSelectBlockShape = async (templateShape: number[][]) => {
    if (selectedPoolBlockIdxToChange === null) return;
    
    const success = await useBlockChangeItem();
    if (success) {
      const templateColors = [
        'from-[#BCE3E6] to-[#A2CBD0]',
        'from-[#FEE282] to-[#FED650]',
        'from-[#FFD369] to-[#FFA800]'
      ];
      const randomColor = templateColors[Math.floor(Math.random() * templateColors.length)];
      
      const newPool = [...blockPool];
      newPool[selectedPoolBlockIdxToChange] = {
        id: Math.random().toString(36).substr(2, 9),
        shape: templateShape,
        color: randomColor,
        width: templateShape[0].length,
        height: templateShape.length
      };
      
      setBlockPool(newPool);
      setGeneratedShapesLog(prev => [...prev, JSON.stringify(templateShape)]);
      triggerWarning('블록이 변경되었습니다!');
    } else {
      triggerWarning('아이템 사용에 실패했습니다.');
    }
    
    setShowShapeSelectorModal(false);
    setSelectedPoolBlockIdxToChange(null);
    setUsingItem(null);
  };

  // 남은 채워야 할 격자 칸 개수 구하기
  const getRemainingTargetCellsCount = () => {
    if (!targetPattern || targetPattern.length === 0) return 0;
    let count = 0;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (targetPattern[r]?.[c] && !grid[r]?.[c]) {
          count++;
        }
      }
    }
    return count;
  };

  // 남은 블록 개수 (현재 풀에 있는 유효 블록 수 + 대기 큐의 블록 수)
  const getRemainingBlocksTotalCount = () => {
    const poolCount = blockPool.filter(b => b !== null).length;
    const queueCount = geminiBlockQueue.length;
    return poolCount + queueCount;
  };

  // 배치 가능 체크
  const canPlaceBlock = (blockShape: number[][], startRow: number, startCol: number): boolean => {
    const bh = blockShape.length;
    const bw = blockShape[0].length;

    for (let r = 0; r < bh; r++) {
      for (let c = 0; c < bw; c++) {
        if (blockShape[r][c] === 1) {
          const targetRow = startRow + r;
          const targetCol = startCol + c;

          if (targetRow < 0 || targetRow >= gridSize || targetCol < 0 || targetCol >= gridSize) {
            return false;
          }

          if (grid[targetRow][targetCol] !== null) {
            return false;
          }

          // 목표 패턴 영역이 아닌 곳에는 배치 불가능하게 차단
          if (targetPattern && targetPattern.length > 0) {
            if (!targetPattern[targetRow]?.[targetCol]) {
              return false;
            }
          }
        }
      }
    }
    return true;
  };

  // 블록 배치
  const placeBlock = (blockIdx: number, startRow: number, startCol: number) => {
    const block = blockPool[blockIdx];
    if (!block) return;

    if (!canPlaceBlock(block.shape, startRow, startCol)) {
      triggerWarning('이 위치에는 블록을 놓을 수 없습니다!');
      return;
    }

    // 뒤로가기를 위한 현재 상태 기록 (깊은 복사)
    setHistory(prev => [
      ...prev,
      {
        grid: grid.map(row => [...row]),
        blockPool: blockPool.map(b => b ? { ...b, shape: b.shape.map(r => [...r]) } : null),
        geminiBlockQueue: geminiBlockQueue.map(b => ({ ...b, shape: b.shape.map(r => [...r]) }))
      }
    ]);

    // 그리드에 색 채우기
    const newGrid = grid.map(row => [...row]);
    const bh = block.shape.length;
    const bw = block.shape[0].length;

    for (let r = 0; r < bh; r++) {
      for (let c = 0; c < bw; c++) {
        if (block.shape[r][c] === 1) {
          newGrid[startRow + r][startCol + c] = block.color;
        }
      }
    }
    setGrid(newGrid);
    clearHint();

    // 사용한 블록을 큐에서 1개 공급받아 채워 넣음
    const newPool = [...blockPool];
    if (isAiMode) {
      if (geminiBlockQueue.length > 0) {
        const nextBlock = geminiBlockQueue[0];
        const nextQueue = geminiBlockQueue.slice(1);
        
        newPool[blockIdx] = {
          id: Math.random().toString(36).substr(2, 9),
          shape: nextBlock.shape,
          color: nextBlock.color,
          width: nextBlock.shape[0].length,
          height: nextBlock.shape.length
        };
        
        setGeminiBlockQueue(nextQueue);
      } else {
        // 더 이상 큐에 블록이 없으면 해당 슬롯은 null 비움
        newPool[blockIdx] = null;
      }
    } else {
      // Fallback 모드: 무한정으로 랜덤 블록을 생성
      newPool[blockIdx] = generateRandomBlock();
    }

    setBlockPool(newPool);

    // 클리어 판정 검사
    checkGameClear(newGrid, newPool);
  };

  // 이전 수 실행 취소 (Undo)
  const undoLastMove = () => {
    if (history.length === 0 || clearedAnimation) return;

    const previousState = history[history.length - 1];
    setGrid(previousState.grid);
    setBlockPool(previousState.blockPool);
    setGeminiBlockQueue(previousState.geminiBlockQueue);

    setHistory(prev => prev.slice(0, -1));
    clearHint();
  };

  // 클리어 검사
  const checkGameClear = (currentGrid: (string | null)[][], currentPool: (Block | null)[]) => {
    if (!targetPattern || targetPattern.length === 0) return;

    // 1. 타겟 형태가 완벽하게 다 채워졌는지 검사
    let isPatternFilled = true;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (targetPattern[r]?.[c] && !currentGrid[r]?.[c]) {
          isPatternFilled = false;
          break;
        }
      }
      if (!isPatternFilled) break;
    }

    if (isAiMode) {
      // AI 모드: 준비된 정답 블록도 모두 소진했는지 검사
      const poolActiveCount = currentPool.filter(b => b !== null).length;
      const isQueueEmpty = geminiBlockQueue.length === 0 && poolActiveCount === 0;

      // 최종 완벽 클리어 조건: 패턴 다 채움 AND 모든 정답 블록 소진
      if (isPatternFilled && isQueueEmpty) {
        handleClear(currentGrid);
      }
    } else {
      // Fallback 모드: 패턴만 다 채워지면 무조건 클리어
      if (isPatternFilled) {
        handleClear(currentGrid);
      }
    }
  };

  // 클리어 처리
  const handleClear = async (finalGrid: (string | null)[][]) => {
    setTimerActive(false);

    let points = 100;
    if (difficulty === '중') points = 250;
    if (difficulty === '상') points = 1000;
    
    setIsNewRecord(false);

    // 1. 점수 및 히스토리 업데이트 (AuthContext 연동)
    await updateUserScore(points, difficulty || '하', time);

    // 점수 업데이트 완료 후 리더보드 즉시 동기화 (레이스 컨디션 방지 및 guest 대응)
    await fetchLeaderboard(userScore + points);

    // 2. 최고 기록 갱신 여부
    const currentDiff = difficulty || '하';
    const currentBest = bestTimes[currentDiff];
    let isNew = false;
    const nextBestTimes = { ...bestTimes };

    if (currentBest === null || time < currentBest) {
      nextBestTimes[currentDiff] = time;
      setBestTimes(nextBestTimes);
      localStorage.setItem('block_puzzle_bestTimes', JSON.stringify(nextBestTimes));
      isNew = true;
    }
    setIsNewRecord(isNew);

    // 3. 목표 영역 황금색으로 반짝이게 칠하기
    const fullyColoredGrid = finalGrid.map((row, rIdx) => 
      row.map((cell, cIdx) => {
        if (targetPattern[rIdx]?.[cIdx]) {
          return cell || 'from-[#FFE082] to-[#FFD54F]';
        }
        return cell;
      })
    );
    setGrid(fullyColoredGrid);

    // 4. 줌인 & 반짝임 애니메이션 2초 작동
    setClearedAnimation(true);

    setTimeout(() => {
      // 폭죽 이모지 파티클 생성
      const emojis = ['🎉', '✨', '🎈', '🎇', '🍰', '🌸', '🍎', '💫'];
      const newParticles = Array(30).fill(null).map((_, i) => ({
        id: i,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        left: `${Math.random() * 90 + 5}%`,
        delay: `${Math.random() * 2}s`,
        duration: `${Math.random() * 1.5 + 2}s`
      }));
      setParticles(newParticles);
      
      setScreen('clear');
    }, 2000);
  };

  // ==========================================
  // 6. Pointer Drag System Handlers
  // ==========================================
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    const block = blockPool[index];
    if (!block) return;

    // Center the block's visual representation exactly on the cursor/pointer
    const offsetX = (block.width * 38) / 2;
    const offsetY = (block.height * 38) / 2;

    setDraggedIdx(index);
    setDragOffset({ x: offsetX, y: offsetY });
    setDragPos({ x: e.clientX, y: e.clientY });
    
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (draggedIdx !== index) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    setDragPos({ x: currentX, y: currentY });

    if (gridRef.current) {
      const gridRect = gridRef.current.getBoundingClientRect();
      
      if (
        currentX >= gridRect.left &&
        currentX <= gridRect.right &&
        currentY >= gridRect.top &&
        currentY <= gridRect.bottom
      ) {
        const cellWidth = gridRect.width / gridSize;
        const cellHeight = gridRect.height / gridSize;

        const relativeX = currentX - dragOffset.x - gridRect.left;
        const relativeY = currentY - dragOffset.y - gridRect.top;

        const col = Math.round(relativeX / cellWidth);
        const row = Math.round(relativeY / cellHeight);

        const block = blockPool[index];
        if (block) {
          if (row >= 0 && row + block.height <= gridSize && col >= 0 && col + block.width <= gridSize) {
            setPreviewCell({ r: row, c: col });
          } else {
            setPreviewCell(null);
          }
        }
      } else {
        setPreviewCell(null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (draggedIdx !== index) return;
    
    e.currentTarget.releasePointerCapture(e.pointerId);

    const finalX = e.clientX;
    const finalY = e.clientY;

    if (gridRef.current) {
      const gridRect = gridRef.current.getBoundingClientRect();

      if (
        finalX >= gridRect.left &&
        finalX <= gridRect.right &&
        finalY >= gridRect.top &&
        finalY <= gridRect.bottom
      ) {
        const cellWidth = gridRect.width / gridSize;
        const cellHeight = gridRect.height / gridSize;

        const relativeX = finalX - dragOffset.x - gridRect.left;
        const relativeY = finalY - dragOffset.y - gridRect.top;

        const col = Math.round(relativeX / cellWidth);
        const row = Math.round(relativeY / cellHeight);

        const block = blockPool[index];
        if (block) {
          if (row >= 0 && row + block.height <= gridSize && col >= 0 && col + block.width <= gridSize) {
            if (canPlaceBlock(block.shape, row, col)) {
              placeBlock(index, row, col);
            } else {
              triggerWarning('블록이 겹치거나 놓을 수 없는 자리입니다!');
            }
          } else {
            triggerWarning('블록이 격자 범위를 벗어났습니다!');
          }
        }
      }
    }

    setDraggedIdx(null);
    setPreviewCell(null);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ==========================================
  // 7. Render Screen Contents
  // ==========================================
  
  // ------------------------------------------
  // HOME SCREEN (BLOCK PUZZLE Main page)
  // ------------------------------------------
  const renderHomeScreen = () => {
    const top3 = [...players].sort((a, b) => b.score - a.score).slice(0, 3);
    
    return (
      <div className="w-full max-w-4xl mx-auto px-4 flex flex-col items-center animate-pop-in">
        
        {/* Responsive Grid layout containing My Record & Center Card */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-4 gap-8 items-start mt-4">
          
          {/* Left panel: My Record Card */}
          <div className="lg:col-span-1 sky-panel p-5 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94-3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              <span className="text-xs text-slate-500 font-extrabold tracking-tight uppercase">My Record</span>
            </div>
            
            <div className="flex flex-col gap-4">
              {/* Section 1: Game Stats */}
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                  <span className="text-xs text-slate-450 font-bold">Best Score</span>
                  <span className="text-sm font-extrabold text-[#1e6068]">{userScore.toLocaleString()} pts</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                  <span className="text-xs text-slate-450 font-bold">Global Rank</span>
                  <span className="text-sm font-black text-slate-700">#{rank}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="h-[1px] bg-slate-100/80" />

              {/* Section 2: My Items */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-450 font-extrabold tracking-wider uppercase">My Items</span>
                
                <div className="flex flex-col gap-2">
                  {/* Gold Item Row */}
                  <div className="group relative flex justify-between items-center bg-amber-50/30 hover:bg-amber-50/60 border border-amber-100/40 hover:border-amber-200/60 px-3 py-2.5 rounded-xl transition-all cursor-help">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🪙</span>
                      <span className="text-xs text-slate-550 font-semibold">Gold</span>
                    </div>
                    <span className="text-xs font-black text-amber-600">{gold.toLocaleString()} Gold</span>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-52 bg-slate-900/95 backdrop-blur-md text-white text-[11px] p-2.5 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center border border-white/10 pointer-events-none scale-95 group-hover:scale-100 leading-normal">
                      <span className="font-bold text-amber-300 block mb-0.5">🪙 골드 (Gold)</span>
                      상점에서 유용한 인게임 아이템들을 구매할 때 사용하는 게임 재화입니다.
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Block Change Item card */}
                    <div className="group relative flex flex-col items-center justify-center bg-slate-50/60 hover:bg-slate-100/80 border border-slate-100/80 hover:border-slate-200 px-2.5 py-3 rounded-xl transition-all cursor-help text-center">
                      <span className="text-lg">🔄</span>
                      <span className="text-[10px] text-slate-400 font-bold mt-1">블럭 변경</span>
                      <span className="text-xs font-black text-slate-700 mt-1">{blockChanges}개</span>

                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-52 bg-slate-900/95 backdrop-blur-md text-white text-[11px] p-2.5 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center border border-white/10 pointer-events-none scale-95 group-hover:scale-100 leading-normal">
                        <span className="font-bold text-[#AECFD4] block mb-0.5">🔄 블럭 변경</span>
                        보유한 블록 중 하나를 선택해 다른 임의의 블록 모양으로 교체할 수 있습니다.
                      </div>
                    </div>

                    {/* Hint Item card */}
                    <div className="group relative flex flex-col items-center justify-center bg-slate-50/60 hover:bg-slate-100/80 border border-slate-100/80 hover:border-slate-200 px-2.5 py-3 rounded-xl transition-all cursor-help text-center">
                      <span className="text-lg">💡</span>
                      <span className="text-[10px] text-slate-400 font-bold mt-1">힌트 아이템</span>
                      <span className="text-xs font-black text-slate-700 mt-1">{hints}개</span>

                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-52 bg-slate-900/95 backdrop-blur-md text-white text-[11px] p-2.5 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center border border-white/10 pointer-events-none scale-95 group-hover:scale-100 leading-normal">
                        <span className="font-bold text-amber-300 block mb-0.5">💡 힌트 아이템</span>
                        블록을 퍼즐판 내 어디에 배치해야 하는지 최적의 위치를 반짝임으로 표시해 줍니다.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {isGuest && (
              <div className="mt-2 text-[10px] text-amber-600 bg-amber-50 border border-amber-100 p-2 rounded-xl text-center leading-4">
                게스트 플레이 중입니다.<br/>
                <button onClick={() => setActiveTab('profile')} className="underline font-bold hover:text-amber-800 cursor-pointer">로그인</button>하여 기록을 영구 저장하세요!
              </div>
            )}
          </div>
          
          {/* Middle panel: Main game card & title */}
          <div className="lg:col-span-2 flex flex-col items-center gap-8 w-full">
            
            {/* Logo and taglines */}
            <div className="text-center flex flex-col gap-2">
              <h1 className="text-4xl font-extrabold tracking-tight text-[#1e3a47]">
                BLOCK-PUZZLE
              </h1>
              <p className="text-sm text-slate-500">Clear the blocks, reveal the picture.</p>
            </div>
            
            {/* TOP 3 Card */}
            <div className="sky-panel w-full rounded-3xl overflow-hidden">
              
              {/* Card Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  🏆 TOP 3 PLAYERS
                </span>
                <span className="text-[10px] font-black text-slate-400 tracking-wider">
                  GLOBAL SEASON 4
                </span>
              </div>
              
              {/* Card List Rows */}
              <div className="flex flex-col">
                {top3.map((player, idx) => {
                  const isGold = idx === 0;
                  const rowBg = isGold ? 'bg-[#F8F3E6]' : 'bg-white';
                  const badgeBg = isGold ? 'bg-[#4a453f] text-white' : 'bg-[#DCECF3] text-[#1e3a47]';
                  const division = getDivisionName(player.score);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between px-6 py-4 border-b border-slate-100/60 ${rowBg} transition-colors`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Rank Badge */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${badgeBg}`}>
                          {idx + 1}
                        </div>
                        {/* Player name & division */}
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800 truncate max-w-[150px]">{player.name}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">{division}</span>
                        </div>
                      </div>
                      
                      {/* Score display */}
                      <div className="text-right flex flex-col">
                        <span className="text-sm font-black text-slate-800">{player.score.toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 font-extrabold tracking-tight">SCORE</span>
                      </div>
                    </div>
                  );
                })}
                {top3.length === 0 && (
                  <div className="py-12 text-center text-sm text-slate-400">등록된 랭커가 없습니다.</div>
                )}
              </div>
              
              {/* View all Rankings footer link */}
              <div className="bg-slate-50/50 py-3 text-center border-t border-slate-100">
                <button 
                  onClick={() => setActiveTab('leaderboard')}
                  className="text-xs font-bold text-[#1e6068] hover:underline cursor-pointer"
                >
                  View All Rankings
                </button>
              </div>
            </div>
            
            {/* Start Game & Shop Buttons */}
            <div className="w-full flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  setSelectedShopItem(null);
                  setShopMessage(null);
                  setShowShopModal(true);
                }}
                className="w-full py-4.5 bg-gradient-to-r from-[#FFF3CD] to-[#FFEAA7] hover:from-[#FFE699] hover:to-[#FFD369] text-[#856404] font-black text-xl rounded-2xl shadow-[0_8px_25px_-4px_rgba(255,243,205,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 border border-[#FFEBAA]"
              >
                <span>🛒</span> 상점 (Shop)
              </button>
              <button
                onClick={() => setShowDiffModal(true)}
                className="w-full py-4.5 bg-[#AECFD4] hover:bg-[#96c4c9] text-[#1e3a47] font-black text-xl rounded-2xl shadow-[0_8px_25px_-4px_rgba(174,207,212,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>▷</span> Start Game
              </button>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                5 energy required to play
              </span>
            </div>
            
          </div>
          
          {/* Right spacer for centering */}
          <div className="hidden lg:block lg:col-span-1" />
          
        </div>
        
      </div>
    );
  };

  // ------------------------------------------
  // PLAYING SCREEN
  // ------------------------------------------
  const renderPlayingScreen = () => {
    if (aiGenerating) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center animate-fade-in-up w-full max-w-md mx-auto">
          <div className="w-12 h-12 border-4 border-[#AECFD4] border-t-transparent rounded-full animate-spin"></div>
          
          <div className="flex flex-col gap-2 w-full">
            <p className="text-base font-extrabold text-[#1e3a47]">Gemini AI가 블록을 조각하는 중...</p>
            <p className="text-xs text-slate-400 max-w-xs leading-5 mx-auto">목표 틀을 완벽하게 채울 수 있는 최적의 블록셋을 생성하고 있습니다.</p>
          </div>

          {/* AI Progress Bar */}
          <div className="w-full bg-slate-105 border border-slate-200/50 p-4 rounded-2xl flex flex-col gap-2 mt-2 sky-panel">
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden relative shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-[#AECFD4] to-[#1e6068] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${aiGeneratingProgress}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase mt-1">
              <span>블록 분석 진행도</span>
              <span>{aiGeneratingProgress}%</span>
            </div>
          </div>
        </div>
      );
    }

    const remainingTargetCells = getRemainingTargetCellsCount();
    const remainingBlocksTotal = getRemainingBlocksTotalCount();
    const shapeIcon = targetShapeName === '사과' ? '🍎' : targetShapeName === '꽃' ? '🌸' : '🍰';
    const shapeDisplayName = targetShapeName === '사과' ? 'Apple Orchard' : targetShapeName === '꽃' ? 'Floral Garden' : 'Sweet Dessert';

    let targetCellCount = 0;
    targetPattern.forEach(row => {
      row.forEach(val => {
        if (val) targetCellCount++;
      });
    });

    return (
      <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-4 animate-pop-in select-none">
        
        {/* Top Objective Bar containing name, preview, and remaining */}
        <div className="w-full sky-panel rounded-2xl px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Thematic preview grid instead of static emoji */}
            <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100/60 shrink-0">
              <div 
                className="grid gap-[1px]"
                style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
              >
                {targetPattern.map((row, r) => 
                  row.map((val, c) => (
                    <div 
                      key={`${r}-${c}`}
                      className={`w-[6px] h-[6px] rounded-[1px] transition-colors ${
                        val 
                          ? 'bg-[#FED650] shadow-sm' 
                          : 'bg-slate-200/50'
                      }`}
                    />
                  ))
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Target Objective</span>
              <span className="text-sm font-extrabold text-[#1e3a47] flex items-center gap-1.5">
                <span>{shapeIcon}</span> {shapeDisplayName}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 뒤로가기 (Undo) 버튼 */}
            <button
              onClick={undoLastMove}
              disabled={history.length === 0 || clearedAnimation}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 font-bold text-xs select-none ${
                history.length === 0 || clearedAnimation
                  ? 'bg-slate-100 text-slate-300 border border-slate-200/30 cursor-not-allowed'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-200 cursor-pointer shadow-sm active:scale-95'
              }`}
              title="이전 수 실행 취소"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              뒤로가기
            </button>

            <div className="text-right flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Remaining</span>
              <span className="text-base font-black text-rose-500 animate-pulse bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-100/40">
                {remainingTargetCells} / {targetCellCount}
              </span>
            </div>
          </div>
        </div>

        {/* Hint Banner message */}
        {(hintSelectMode || hintTimer !== null) && (
          <div className="w-full bg-amber-50 border border-amber-200 text-[#7a5c00] text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-between shadow-sm animate-pop-in mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-sm animate-bounce">💡</span>
              <span>
                {hintSelectMode 
                  ? '힌트를 받을 블록을 아래에서 선택하세요.' 
                  : `힌트 표시 중... ${hintTimer}초`}
              </span>
            </div>
            {hintTimer !== null && (
              <span className="font-extrabold px-2 py-0.5 bg-amber-200/60 rounded text-[10px]">
                {hintTimer}s
              </span>
            )}
          </div>
        )}

        {/* Main Grid */}
        <div 
          ref={gridRef}
          className={`relative p-3 bg-white rounded-3xl border border-slate-100 shadow-xl transition-all duration-500 overflow-hidden ${
            clearedAnimation ? 'animate-pulse-gold scale-105 z-10' : ''
          }`}
        >
          {clearedAnimation && <div className="absolute inset-0 bg-shine pointer-events-none z-10" />}

          <div 
            className="grid gap-1.5"
            style={{ 
              gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
              width: gridSize === 5 ? '280px' : gridSize === 7 ? '310px' : '340px',
              height: gridSize === 5 ? '280px' : gridSize === 7 ? '310px' : '340px'
            }}
          >
            {grid.map((row, rIdx) => 
              row.map((cellColor, cIdx) => {
                const isTarget = targetPattern[rIdx]?.[cIdx];
                const hasColor = cellColor !== null;
                
                let isPreviewActive = false;
                let previewColor = '';
                if (previewCell && draggedIdx !== null) {
                  const block = blockPool[draggedIdx];
                  if (block) {
                    const pr = rIdx - previewCell.r;
                    const pc = cIdx - previewCell.c;
                    if (pr >= 0 && pr < block.shape.length && pc >= 0 && pc < block.shape[0].length) {
                      if (block.shape[pr][pc] === 1) {
                        isPreviewActive = true;
                        previewColor = block.color;
                      }
                    }
                  }
                }

                let isHintActive = hintHighlightCells.some(cell => cell.r === rIdx && cell.c === cIdx);

                // Grid cell class configurations
                let cellClasses = 'relative rounded-lg aspect-square flex items-center justify-center transition-all bg-white ';
                if (hasColor) {
                  cellClasses += `bg-gradient-to-br ${cellColor} shadow-sm border border-white/40`;
                } else if (isPreviewActive) {
                  cellClasses += `bg-gradient-to-br ${previewColor} opacity-50 scale-95 border border-white/20`;
                } else if (isHintActive) {
                  cellClasses += hintFadeOut ? 'hint-fade-out ' : 'hint-highlight-cell ';
                } else if (isTarget) {
                  cellClasses += 'border border-slate-200 shadow-inner dot-marker';
                } else {
                  cellClasses += 'border border-slate-100/80 dot-marker';
                }

                return (
                  <div 
                    key={`${rIdx}-${cIdx}`}
                    className={cellClasses}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Warning notification */}
        {warningMessage && (
          <div className="fixed bottom-24 bg-rose-50 border border-rose-100 text-rose-600 font-extrabold text-xs px-5 py-3 rounded-xl shadow-lg animate-bounce z-50 flex items-center gap-1.5">
            <span>⚠️</span> {warningMessage}
          </div>
        )}

        {/* Drag pieces panel */}
        <div className="w-full sky-panel p-3.5 rounded-3xl flex flex-col gap-2">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
            </svg>
            Drag pieces to the grid
          </div>
          
          <div className="flex justify-around items-center gap-4 mt-1">
            {blockPool.map((block, idx) => {
              if (!block) {
                return (
                  <div 
                    key={`empty-${idx}`}
                    className="flex items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 border-dashed"
                    style={{ width: '80px', height: '80px' }}
                  >
                    <span className="text-[10px] text-slate-300 font-bold tracking-wider uppercase">Empty</span>
                  </div>
                );
              }

              const isDragged = draggedIdx === idx;

              const isSelectedForHint = selectedHintBlockIdx === idx;
              const isBlockChangeMode = usingItem === 'blockchange';
              const pulseClass = hintSelectMode 
                ? 'animate-hint-pulse border-2 border-amber-400 bg-amber-50/50 cursor-pointer scale-102 shadow-md' 
                : isBlockChangeMode
                ? 'animate-hint-pulse border-2 border-rose-400 bg-rose-50/50 cursor-pointer scale-102 shadow-md'
                : '';
              const outlineStyle = isSelectedForHint ? { outline: '2px solid #FFD700', outlineOffset: '2px' } : {};

              return (
                <div 
                  key={block.id}
                  onPointerDown={(e) => {
                    if (usingItem || hintSelectMode) return;
                    handlePointerDown(e, idx);
                  }}
                  onPointerMove={(e) => {
                    if (usingItem || hintSelectMode) return;
                    handlePointerMove(e, idx);
                  }}
                  onPointerUp={(e) => {
                    if (usingItem || hintSelectMode) return;
                    handlePointerUp(e, idx);
                  }}
                  onClick={() => {
                    if (hintSelectMode) {
                      handleBlockPoolSlotClickForHint(idx);
                    } else if (usingItem === 'blockchange') {
                      handleBlockPoolSlotClick(idx);
                    }
                  }}
                  className={`touch-none relative flex items-center justify-center p-2 rounded-2xl transition-all ${
                    pulseClass || (isDragged ? 'opacity-20 bg-slate-150/40' : 'bg-slate-50 hover:bg-slate-100/80 border border-slate-200/60 shadow-sm cursor-grab active:cursor-grabbing')
                  }`}
                  style={{ width: '85px', height: '85px', ...outlineStyle }}
                >
                  {/* "선택하세요" overlay for hint selection */}
                  {hintSelectMode && (
                    <div className="absolute inset-0 bg-amber-400/10 rounded-2xl flex items-center justify-center z-20">
                      <span className="text-[9px] font-black text-amber-600 bg-white px-1.5 py-0.5 rounded-md shadow-sm uppercase animate-pulse">선택하세요</span>
                    </div>
                  )}
                  {isBlockChangeMode && (
                    <div className="absolute inset-0 bg-rose-400/10 rounded-2xl flex items-center justify-center z-20">
                      <span className="text-[9px] font-black text-rose-600 bg-white px-1.5 py-0.5 rounded-md shadow-sm uppercase animate-pulse">선택하세요</span>
                    </div>
                  )}
                  <div 
                    className="grid gap-[2px]"
                    style={{ gridTemplateColumns: `repeat(${block.shape[0].length}, minmax(0, 1fr))` }}
                  >
                    {block.shape.map((row, r) => 
                      row.map((cell, c) => (
                        <div 
                          key={`${r}-${c}`}
                          className={`w-3.5 h-3.5 rounded-[3px] ${
                            cell === 1 
                              ? `bg-gradient-to-br ${block.color} border border-white/20 shadow-sm` 
                              : 'bg-transparent'
                          }`}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Item usage slots container */}
        <div className="w-full sky-panel p-3 rounded-3xl flex justify-between items-center gap-4">
          {/* Block change item */}
          <div className="group relative flex-1 bg-slate-50 border border-slate-200/50 p-3 rounded-2xl flex items-center justify-between transition-all">
            <div className="flex items-center gap-2 cursor-help">
              <span className="text-xl">🔄</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700">블럭 변경</span>
                <span className="text-[10px] text-slate-400 font-semibold">보유: {blockChanges}개</span>
              </div>
            </div>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2.5 w-56 bg-slate-900/95 backdrop-blur-md text-white text-[11px] p-2.5 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center border border-white/10 pointer-events-none scale-95 group-hover:scale-100 leading-normal font-medium">
              <span className="font-bold text-[#AECFD4] block mb-0.5">🔄 블럭 변경 아이템</span>
              원하지 않는 모양의 블록을 선택해 다른 임의의 템플릿 블록으로 변경하여 퍼즐을 쉽게 풀 수 있습니다.
            </div>

            <button
              onClick={triggerBlockChangeUsage}
              disabled={aiGenerating || clearedAnimation}
              className={`px-3 py-1.5 font-black text-xs rounded-xl shadow-sm cursor-pointer transition-all ${
                usingItem === 'blockchange'
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                  : 'bg-[#AECFD4] hover:bg-[#96c4c9] text-[#1e3a47] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed'
              }`}
            >
              {usingItem === 'blockchange' ? '취소' : '사용'}
            </button>
          </div>

          {/* Hint item */}
          <div className="group relative flex-1 bg-slate-50 border border-slate-200/50 p-3 rounded-2xl flex items-center justify-between transition-all">
            <div className="flex items-center gap-2 cursor-help">
              <span className="text-xl">💡</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700">힌트 아이템</span>
                <span className="text-[10px] text-slate-400 font-semibold">보유: {hints}개</span>
              </div>
            </div>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2.5 w-56 bg-slate-900/95 backdrop-blur-md text-white text-[11px] p-2.5 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center border border-white/10 pointer-events-none scale-95 group-hover:scale-100 leading-normal font-medium">
              <span className="font-bold text-amber-300 block mb-0.5">💡 힌트 아이템</span>
              선택한 블록을 배치할 수 있는 올바른 그리드 영역을 반짝임 표시로 일정 시간 동안 알려줍니다.
            </div>

            <button
              onClick={triggerHintUsage}
              disabled={aiGenerating || clearedAnimation}
              className={`px-3 py-1.5 font-black text-xs rounded-xl shadow-sm cursor-pointer transition-all ${
                usingItem === 'hint'
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                  : 'bg-[#AECFD4] hover:bg-[#96c4c9] text-[#1e3a47] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed'
              }`}
            >
              {usingItem === 'hint' ? '취소' : '사용'}
            </button>
          </div>
        </div>

        {/* Control actions footer */}
        <div className="w-full flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
            <span className="text-slate-400 text-[10px] font-bold uppercase">⏱️ Time</span>
            <span className="text-slate-700 font-extrabold text-xs tabular-nums">
              {formatTime(time)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={restartGame}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200 flex items-center gap-1"
            >
              <span>↻</span> Restart
            </button>
            <button
              onClick={quitGame}
              className="px-4 py-2 bg-[#b31e13] hover:bg-[#991a10] text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
            >
              <span>🚪</span> Quit
            </button>
          </div>
        </div>

      </div>
    );
  };

  // ------------------------------------------
  // CLEAR SCREEN
  // ------------------------------------------
  const renderClearScreen = () => {
    const acquired = difficulty === '하' ? 100 : difficulty === '중' ? 250 : 1000;

    return (
      <div className="w-full max-w-md mx-auto py-6 flex flex-col items-center select-none relative overflow-hidden animate-pop-in">
        
        {/* Confetti particles */}
        {particles.map(p => (
          <div
            key={p.id}
            className="confetti"
            style={{
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration
            }}
          >
            {p.emoji}
          </div>
        ))}

        <div className="w-full sky-panel p-8 rounded-3xl flex flex-col items-center gap-6 text-center z-10 relative">
          
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl animate-bounce">🏆</span>
            <h1 className="text-3xl font-extrabold text-amber-500 uppercase tracking-tight">
              STAGE CLEAR!
            </h1>
            <p className="text-slate-400 text-xs font-medium">Gemini AI 블록으로 형태를 다 맞췄습니다!</p>
          </div>

          <div className="px-5 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-bold uppercase">현재 등수:</span>
            <span className="text-sm font-black text-slate-700">{rank}위</span>
          </div>

          {/* Completed puzzle mini preview */}
          <div className="w-full bg-slate-50 border border-slate-100 p-4.5 rounded-2xl flex flex-col items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">완성한 퍼즐 그림</span>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/50 shadow-inner">
              <div 
                className="grid gap-[2px]"
                style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
              >
                {grid.map((row, r) => 
                  row.map((cellColor, c) => {
                    const isFilled = cellColor !== null;
                    const thematicColor = isFilled ? getThematicCellColor(targetShapeName, r, c, gridSize) : 'bg-slate-100';
                    return (
                      <div 
                        key={`${r}-${c}`}
                        className={`w-4 h-4 rounded-[2px] ${
                          isFilled 
                            ? `bg-gradient-to-br ${thematicColor} shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-white/20` 
                            : 'bg-slate-100'
                        }`}
                      />
                    );
                  })
                )}
              </div>
            </div>
            <span className="text-xs font-extrabold text-[#1e6068]">
              {targetShapeName === '사과' ? '🍎 완성된 사과' : targetShapeName === '꽃' ? '🌸 완성된 꽃' : '🍰 완성된 케이크'}
            </span>
          </div>

          <div className="w-full py-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center gap-2">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">획득 점수</div>
            <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              이전 점수 <span className="font-extrabold text-slate-700">{userScore - acquired}점</span> 
              <span className="text-slate-400 font-bold">+</span> 
              <span className="font-black text-emerald-500">{acquired}점</span>
            </div>
            
            <div className="h-[1px] w-1/2 bg-slate-200/80 my-2" />

            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">누적 점수</div>
            <div className="text-3xl font-black text-[#1e6068]">
              {animatedScore}점
            </div>
          </div>

          <p className="text-[10.5px] text-slate-500 font-extrabold leading-relaxed max-w-[280px] bg-amber-50/40 border border-amber-100/50 py-2 px-3 rounded-xl">
            💡 점수가 집계되는데 시간이 걸릴 수 있습니다. 만약 메인화면에서 점수가 더해지지 않았다면 새로고침 해주세요!
          </p>

          <div className="w-full flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex flex-col items-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase">클리어 시간</span>
              <span className="text-sm font-extrabold text-slate-700 tabular-nums">{formatTime(time)}</span>
            </div>
            
            {isNewRecord && (
              <div className="bg-[#FED650] text-[#1e3a47] font-black text-[10px] px-3 py-1 rounded-full shadow-sm animate-pulse">
                🔥 신기록!
              </div>
            )}
          </div>

          <div className="w-full flex gap-3 mt-4">
            <button
              onClick={() => { setScreen('home'); setActiveTab('play'); }}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-200"
            >
              홈으로 🏠
            </button>
            <button
              onClick={restartGame}
              className="flex-1 py-3 bg-[#AECFD4] hover:bg-[#96c4c9] text-[#1e3a47] font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              다시 플레이 🔄
            </button>
          </div>

        </div>

      </div>
    );
  };

  // ------------------------------------------
  // LEADERBOARD TAB CONTENT
  // ------------------------------------------
  // ------------------------------------------
  // LEADERBOARD SKELETON & PROFILE SKELETON
  // ------------------------------------------
  const renderLeaderboardSkeleton = () => {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col gap-6 mt-4">
        <div className="text-center flex flex-col gap-1.5 animate-pulse">
          <div className="h-8 w-48 bg-slate-200 rounded-lg mx-auto skeleton-shimmer"></div>
          <div className="h-3 w-64 bg-slate-100 rounded mx-auto skeleton-shimmer mt-1"></div>
        </div>

        <div className="sky-panel rounded-3xl overflow-hidden w-full">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <div className="h-3.5 w-24 bg-slate-200 rounded skeleton-shimmer"></div>
            <div className="h-3.5 w-16 bg-slate-200 rounded skeleton-shimmer"></div>
          </div>

          <div className="flex flex-col">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i} 
                className="flex items-center justify-between px-6 py-4 border-b border-slate-100/60"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 skeleton-shimmer"></div>
                  <div className="flex flex-col gap-1.5">
                    <div className="h-4 w-24 bg-slate-200 rounded skeleton-shimmer"></div>
                    <div className="h-2.5 w-16 bg-slate-100 rounded skeleton-shimmer"></div>
                  </div>
                </div>
                <div className="h-4 w-16 bg-slate-200 rounded skeleton-shimmer"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderProfileSkeleton = () => {
    return (
      <div className="w-full max-w-md mx-auto flex flex-col gap-6 mt-4">
        <div className="text-center flex flex-col gap-1.5 animate-pulse">
          <div className="h-8 w-56 bg-slate-200 rounded-lg mx-auto skeleton-shimmer"></div>
          <div className="h-3 w-40 bg-slate-100 rounded mx-auto skeleton-shimmer mt-1"></div>
        </div>

        <div className="sky-panel p-6 rounded-3xl flex flex-col gap-6 w-full">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
            <div className="w-14 h-14 rounded-full bg-slate-200 skeleton-shimmer"></div>
            <div className="flex flex-col gap-2">
              <div className="h-4.5 w-28 bg-slate-200 rounded skeleton-shimmer"></div>
              <div className="h-3.5 w-16 bg-slate-100 rounded-full skeleton-shimmer"></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col gap-2">
              <div className="h-3 w-16 bg-slate-200 rounded skeleton-shimmer"></div>
              <div className="h-5 w-24 bg-slate-300 rounded skeleton-shimmer"></div>
            </div>
            <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col gap-2">
              <div className="h-3 w-16 bg-slate-200 rounded skeleton-shimmer"></div>
              <div className="h-5 w-12 bg-slate-300 rounded skeleton-shimmer"></div>
            </div>
          </div>

          <div className="h-10 w-full bg-slate-200 rounded-2xl skeleton-shimmer mt-2"></div>
        </div>
      </div>
    );
  };

  // ------------------------------------------
  // LEADERBOARD TAB CONTENT
  // ------------------------------------------
  const renderLeaderboardTab = () => {
    if (leaderboardLoading) return renderLeaderboardSkeleton();

    const sorted = [...players].sort((a, b) => b.score - a.score);
    
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col gap-6 animate-fade-in-up mt-4">
        <div className="text-center flex flex-col gap-1.5">
          <h2 className="text-3xl font-extrabold text-[#1e3a47]">LEADERBOARD</h2>
          <p className="text-xs text-slate-500">실시간 글로벌 플레이어 누적 점수 순위</p>
        </div>

        <div className="sky-panel rounded-3xl overflow-hidden w-full">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>순위 & 플레이어</span>
            <span>누적 점수</span>
          </div>

          <div className="flex flex-col">
            {sorted.map((player, idx) => {
              const isGold = idx === 0;
              const rowBg = isGold ? 'bg-[#F8F3E6]' : 'bg-white';
              const badgeBg = idx === 0 ? 'bg-[#4a453f] text-white' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-[#DCECF3] text-[#1e3a47]' : 'bg-slate-100 text-slate-500';
              const division = getDivisionName(player.score);

              return (
                <div 
                  key={idx} 
                  className={`flex items-center justify-between px-6 py-4 border-b border-slate-100/60 ${rowBg}`}
                >
                  <div className="flex items-center gap-4">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${badgeBg}`}>
                      {idx + 1}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-850">{player.name}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{division}</span>
                    </div>
                  </div>
                  
                  <span className="text-sm font-black text-slate-800">{player.score.toLocaleString()} 점</span>
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">데이터가 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ------------------------------------------
  // PROFILE TAB CONTENT
  // ------------------------------------------
  const renderProfileTab = () => {
    if (loading) return renderProfileSkeleton();

    return (
      <div className="w-full max-w-md mx-auto flex flex-col gap-6 animate-fade-in-up mt-4">
        <div className="text-center flex flex-col gap-1.5">
          <h2 className="text-3xl font-extrabold text-[#1e3a47]">PROFILE & SETTINGS</h2>
          <p className="text-xs text-slate-500">인증 정보 관리 및 게임 통계</p>
        </div>

        <div className="sky-panel p-6 rounded-3xl flex flex-col gap-6 w-full">
          
          {/* User profile detail */}
          <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
            <div className="w-14 h-14 rounded-full border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center text-xl shadow-inner">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[#1e6068] font-bold uppercase">{user?.email?.[0] || 'G'}</span>
              )}
            </div>
            
            <div className="flex flex-col">
              {user ? (
                <>
                  <span className="text-base font-bold text-slate-800">{user.email?.split('@')[0]}</span>
                  <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full w-fit mt-1 font-semibold">인증 회원</span>
                </>
              ) : (
                <>
                  <span className="text-base font-bold text-slate-800">{guestId || '게스트'}</span>
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full w-fit mt-1 font-semibold">게스트 모드</span>
                </>
              )}
            </div>
          </div>

          {/* Statistics summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1 hover:scale-[1.02] hover:shadow-sm transition-all duration-300">
              <span className="text-[10px] text-slate-400 font-bold uppercase">내 누적 점수</span>
              <span className="text-lg font-black text-[#1e6068]">
                <AnimatedCounter value={userScore} enabled={animationsEnabled} /> 점
              </span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1 hover:scale-[1.02] hover:shadow-sm transition-all duration-300">
              <span className="text-[10px] text-slate-400 font-bold uppercase">내 현재 등수</span>
              <span className="text-lg font-black text-slate-700">{rank} 위</span>
            </div>
          </div>

          {/* Rank division progress chart */}
          <RankProgressChart score={userScore} />

          {/* Accessibility Option Settings */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 px-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-[#1e3a47]">화면 애니메이션 효과</span>
              <span className="text-[10px] text-slate-400 font-medium">부드러운 화면 전환 및 확대 효과 활성화</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={animationsEnabled} 
                onChange={(e) => {
                  const val = e.target.checked;
                  setAnimationsEnabled(val);
                  localStorage.setItem('block_puzzle_animationsEnabled', val ? 'true' : 'false');
                }}
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1e6068]"></div>
            </label>
          </div>

          {/* Login / logout action buttons */}
          <div className="w-full mt-2">
            {user ? (
              <button
                onClick={async () => {
                  await signOut();
                  setActiveTab('play');
                  setScreen('home');
                }}
                className="w-full py-3.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-bold text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                로그아웃 (Sign Out) 🔑
              </button>
            ) : (
              <Link
                href="/auth"
                className="w-full py-3.5 bg-[#AECFD4] hover:bg-[#96c4c9] text-[#1e3a47] font-black text-sm rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                구글 계정으로 로그인 🔑
              </Link>
            )}
          </div>

        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (activeTab === 'leaderboard') return renderLeaderboardTab();
    if (activeTab === 'profile') return renderProfileTab();
    
    // Play Tab: render based on current gameplay screen state
    switch (screen) {
      case 'playing':
        return renderPlayingScreen();
      case 'clear':
        return renderClearScreen();
      case 'home':
      default:
        return renderHomeScreen();
    }
  };

  // ------------------------------------------
  // BREADCRUMBS & FOOTER DEFINITIONS
  // ------------------------------------------
  const renderBreadcrumbs = () => {
    const items = [{ label: 'Home 🏠', onClick: () => { setScreen('home'); setActiveTab('play'); } }];

    if (activeTab === 'play') {
      if (screen === 'home') {
        items.push({ label: 'Play', onClick: () => setScreen('home') });
      } else if (screen === 'playing') {
        items.push({ label: 'Play', onClick: () => setScreen('home') });
        items.push({ label: aiGenerating ? 'AI Generating' : 'Playing Game 🎮', onClick: () => {} });
      } else if (screen === 'clear') {
        items.push({ label: 'Play', onClick: () => setScreen('home') });
        items.push({ label: 'Game Clear 🌸', onClick: () => {} });
      }
    } else if (activeTab === 'leaderboard') {
      items.push({ label: 'Rankings 🏆', onClick: () => {} });
    } else if (activeTab === 'profile') {
      items.push({ label: 'Profile & Settings ⚙️', onClick: () => {} });
    }

    return (
      <div className="w-full max-w-4xl mx-auto px-6 py-2.5 flex items-center gap-1.5 text-xs text-slate-400 font-semibold bg-white/40 border-b border-slate-200/20 backdrop-blur-sm shadow-sm transition-all duration-300">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-slate-300">/</span>}
              {isLast ? (
                <span className="text-[#1e3a47] font-extrabold">{item.label}</span>
              ) : (
                <button
                  onClick={item.onClick}
                  className="hover:text-[#1e6068] cursor-pointer transition-colors duration-200 font-bold"
                >
                  {item.label}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderFooter = () => {
    return (
      <footer className="w-full max-w-4xl mx-auto px-6 py-8 border-t border-slate-200/40 text-center text-xs text-slate-400 mt-auto pb-32 flex flex-col items-center gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-bold text-slate-500">제작자: 오예림</p>
          <p className="text-[10px] text-slate-400/80">인천대학교 AI코딩을 활용한 창의적 앱 개발 과제물</p>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-semibold">
          <a
            href="https://www.inu.ac.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-[#1e6068] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 underline underline-offset-4"
          >
            인천대학교 홈페이지
          </a>
          <span className="text-slate-200">|</span>
          <a
            href="https://portal.inu.ac.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-[#1e6068] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 underline underline-offset-4"
          >
            INU 포털
          </a>
        </div>
      </footer>
    );
  };

  // ==========================================
  // 8. Main Render Wrapper
  // ==========================================
  return (
    <ErrorBoundary>
      <div className={`flex flex-col min-h-screen bg-gradient-to-b from-[#f7fafd] to-[#eef3f7] text-[#1e3a47] ${!animationsEnabled ? 'no-animations' : ''}`}>
        
        {/* Top Header Navigation */}
        <header className="w-full max-w-4xl mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-200/40">
          <div 
            onClick={() => { setActiveTab('play'); setScreen('home'); }}
            className="text-2xl font-black tracking-tight text-[#1e3a47] cursor-pointer flex items-center gap-1"
          >
            block-puzzle
          </div>
          
          {/* Right side icon links */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('leaderboard')}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'leaderboard' ? 'bg-[#EAE3D2] text-[#1e3a47]' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
              title="리더보드 보기"
            >
              <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
              </svg>
            </button>
            
            <button 
              onClick={() => setActiveTab('profile')}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'profile' ? 'bg-[#EAE3D2] text-[#1e3a47]' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
              title="설정 및 프로필"
            >
              <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Dynamic Breadcrumbs */}
        {renderBreadcrumbs()}

        {/* Main content body */}
        <main className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-4 pt-4">
          {renderContent()}
        </main>

        {/* Premium footer */}
        {renderFooter()}

      {/* Sticky Bottom Tab Bar Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-100 flex items-center justify-around z-40 px-6 shadow-[0_-5px_25px_rgba(30,58,71,0.03)]">
        
        {/* PLAY TAB */}
        <button 
          onClick={() => { setActiveTab('play'); }}
          className="flex flex-col items-center gap-1 cursor-pointer w-24 py-1.5 rounded-2xl transition-all"
        >
          <div className={`flex flex-col items-center gap-0.5 px-5 py-1 rounded-xl transition-all ${
            activeTab === 'play' ? 'bg-[#EAE3D2] text-[#1e3a47] font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}>
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
            <span className="text-[10px] uppercase tracking-wide">Play</span>
          </div>
        </button>

        {/* LEADERBOARD TAB */}
        <button 
          onClick={() => { setActiveTab('leaderboard'); }}
          className="flex flex-col items-center gap-1 cursor-pointer w-24 py-1.5 rounded-2xl transition-all"
        >
          <div className={`flex flex-col items-center gap-0.5 px-5 py-1 rounded-xl transition-all ${
            activeTab === 'leaderboard' ? 'bg-[#EAE3D2] text-[#1e3a47] font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}>
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-2.25a1.125 1.125 0 00-1.125 1.125v3.375m9-6.375c.621 0 1.125-.504 1.125-1.125V8.25a1.125 1.125 0 00-1.125-1.125h-2.25m-6.75 6.375a1.125 1.125 0 01-1.125-1.125V8.25a1.125 1.125 0 011.125-1.125h2.25m-2.25 0a3 3 0 00-3-3h10.5a3 3 0 00-3 3m-9 0h12" />
            </svg>
            <span className="text-[10px] uppercase tracking-wide">Rankings</span>
          </div>
        </button>

        {/* PROFILE TAB */}
        <button 
          onClick={() => { setActiveTab('profile'); }}
          className="flex flex-col items-center gap-1 cursor-pointer w-24 py-1.5 rounded-2xl transition-all"
        >
          <div className={`flex flex-col items-center gap-0.5 px-5 py-1 rounded-xl transition-all ${
            activeTab === 'profile' ? 'bg-[#EAE3D2] text-[#1e3a47] font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}>
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span className="text-[10px] uppercase tracking-wide">Profile</span>
          </div>
        </button>

      </nav>

      {/* Difficulty select popup modal (Light Theme style) */}
      {showDiffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-sm mx-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl animate-pop-in">
            <button 
              onClick={() => setShowDiffModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              ✕
            </button>

            <h2 className="text-xl font-extrabold text-center text-[#1e3a47] mb-6">
              난이도를 선택하세요
            </h2>

            <div className="flex flex-col gap-4">
              <button
                onClick={() => startGame('하')}
                className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200/60 hover:border-emerald-300 rounded-2xl transition-all group cursor-pointer text-center"
              >
                <span className="text-emerald-600 font-black text-base group-hover:scale-102 transition-transform">하 (100점)</span>
                <span className="text-[11px] text-slate-400 mt-1">5x5 그리드 • 아기자기한 기본 난이도</span>
                <span className="text-[11px] text-[#1e6068] font-bold mt-1">
                  최고 기록: {bestTimes['하'] ? formatTime(bestTimes['하']!) : '기록 없음'}
                </span>
              </button>

              <button
                onClick={() => startGame('중')}
                className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-amber-50 border border-slate-200/60 hover:border-amber-300 rounded-2xl transition-all group cursor-pointer text-center"
              >
                <span className="text-amber-600 font-black text-base group-hover:scale-102 transition-transform">중 (250점)</span>
                <span className="text-[11px] text-slate-400 mt-1">7x7 그리드 • 집중이 필요한 중급 퍼즐</span>
                <span className="text-[11px] text-[#1e6068] font-bold mt-1">
                  최고 기록: {bestTimes['중'] ? formatTime(bestTimes['중']!) : '기록 없음'}
                </span>
              </button>

              <button
                onClick={() => startGame('상')}
                className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-rose-50 border border-slate-200/60 hover:border-rose-300 rounded-2xl transition-all group cursor-pointer text-center"
              >
                <span className="text-rose-600 font-black text-base group-hover:scale-102 transition-transform">상 (1000점)</span>
                <span className="text-[10px] text-rose-500 font-extrabold mt-0.5">가장 복잡한 퍼즐에 도전하세요!</span>
                <span className="text-[11px] text-slate-400 mt-1">10x10 그리드 • 극한의 두뇌 회전 고난도</span>
                <span className="text-[11px] text-[#1e6068] font-bold mt-1">
                  최고 기록: {bestTimes['상'] ? formatTime(bestTimes['상']!) : '기록 없음'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shop popup modal (Light Theme style) */}
      {showShopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-md mx-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl animate-pop-in flex flex-col gap-5 max-h-[85vh] overflow-y-auto">
            {/* Close Button */}
            <button 
              onClick={() => {
                setShowShopModal(false);
                setSelectedShopItem(null);
                setShopMessage(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              ✕
            </button>

            {/* Title (중앙 상단에 "상점") */}
            <h2 className="text-2xl font-black text-center text-[#1e3a47] border-b border-slate-100 pb-3 mt-2">
              상점
            </h2>

            {/* Gold Balance Display inside Shop */}
            <div className="flex items-center justify-between bg-amber-50 border border-amber-100 px-4 py-2.5 rounded-2xl">
              <span className="text-xs text-amber-800 font-bold flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                </svg>
                내 보유 골드:
              </span>
              <span className="text-sm font-black text-amber-600">{gold.toLocaleString()} Gold</span>
            </div>

            {/* Chapters / Tabs (첫 번째: Gold, 두 번째: Cash) */}
            <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
              <button
                onClick={() => {
                  setShopTab('gold');
                  setSelectedShopItem(null);
                  setShopMessage(null);
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                  shopTab === 'gold' 
                    ? 'bg-white text-[#1e3a47] shadow-sm font-black' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Gold
              </button>
              <button
                onClick={() => {
                  setShopTab('cash');
                  setSelectedShopItem(null);
                  setShopMessage(null);
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                  shopTab === 'cash' 
                    ? 'bg-white text-[#1e3a47] shadow-sm font-black' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Cash
              </button>
            </div>

            {/* Tab/Chapter Content */}
            <div className="flex-1 flex flex-col gap-4">
              {shopTab === 'gold' ? (
                /* Gold Chapter: Time Sale (Limit 1), Block Change, Hint */
                <div className="flex flex-col gap-3">
                  {/* Time Sale Item Card */}
                  <button
                    onClick={() => {
                      if (hasBoughtTimeSale) {
                        setShopMessage({ text: '이미 타임 세일 상품을 구매하셨습니다! (구매 제한: 1개)', success: false });
                        return;
                      }
                      setSelectedShopItem({
                        id: 'timesale',
                        name: 'Time Sale (블럭 변경)',
                        description: '아이템 사용 후 3개의 블럭 중 하나를 선택하여 원하는 블록으로 변경합니다.',
                        priceText: '100 Gold',
                        originalPriceText: '200 Gold',
                        icon: '⚡',
                        badge: '할인 • 1회 한정'
                      });
                      setShopMessage(null);
                    }}
                    disabled={hasBoughtTimeSale}
                    className={`flex items-center justify-between p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                      hasBoughtTimeSale 
                        ? 'opacity-60 bg-slate-100 border-slate-200/80 cursor-not-allowed'
                        : selectedShopItem?.id === 'timesale'
                          ? 'bg-[#FFF9E6] border-amber-400 shadow-sm scale-101'
                          : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shadow-inner">
                        <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-800">Time Sale</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${hasBoughtTimeSale ? 'bg-slate-400 text-white' : 'bg-rose-500 text-white'}`}>
                            {hasBoughtTimeSale ? '1/1' : '0/1'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">블럭 변경 아이템 할인</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col">
                      <span className="text-xs text-slate-400 line-through">200 Gold</span>
                      <span className="text-sm font-black text-rose-500">100 Gold</span>
                    </div>
                  </button>

                  {/* Standard Block Change Item Card */}
                  <button
                    onClick={() => {
                      setSelectedShopItem({
                        id: 'blockchange',
                        name: '블럭 변경 아이템',
                        description: '아이템 사용 후 3개의 블럭 중 하나를 선택하여 원하는 블록으로 변경합니다.',
                        priceText: '200 Gold',
                        icon: '🔄'
                      });
                      setShopMessage(null);
                    }}
                    className={`flex items-center justify-between p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                      selectedShopItem?.id === 'blockchange'
                        ? 'bg-[#FFF9E6] border-amber-400 shadow-sm scale-101'
                        : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shadow-inner">
                        <svg className="w-5 h-5 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">블럭 변경 아이템</span>
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">원하지 않는 블럭 교체</span>
                      </div>
                    </div>
                    <span className="text-sm font-black text-slate-700">200 Gold</span>
                  </button>

                  {/* Hint Item Card */}
                  <button
                    onClick={() => {
                      setSelectedShopItem({
                        id: 'hint',
                        name: '힌트 아이템',
                        description: '아이템 사용 후 3개의 블럭 중 하나를 선택하면 놓아야 하는 위치를 표시합니다.',
                        priceText: '100 Gold',
                        icon: '💡'
                      });
                      setShopMessage(null);
                    }}
                    className={`flex items-center justify-between p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                      selectedShopItem?.id === 'hint'
                        ? 'bg-[#FFF9E6] border-amber-400 shadow-sm scale-101'
                        : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50/80 flex items-center justify-center shadow-inner">
                        <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2h-12a2 2 0 002 2zm4-19c-3.866 0-7 3.134-7 7 0 2.277 1.087 4.3 2.775 5.588.61.465.975 1.196.975 1.967v1.445h6.5v-1.445c0-.77.366-1.502.975-1.967A6.978 6.978 0 0019 9c0-3.866-3.134-7-7-7z" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">힌트 아이템</span>
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">배치 힌트 정보 확인</span>
                      </div>
                    </div>
                    <span className="text-sm font-black text-slate-700">100 Gold</span>
                  </button>
                </div>
              ) : (
                /* Cash Chapter: Arranged in 2 rows. Row 1: Item Set, Row 2: Gold packages */
                <div className="flex flex-col gap-3">
                  {/* Row 1: Item Set (아이템 세트) */}
                  <button
                    onClick={() => {
                      if (hasBoughtItemSet) {
                        setShopMessage({ text: '이미 아이템 세트 상품을 구매하셨습니다! (구매 제한: 1개)', success: false });
                        return;
                      }
                      setSelectedShopItem({
                        id: 'itemset',
                        name: '아이템 세트',
                        description: '힌트 아이템 20개와 블럭 변경 아이템 20개를 획득합니다.',
                        priceText: '4,900원',
                        icon: '🎁'
                      });
                      setShopMessage(null);
                    }}
                    disabled={hasBoughtItemSet}
                    className={`w-full p-4 rounded-2xl text-left border transition-all cursor-pointer flex items-center justify-between ${
                      hasBoughtItemSet
                        ? 'opacity-60 bg-slate-100 border-slate-200/80 cursor-not-allowed'
                        : selectedShopItem?.id === 'itemset'
                          ? 'bg-[#FFF9E6] border-amber-400 shadow-sm scale-101'
                          : 'bg-gradient-to-r from-violet-50 to-indigo-50 hover:from-violet-100 hover:to-indigo-100 border-indigo-150/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center shadow-inner">
                        <svg className="w-5.5 h-5.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-[#1e3a47]">아이템 세트</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${hasBoughtItemSet ? 'bg-slate-400 text-white' : 'bg-indigo-600 text-white bg-indigo-600'}`}>
                            {hasBoughtItemSet ? '1/1' : '0/1'}
                          </span>
                        </div>
                        <span className="text-[10px] text-indigo-500 font-semibold mt-0.5">힌트 20개 + 블록 변경 20개</span>
                      </div>
                    </div>
                    <span className="text-base font-black text-indigo-600">4,900원</span>
                  </button>

                  {/* Row 2: 2 Column rectangular cards for Gold 10000 and Gold 5000 */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Gold 10000개 */}
                    <button
                      onClick={() => {
                        setSelectedShopItem({
                          id: 'gold10000',
                          name: 'Gold 10000개',
                          description: '10000 gold 획득합니다.',
                          priceText: '10,000원',
                          icon: '🪙'
                        });
                        setShopMessage(null);
                      }}
                      className={`p-4 rounded-2xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                        selectedShopItem?.id === 'gold10000'
                          ? 'bg-[#FFF9E6] border-amber-400 shadow-sm scale-101'
                          : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200/60'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shadow-inner">
                        <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" />
                          <circle cx="12" cy="12" r="5" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-800">Gold 10000개</span>
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">대용량 패키지</span>
                      </div>
                      <span className="text-xs font-black text-slate-700 bg-slate-200/40 px-2.5 py-1 rounded-lg mt-1">10,000원</span>
                    </button>

                    {/* Gold 5000개 */}
                    <button
                      onClick={() => {
                        setSelectedShopItem({
                          id: 'gold5000',
                          name: 'Gold 5000개',
                          description: '5000 gold 획득합니다.',
                          priceText: '5,000원',
                          icon: '🪙'
                        });
                        setShopMessage(null);
                      }}
                      className={`p-4 rounded-2xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                        selectedShopItem?.id === 'gold5000'
                          ? 'bg-[#FFF9E6] border-amber-400 shadow-sm scale-101'
                          : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200/60'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shadow-inner">
                        <svg className="w-5 h-5 text-amber-555 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" />
                          <circle cx="12" cy="12" r="5" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-800">Gold 5000개</span>
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">실속형 패키지</span>
                      </div>
                      <span className="text-xs font-black text-slate-700 bg-slate-200/40 px-2.5 py-1 rounded-lg mt-1">5,000원</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Description & Purchase panel */}
            {selectedShopItem ? (
              <div className="bg-slate-50 border border-slate-100 p-4.5 rounded-2xl flex flex-col gap-3.5 animate-pop-in">
                <div className="flex items-center gap-2">
                  <span className="text-lg flex-shrink-0">
                    {selectedShopItem.id === 'timesale' ? (
                      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                      </svg>
                    ) : selectedShopItem.id === 'blockchange' ? (
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    ) : selectedShopItem.id === 'hint' ? (
                      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2h-12a2 2 0 002 2zm4-19c-3.866 0-7 3.134-7 7 0 2.277 1.087 4.3 2.775 5.588.61.465.975 1.196.975 1.967v1.445h6.5v-1.445c0-.77.366-1.502.975-1.967A6.978 6.978 0 0019 9c0-3.866-3.134-7-7-7z" />
                      </svg>
                    ) : selectedShopItem.id === 'itemset' ? (
                      <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <circle cx="12" cy="12" r="5" />
                      </svg>
                    )}
                  </span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">상품 설명</span>
                </div>
                
                {/* Description texts */}
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-sm font-black text-slate-800">{selectedShopItem.name}</h4>
                  <p className="text-xs text-slate-550 font-medium leading-5">
                    {selectedShopItem.description}
                  </p>
                </div>

                {/* Purchase Button */}
                <button
                  onClick={async () => {
                    if (selectedShopItem) {
                      const isCashItem = ['itemset', 'gold10000', 'gold5000'].includes(selectedShopItem.id);
                      if (isCashItem) {
                        setPayerName(user?.email ? user.email.split('@')[0] : '');
                        setPayerEmail(user?.email || '');
                        setPayerNameError('');
                        setPayerEmailError('');
                        setShowBillingModal(true);
                      } else {
                        const res = await purchaseItem(selectedShopItem.id as any);
                        setShopMessage({ text: res.message, success: res.success });
                      }
                    }
                  }}
                  className="w-full py-3 bg-[#AECFD4] hover:bg-[#96c4c9] text-[#1e3a47] font-black text-sm rounded-xl shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-1"
                >
                  {selectedShopItem.priceText}에 구매하기
                </button>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400 font-semibold">
                상점에서 구매할 상품을 선택해주세요.
              </div>
            )}

            {/* Feedback Messages inside Shop */}
            {shopMessage && (
              <div className={`p-3.5 rounded-xl text-center text-xs font-semibold animate-pop-in ${
                shopMessage.success 
                  ? 'bg-emerald-50 border border-emerald-100 text-emerald-600' 
                  : 'bg-rose-50 border border-rose-100 text-rose-600'
              }`}>
                {shopMessage.success ? '🎉' : '⚠️'} {shopMessage.text}
              </div>
            )}

            {/* Modal Bottom Actions */}
            <button
              onClick={() => {
                setShowShopModal(false);
                setSelectedShopItem(null);
                setShopMessage(null);
              }}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
            >
              상점 닫기
            </button>
          </div>
        </div>
      )}

      {/* Toss Payments Payer Info Modal */}
      {showBillingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pop-in">
          <div className="relative w-full max-w-sm mx-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-center">
            {/* Close */}
            <button 
              onClick={() => setShowBillingModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-655 text-lg font-bold cursor-pointer w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              ✕
            </button>

            <h3 className="text-lg font-extrabold text-[#1e3a47] mt-2">결제자 정보 입력</h3>
            <p className="text-[11px] text-slate-400 -mt-2">결제를 진행하기 위해 아래 정보를 입력해 주세요.</p>

            <div className="flex flex-col gap-3 text-left mt-2">
              {/* Name field */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-450 font-bold uppercase">이름</label>
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-400 focus:bg-white transition-all text-[#1e3a47]"
                />
                {payerNameError && (
                  <span className="text-[9px] text-rose-500 font-semibold pl-1">⚠️ {payerNameError}</span>
                )}
              </div>

              {/* Email field */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-450 font-bold uppercase">이메일</label>
                <input
                  type="email"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-400 focus:bg-white transition-all text-[#1e3a47]"
                />
                {payerEmailError && (
                  <span className="text-[9px] text-rose-500 font-semibold pl-1">⚠️ {payerEmailError}</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowBillingModal(false)}
                disabled={payerLoading}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors border border-slate-200 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleTossPayment}
                disabled={payerLoading}
                className="flex-1 py-3 bg-[#AECFD4] hover:bg-[#96c4c9] text-[#1e3a47] font-black text-xs rounded-xl shadow-sm cursor-pointer transition-all flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {payerLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#1e3a47] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  '결제하기'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Shape selector modal */}
      {showShapeSelectorModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-pop-in">
          <div className="relative w-full max-w-sm mx-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-center">
            <button 
              onClick={() => {
                setShowShapeSelectorModal(false);
                setSelectedPoolBlockIdxToChange(null);
                setUsingItem(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-655 text-lg font-bold cursor-pointer w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              ✕
            </button>

            <h3 className="text-lg font-extrabold text-[#1e3a47] mt-2">변경할 블록 모양 선택</h3>
            <p className="text-[11px] text-slate-400 -mt-2">교체할 원하는 모양을 선택해 주세요.</p>

            {/* Grid of block template options */}
            <div className="grid grid-cols-3 gap-3.5 my-2 max-h-[40vh] overflow-y-auto p-1">
              {[
                { name: '1x1 Square', shape: [[1]] },
                { name: '2x1 Horiz', shape: [[1, 1]] },
                { name: '1x2 Vert', shape: [[1], [1]] },
                { name: '3x1 Horiz', shape: [[1, 1, 1]] },
                { name: '1x3 Vert', shape: [[1], [1], [1]] },
                { name: '2x2 Block', shape: [[1, 1], [1, 1]] },
                { name: 'L Shape', shape: [[1, 0], [1, 1]] },
                { name: 'T Shape', shape: [[0, 1, 0], [1, 1, 1]] }
              ].map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectBlockShape(tmpl.shape)}
                  className="p-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-350 rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
                >
                  <div 
                    className="grid gap-[2px]"
                    style={{ gridTemplateColumns: `repeat(${tmpl.shape[0].length}, minmax(0, 1fr))` }}
                  >
                    {tmpl.shape.map((row, r) => 
                      row.map((val, c) => (
                        <div 
                          key={`${r}-${c}`}
                          className={`w-2 h-2 rounded-[2px] ${
                            val === 1 
                              ? 'bg-amber-500 border border-white/20' 
                              : 'bg-transparent'
                          }`}
                        />
                      ))
                    )}
                  </div>
                  <span className="text-[9px] text-slate-455 font-bold tracking-tight">{tmpl.name}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setShowShapeSelectorModal(false);
                setSelectedPoolBlockIdxToChange(null);
                setUsingItem(null);
              }}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Guest migration modal (Light Theme style) */}
      {pendingMigrationScore !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-sm mx-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl animate-pop-in text-center flex flex-col gap-4">
            <span className="text-4xl animate-bounce">⚡</span>
            <h3 className="text-lg font-extrabold text-[#1e3a47]">게스트 점수 이전 알림</h3>
            <p className="text-xs text-slate-500 leading-5">
              인증 로그인 이전에 게스트 모드로 플레이하여 누적된 점수{' '}
              <span className="font-extrabold text-[#1e6068]">{pendingMigrationScore}점</span> 및 골드/아이템 정보가 감지되었습니다. 
              이 기록을 현재 로그인한 계정으로 이전하여 합산하시겠습니까?
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={async () => {
                  await migrateGuestScore(false);
                  await fetchLeaderboard();
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors border border-slate-200"
              >
                아니오 (삭제)
              </button>
              <button
                onClick={async () => {
                  await migrateGuestScore(true);
                  await fetchLeaderboard();
                }}
                className="flex-1 py-3 bg-[#AECFD4] hover:bg-[#96c4c9] text-[#1e3a47] font-black text-xs rounded-xl shadow-sm cursor-pointer transition-all"
              >
                예 (합산 이전)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drag overlay rendering (Rendered at top-level container to avoid coordinate offsets from parent CSS transforms) */}
      {draggedIdx !== null && blockPool[draggedIdx] && (
        <div 
          className="fixed pointer-events-none z-50 drop-shadow-lg"
          style={{
            left: `${dragPos.x - dragOffset.x}px`,
            top: `${dragPos.y - dragOffset.y}px`,
            width: `${blockPool[draggedIdx]!.width * 38}px`,
            height: `${blockPool[draggedIdx]!.height * 38}px`
          }}
        >
          <div 
            className="grid gap-1 scale-[1.05]"
            style={{
              gridTemplateColumns: `repeat(${blockPool[draggedIdx]!.shape[0].length}, minmax(0, 1fr))`
            }}
          >
            {blockPool[draggedIdx]!.shape.map((row, r) => 
              row.map((cell, c) => (
                <div 
                  key={`${r}-${c}`}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    cell === 1 
                      ? `bg-gradient-to-br ${blockPool[draggedIdx]!.color} border border-white/30 shadow-md opacity-90` 
                      : 'bg-transparent'
                  }`}
                />
              ))
            )}
          </div>
        </div>
      )}

      </div>
    </ErrorBoundary>
  );
}
