import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

// 1. Google AI Provider 초기화
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

// Zod 스키마 정의 (컴팩트 스트링 리스트로 최적화)
const ResponseSchema = z.object({
  blocks: z.array(z.string()).describe('List of block shorthand codes and colors, e.g. ["2x2:pink", "1x1:amber"]')
});

// 컴팩트 포맷 파서
function parseCompactBlocks(compactList: string[]): { shape: number[][]; color: string }[] {
  const sizeMap: Record<string, number[][]> = {
    "1x1": [[1]],
    "2x1": [[1, 1]],
    "1x2": [[1], [1]],
    "3x1": [[1, 1, 1]],
    "1x3": [[1], [1], [1]],
    "4x1": [[1, 1, 1, 1]],
    "1x4": [[1], [1], [1], [1]],
    "2x2": [[1, 1], [1, 1]],
    "L3": [[1, 0], [1, 1]],
    "T4": [[0, 1, 0], [1, 1, 1]]
  };

  const colorMap: Record<string, string> = {
    "pink": "from-pink-500 to-rose-500",
    "amber": "from-amber-400 to-orange-500",
    "orange": "from-orange-400 to-red-500",
    "emerald": "from-emerald-400 to-teal-500",
    "teal": "from-teal-400 to-cyan-500",
    "blue": "from-blue-500 to-indigo-600",
    "violet": "from-violet-500 to-purple-600",
    "fuchsia": "from-fuchsia-500 to-pink-600"
  };

  const defaultColors = Object.values(colorMap);

  return compactList.map(str => {
    if (!str || typeof str !== 'string' || !str.includes(':')) {
      return { shape: [[1]], color: defaultColors[0] };
    }
    const parts = str.split(':');
    const code = parts[0];
    const colorKey = parts[1];

    const shape = sizeMap[code] || [[1]];
    const color = colorMap[colorKey] || defaultColors[Math.floor(Math.random() * defaultColors.length)];

    return { shape, color };
  });
}

// 로컬 알고리즘 기반 무작위 그리디 블록 분할기 (즉시 응답용 fallback)
function generateBlocksAlgorithmic(targetPattern: boolean[][]): { shape: number[][]; color: string }[] {
  const R = targetPattern.length;
  const C = targetPattern[0].length;
  const covered = Array(R).fill(null).map(() => Array(C).fill(false));
  const blocks: { shape: number[][]; color: string }[] = [];

  const templates = [
    { name: '2x2', shape: [[1, 1], [1, 1]] },
    { name: 'T4_inv', shape: [[1, 1, 1], [0, 1, 0]] },
    { name: 'T4_right', shape: [[1, 0], [1, 1], [1, 0]] },
    { name: 'L3', shape: [[1, 0], [1, 1]] },
    { name: 'L3_rot1', shape: [[1, 1], [1, 0]] },
    { name: 'L3_rot2', shape: [[1, 1], [0, 1]] },
    { name: '4x1', shape: [[1, 1, 1, 1]] },
    { name: '1x4', shape: [[1], [1], [1], [1]] },
    { name: '3x1', shape: [[1, 1, 1]] },
    { name: '1x3', shape: [[1], [1], [1]] },
    { name: '2x1', shape: [[1, 1]] },
    { name: '1x2', shape: [[1], [1]] }
  ];

  const colors = [
    'from-pink-500 to-rose-500',
    'from-amber-400 to-orange-500',
    'from-orange-400 to-red-500',
    'from-emerald-400 to-teal-500',
    'from-teal-400 to-cyan-500',
    'from-blue-500 to-indigo-600',
    'from-violet-500 to-purple-600',
    'from-fuchsia-500 to-pink-600'
  ];

  const shuffle = (arr: any[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };

  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (targetPattern[r][c] && !covered[r][c]) {
        // 큰 템플릿의 배열을 무작위로 섞어서 매번 다른 블록 세트 분할을 만들어냄
        const localTemplates = [...templates];
        shuffle(localTemplates);
        localTemplates.push({ name: '1x1', shape: [[1]] }); // 항상 1x1을 종단 대비책으로 둠

        for (const t of localTemplates) {
          const tH = t.shape.length;
          const tW = t.shape[0].length;

          if (r + tH > R || c + tW > C) continue;

          let fits = true;
          for (let tr = 0; tr < tH; tr++) {
            for (let tc = 0; tc < tW; tc++) {
              if (t.shape[tr][tc] === 1) {
                const targetRow = r + tr;
                const targetCol = c + tc;
                if (!targetPattern[targetRow][targetCol] || covered[targetRow][targetCol]) {
                  fits = false;
                  break;
                }
              }
            }
            if (!fits) break;
          }

          if (fits) {
            for (let tr = 0; tr < tH; tr++) {
              for (let tc = 0; tc < tW; tc++) {
                if (t.shape[tr][tc] === 1) {
                  covered[r + tr][c + tc] = true;
                }
              }
            }
            blocks.push({
              shape: t.shape,
              color: colors[Math.floor(Math.random() * colors.length)]
            });
            break;
          }
        }
      }
    }
  }

  return blocks;
}

