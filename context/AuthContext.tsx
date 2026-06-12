'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  guestId: string | null;
  isGuest: boolean;
  userScore: number;
  loading: boolean;
  signOut: () => Promise<void>;
  updateUserScore: (addScore: number, difficulty: string, time: number) => Promise<void>;
  pendingMigrationScore: number | null;
  migrateGuestScore: (confirm: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [userScore, setUserScore] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  
  // 게스트 점수 마이그레이션 대기용 상태
  const [pendingMigrationScore, setPendingMigrationScore] = useState<number | null>(null);

  // 게스트 여부 반환
  const isGuest = !user;

  // 1. 게스트 ID 초기 생성/조회 및 게스트 점수 로드
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let currentGuestId = localStorage.getItem('block_puzzle_guestId');
      if (!currentGuestId) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        currentGuestId = `guest${rand}`;
        localStorage.setItem('block_puzzle_guestId', currentGuestId);
      }
      setGuestId(currentGuestId);
    }
  }, []);

  // 2. Supabase Auth 감시 리스너
  useEffect(() => {
    // 세션 조회
    supabase.auth.getSession().then((res: any) => {
      const session = res?.data?.session;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchDbUserScore(currentUser.id);
      } else {
        loadGuestScore();
      }
      setLoading(false);
    });

    // 상태 변화 감지 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      const currentUser = session?.user ?? null;
      const prevUser = user;
      setUser(currentUser);

      if (event === 'SIGNED_IN' && currentUser) {
        fetchDbUserScore(currentUser.id).then(() => {
          // 게스트 모드에서 누적되었던 점수가 있는지 검사하여 마이그레이션 제안
          const gScoreStr = localStorage.getItem('block_puzzle_guestScore');
          const gScore = gScoreStr ? parseInt(gScoreStr, 10) : 0;
          if (gScore > 0) {
            setPendingMigrationScore(gScore);
          }
        });
      } else if (event === 'SIGNED_OUT') {
        setUserScore(0);
        loadGuestScore();
        setPendingMigrationScore(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // DB에서 사용자의 total_score 조회
  const fetchDbUserScore = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_scores')
        .select('total_score')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching user score:', error);
      } else if (data) {
        setUserScore(data.total_score);
        localStorage.setItem('block_puzzle_myScore', data.total_score.toString());
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
      const { error: scoreErr } = await supabase
        .from('user_scores')
        .update({ total_score: nextScore, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (scoreErr) {
        console.error('Failed to update DB score:', scoreErr);
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

      // 3. 리더보드 동기화 (players 갱신)
      const { data: allScores } = await supabase
        .from('user_scores')
        .select('id, total_score, users(email)');

      if (allScores) {
        const mappedPlayers = (allScores as any[]).map((row: any) => {
          let email = '';
          if (row.users) {
            if (Array.isArray(row.users)) {
              email = row.users[0]?.email || '';
            } else {
              const u = row.users as any;
              email = u.email || '';
            }
          }
          return {
            name: email.split('@')[0] || '익명',
            score: row.total_score
          };
        }).sort((a: any, b: any) => b.score - a.score);

        localStorage.setItem('block_puzzle_players', JSON.stringify(mappedPlayers));
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

  // 게스트 점수 마이그레이션 수락/거절 처리
  const migrateGuestScore = async (confirm: boolean) => {
    if (!user || pendingMigrationScore === null) return;

    if (confirm) {
      const mergedScore = userScore + pendingMigrationScore;
      setUserScore(mergedScore);
      localStorage.setItem('block_puzzle_myScore', mergedScore.toString());

      // DB 업데이트
      await supabase
        .from('user_scores')
        .update({ total_score: mergedScore, updated_at: new Date().toISOString() })
        .eq('id', user.id);

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
    setPendingMigrationScore(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        guestId,
        isGuest,
        userScore,
        loading,
        signOut,
        updateUserScore,
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
