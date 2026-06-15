import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase admin client using Service Role Key to bypass RLS policies for global leaderboard select queries
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_scores')
      .select('id, total_score, users(email)')
      .order('total_score', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    const mapped = (data || [])
      .map((row: any) => {
        let email = '';
        if (row.users) {
          if (Array.isArray(row.users)) {
            email = row.users[0]?.email || '';
          } else {
            email = row.users.email || '';
          }
        }
        return {
          name: email ? (email.split('@')[0] || '익명') : '익명',
          score: row.total_score || 0
        };
      })
      .filter(p => p.name !== '익명'); // Filter out rows without email or guest names

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: error.message || '리더보드 조회 실패' }, { status: 500 });
  }
}
