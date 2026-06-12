'use client';

import React, { useState, useEffect, useRef } from 'react';

// ==========================================
// 1. Types & Data Definitions
// ==========================================

interface Player {
  name: string;
  score: number;
}

interface BestTimes {
  '하': number | null;
  '중': number | null;
  '상': number | null;
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

// 블록 템플릿 정의 (5~7가지)
const BLOCK_TEMPLATES: { shape: number[][]; color: string }[] = [
  { shape: [[1]], color: 'from-pink-500 to-rose-500' }, // 1x1
  { shape: [[1, 1]], color: 'from-amber-400 to-orange-500' }, // 2x1 가로
  { shape: [[1], [1]], color: 'from-orange-400 to-red-500' }, // 1x2 세로
  { shape: [[1, 1, 1]], color: 'from-emerald-400 to-teal-500' }, // 3x1 가로
  { shape: [[1], [1], [1]], color: 'from-teal-400 to-cyan-500' }, // 1x3 세로
  { shape: [[1, 1], [1, 1]], color: 'from-blue-500 to-indigo-600' }, // 2x2 사각형
  { shape: [[1, 0], [1, 1]], color: 'from-violet-500 to-purple-600' }, // L자 (3칸)
  { shape: [[0, 1, 0], [1, 1, 1]], color: 'from-fuchsia-500 to-pink-600' } // T자 (4칸)
];

// 디폴트 랭킹 데이터 (로컬 스토리지에 플레이어 데이터가 없을 때 사용)
const DEFAULT_PLAYERS: Player[] = [
  { name: '빛나는퍼즐왕', score: 2500 },
  { name: '블록마스터', score: 1800 },
  { name: '도전가', score: 1000 }
];

export default function BlockPuzzleGame() {
  // ==========================================
  // 2. States
  // ==========================================
  const [screen, setScreen] = useState<ScreenType>('home');
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyType | null>(null);
  const [gridSize, setGridSize] = useState<number>(5);
  
  // 게임 판 정보: null 이면 빈 칸, string 이면 채워진 블록의 색상
  const [grid, setGrid] = useState<(string | null)[][]>([]);
  const [targetShapeName, setTargetShapeName] = useState<'사과' | '꽃' | '케이크' | ''>('');
  const [targetPattern, setTargetPattern] = useState<boolean[][]>([]);
  
  // 3가지 제시되는 블록 풀
  const [blockPool, setBlockPool] = useState<Block[]>([]);
  
  // 점수 및 기록
  const [myScore, setMyScore] = useState<number>(0);
  const [prevScore, setPrevScore] = useState<number>(0);
  const [acquiredScore, setAcquiredScore] = useState<number>(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [bestTimes, setBestTimes] = useState<BestTimes>({ '하': null, '중': null, '상': null });
  const [rank, setRank] = useState<number>(1);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  
  // 타이머
  const [time, setTime] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  
  // 경고 메시지 토스트
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [warningTimeout, setWarningTimeout] = useState<NodeJS.Timeout | null>(null);

  // 클리어 연출용 (줌인 & 반짝임)
  const [clearedAnimation, setClearedAnimation] = useState<boolean>(false);
  
  // 폭죽 파티클 (클리어 화면용)
  const [particles, setParticles] = useState<{ id: number; emoji: string; left: string; delay: string; duration: string }[]>([]);

  // 드래그 상태 관리
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // 미리보기(Preview) 타겟 격자 좌표
  const [previewCell, setPreviewCell] = useState<{ r: number; c: number } | null>(null);

  // DOM Refs
  const gridRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ==========================================
  // 3. Initial Load & LocalStorage Sync
  // ==========================================
  useEffect(() => {
    // 1. 플레이어 점수 로드
    const storedPlayers = localStorage.getItem('block_puzzle_players');
    let loadedPlayers = DEFAULT_PLAYERS;
    if (storedPlayers) {
      try {
        loadedPlayers = JSON.parse(storedPlayers);
      } catch (e) {
        console.error(e);
      }
    } else {
      localStorage.setItem('block_puzzle_players', JSON.stringify(DEFAULT_PLAYERS));
    }
    setPlayers(loadedPlayers);

    // 2. 내 점수 로드
    const storedMyScore = localStorage.getItem('block_puzzle_myScore');
    let loadedMyScore = 0;
    if (storedMyScore) {
      loadedMyScore = parseInt(storedMyScore, 10);
      setMyScore(loadedMyScore);
    } else {
      localStorage.setItem('block_puzzle_myScore', '0');
    }

    // 3. 최고 기록 로드
    const storedBestTimes = localStorage.getItem('block_puzzle_bestTimes');
    if (storedBestTimes) {
      try {
        setBestTimes(JSON.parse(storedBestTimes));
      } catch (e) {
        console.error(e);
      }
    } else {
      const initialBestTimes: BestTimes = { '하': null, '중': null, '상': null };
      localStorage.setItem('block_puzzle_bestTimes', JSON.stringify(initialBestTimes));
    }

    // 내 등수 계산
    const currentRank = loadedPlayers.filter(p => p.score > loadedMyScore).length + 1;
    setRank(currentRank);
  }, []);

  // 내 점수나 플레이어 목록이 변할 때 등수 갱신
  useEffect(() => {
    const currentRank = players.filter(p => p.score > myScore).length + 1;
    setRank(currentRank);
  }, [myScore, players]);

  // ==========================================
  // 4. Timer Handling
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
  // 5. Game Core Logic Functions
  // ==========================================
  
  // 경고 메시지 표시
  const triggerWarning = (msg: string) => {
    if (warningTimeout) clearTimeout(warningTimeout);
    setWarningMessage(msg);
    const to = setTimeout(() => {
      setWarningMessage(null);
    }, 2000);
    setWarningTimeout(to);
  };

  // 랜덤 블록 생성
  const generateRandomBlock = (): Block => {
    const templateIdx = Math.floor(Math.random() * BLOCK_TEMPLATES.length);
    const template = BLOCK_TEMPLATES[templateIdx];
    const shape = template.shape;
    const height = shape.length;
    const width = shape[0].length;
    return {
      id: Math.random().toString(36).substr(2, 9),
      shape,
      color: template.color,
      width,
      height
    };
  };

  // 게임 시작 처리 (난이도 입력)
  const startGame = (diff: DifficultyType) => {
    setDifficulty(diff);
    let size = 5;
    if (diff === '중') size = 7;
    if (diff === '상') size = 10;
    setGridSize(size);

    // 격자 초기화
    const newGrid: (string | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
    setGrid(newGrid);

    // 랜덤으로 그림 하나 선택 (사과, 꽃, 케이크)
    const shapes: ('사과' | '꽃' | '케이크')[] = ['사과', '꽃', '케이크'];
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    setTargetShapeName(randomShape);
    const pattern = PATTERNS[diff][randomShape];
    setTargetPattern(pattern);

    // 3개 블록 풀 생성
    const newPool = [generateRandomBlock(), generateRandomBlock(), generateRandomBlock()];
    setBlockPool(newPool);

    // 변수 초기화
    setTime(0);
    setTimerActive(true);
    setClearedAnimation(false);
    setShowDiffModal(false);
    setScreen('playing');
  };

  // 게임 다시하기 (같은 난이도 재시작)
  const restartGame = () => {
    if (difficulty) {
      startGame(difficulty);
    }
  };

  // 그만하기 (홈 화면으로)
  const quitGame = () => {
    setTimerActive(false);
    setScreen('home');
  };

  // 남은 채워야 할 타겟 칸 개수 계산
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

  // 격자판 위의 특정 셀에 블록이 들어갈 수 있는지 체크
  const canPlaceBlock = (blockShape: number[][], startRow: number, startCol: number): boolean => {
    const bh = blockShape.length;
    const bw = blockShape[0].length;

    for (let r = 0; r < bh; r++) {
      for (let c = 0; c < bw; c++) {
        if (blockShape[r][c] === 1) {
          const targetRow = startRow + r;
          const targetCol = startCol + c;

          // 격자 범위를 벗어나는 경우
          if (targetRow < 0 || targetRow >= gridSize || targetCol < 0 || targetCol >= gridSize) {
            return false;
          }

          // 이미 블록이 채워져 있는 경우
          if (grid[targetRow][targetCol] !== null) {
            return false;
          }
        }
      }
    }
    return true;
  };

  // 블록을 배치하기
  const placeBlock = (blockIdx: number, startRow: number, startCol: number) => {
    const block = blockPool[blockIdx];
    if (!block) return;

    if (!canPlaceBlock(block.shape, startRow, startCol)) {
      triggerWarning('이 위치에는 블록을 놓을 수 없습니다!');
      return;
    }

    // 그리드 업데이트
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

    // 사용한 블록 제거 및 새 블록 자동 생성
    const newPool = [...blockPool];
    newPool[blockIdx] = generateRandomBlock();
    setBlockPool(newPool);

    // 클리어 검사 (배치 완료 후의 격자로 판단)
    checkGameClear(newGrid);
  };

  // 게임 클리어 체크
  const checkGameClear = (currentGrid: (string | null)[][]) => {
    if (!targetPattern || targetPattern.length === 0) return;
    
    let isCleared = true;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        // 목표가 true인 칸에 색이 다 칠해졌는지 검사
        if (targetPattern[r]?.[c] && !currentGrid[r]?.[c]) {
          isCleared = false;
          break;
        }
      }
      if (!isCleared) break;
    }

    if (isCleared) {
      handleClear(currentGrid);
    }
  };

  // 클리어 연출 및 데이터 저장
  const handleClear = (finalGrid: (string | null)[][]) => {
    setTimerActive(false);
    
    // 획득 점수 결정
    let points = 100;
    if (difficulty === '중') points = 250;
    if (difficulty === '상') points = 500;
    setAcquiredScore(points);
    setPrevScore(myScore);

    // 1. 점수 저장 & 업데이트
    const nextScore = myScore + points;
    setMyScore(nextScore);
    localStorage.setItem('block_puzzle_myScore', nextScore.toString());

    // 2. players 랭킹 업데이트 ("나"의 점수 갱신 혹은 추가)
    const storedPlayers = localStorage.getItem('block_puzzle_players');
    let loadedPlayers: Player[] = storedPlayers ? JSON.parse(storedPlayers) : DEFAULT_PLAYERS;
    
    // 내 닉네임을 "나"로 정의해서 랭킹에 업데이트
    const myIndex = loadedPlayers.findIndex(p => p.name === '나(Me)');
    if (myIndex !== -1) {
      loadedPlayers[myIndex].score = nextScore;
    } else {
      loadedPlayers.push({ name: '나(Me)', score: nextScore });
    }
    // 내림차순 정렬
    loadedPlayers.sort((a, b) => b.score - a.score);
    setPlayers(loadedPlayers);
    localStorage.setItem('block_puzzle_players', JSON.stringify(loadedPlayers));

    // 3. 최고 기록 갱신 여부
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

    // 4. 그림의 모든 셀 색칠하기 (클리어 상태 연출)
    const fullyColoredGrid = finalGrid.map((row, rIdx) => 
      row.map((cell, cIdx) => {
        if (targetPattern[rIdx]?.[cIdx]) {
          // 원래 칠해져 있다면 그 색, 아니면 골드빛 그라데이션
          return cell || 'from-yellow-400 to-amber-500';
        }
        return cell;
      })
    );
    setGrid(fullyColoredGrid);

    // 5. 줌인 & 반짝임 애니메이션 활성화 (2초간)
    setClearedAnimation(true);

    // 6. 2초 후 클리어 화면으로 전환
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
  // 6. Drag and Drop Pointer Event Handlers
  // ==========================================
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    const blockEl = e.currentTarget;
    const rect = blockEl.getBoundingClientRect();
    
    // 터치/마우스 다운 지점의 블록 돔 기준 오프셋
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDraggedIdx(index);
    setDragOffset({ x: offsetX, y: offsetY });
    setDragPos({ x: e.clientX, y: e.clientY });
    
    // Pointer capture 획득
    blockEl.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (draggedIdx !== index) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    setDragPos({ x: currentX, y: currentY });

    // 격자판(Grid) 위에 올라와 있는지 실시간 위치 계산
    if (gridRef.current) {
      const gridRect = gridRef.current.getBoundingClientRect();
      
      if (
        currentX >= gridRect.left &&
        currentX <= gridRect.right &&
        currentY >= gridRect.top &&
        currentY <= gridRect.bottom
      ) {
        // 드롭될 예상 격자 셀 계산
        // 드래그 중인 오프셋을 기반으로, 블록의 좌상단(0,0) 영역이 매칭될 격자 셀을 찾음
        // (실제 블록의 시각적 중심을 타겟팅하기 위해 살짝 미세 조정)
        const cellWidth = gridRect.width / gridSize;
        const cellHeight = gridRect.height / gridSize;

        // 드래그하는 포인트에서 오프셋만큼 뺀 값(블록 좌상단)을 기준으로 격자 상 위치 계산
        const relativeX = currentX - dragOffset.x - gridRect.left;
        const relativeY = currentY - dragOffset.y - gridRect.top;

        // 반올림/버림 처리하여 셀 행, 열 계산
        const col = Math.round(relativeX / cellWidth);
        const row = Math.round(relativeY / cellHeight);

        const block = blockPool[index];
        if (block) {
          // 격자 내에 블록이 걸쳐질 수 있는지 확인
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
    
    // Capture 해제
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
            // 배치 가능한지 검사
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

    // 드래그 상태 리셋
    setDraggedIdx(null);
    setPreviewCell(null);
  };

  // ==========================================
  // 7. Visual Render Helper Functions
  // ==========================================
  
  // 포맷팅된 시간 문자열 (MM:SS)
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ==========================================
  // 8. Screen Rendering
  // ==========================================
  
  // ------------------------------------------
  // HOME SCREEN
  // ------------------------------------------
  const renderHomeScreen = () => {
    // 랭킹 상위 3인 추출
    const top3 = [...players].sort((a, b) => b.score - a.score).slice(0, 3);
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-10 px-4 animate-pop-in">
        {/* 내 정보 영역 */}
        <div className="absolute top-6 left-6 flex flex-col gap-1 p-3 rounded-xl glass-panel shadow-lg border border-white/10">
          <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">나의 기록</div>
          <div className="text-sm text-zinc-200">내 점수: <span className="font-extrabold text-indigo-400">{myScore}점</span></div>
          <div className="text-sm text-zinc-200">내 등수: <span className="font-extrabold text-amber-400">{rank}위</span></div>
        </div>

        <div className="w-full max-w-md flex flex-col items-center gap-8 bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 shadow-2xl backdrop-blur-md">
          {/* 타이틀 로고 */}
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent drop-shadow-sm">
              BLOCK PUZZLE
            </h1>
            <p className="text-sm text-zinc-400 mt-2 font-medium">그림 패턴을 완성하는 이색 블록 퍼즐!</p>
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
                        <td className="py-3 px-4 font-medium">{player.name}</td>
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

          {/* 게임 시작 버튼 */}
          <button
            onClick={() => setShowDiffModal(true)}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-extrabold text-xl rounded-2xl shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer"
          >
            게임 시작 🕹️
          </button>
        </div>

        {/* 난이도 선택 모달 */}
        {showDiffModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-sm mx-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl animate-pop-in">
              {/* 닫기 버튼 */}
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
                {/* 하 난이도 */}
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

                {/* 중 난이도 */}
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

                {/* 상 난이도 */}
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
      </div>
    );
  };

  // ------------------------------------------
  // PLAYING SCREEN
  // ------------------------------------------
  const renderPlayingScreen = () => {
    const remainingTargetCells = getRemainingTargetCellsCount();

    return (
      <div className="flex flex-col items-center justify-between min-h-screen py-6 px-4 select-none relative overflow-hidden">
        
        {/* 상단바: 남은 셀(블록) 표시, 목표 명칭 */}
        <div className="w-full max-w-lg flex items-center justify-between bg-zinc-900/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-zinc-800 shadow-lg mb-4">
          <div className="flex flex-col">
            <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">목표 그림</span>
            <span className="text-lg font-black text-indigo-400 flex items-center gap-1.5">
              {targetShapeName === '사과' ? '🍎' : targetShapeName === '꽃' ? '🌸' : '🍰'} {targetShapeName}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">남은 채울 칸</span>
            <span className="text-lg font-black text-rose-400 animate-pulse">
              남은 블록: {remainingTargetCells}개
            </span>
          </div>
        </div>

        {/* 메인 격자판 & 목표 미니맵 가이드 */}
        <div className="flex flex-col items-center justify-center flex-1 my-2">
          
          {/* 가이드 미니맵 */}
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
                    className={`w-3.5 h-3.5 rounded-[2px] transition-colors ${
                      val 
                        ? (targetShapeName === '사과' ? 'bg-red-500/80' : targetShapeName === '꽃' ? 'bg-pink-400/80' : 'bg-yellow-400/80') 
                        : 'bg-zinc-850'
                    }`}
                  />
                ))
              )}
            </div>
          </div>

          {/* 메인 격자판 (Canvas 혹은 Div 기반) */}
          <div 
            ref={gridRef}
            className={`relative p-3 bg-zinc-950 rounded-3xl border border-zinc-800 shadow-2xl transition-all duration-500 overflow-hidden ${
              clearedAnimation ? 'animate-pulse-gold scale-105 z-10' : ''
            }`}
          >
            {/* 반짝임 애니메이션 레이어 (클리어 시 노출) */}
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
                  
                  // 드래그 미리보기 체크 (previewCell 좌표 범위 내에 이 셀이 들어가고, 블록 형상이 1인 경우)
                  let isPreviewActive = false;
                  let previewColor = '';
                  if (previewCell && draggedIdx !== null) {
                    const block = blockPool[draggedIdx];
                    const pr = rIdx - previewCell.r;
                    const pc = cIdx - previewCell.c;
                    if (pr >= 0 && pr < block.shape.length && pc >= 0 && pc < block.shape[0].length) {
                      if (block.shape[pr][pc] === 1) {
                        isPreviewActive = true;
                        previewColor = block.color;
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
                      {/* 목표 영역이지만 아직 칠해지지 않은 곳에는 옅은 아이콘을 띄워 완성 힌트를 줌 */}
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

        {/* 하단 경고 메시지 토스트 */}
        {warningMessage && (
          <div className="absolute bottom-40 bg-red-500/95 text-white font-extrabold text-sm px-5 py-2.5 rounded-full shadow-lg border border-red-400/30 animate-bounce z-40 backdrop-blur-sm">
            ⚠️ {warningMessage}
          </div>
        )}

        {/* 제시되는 3개 블록 풀 */}
        <div className="w-full max-w-lg bg-zinc-900/50 border border-zinc-800 p-4 rounded-3xl shadow-inner mb-6">
          <div className="text-center text-xs text-zinc-400 font-bold mb-3">
            👇 블록을 길게 누른 상태로 그리드판에 드래그하여 배치하세요!
          </div>
          <div className="flex justify-around items-center gap-4">
            {blockPool.map((block, idx) => {
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
                    width: '110px',
                    height: '110px',
                  }}
                >
                  {/* 블록 형상 */}
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
                          className={`w-5 h-5 rounded-[4px] ${
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

        {/* 실시간 드래그 중인 블록 렌더링 */}
        {draggedIdx !== null && (
          <div 
            className="fixed pointer-events-none z-50 transform -translate-x-[25px] -translate-y-[25px] drop-shadow-2xl"
            style={{
              left: `${dragPos.x - dragOffset.x}px`,
              top: `${dragPos.y - dragOffset.y}px`,
              width: `${blockPool[draggedIdx].width * 42}px`,
              height: `${blockPool[draggedIdx].height * 42}px`
            }}
          >
            <div 
              className="grid gap-1 scale-[1.05]"
              style={{
                gridTemplateColumns: `repeat(${blockPool[draggedIdx].shape[0].length}, minmax(0, 1fr))`
              }}
            >
              {blockPool[draggedIdx].shape.map((row, r) => 
                row.map((cell, c) => (
                  <div 
                    key={`${r}-${c}`}
                    className={`w-9 h-9 rounded-lg transition-all ${
                      cell === 1 
                        ? `bg-gradient-to-br ${blockPool[draggedIdx].color} border border-white/20 opacity-90` 
                        : 'bg-transparent'
                    }`}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* 하단 제어바 (타이머 & 그만하기 / 다시하기) */}
        <div className="w-full max-w-lg flex items-center justify-between border-t border-zinc-800/80 pt-4">
          {/* 타이머 */}
          <div className="flex items-center gap-2 bg-zinc-900/60 px-4 py-2 rounded-xl border border-zinc-800 shadow-inner">
            <span className="text-zinc-400 text-xs font-semibold">⏱️ 플레이 시간</span>
            <span className="text-zinc-200 font-extrabold text-sm tabular-nums">
              {formatTime(time)}
            </span>
          </div>

          {/* 제어 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={restartGame}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer border border-zinc-700"
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
    // 획득 점수 증가 애니메이션용 상태
    const [animatedScore, setAnimatedScore] = useState<number>(prevScore);

    useEffect(() => {
      let start = prevScore;
      const end = myScore;
      if (start === end) return;

      const duration = 1000; // 1초
      const stepTime = Math.abs(Math.floor(duration / (end - start)));
      const timer = setInterval(() => {
        start += 1;
        setAnimatedScore(start);
        if (start >= end) {
          clearInterval(timer);
        }
      }, Math.max(stepTime, 20)); // 너무 빠르면 최소 20ms 보정

      return () => clearInterval(timer);
    }, [prevScore, myScore]);

    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-10 px-4 select-none relative overflow-hidden">
        
        {/* 폭죽 애니메이션 파티클 */}
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
          
          {/* 축하 타이틀 */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl animate-bounce">🏆</span>
            <h1 className="text-4xl font-black text-yellow-400 uppercase tracking-tight drop-shadow-md">
              STAGE CLEAR!
            </h1>
            <p className="text-zinc-400 text-sm font-semibold">완성된 그림을 성공적으로 맞췄습니다!</p>
          </div>

          {/* 등수 정보 */}
          <div className="px-5 py-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl">
            <span className="text-sm text-zinc-300 font-semibold">현재 등수 : </span>
            <span className="text-base font-black text-indigo-300">{rank}위</span>
          </div>

          {/* 점수 획득 애니메이션 영역 */}
          <div className="w-full py-6 bg-zinc-950/60 rounded-2xl border border-zinc-800 shadow-inner flex flex-col items-center gap-2">
            <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">획득 점수</div>
            <div className="text-sm text-zinc-300 font-medium flex items-center gap-1.5">
              이전 점수 <span className="font-extrabold text-zinc-200">{prevScore}점</span> 
              <span className="text-indigo-400 font-black">+</span> 
              <span className="font-black text-emerald-400">{acquiredScore}점</span>
            </div>
            
            <div className="h-[1px] w-1/2 bg-zinc-800/80 my-2" />

            <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">누적 점수</div>
            <div className="text-3xl font-black text-white bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 bg-clip-text text-transparent drop-shadow-sm">
              {animatedScore}점
            </div>
          </div>

          {/* 시간 및 기록 정보 */}
          <div className="w-full flex justify-between items-center bg-zinc-800/20 p-4 rounded-xl border border-zinc-800/50">
            <div className="flex flex-col items-start">
              <span className="text-xs text-zinc-400 font-semibold">클리어 시간</span>
              <span className="text-sm font-extrabold text-zinc-200 tabular-nums">{formatTime(time)}</span>
            </div>
            
            {isNewRecord && (
              <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-zinc-950 font-black text-xs px-3.5 py-1.5 rounded-full shadow-md animate-pulse">
                🔥 신기록!
              </div>
            )}
          </div>

          {/* 하단 이동 버튼 */}
          <div className="w-full flex gap-3 mt-4">
            <button
              onClick={() => setScreen('home')}
              className="flex-1 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-extrabold text-sm rounded-xl transition-all cursor-pointer border border-zinc-750"
            >
              홈으로 🏠
            </button>
            <button
              onClick={restartGame}
              className="flex-1 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-extrabold text-sm rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              다시 플레이 🔄
            </button>
          </div>

        </div>

      </div>
    );
  };

  // ==========================================
  // 9. Root Render Controller
  // ==========================================
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
