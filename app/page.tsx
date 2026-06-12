'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';

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
  { name: '빛나는퍼즐왕', score: 2500 },
  { name: '블록마스터', score: 1800 },
  { name: '도전가', score: 1000 }
];

export default function BlockPuzzleGame() {
  // ==========================================
  // 2. States & Auth Context
  // ==========================================
  const { 
    user, 
    guestId, 
    isGuest, 
    userScore, 
    signOut, 
    updateUserScore, 
    pendingMigrationScore, 
    migrateGuestScore 
  } = useAuth();

  const [screen, setScreen] = useState<ScreenType>('home');
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyType | null>(null);
  const [gridSize, setGridSize] = useState<number>(5);
  
  // 게임 판 정보: null 이면 빈 칸, string 이면 채워진 블록의 색상
  const [grid, setGrid] = useState<(string | null)[][]>([]);
  const [targetShapeName, setTargetShapeName] = useState<'사과' | '꽃' | '케이크' | ''>('');
  const [targetPattern, setTargetPattern] = useState<boolean[][]>([]);
  
  // Gemini 블록 큐 및 현재 활성화된 3개 블록 풀
  const [geminiBlockQueue, setGeminiBlockQueue] = useState<Omit<Block, 'id' | 'width' | 'height'>[]>([]);
  const [blockPool, setBlockPool] = useState<(Block | null)[]>([]);
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);
  
  // 랭킹 & 최고 기록 (로컬 저장소 백업용)
  const [players, setPlayers] = useState<Player[]>([]);
  const [bestTimes, setBestTimes] = useState<Record<string, number | null>>({ '하': null, '중': null, '상': null });
  const [rank, setRank] = useState<number>(1);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  
  // 타이머 및 경고 알림
  const [time, setTime] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [warningTimeout, setWarningTimeout] = useState<NodeJS.Timeout | null>(null);

  // 클리어 연출
  const [clearedAnimation, setClearedAnimation] = useState<boolean>(false);
  const [particles, setParticles] = useState<{ id: number; emoji: string; left: string; delay: string; duration: string }[]>([]);

  // 드래그앤드롭 상태
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [previewCell, setPreviewCell] = useState<{ r: number; c: number } | null>(null);

  // UI 헤더 프로필 팝오버 상태
  const [showProfilePopover, setShowProfilePopover] = useState(false);

  // DOM Refs
  const gridRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ==========================================
  // 3. Initial Load & Storage Sync
  // ==========================================
  useEffect(() => {
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
    const myName = user ? (user.email?.split('@')[0] || '나(Me)') : (guestId || 'guest');
    
    // 내 등수 산출: 나보다 높은 사람의 수 + 1
    const currentRank = sorted.filter(p => p.score > userScore).length + 1;
    setRank(currentRank);
  }, [userScore, players, user, guestId]);

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

    // 그림 랜덤 선택
    const shapes: ('사과' | '꽃' | '케이크')[] = ['사과', '꽃', '케이크'];
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    setTargetShapeName(randomShape);
    const pattern = PATTERNS[diff][randomShape];
    setTargetPattern(pattern);

    // 모달을 닫고 AI 생성 모드 진입
    setShowDiffModal(false);
    setAiGenerating(true);
    setScreen('playing');

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

      // 2. 받아온 블록 리스트를 큐에 보관
      setGeminiBlockQueue(generated);

      // 3. 큐에서 최초 3개 블록을 꺼내 풀(Pool) 구성
      const initialPool: (Block | null)[] = [];
      const blocksToTake = generated.slice(0, 3);
      const remainingQueue = generated.slice(3);

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

      setBlockPool(initialPool);
      setGeminiBlockQueue(remainingQueue);

    } catch (err) {
      console.error('Gemini 블록 구성 에러:', err);
      triggerWarning('AI 블록 생성에 실패하여 로컬 기본 블록으로 시작합니다.');
      
      // Fallback: Gemini 실패 시 기본 블록 템플릿 무한 모드로 세팅
      const fallbackTemplates = [
        { shape: [[1]], color: 'from-pink-500 to-rose-500' },
        { shape: [[1, 1]], color: 'from-amber-400 to-orange-500' },
        { shape: [[1], [1]], color: 'from-orange-400 to-red-500' },
        { shape: [[1, 1, 1]], color: 'from-emerald-400 to-teal-500' },
        { shape: [[1], [1], [1]], color: 'from-teal-400 to-cyan-500' },
        { shape: [[1, 1], [1, 1]], color: 'from-blue-500 to-indigo-600' }
      ];

      const initialPool = Array(3).fill(null).map(() => {
        const t = fallbackTemplates[Math.floor(Math.random() * fallbackTemplates.length)];
        return {
          id: Math.random().toString(36).substr(2, 9),
          shape: t.shape,
          color: t.color,
          width: t.shape[0].length,
          height: t.shape.length
        };
      });
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

    // 사용한 블록을 큐에서 1개 공급받아 채워 넣음
    const newPool = [...blockPool];
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

    setBlockPool(newPool);

    // 클리어 판정 검사
    checkGameClear(newGrid, newPool);
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

    // 2. 준비된 정답 블록도 모두 소진했는지 검사
    const poolActiveCount = currentPool.filter(b => b !== null).length;
    const isQueueEmpty = geminiBlockQueue.length === 0 && poolActiveCount === 0;

    // 만약 정답 블록 큐가 다 떨어졌는데(0개) 격자판을 덜 채웠다면, 더 이상 놓을 수 없는 상태
    if (geminiBlockQueue.length === 0 && poolActiveCount > 0 && !isPatternFilled) {
      // 큐는 0개이고 풀만 남았는데, 남은 풀의 블록들을 다 써야만 완성이 되도록 유도
    }

    // 최종 완벽 클리어 조건: 패턴 다 채움 AND 모든 정답 블록 소진
    if (isPatternFilled && isQueueEmpty) {
      handleClear(currentGrid);
    }
  };

  // 클리어 처리
  const handleClear = async (finalGrid: (string | null)[][]) => {
    setTimerActive(false);

    let points = 100;
    if (difficulty === '중') points = 250;
    if (difficulty === '상') points = 500;
    
    const prevScore = userScore;
    setIsNewRecord(false);

    // 1. 점수 및 히스토리 업데이트 (AuthContext 연동)
    await updateUserScore(points, difficulty || '하', time);

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
          return cell || 'from-yellow-400 to-amber-500';
        }
        return cell;
      })
    );
    setGrid(fullyColoredGrid);

    // 4. 줌인 & 반짝임 애니메이션 2초 작동
    setClearedAnimation(true);

    setTimeout(() => {
      // 폭죽 이모지 파티클 생성
      const emojis = ['🎉', '✨', '🎈', '🎇', '🍰', '🌸', '🍎', '🎁', '💫'];
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

    const blockEl = e.currentTarget;
    const rect = blockEl.getBoundingClientRect();
    
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDraggedIdx(index);
    setDragOffset({ x: offsetX, y: offsetY });
    setDragPos({ x: e.clientX, y: e.clientY });
    
    blockEl.setPointerCapture(e.pointerId);
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
  // 7. Render Pages
  // ==========================================
  
  // ------------------------------------------
  // HOME SCREEN (With Top Header Profile Link)
  // ------------------------------------------
  const renderHomeScreen = () => {
    const top3 = [...players].sort((a, b) => b.score - a.score).slice(0, 3);
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-10 px-4 animate-pop-in relative">
        
        {/* 상단 헤더 프로필 영역 */}
        <div className="absolute top-6 right-6 z-30">
          {user ? (
            <div 
              className="relative"
              onMouseEnter={() => setShowProfilePopover(true)}
              onMouseLeave={() => setShowProfilePopover(false)}
            >
              {/* 사용자 프로필 사진 (Google Avatar) */}
              <button className="w-10 h-10 rounded-full border border-white/20 overflow-hidden cursor-pointer shadow-lg hover:border-indigo-400 transition-all flex items-center justify-center bg-zinc-800">
                {user.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="avatar" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <span className="text-zinc-200 font-bold uppercase">{user.email?.[0]}</span>
                )}
              </button>
              
              {/* 호버 팝오버 Sign out */}
              {showProfilePopover && (
                <div className="absolute right-0 mt-1 w-32 bg-zinc-900 border border-zinc-850 p-2 rounded-xl shadow-xl animate-fade-in text-center flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-zinc-400 truncate max-w-full font-bold">
                    {user.email?.split('@')[0]}
                  </span>
                  <button
                    onClick={() => signOut()}
                    className="w-full py-1.5 text-xs font-extrabold bg-rose-950 hover:bg-rose-900 text-rose-300 rounded-lg cursor-pointer transition-colors border border-rose-900/40"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            // 비로그인 상태 (게스트) 로그인 링크
            <Link 
              href="/auth"
              className="px-4 py-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-900 text-indigo-300 hover:text-indigo-100 text-xs font-extrabold rounded-xl transition-all shadow-md"
            >
              로그인 🔑
            </Link>
          )}
        </div>

        {/* 내 기록 정보 */}
        <div className="absolute top-6 left-6 flex flex-col gap-1 p-3 rounded-xl glass-panel shadow-lg border border-white/10">
          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <span>나의 기록</span>
            {isGuest ? (
              <span className="bg-zinc-800 text-[9px] text-zinc-400 px-1.5 py-0.5 rounded-full border border-zinc-700 font-normal">게스트</span>
            ) : (
              <span className="bg-indigo-950 text-[9px] text-indigo-300 px-1.5 py-0.5 rounded-full border border-indigo-900/50 font-semibold">인증됨</span>
            )}
          </div>
          <div className="text-sm text-zinc-200">
            내 점수: <span className="font-extrabold text-indigo-400">{userScore}점</span>
          </div>
          <div className="text-sm text-zinc-200">
            내 등수: <span className="font-extrabold text-amber-400">{rank}위</span>
          </div>
        </div>

        {/* 랭킹 판 */}
        <div className="w-full max-w-md flex flex-col items-center gap-8 bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 shadow-2xl backdrop-blur-md">
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent drop-shadow-sm">
              BLOCK PUZZLE
            </h1>
            <p className="text-xs text-zinc-400 mt-2 font-medium">Gemini AI가 제공하는 정답 블록으로 형태를 다 맞춰보세요!</p>
          </div>

          {/* TOP 3 플레이어 */}
          <div className="w-full">
            <h2 className="text-lg font-bold text-center text-zinc-100 mb-4 flex items-center justify-center gap-2">
              🏆 TOP 3 플레이어
            </h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-zinc-800/50 text-xs text-zinc-400 font-semibold border-b border-zinc-800">
                    <th className="py-2.5 px-4">순위</th>
                    <th className="py-2.5 px-4">이름</th>
                    <th className="py-2.5 px-4">누적 점수</th>
                  </tr>
                </thead>
                <tbody>
                  {top3.map((player, idx) => {
                    const rankMedal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                    const rankColor = idx === 0 ? 'text-yellow-400 font-bold' : idx === 1 ? 'text-zinc-300' : 'text-amber-600';
                    return (
                      <tr key={idx} className="border-b border-zinc-900/50 text-sm text-zinc-300 hover:bg-zinc-800/20 transition-colors">
                        <td className={`py-3 px-4 ${rankColor}`}>{rankMedal} {idx + 1}</td>
                        <td className="py-3 px-4 font-medium truncate max-w-[120px]">{player.name}</td>
                        <td className="py-3 px-4 font-bold text-indigo-300">{player.score}점</td>
                      </tr>
                    );
                  })}
                  {top3.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-6 text-sm text-zinc-500">등록된 플레이어가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={() => setShowDiffModal(true)}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-extrabold text-xl rounded-2xl shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer"
          >
            게임 시작 🕹️
          </button>
        </div>

        {/* 난이도 선택 모달 */}
        {showDiffModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
            <div className="relative w-full max-w-sm mx-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl animate-pop-in">
              <button 
                onClick={() => setShowDiffModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white text-xl font-bold cursor-pointer w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                ✕
              </button>

              <h2 className="text-2xl font-black text-center text-zinc-100 mb-6 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                난이도를 선택하세요
              </h2>

              <div className="flex flex-col gap-4">
                <button
                  onClick={() => startGame('하')}
                  className="flex flex-col items-center justify-center p-4 bg-zinc-800/40 hover:bg-emerald-950/20 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl transition-all group cursor-pointer text-center"
                >
                  <span className="text-emerald-400 font-extrabold text-lg group-hover:scale-105 transition-transform">하 (100점)</span>
                  <span className="text-xs text-zinc-400 mt-1">5x5 그리드 • 아기자기한 기본 난이도</span>
                  <span className="text-[11px] text-indigo-400 font-semibold mt-1">
                    최고 기록: {bestTimes['하'] ? formatTime(bestTimes['하']!) : '기록 없음'}
                  </span>
                </button>

                <button
                  onClick={() => startGame('중')}
                  className="flex flex-col items-center justify-center p-4 bg-zinc-800/40 hover:bg-amber-950/20 border border-zinc-800 hover:border-amber-500/50 rounded-2xl transition-all group cursor-pointer text-center"
                >
                  <span className="text-amber-400 font-extrabold text-lg group-hover:scale-105 transition-transform">중 (250점)</span>
                  <span className="text-xs text-zinc-400 mt-1">7x7 그리드 • 집중이 필요한 중급 퍼즐</span>
                  <span className="text-[11px] text-indigo-400 font-semibold mt-1">
                    최고 기록: {bestTimes['중'] ? formatTime(bestTimes['중']!) : '기록 없음'}
                  </span>
                </button>

                <button
                  onClick={() => startGame('상')}
                  className="flex flex-col items-center justify-center p-4 bg-zinc-800/40 hover:bg-rose-950/20 border border-zinc-800 hover:border-rose-500/50 rounded-2xl transition-all group cursor-pointer text-center"
                >
                  <span className="text-rose-400 font-extrabold text-lg group-hover:scale-105 transition-transform">상 (500점)</span>
                  <span className="text-xs text-zinc-400 mt-1">10x10 그리드 • 극한의 두뇌 회전 고난도</span>
                  <span className="text-[11px] text-indigo-400 font-semibold mt-1">
                    최고 기록: {bestTimes['상'] ? formatTime(bestTimes['상']!) : '기록 없음'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 게스트 스코어 마이그레이션 팝업 모달 */}
        {pendingMigrationScore !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="relative w-full max-w-sm mx-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl animate-pop-in text-center flex flex-col gap-5">
              <span className="text-4xl animate-bounce">⚡</span>
              <h3 className="text-xl font-black text-indigo-400">게스트 점수 이전 알림</h3>
              <p className="text-sm text-zinc-300 leading-6">
                인증 로그인 이전에 게스트 모드로 플레이하여 누적된 점수{' '}
                <span className="font-extrabold text-indigo-300">{pendingMigrationScore}점</span>이 감지되었습니다. 
                이 점수를 현재 가입된 계정으로 이전하시겠습니까?
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => migrateGuestScore(false)}
                  className="flex-1 py-3 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold text-xs rounded-xl cursor-pointer transition-colors border border-zinc-800"
                >
                  아니오 (삭제)
                </button>
                <button
                  onClick={() => migrateGuestScore(true)}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  예 (합산 이전)
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  };

  // ------------------------------------------
  // PLAYING SCREEN
  // ------------------------------------------
  const renderPlayingScreen = () => {
    // 1. AI 블록 설계 중 로딩 뷰
    if (aiGenerating) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-center flex flex-col gap-1">
            <p className="text-base font-black text-indigo-400">Gemini AI가 블록을 조각하는 중...</p>
            <p className="text-xs text-zinc-500">목표 틀을 완전히 채울 수 있는 최적의 정답 블록 세트를 생성하고 있습니다.</p>
          </div>
        </div>
      );
    }

    const remainingTargetCells = getRemainingTargetCellsCount();
    const remainingBlocksTotal = getRemainingBlocksTotalCount();

    return (
      <div className="flex flex-col items-center justify-between min-h-screen py-6 px-4 select-none relative overflow-hidden">
        
        {/* 상단바 */}
        <div className="w-full max-w-lg flex items-center justify-between bg-zinc-900/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-zinc-800 shadow-lg mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">목표 그림</span>
            <span className="text-base font-black text-indigo-400 flex items-center gap-1.5">
              {targetShapeName === '사과' ? '🍎' : targetShapeName === '꽃' ? '🌸' : '🍰'} {targetShapeName}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">남은 채울 칸 / 남은 정답 블록</span>
            <span className="text-sm font-black text-rose-400 animate-pulse mt-0.5">
              빈 칸: {remainingTargetCells}개 • 남은 블록: {remainingBlocksTotal}개
            </span>
          </div>
        </div>

        {/* 격자판 & 가이드 */}
        <div className="flex flex-col items-center justify-center flex-1 my-2">
          
          <div className="mb-4 flex flex-col items-center bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800 shadow-inner">
            <span className="text-[10px] text-zinc-400 font-semibold mb-1">완성해야 할 목표 형태 가이드</span>
            <div 
              className="grid gap-[2px]"
              style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
            >
              {targetPattern.map((row, r) => 
                row.map((val, c) => (
                  <div 
                    key={`${r}-${c}`}
                    className={`w-3 h-3 rounded-[2px] transition-colors ${
                      val 
                        ? (targetShapeName === '사과' ? 'bg-red-500/80' : targetShapeName === '꽃' ? 'bg-pink-400/80' : 'bg-yellow-400/80') 
                        : 'bg-zinc-850'
                    }`}
                  />
                ))
              )}
            </div>
          </div>

          <div 
            ref={gridRef}
            className={`relative p-3 bg-zinc-950 rounded-3xl border border-zinc-800 shadow-2xl transition-all duration-500 overflow-hidden ${
              clearedAnimation ? 'animate-pulse-gold scale-105 z-10' : ''
            }`}
          >
            {clearedAnimation && <div className="absolute inset-0 bg-shine pointer-events-none z-10" />}

            <div 
              className="grid gap-1.5"
              style={{ 
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                width: gridSize === 5 ? '320px' : gridSize === 7 ? '350px' : '380px',
                height: gridSize === 5 ? '320px' : gridSize === 7 ? '350px' : '380px'
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

                  return (
                    <div 
                      key={`${rIdx}-${cIdx}`}
                      className={`relative rounded-lg aspect-square flex items-center justify-center transition-all ${
                        hasColor 
                          ? `bg-gradient-to-br ${cellColor} shadow-inner shadow-black/20 border border-white/10` 
                          : isPreviewActive
                            ? `bg-gradient-to-br ${previewColor} opacity-50 scale-95 border-2 border-white/30`
                            : isTarget
                              ? 'bg-zinc-850 hover:bg-zinc-800/80 border border-zinc-700/50 cursor-pointer shadow-inner'
                              : 'bg-zinc-900 border border-zinc-950 cursor-pointer'
                      }`}
                    >
                      {isTarget && !hasColor && !isPreviewActive && (
                        <div className="absolute w-1.5 h-1.5 rounded-full bg-zinc-600/50" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 경고 알림 */}
        {warningMessage && (
          <div className="absolute bottom-40 bg-red-500/95 text-white font-extrabold text-xs px-5 py-2.5 rounded-full shadow-lg border border-red-400/30 animate-bounce z-40 backdrop-blur-sm">
            ⚠️ {warningMessage}
          </div>
        )}

        {/* 제시되는 블록 (3개 풀) */}
        <div className="w-full max-w-lg bg-zinc-900/50 border border-zinc-800 p-4 rounded-3xl shadow-inner mb-6">
          <div className="text-center text-[10px] text-zinc-400 font-bold mb-3 uppercase tracking-wider">
            👉 블록을 클릭한 상태로 격자판에 드래그 앤 드롭 하세요! (마지막에 남은 블록이 0개여야 완료됩니다)
          </div>
          <div className="flex justify-around items-center gap-4">
            {blockPool.map((block, idx) => {
              if (!block) {
                return (
                  <div 
                    key={`empty-${idx}`}
                    className="flex items-center justify-center p-3 rounded-2xl bg-zinc-950/20 border border-zinc-900/50 border-dashed"
                    style={{ width: '100px', height: '100px' }}
                  >
                    <span className="text-[10px] text-zinc-600 font-extrabold uppercase">소진됨</span>
                  </div>
                );
              }

              const isDragged = draggedIdx === idx;

              return (
                <div 
                  key={block.id}
                  onPointerDown={(e) => handlePointerDown(e, idx)}
                  onPointerMove={(e) => handlePointerMove(e, idx)}
                  onPointerUp={(e) => handlePointerUp(e, idx)}
                  className={`touch-none flex items-center justify-center p-3 rounded-2xl transition-all cursor-grab active:cursor-grabbing ${
                    isDragged ? 'opacity-30 bg-zinc-800/30' : 'bg-zinc-950/80 hover:bg-zinc-950 border border-zinc-800 hover:border-zinc-700/60 shadow-lg'
                  }`}
                  style={{
                    width: '100px',
                    height: '100px',
                  }}
                >
                  <div 
                    className="grid gap-[2px]"
                    style={{
                      gridTemplateColumns: `repeat(${block.shape[0].length}, minmax(0, 1fr))`,
                    }}
                  >
                    {block.shape.map((row, r) => 
                      row.map((cell, c) => (
                        <div 
                          key={`${r}-${c}`}
                          className={`w-4 h-4 rounded-[3px] ${
                            cell === 1 
                              ? `bg-gradient-to-br ${block.color} border border-white/10` 
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

        {/* 드래그 렌더링 */}
        {draggedIdx !== null && blockPool[draggedIdx] && (
          <div 
            className="fixed pointer-events-none z-50 transform -translate-x-[20px] -translate-y-[20px] drop-shadow-2xl"
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
                        ? `bg-gradient-to-br ${blockPool[draggedIdx]!.color} border border-white/20 opacity-90` 
                        : 'bg-transparent'
                    }`}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* 하단바 */}
        <div className="w-full max-w-lg flex items-center justify-between border-t border-zinc-800/80 pt-4">
          <div className="flex items-center gap-2 bg-zinc-900/60 px-4 py-2 rounded-xl border border-zinc-800 shadow-inner">
            <span className="text-zinc-400 text-[10px] font-bold uppercase">⏱️ 플레이 시간</span>
            <span className="text-zinc-200 font-extrabold text-sm tabular-nums">
              {formatTime(time)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={restartGame}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer border border-zinc-750"
            >
              다시하기 🔄
            </button>
            <button
              onClick={quitGame}
              className="px-4 py-2 bg-rose-950 hover:bg-rose-900 text-rose-300 hover:text-rose-100 text-xs font-extrabold rounded-xl transition-all cursor-pointer border border-rose-900/50"
            >
              그만하기 🚪
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
    const [animatedScore, setAnimatedScore] = useState<number>(userScore - (difficulty === '하' ? 100 : difficulty === '중' ? 250 : 500));

    useEffect(() => {
      let start = userScore - (difficulty === '하' ? 100 : difficulty === '중' ? 250 : 500);
      const end = userScore;
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
    }, [userScore, difficulty]);

    const acquired = difficulty === '하' ? 100 : difficulty === '중' ? 250 : 500;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-10 px-4 select-none relative overflow-hidden">
        
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

        <div className="w-full max-w-md bg-zinc-900/70 p-8 rounded-3xl border border-zinc-800 shadow-2xl backdrop-blur-md flex flex-col items-center gap-6 animate-pop-in text-center z-10 relative">
          
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl animate-bounce">🏆</span>
            <h1 className="text-4xl font-black text-yellow-400 uppercase tracking-tight drop-shadow-md">
              STAGE CLEAR!
            </h1>
            <p className="text-zinc-400 text-xs font-semibold">Gemini AI 블록 세트를 활용하여 그림을 완벽히 메웠습니다!</p>
          </div>

          <div className="px-5 py-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl flex items-center gap-1.5">
            <span className="text-xs text-zinc-400 font-bold uppercase">현재 등수 : </span>
            <span className="text-sm font-black text-indigo-300">{rank}위</span>
          </div>

          <div className="w-full py-6 bg-zinc-950/60 rounded-2xl border border-zinc-800 shadow-inner flex flex-col items-center gap-2">
            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">획득 점수</div>
            <div className="text-xs text-zinc-300 font-medium flex items-center gap-1.5">
              이전 점수 <span className="font-extrabold text-zinc-200">{userScore - acquired}점</span> 
              <span className="text-indigo-400 font-black">+</span> 
              <span className="font-black text-emerald-400">{acquired}점</span>
            </div>
            
            <div className="h-[1px] w-1/2 bg-zinc-800/80 my-2" />

            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">누적 점수</div>
            <div className="text-3xl font-black text-white bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 bg-clip-text text-transparent drop-shadow-sm">
              {animatedScore}점
            </div>
          </div>

          <div className="w-full flex justify-between items-center bg-zinc-800/20 p-4 rounded-xl border border-zinc-800/50">
            <div className="flex flex-col items-start">
              <span className="text-[10px] text-zinc-400 font-bold uppercase">클리어 시간</span>
              <span className="text-sm font-extrabold text-zinc-200 tabular-nums">{formatTime(time)}</span>
            </div>
            
            {isNewRecord && (
              <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-zinc-950 font-black text-[10px] px-3 py-1 rounded-full shadow-md animate-pulse">
                🔥 신기록!
              </div>
            )}
          </div>

          <div className="w-full flex gap-3 mt-4">
            <button
              onClick={() => setScreen('home')}
              className="flex-1 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer border border-zinc-750"
            >
              홈으로 🏠
            </button>
            <button
              onClick={restartGame}
              className="flex-1 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-extrabold text-xs rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              다시 플레이 🔄
            </button>
          </div>

        </div>

      </div>
    );
  };

  switch (screen) {
    case 'playing':
      return renderPlayingScreen();
    case 'clear':
      return renderClearScreen();
    case 'home':
    default:
      return renderHomeScreen();
  }
}
