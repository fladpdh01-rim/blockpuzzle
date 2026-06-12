import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

// 1. Google AI Provider 초기화
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

// Zod 스키마 정의
const BlockSchema = z.object({
  shape: z.array(z.array(z.number())).describe('2D array where 1 represents block, 0 represents empty space'),
  color: z.string().describe('Color tailwind CSS gradient classes e.g. "from-pink-500 to-rose-500"')
});

const ResponseSchema = z.object({
  blocks: z.array(BlockSchema).describe('The sequence of blocks that perfectly partition the target pattern')
});

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

    // Gemini API 호출을 위한 프롬프트 구성
    const systemInstruction = 
      `You are a mathematical block puzzle solver.
      The user wants to solve a 2D grid puzzle of size ${gridSize}x${gridSize} for the shape named "${targetShapeName}".
      The total cells that must be filled (represented by 'true' in targetPattern) is exactly ${targetCellCount} cells.

      Your goal is to provide a list of block shapes that:
      1. CAN PERFECTLY PARTITION (FILL) THE ${targetCellCount} CELLS in the target shape without any overlap or gaps.
      2. The sum of all '1's in the generated blocks must be EXACTLY EQUAL to ${targetCellCount}.
      
      Available block templates to choose from:
      - 1x1: [[1]]
      - 2x1 (horizontal): [[1, 1]]
      - 1x2 (vertical): [[1], [1]]
      - 3x1 (horizontal): [[1, 1, 1]]
      - 1x3 (vertical): [[1], [1], [1]]
      - 2x2 square: [[1, 1], [1, 1]]
      - L-shape (3 cells): [[1, 0], [1, 1]]
      - T-shape (4 cells): [[0, 1, 0], [1, 1, 1]]

      Assign a random gradient color class to each block from this list:
      - "from-pink-500 to-rose-500"
      - "from-amber-400 to-orange-500"
      - "from-orange-400 to-red-500"
      - "from-emerald-400 to-teal-500"
      - "from-teal-400 to-cyan-500"
      - "from-blue-500 to-indigo-600"
      - "from-violet-500 to-purple-600"
      - "from-fuchsia-500 to-pink-600"

      CRITICAL CONSTRAINT:
      The sum of cells (sum of all elements that equal 1 across all generated blocks) MUST BE EXACTLY ${targetCellCount}. Do not exceed or fall short under any circumstance!`;

    const userPrompt = 
      `Target Pattern Map (boolean matrix of size ${gridSize}x${gridSize}):
      ${JSON.stringify(targetPattern)}
      
      Generate a list of blocks that perfectly partition the true cells in this map.`;

    // 2. gemini-2.5-flash 모델 호출
    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: ResponseSchema,
      prompt: `${systemInstruction}\n\n${userPrompt}`,
      temperature: 0.1, // 재현성을 높이고 실수 방지를 위해 낮춤
    });

    let generatedBlocks = result.object.blocks;

    // 3. 정합성 검증 및 자가 치유 (Self-Healing Fallback)
    // 생성된 블록의 총합 면적 계산
    let generatedCellsSum = 0;
    generatedBlocks.forEach(b => {
      b.shape.forEach(row => {
        row.forEach(val => {
          if (val === 1) generatedCellsSum++;
        });
      });
    });

    // 만약 총합 면적이 타겟과 맞지 않다면, 에러를 내지 않고 1x1 혹은 2x1 블록 등을 활용하여 강제로 채워 맞춤
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
        // 모자란 면적을 1x1 블록들로 채워 넣음
        while (diff > 0) {
          generatedBlocks.push({
            shape: [[1]],
            color: fallbackColors[Math.floor(Math.random() * fallbackColors.length)]
          });
          diff -= 1;
        }
      } else if (diff < 0) {
        // 넘치는 면적만큼 블록들을 잘라내거나 제거
        let excess = Math.abs(diff);
        const filteredBlocks: typeof generatedBlocks = [];
        
        for (const block of generatedBlocks) {
          let blockSize = 0;
          block.shape.forEach(row => row.forEach(val => { if (val === 1) blockSize++; }));
          
          if (excess >= blockSize) {
            excess -= blockSize;
            // 이 블록은 버림
          } else if (excess > 0) {
            // 이 블록을 축소시키거나 (예: 1x1으로 변경)
            const remaining = blockSize - excess;
            if (remaining === 1) {
              filteredBlocks.push({ shape: [[1]], color: block.color });
            } else if (remaining === 2) {
              filteredBlocks.push({ shape: [[1, 1]], color: block.color });
            }
            excess = 0;
          } else {
            filteredBlocks.push(block);
          }
        }
        generatedBlocks = filteredBlocks;
      }
    }

    return NextResponse.json({ blocks: generatedBlocks });

  } catch (error: any) {
    console.error('Error generating puzzle blocks:', error);
    return NextResponse.json({ error: error.message || '블록 생성에 실패했습니다.' }, { status: 500 });
  }
}
