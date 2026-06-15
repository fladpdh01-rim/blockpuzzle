'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  guestId: string | null;
  isGuest: boolean;
  userScore: number;
  gold: number;
  blockChanges: number;
  hints: number;
  hasBoughtItemSet: boolean;
  hasBoughtTimeSale: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  updateUserScore: (addScore: number, difficulty: string, time: number) => Promise<void>;
  purchaseItem: (itemType: 'itemset' | 'gold5000' | 'gold10000' | 'timesale' | 'blockchange' | 'hint') => Promise<{ success: boolean; message: string }>;
  useBlockChangeItem: () => Promise<boolean>;
  useHintItem: () => Promise<boolean>;
  completePurchase: (itemType: 'itemset' | 'gold5000' | 'gold10000') => Promise<void>;
  pendingMigrationScore: number | null;
  migrateGuestScore: (confirm: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [userScore, setUserScore] = useState<number>(0);
  const [gold, setGold] = useState<number>(0);
  const [blockChanges, setBlockChanges] = useState<number>(0);
  const [hints, setHints] = useState<number>(0);
  const [hasBoughtItemSet, setHasBoughtItemSet] = useState<boolean>(false);
  const [hasBoughtTimeSale, setHasBoughtTimeSale] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  
  // 게스트 데이터 마이그레이션 대기용 상태
  const [pendingMigrationScore, setPendingMigrationScore] = useState<number | null>(null);
  const [pendingMigrationGold, setPendingMigrationGold] = useState<number | null>(null);
  const [pendingMigrationBlockChanges, setPendingMigrationBlockChanges] = useState<number | null>(null);
  const [pendingMigrationHints, setPendingMigrationHints] = useState<number | null>(null);

  // 게스트 여부 반환
  const isGuest = !user;

  // 로컬 스토리지에서 게스트 골드 로드
  const loadGuestGold = () => {
    if (typeof window !== 'undefined') {
      const gGoldStr = localStorage.getItem('block_puzzle_guestGold');
      if (gGoldStr === null || gGoldStr === '1000') {
        localStorage.setItem('block_puzzle_guestGold', '0');
        setGold(0);
      } else {
        setGold(parseInt(gGoldStr, 10));
      }
    }
  };

  // 로컬 스토리지에서 아이템 정보 로드
  const loadUserItems = (id: string, isGuestUser: boolean) => {
    if (typeof window === 'undefined') return;
    const key = isGuestUser ? 'block_puzzle_guestItems' : `block_puzzle_items_${id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setBlockChanges(parsed.blockChanges ?? 0);
        setHints(parsed.hints ?? 0);
        setHasBoughtItemSet(parsed.hasBoughtItemSet ?? false);
        setHasBoughtTimeSale(parsed.hasBoughtTimeSale ?? false);
      } catch (e) {
        console.error('Error parsing user items:', e);
      }
    } else {
      setBlockChanges(0);
      setHints(0);
      setHasBoughtItemSet(false);
      setHasBoughtTimeSale(false);
    }
  };

  // 로컬 스토리지 및 DB에 아이템 정보 저장
  const saveUserItems = async (id: string, isGuestUser: boolean, items: { blockChanges: number; hints: number; hasBoughtItemSet: boolean; hasBoughtTimeSale: boolean }) => {
    if (typeof window === 'undefined') return;
    const key = isGuestUser ? 'block_puzzle_guestItems' : `block_puzzle_items_${id}`;
    localStorage.setItem(key, JSON.stringify(items));

    if (!isGuestUser && id) {
      try {
        await supabase
          .from('user_scores')
          .update({
            hints: items.hints,
            block_changes: items.blockChanges,
            has_bought_item_set: items.hasBoughtItemSet,
            has_bought_time_sale: items.hasBoughtTimeSale
          })
          .eq('id', id);
      } catch (e) {
        console.error('Failed to sync items to DB:', e);
      }
    }
  };

  // 1. 게스트 ID 초기 생성/조회 및 게스트 점수/골드/아이템 로드
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let currentGuestId = localStorage.getItem('block_puzzle_guestId');
      if (!currentGuestId) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        currentGuestId = `guest${rand}`;
        localStorage.setItem('block_puzzle_guestId', currentGuestId);
      }
      setGuestId(currentGuestId);
      loadGuestGold();
      loadUserItems('', true);
    }
  }, []);

  // 2. Supabase Auth 감시 리스너
  useEffect(() => {
    // 세션 조회
    supabase.auth.getSession().then(async (res: any) => {
      const session = res?.data?.session;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchDbUserScore(currentUser.id);
        loadUserItems(currentUser.id, false);
      } else {
        loadGuestScore();
        loadGuestGold();
        loadUserItems('', true);
      }
      setLoading(false);
    });

    // 상태 변화 감지 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (event === 'SIGNED_IN' && currentUser) {
        setLoading(true); // 데이터 패치 시작 시 로딩 상태로 변경
        await fetchDbUserScore(currentUser.id);
        
        // 게스트 모드에서 누적되었던 점수, 골드, 아이템이 있는지 검사하여 마이그레이션 제안
        const gScoreStr = localStorage.getItem('block_puzzle_guestScore');
        const gScore = gScoreStr ? parseInt(gScoreStr, 10) : 0;
        
        const gGoldStr = localStorage.getItem('block_puzzle_guestGold');
        const gGold = gGoldStr ? parseInt(gGoldStr, 10) : 0;

        const gItemsStr = localStorage.getItem('block_puzzle_guestItems');
        let gItems = { blockChanges: 0, hints: 0, hasBoughtItemSet: false, hasBoughtTimeSale: false };
        if (gItemsStr) {
          try { gItems = JSON.parse(gItemsStr); } catch (e) {}
        }

        if (gScore > 0 || gGold > 0 || gItems.blockChanges > 0 || gItems.hints > 0 || gItems.hasBoughtItemSet) {
          setPendingMigrationScore(gScore);
          setPendingMigrationGold(gGold);
          setPendingMigrationBlockChanges(gItems.blockChanges);
          setPendingMigrationHints(gItems.hints);
        }
        loadUserItems(currentUser.id, false);
      } else if (event === 'SIGNED_OUT') {
        setUserScore(0);
        setGold(0);
        setBlockChanges(0);
        setHints(0);
        setHasBoughtItemSet(false);
        setHasBoughtTimeSale(false);
        loadGuestScore();
        loadGuestGold();
        loadUserItems('', true);
        setPendingMigrationScore(null);
        setPendingMigrationGold(null);
        setPendingMigrationBlockChanges(null);
        setPendingMigrationHints(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // DB에서 사용자의 total_score 및 gold/아이템/패키지 기록 조회
  const fetchDbUserScore = async (userId: string) => {
    try {
      let { data, error } = await supabase
        .from('user_scores')
        .select('total_score, gold, hints, block_changes, has_bought_item_set, has_bought_time_sale')
        .eq('id', userId)
        .single();
      
      // self-healing: 신규 컬럼이 DB에 없으면 total_score만 다시 조회
      if (error && error.message && (error.message.includes('column') || error.message.includes('not found') || error.message.includes('gold') || error.message.includes('hints') || error.message.includes('block_changes'))) {
        console.warn('New columns not found in database. Using local fallback.');
        const fallbackRes = await supabase
          .from('user_scores')
          .select('total_score')
          .eq('id', userId)
          .single();
        
        if (fallbackRes.data) {
          data = { 
            total_score: fallbackRes.data.total_score, 
            gold: null, 
            hints: null, 
            block_changes: null, 
            has_bought_item_set: null, 
            has_bought_time_sale: null 
          };
          error = null;
        }
      }

      if (error) {
        console.error('Error fetching user score & gold:', error);
      } else if (data) {
        setUserScore(data.total_score);
        localStorage.setItem('block_puzzle_myScore', data.total_score.toString());
        
        // Gold
        if (data.gold !== null && data.gold !== undefined) {
          setGold(data.gold);
          localStorage.setItem(`block_puzzle_gold_${userId}`, data.gold.toString());
        } else {
          const localGold = localStorage.getItem(`block_puzzle_gold_${userId}`);
          setGold(localGold && localGold !== '1000' ? parseInt(localGold, 10) : 0); // 기본 0골드
        }

        // Hints
        if (data.hints !== null && data.hints !== undefined) {
          setHints(data.hints);
        } else {
          const stored = localStorage.getItem(`block_puzzle_items_${userId}`);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              setHints(parsed.hints ?? 0);
            } catch (e) {
              setHints(0);
            }
          } else {
            setHints(0);
          }
        }

        // Block Changes
        if (data.block_changes !== null && data.block_changes !== undefined) {
          setBlockChanges(data.block_changes);
        } else {
          const stored = localStorage.getItem(`block_puzzle_items_${userId}`);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              setBlockChanges(parsed.blockChanges ?? 0);
            } catch (e) {
              setBlockChanges(0);
            }
          } else {
            setBlockChanges(0);
          }
        }

        // Package item set
        if (data.has_bought_item_set !== null && data.has_bought_item_set !== undefined) {
          setHasBoughtItemSet(data.has_bought_item_set);
        } else {
          const stored = localStorage.getItem(`block_puzzle_items_${userId}`);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              setHasBoughtItemSet(parsed.hasBoughtItemSet ?? false);
            } catch (e) {
              setHasBoughtItemSet(false);
            }
          } else {
            setHasBoughtItemSet(false);
          }
        }

        // Package time sale
        if (data.has_bought_time_sale !== null && data.has_bought_time_sale !== undefined) {
          setHasBoughtTimeSale(data.has_bought_time_sale);
        } else {
          const stored = localStorage.getItem(`block_puzzle_items_${userId}`);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              setHasBoughtTimeSale(parsed.hasBoughtTimeSale ?? false);
            } catch (e) {
              setHasBoughtTimeSale(false);
            }
          } else {
            setHasBoughtTimeSale(false);
          }
        }

        // Sync local storage item cache in all cases
        saveUserItems(userId, false, {
          blockChanges: data.block_changes ?? blockChanges,
          hints: data.hints ?? hints,
          hasBoughtItemSet: data.has_bought_item_set ?? hasBoughtItemSet,
          hasBoughtTimeSale: data.has_bought_time_sale ?? hasBoughtTimeSale
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 로컬 스토리지에서 게스트 점수 로드
  const loadGuestScore = () => {
    if (typeof window !== 'undefined') {
      const gScore = localStorage.getItem('block_puzzle_guestScore');
      const score = gScore ? parseInt(gScore, 10) : 0;
      setUserScore(score);
      localStorage.setItem('block_puzzle_myScore', score.toString());
    }
  };

  // 로그아웃 처리
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // 점수 업데이트 (게임 클리어 시)
  const updateUserScore = async (addScore: number, difficulty: string, time: number) => {
    const nextScore = userScore + addScore;
    setUserScore(nextScore);
    localStorage.setItem('block_puzzle_myScore', nextScore.toString());

    if (user) {
      // 1. Supabase user_scores 업데이트
      try {
        const { error: scoreErr } = await supabase
          .from('user_scores')
          .update({ 
            total_score: nextScore, 
            gold, 
            hints,
            block_changes: blockChanges,
            has_bought_item_set: hasBoughtItemSet,
            has_bought_time_sale: hasBoughtTimeSale,
            updated_at: new Date().toISOString() 
          })
          .eq('id', user.id);

        if (scoreErr) {
          // 컬럼이 없을 때를 대비해 total_score만 다시 시도
          await supabase
            .from('user_scores')
            .update({ total_score: nextScore, updated_at: new Date().toISOString() })
            .eq('id', user.id);
        }
      } catch (e) {
        console.error('Failed to update DB score:', e);
      }

      // 2. game_history 기록 저장
      const { error: histErr } = await supabase
        .from('game_history')
        .insert({
          user_id: user.id,
          difficulty,
          score: addScore,
          clear_time: time
        });

      if (histErr) {
        console.error('Failed to insert game history:', histErr);
      }
    } else {
      // 게스트 모드인 경우 로컬스토리지에만 저장
      localStorage.setItem('block_puzzle_guestScore', nextScore.toString());
      
      // 로컬 리더보드에 게스트 기록 임시 추가/갱신
      const storedPlayers = localStorage.getItem('block_puzzle_players');
      let loadedPlayers = storedPlayers ? JSON.parse(storedPlayers) : [];
      
      const currentGuestId = guestId || 'guestGuest';
      const guestIdx = loadedPlayers.findIndex((p: any) => p.name === currentGuestId);
      if (guestIdx !== -1) {
        loadedPlayers[guestIdx].score = nextScore;
      } else {
        loadedPlayers.push({ name: currentGuestId, score: nextScore });
      }
      loadedPlayers.sort((a: any, b: any) => b.score - a.score);
      localStorage.setItem('block_puzzle_players', JSON.stringify(loadedPlayers));
    }
  };

  // 게스트 점수 및 골드/아이템 마이그레이션 수락/거절 처리
  const migrateGuestScore = async (confirm: boolean) => {
    if (!user || pendingMigrationScore === null) return;

    if (confirm) {
      const mergedScore = userScore + pendingMigrationScore;
      setUserScore(mergedScore);
      localStorage.setItem('block_puzzle_myScore', mergedScore.toString());

      const mergedGold = gold + (pendingMigrationGold ?? 0);
      setGold(mergedGold);
      localStorage.setItem(`block_puzzle_gold_${user.id}`, mergedGold.toString());

      const mergedBlockChanges = blockChanges + (pendingMigrationBlockChanges ?? 0);
      const mergedHints = hints + (pendingMigrationHints ?? 0);
      setBlockChanges(mergedBlockChanges);
      setHints(mergedHints);

      saveUserItems(user.id, false, {
        blockChanges: mergedBlockChanges,
        hints: mergedHints,
        hasBoughtItemSet: hasBoughtItemSet,
        hasBoughtTimeSale: hasBoughtTimeSale
      });

      // DB 업데이트
      try {
        const { error: scoreErr } = await supabase
          .from('user_scores')
          .update({ 
            total_score: mergedScore, 
            gold: mergedGold,
            hints: mergedHints,
            block_changes: mergedBlockChanges,
            has_bought_item_set: hasBoughtItemSet,
            has_bought_time_sale: hasBoughtTimeSale,
            updated_at: new Date().toISOString() 
          })
          .eq('id', user.id);

        if (scoreErr) {
          await supabase
            .from('user_scores')
            .update({ 
              total_score: mergedScore, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', user.id);
        }
      } catch (dbErr) {
        console.error('Failed to update merged score in DB:', dbErr);
      }

      // game_history에 마이그레이션 보너스 성격으로 적재
      await supabase
        .from('game_history')
        .insert({
          user_id: user.id,
          difficulty: '이전(게스트)',
          score: pendingMigrationScore,
          clear_time: 0
        });
    }

    // 마이그레이션이 끝났으므로 로컬 게스트 스코어 및 펜딩 상태 초기화
    localStorage.removeItem('block_puzzle_guestScore');
    localStorage.removeItem('block_puzzle_guestGold');
    localStorage.removeItem('block_puzzle_guestItems');
    setPendingMigrationScore(null);
    setPendingMigrationGold(null);
    setPendingMigrationBlockChanges(null);
    setPendingMigrationHints(null);
  };

  const saveDbGold = async (userId: string, targetGold: number) => {
    try {
      await supabase
        .from('user_scores')
        .update({ gold: targetGold })
        .eq('id', userId);
    } catch (e) {
      console.error('Failed to sync Gold to Supabase:', e);
    }
  };

  const purchaseItem = async (itemType: 'itemset' | 'gold5000' | 'gold10000' | 'timesale' | 'blockchange' | 'hint') => {
    if (itemType === 'itemset') {
      if (hasBoughtItemSet) {
        return { success: false, message: '이미 세트 상품을 구매하셨습니다! (구매 제한: 1개)' };
      }
      const nextHasBoughtItemSet = true;
      const nextBlockChanges = blockChanges + 20;
      const nextHints = hints + 20;

      setHasBoughtItemSet(nextHasBoughtItemSet);
      setBlockChanges(nextBlockChanges);
      setHints(nextHints);

      if (user) {
        saveUserItems(user.id, false, { blockChanges: nextBlockChanges, hints: nextHints, hasBoughtItemSet: nextHasBoughtItemSet, hasBoughtTimeSale });
      } else {
        saveUserItems('', true, { blockChanges: nextBlockChanges, hints: nextHints, hasBoughtItemSet: nextHasBoughtItemSet, hasBoughtTimeSale });
      }
      return { success: true, message: '아이템 세트 상품이 구매되었습니다! 보상으로 블럭 변경 20개, 힌트 20개가 즉시 지급됩니다.' };
    }

    if (itemType === 'gold10000') {
      const nextGold = gold + 10000;
      setGold(nextGold);
      if (user) {
        localStorage.setItem(`block_puzzle_gold_${user.id}`, nextGold.toString());
        await saveDbGold(user.id, nextGold);
      } else {
        localStorage.setItem('block_puzzle_guestGold', nextGold.toString());
      }
      return { success: true, message: '10000 Gold가 지급되었습니다.' };
    }

    if (itemType === 'gold5000') {
      const nextGold = gold + 5000;
      setGold(nextGold);
      if (user) {
        localStorage.setItem(`block_puzzle_gold_${user.id}`, nextGold.toString());
        await saveDbGold(user.id, nextGold);
      } else {
        localStorage.setItem('block_puzzle_guestGold', nextGold.toString());
      }
      return { success: true, message: '5000 Gold가 지급되었습니다.' };
    }

    let cost = 0;
    if (itemType === 'timesale') cost = 100;
    else if (itemType === 'blockchange') cost = 200;
    else if (itemType === 'hint') cost = 100;

    if (gold < cost) {
      return { success: false, message: '골드가 부족합니다.' };
    }

    if (itemType === 'timesale') {
      if (hasBoughtTimeSale) {
        return { success: false, message: '이미 타임 세일 상품을 구매하셨습니다! (구매 제한: 1개)' };
      }
      const nextGold = gold - cost;
      const nextBlockChanges = blockChanges + 1;
      const nextHasBoughtTimeSale = true;
      
      setGold(nextGold);
      setBlockChanges(nextBlockChanges);
      setHasBoughtTimeSale(nextHasBoughtTimeSale);

      if (user) {
        localStorage.setItem(`block_puzzle_gold_${user.id}`, nextGold.toString());
        await saveDbGold(user.id, nextGold);
        saveUserItems(user.id, false, { blockChanges: nextBlockChanges, hints, hasBoughtItemSet, hasBoughtTimeSale: nextHasBoughtTimeSale });
      } else {
        localStorage.setItem('block_puzzle_guestGold', nextGold.toString());
        saveUserItems('', true, { blockChanges: nextBlockChanges, hints, hasBoughtItemSet, hasBoughtTimeSale: nextHasBoughtTimeSale });
      }
      return { success: true, message: '타임 세일 블럭 변경 아이템 1개를 구매했습니다!' };
    }

    if (itemType === 'blockchange') {
      const nextGold = gold - cost;
      const nextBlockChanges = blockChanges + 1;

      setGold(nextGold);
      setBlockChanges(nextBlockChanges);

      if (user) {
        localStorage.setItem(`block_puzzle_gold_${user.id}`, nextGold.toString());
        await saveDbGold(user.id, nextGold);
        saveUserItems(user.id, false, { blockChanges: nextBlockChanges, hints, hasBoughtItemSet, hasBoughtTimeSale });
      } else {
        localStorage.setItem('block_puzzle_guestGold', nextGold.toString());
        saveUserItems('', true, { blockChanges: nextBlockChanges, hints, hasBoughtItemSet, hasBoughtTimeSale });
      }
      return { success: true, message: '블럭 변경 아이템 1개를 구매했습니다!' };
    }

    if (itemType === 'hint') {
      const nextGold = gold - cost;
      const nextHints = hints + 1;

      setGold(nextGold);
      setHints(nextHints);

      if (user) {
        localStorage.setItem(`block_puzzle_gold_${user.id}`, nextGold.toString());
        await saveDbGold(user.id, nextGold);
        saveUserItems(user.id, false, { blockChanges, hints: nextHints, hasBoughtItemSet, hasBoughtTimeSale });
      } else {
        localStorage.setItem('block_puzzle_guestGold', nextGold.toString());
        saveUserItems('', true, { blockChanges, hints: nextHints, hasBoughtItemSet, hasBoughtTimeSale });
      }
      return { success: true, message: '힌트 아이템 1개를 구매했습니다!' };
    }

    return { success: false, message: '알 수 없는 상품입니다.' };
  };

  const useBlockChangeItem = async (): Promise<boolean> => {
    if (blockChanges <= 0) return false;
    const nextBlockChanges = blockChanges - 1;
    setBlockChanges(nextBlockChanges);
    if (user) {
      saveUserItems(user.id, false, { blockChanges: nextBlockChanges, hints, hasBoughtItemSet, hasBoughtTimeSale });
    } else {
      saveUserItems('', true, { blockChanges: nextBlockChanges, hints, hasBoughtItemSet, hasBoughtTimeSale });
    }
    return true;
  };

  const useHintItem = async (): Promise<boolean> => {
    if (hints <= 0) return false;
    const nextHints = hints - 1;
    setHints(nextHints);
    if (user) {
      saveUserItems(user.id, false, { blockChanges, hints: nextHints, hasBoughtItemSet, hasBoughtTimeSale });
    } else {
      saveUserItems('', true, { blockChanges, hints: nextHints, hasBoughtItemSet, hasBoughtTimeSale });
    }
    return true;
  };

  const completePurchase = async (itemType: 'itemset' | 'gold5000' | 'gold10000') => {
    if (itemType === 'itemset') {
      let currentBlockChanges = 0;
      let currentHints = 0;
      let currentTimeSale = false;

      if (user) {
        // DB에서 최신 데이터 직접 확인
        const { data } = await supabase
          .from('user_scores')
          .select('block_changes, hints, has_bought_time_sale')
          .eq('id', user.id)
          .single();
        
        if (data) {
          currentBlockChanges = data.block_changes ?? 0;
          currentHints = data.hints ?? 0;
          currentTimeSale = data.has_bought_time_sale ?? false;
        } else {
          const stored = localStorage.getItem(`block_puzzle_items_${user.id}`);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              currentBlockChanges = parsed.blockChanges ?? 0;
              currentHints = parsed.hints ?? 0;
              currentTimeSale = parsed.hasBoughtTimeSale ?? false;
            } catch (e) {}
          }
        }
      } else {
        const stored = localStorage.getItem('block_puzzle_guestItems');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            currentBlockChanges = parsed.blockChanges ?? 0;
            currentHints = parsed.hints ?? 0;
            currentTimeSale = parsed.hasBoughtTimeSale ?? false;
          } catch (e) {}
        }
      }

      const nextHasBoughtItemSet = true;
      const nextBlockChanges = currentBlockChanges + 20;
      const nextHints = currentHints + 20;

      setHasBoughtItemSet(nextHasBoughtItemSet);
      setBlockChanges(nextBlockChanges);
      setHints(nextHints);

      if (user) {
        await saveUserItems(user.id, false, { blockChanges: nextBlockChanges, hints: nextHints, hasBoughtItemSet: nextHasBoughtItemSet, hasBoughtTimeSale: currentTimeSale });
      } else {
        await saveUserItems('', true, { blockChanges: nextBlockChanges, hints: nextHints, hasBoughtItemSet: nextHasBoughtItemSet, hasBoughtTimeSale: currentTimeSale });
      }
    } else if (itemType === 'gold10000') {
      let currentGold = 0;
      if (user) {
        const { data } = await supabase
          .from('user_scores')
          .select('gold')
          .eq('id', user.id)
          .single();
        if (data) {
          currentGold = data.gold ?? 0;
        } else {
          const storedGold = localStorage.getItem(`block_puzzle_gold_${user.id}`);
          currentGold = storedGold ? parseInt(storedGold, 10) : 0;
        }
      } else {
        const gGoldStr = localStorage.getItem('block_puzzle_guestGold');
        currentGold = gGoldStr ? parseInt(gGoldStr, 10) : 0;
      }

      const nextGold = currentGold + 10000;
      setGold(nextGold);
      if (user) {
        localStorage.setItem(`block_puzzle_gold_${user.id}`, nextGold.toString());
        await saveDbGold(user.id, nextGold);
      } else {
        localStorage.setItem('block_puzzle_guestGold', nextGold.toString());
      }
    } else if (itemType === 'gold5000') {
      let currentGold = 0;
      if (user) {
        const { data } = await supabase
          .from('user_scores')
          .select('gold')
          .eq('id', user.id)
          .single();
        if (data) {
          currentGold = data.gold ?? 0;
        } else {
          const storedGold = localStorage.getItem(`block_puzzle_gold_${user.id}`);
          currentGold = storedGold ? parseInt(storedGold, 10) : 0;
        }
      } else {
        const gGoldStr = localStorage.getItem('block_puzzle_guestGold');
        currentGold = gGoldStr ? parseInt(gGoldStr, 10) : 0;
      }

      const nextGold = currentGold + 5000;
      setGold(nextGold);
      if (user) {
        localStorage.setItem(`block_puzzle_gold_${user.id}`, nextGold.toString());
        await saveDbGold(user.id, nextGold);
      } else {
        localStorage.setItem('block_puzzle_guestGold', nextGold.toString());
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
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
        completePurchase,
        pendingMigrationScore,
        migrateGuestScore
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