export async function POST(req: Request) {
  try {
    const { difficulty, gridSize, targetShapeName, targetPattern } = await req.json();

    if (!targetPattern || !Array.isArray(targetPattern)) {
      return NextResponse.json({ error: '유효한 targetPattern이 필요합니다.' }, { status: 400 });
    }

    // 채워야 할 타겟 칸(true)의 총 개수 계산
    let targetCellCount = 0;
    for (let r = 0; r < targetPattern.length; r++) {
      for (let c = 0; c < targetPattern[r].length; c++) {
        if (targetPattern[r][c]) {
          targetCellCount++;
        }
      }
    }

    // Gemini API 호출을 위한 프롬프트 구성 (컴팩트 포맷 지정)
    const systemInstruction = 
      `You are a mathematical block puzzle solver.
      The user wants to solve a 2D grid puzzle of size ${gridSize}x${gridSize} for the shape named "${targetShapeName}".
      The total cells that must be filled (represented by 'true' in targetPattern) is exactly ${targetCellCount} cells.

      Your goal is to provide a list of block shapes that:
      1. CAN PERFECTLY PARTITION (FILL) THE ${targetCellCount} CELLS in the target shape without any overlap or gaps.
      2. The sum of all cells in the generated blocks must be EXACTLY EQUAL to ${targetCellCount}.
      
      Available block shorthand codes (and their cell counts):
      - "1x1" (1 cell): [[1]]
      - "2x1" (2 cells): [[1, 1]]
      - "1x2" (2 cells): [[1], [1]]
      - "3x1" (3 cells): [[1, 1, 1]]
      - "1x3" (3 cells): [[1], [1], [1]]
      - "4x1" (4 cells): [[1, 1, 1, 1]]
      - "1x4" (4 cells): [[1], [1], [1], [1]]
      - "2x2" (4 cells): [[1, 1], [1, 1]]
      - "L3" (3 cells): [[1, 0], [1, 1]]
      - "T4" (4 cells): [[0, 1, 0], [1, 1, 1]]

      Available colors:
      - "pink", "amber", "orange", "emerald", "teal", "blue", "violet", "fuchsia"

      Format:
      Each item in the output array must be a string of format "CODE:COLOR" where CODE is one of the shorthand codes and COLOR is one of the available colors.
      Example: ["2x2:pink", "1x1:amber", "L3:emerald", "3x1:blue"]

      CRITICAL CONSTRAINT:
      1. The sum of cells across all generated blocks MUST BE EXACTLY ${targetCellCount}. Do not exceed or fall short under any circumstance!
      2. Duplicate shorthand codes are strictly limited to at most 3 occurrences. Avoid generating the same block 4 or more times! Use different shapes.`;

    const userPrompt = 
      `Target Pattern Map (boolean matrix of size ${gridSize}x${gridSize}):
      ${JSON.stringify(targetPattern)}
      
      Generate a list of blocks in "CODE:COLOR" format that perfectly partition the true cells in this map.`;

    let generatedBlocks: { shape: number[][]; color: string }[] = [];
    let usedFallback = false;

    try {
      // 3.5초 타임아웃 약속 생성
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API Timeout (3.5s)')), 3500)
      );

      // Gemini API 호출 경쟁
      const apiCallPromise = generateObject({
        model: google('gemini-2.5-flash'),
        schema: ResponseSchema,
        prompt: `${systemInstruction}\n\n${userPrompt}`,
        temperature: 0.1,
      });

      const result = await Promise.race([apiCallPromise, timeoutPromise]);
      generatedBlocks = parseCompactBlocks(result.object.blocks);
    } catch (apiError) {
      console.warn('Gemini API failed or timed out. Falling back to local algorithmic generator:', apiError);
      generatedBlocks = generateBlocksAlgorithmic(targetPattern);
      usedFallback = true;
    }

    // 정합성 검증 및 자가 치유 (Self-Healing Fallback)
    let generatedCellsSum = 0;
    generatedBlocks.forEach(b => {
      b.shape.forEach(row => {
        row.forEach(val => {
          if (val === 1) generatedCellsSum++;
        });
      });
    });

    if (generatedCellsSum !== targetCellCount) {
      console.warn(`Area mismatch! AI: ${generatedCellsSum}, Target: ${targetCellCount}. Applying fallback.`);
      
      let diff = targetCellCount - generatedCellsSum;
      const fallbackColors = [
        'from-pink-500 to-rose-500',
        'from-amber-400 to-orange-500',
        'from-emerald-400 to-teal-500',
        'from-blue-500 to-indigo-600'
      ];

      if (diff > 0) {
        while (diff > 0) {
          generatedBlocks.push({
            shape: [[1]],
            color: fallbackColors[Math.floor(Math.random() * fallbackColors.length)]
          });
          diff -= 1;
        }
      } else if (diff < 0) {
        let excess = Math.abs(diff);
        const filteredBlocks: typeof generatedBlocks = [];
        
        for (const block of generatedBlocks) {
          let blockSize = 0;
          block.shape.forEach(row => row.forEach(val => { if (val === 1) blockSize++; }));
          
          if (excess >= blockSize) {
            excess -= blockSize;
          } else if (excess > 0) {
            const remaining = blockSize - excess;
            if (remaining === 1) {
              filteredBlocks.push({ shape: [[1]], color: block.color });
            } else if (remaining === 2) {
              filteredBlocks.push({ shape: [[1, 1]], color: block.color });
            } else if (remaining === 3) {
              filteredBlocks.push({ shape: [[1, 1, 1]], color: block.color });
            } else if (remaining === 4) {
              filteredBlocks.push({ shape: [[1, 1, 1, 1]], color: block.color });
            }
            excess = 0;
          } else {
            filteredBlocks.push(block);
          }
        }
        generatedBlocks = filteredBlocks;
      }
    }

    // Enforce shape duplicate limit (max 3 of the same shape)
    generatedBlocks = balanceBlocks(generatedBlocks as any) as any;

    return NextResponse.json({ blocks: generatedBlocks, fallback: usedFallback });

  } catch (error: any) {
    console.error('Error generating puzzle blocks:', error);
    return NextResponse.json({ error: error.message || '블록 생성에 실패했습니다.' }, { status: 500 });
  }
}

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
