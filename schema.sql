-- ==========================================
-- 1. 테이블 생성 (users, user_scores, game_history)
-- ==========================================

-- Public Users 테이블 (auth.users 연동용)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- User Scores 테이블 (사용자별 누적 점수 관리)
CREATE TABLE IF NOT EXISTS public.user_scores (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  total_score INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Game History 테이블 (개별 게임 기록 저장)
CREATE TABLE IF NOT EXISTS public.game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  difficulty TEXT NOT NULL, -- '하' | '중' | '상'
  score INTEGER NOT NULL,    -- 100 | 250 | 500
  clear_time INTEGER NOT NULL, -- 초 단위 기록
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. Auth.users 연동을 위한 트리거 설정
-- ==========================================

-- 새 auth.users 생성 시 public.users 및 user_scores에 자동으로 추가하는 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. public.users에 사용자 정보 추가
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;

  -- 2. user_scores에 누적 점수 0으로 초기화 생성
  INSERT INTO public.user_scores (id, total_score)
  VALUES (new.id, 0)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 바인딩
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- 3. PostgREST API 노출 권한 (GRANT) 설정
-- ==========================================

-- anon 및 authenticated 역할에 테이블 조회/수정 권한 명시적으로 부여
GRANT SELECT, INSERT, UPDATE ON public.users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_scores TO anon, authenticated;
GRANT SELECT, INSERT ON public.game_history TO anon, authenticated;

-- ==========================================
-- 4. RLS (Row Level Security) 설정 및 Policy
-- ==========================================

-- RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;

-- Policy 1: users 테이블 보안
CREATE POLICY "인증된 사용자는 본인의 프로필 정보만 조회 가능"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "인증된 사용자는 본인의 프로필 정보만 수정 가능"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: user_scores 테이블 보안
CREATE POLICY "인증된 사용자는 본인의 스코어만 조회 가능"
  ON public.user_scores FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "인증된 사용자는 본인의 스코어만 수정 가능"
  ON public.user_scores FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Policy 3: game_history 테이블 보안
CREATE POLICY "인증된 사용자는 본인의 게임 기록만 조회 가능"
  ON public.game_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "인증된 사용자는 본인의 게임 기록만 삽입 가능"
  ON public.game_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
