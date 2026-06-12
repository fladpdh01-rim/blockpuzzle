import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 유효한 Supabase URL 및 API Key 여부 판단
const isValidSupabaseConfig = (url: string, anonKey: string) => {
  if (!url || !anonKey) return false;
  if (url.includes('your-project-id') || anonKey.includes('your-supabase-anon-key')) return false;
  try {
    new URL(url);
    return url.startsWith('https://');
  } catch {
    return false;
  }
};

// 환경 변수가 적절히 입력되지 않은 경우 게스트 모드용 Dummy Client를 제공하여 런타임 오류 방어
export const supabase = isValidSupabaseConfig(supabaseUrl, supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createDummySupabaseClient();

function createDummySupabaseClient(): any {
  if (typeof window !== 'undefined') {
    console.warn(
      '⚠️ Supabase 환경 변수가 설정되지 않았거나 기본 템플릿 값입니다. 게스트 모드로 동작하며, DB 저장 및 구글 로그인은 비활성화됩니다. .env.local 파일을 실제 값으로 업데이트해 주세요.'
    );
  }
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: (callback: any) => {
        // 더미 리스너
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signInWithOAuth: async () => {
        alert('Supabase 설정(.env.local)이 올바르지 않아 구글 로그인을 진행할 수 없습니다.');
        return { data: {}, error: new Error('Supabase Config Missing') };
      },
      signOut: async () => ({ error: null })
    },
    from: () => {
      const selectChain = {
        eq: () => ({
          single: async () => ({ data: null, error: new Error('Supabase Config Missing') })
        }),
        order: () => selectChain,
        limit: () => selectChain,
        then: (onfulfilled: any) => Promise.resolve({ data: null, error: new Error('Supabase Config Missing') }).then(onfulfilled)
      };

      return {
        select: () => selectChain,
        update: () => ({
          eq: async () => ({ error: new Error('Supabase Config Missing') })
        }),
        insert: async () => ({ error: new Error('Supabase Config Missing') })
      };
    }
  };
}
export default supabase;
