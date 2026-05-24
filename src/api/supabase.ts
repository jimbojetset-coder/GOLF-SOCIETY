import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── Type helpers ──────────────────────────────────────────────

export type Tables = {
  user_profiles: {
    id: string;
    user_id: string;
    display_name: string;
    avatar_url?: string;
    home_course?: string;
    handicap_index?: number;
    rounds_submitted: number;
    created_at: string;
    updated_at: string;
  };
  courses: {
    id: string;
    name: string;
    location?: string;
    holes_count: number;
    created_by_user_id?: string;
    is_verified: boolean;
    source: string;
    created_at: string;
  };
  course_tees: {
    id: string;
    course_id: string;
    tee_name: string;
    tee_colour?: string;
    course_rating?: number;
    slope_rating?: number;
    total_yards?: number;
    total_par: number;
  };
  course_holes: {
    id: string;
    course_id: string;
    tee_id: string;
    hole_number: number;
    par: number;
    stroke_index?: number;
    yards?: number;
  };
  competitions: {
    id: string;
    name: string;
    // Multi-day support
    start_date?: string;        // YYYY-MM-DD — first day of event
    end_date?: string;          // YYYY-MM-DD — last day (same as start_date if single day)
    event_date?: string;        // legacy, kept for backwards compat
    course_id?: string;
    tee_id?: string;
    status: 'active' | 'closed' | 'history';
    created_by_user_id?: string;
    share_token?: string;
    team_a_name: string;
    team_a_colour: string;
    team_b_name: string;
    team_b_colour: string;
    team_a_points: number;
    team_b_points: number;
    notes?: string;
    created_at: string;
    updated_at: string;
  };
  players: {
    id: string;
    competition_id: string;
    name: string;
    photo_url?: string;
    handicap_index?: number;
    playing_handicap?: number;
    team?: 'A' | 'B';
    user_id?: string;           // optional — only set if player has the app
  };
  matches: {
    id: string;
    competition_id: string;
    match_number?: number;
    format: 'fourball' | 'foursomes' | 'singles' | 'scramble';
    session_date?: string;      // YYYY-MM-DD — which day this match is played
    session?: string;           // 'Morning' | 'Afternoon' | 'Evening'
    status: 'pending' | 'in_progress' | 'complete';
    result?: string;
    winning_team?: 'A' | 'B' | 'halved';
    points_a: number;
    points_b: number;
    holes_played: number;
    scorer_user_id?: string;
    scorer_share_token?: string;
  };
  match_players: {
    id: string;
    match_id: string;
    player_id: string;
    team: 'A' | 'B';
    playing_handicap?: number;
    strokes_received: number;
  };
  match_scores: {
    id: string;
    match_id: string;
    hole_number: number;
    par: number;
    stroke_index?: number;
    score_a?: number;
    score_b?: number;
    score_a_player2?: number;
    score_b_player2?: number;
    net_score_a?: number;
    net_score_b?: number;
    hole_result?: 'A' | 'B' | 'halved';
    match_status_after?: string;
  };
  highlight_events: {
    id: string;
    competition_id: string;
    match_id?: string;
    player_id?: string;
    hole_number?: number;
    event_type: 'birdie' | 'eagle' | 'albatross' | 'hole_in_one' | 'par';
    team?: 'A' | 'B';
    timestamp: string;
  };
  competition_members: {
    id: string;
    competition_id: string;
    user_id: string;
    role: 'spectator' | 'scorer' | 'owner';
    joined_at: string;
  };
};

// ── Derived helpers ───────────────────────────────────────────

/** Returns all dates between start and end inclusive, as YYYY-MM-DD strings */
export function getEventDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    days.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/** Format a YYYY-MM-DD date as "Fri 22 May" */
export function formatMatchDay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

/** Group matches by session_date then session */
export function groupMatchesByDay(matches: Tables['matches'][]): Record<string, Tables['matches'][]> {
  return matches.reduce((acc, match) => {
    const key = match.session_date ?? 'Unscheduled';
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {} as Record<string, Tables['matches'][]>);
}
