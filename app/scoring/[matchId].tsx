/**
 * Live scoring screen — /scoring/[matchId]
 *
 * Loads match + players + holes, renders ScoringCardLayout,
 * persists every score change to Supabase in real time,
 * and computes match status after each hole using the scoring engine.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, ActivityIndicator, Alert, Text, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/api/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS } from '../../src/constants/theme';
import ScoringCardLayout, {
  type ScoringHole,
  type ScoringPlayer,
} from '../../src/screens/scoring/ScoringCardLayout';
import ScoringGridLayout from '../../src/screens/scoring/ScoringGridLayout';
import {
  extraStrokesOnHole,
  netScore,
  holeResult,
  matchStatusString,
  finalResult,
  stablefordPoints,
  detectHighlight,
  calcStrokesReceived,
} from '../../src/utils/scoring';
import { DEFAULT_HERO } from '../../src/constants/heroImages';

// ── Types ─────────────────────────────────────────────────────
interface DBPlayer {
  id: string;
  name: string;
  team: 'A' | 'B';
  playing_handicap: number;
  handicap_index: number;
  photo_url?: string;
}

interface DBMatchScore {
  id?: string;
  match_id: string;
  hole_number: number;
  par: number;
  stroke_index: number;
  score_a: number | null;
  score_b: number | null;
  score_a_player2: number | null;
  score_b_player2: number | null;
  net_score_a: number | null;
  net_score_b: number | null;
  hole_result: string | null;
  match_status_after: string | null;
}

// ── Helpers ───────────────────────────────────────────────────
function nameToInitials(name: string): string {
  return name.trim().split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
}

// ── Main Screen ───────────────────────────────────────────────
export default function ScoringScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<any>(null);
  const [competition, setCompetition] = useState<any>(null);
  const [dbPlayers, setDbPlayers] = useState<DBPlayer[]>([]);
  const [holes, setHoles] = useState<ScoringHole[]>([]);
  const [matchStatus, setMatchStatus] = useState('A/S');
  const [saving, setSaving] = useState(false);
  const [scoringLayout, setScoringLayout] = useState<'card' | 'grid'>('card');
  const [strokesMap, setStrokesMap] = useState<Record<string, number>>({});

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (matchId) loadMatch();
  }, [matchId]);

  const loadMatch = async () => {
    setLoading(true);

    if (user) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('scoring_layout')
        .eq('user_id', user.id)
        .single();
      if (prof?.scoring_layout) setScoringLayout(prof.scoring_layout as 'card' | 'grid');
    }

    const { data: matchData } = await supabase
      .from('matches')
      .select('*, competitions(*)')
      .eq('id', matchId)
      .single();

    if (!matchData) { setLoading(false); return; }
    setMatch(matchData);
    setCompetition(matchData.competitions);

    const { data: matchPlayerRows } = await supabase
      .from('match_players')
      .select('*, players(*)')
      .eq('match_id', matchId);

    const players: DBPlayer[] = (matchPlayerRows ?? []).map((mp: any) => ({
      id: mp.players.id,
      name: mp.players.name,
      team: mp.team,
      playing_handicap: mp.playing_handicap ?? mp.players.playing_handicap ?? 0,
      handicap_index: mp.players.handicap_index ?? 0,
      photo_url: mp.players.photo_url,
    }));
    setDbPlayers(players);

    const { data: courseHoles } = await supabase
      .from('course_holes')
      .select('*')
      .eq('tee_id', matchData.competitions.tee_id)
      .order('hole_number');

    const { data: existingScores } = await supabase
      .from('match_scores')
      .select('*')
      .eq('match_id', matchId)
      .order('hole_number');

    const scoreMap: Record<number, DBMatchScore> = {};
    (existingScores ?? []).forEach((s: DBMatchScore) => { scoreMap[s.hole_number] = s; });

    // ── CALCULATE STROKES WITH DYNAMIC ALLOWANCE ──
    const teamA = players.filter(p => p.team === 'A');
    const teamB = players.filter(p => p.team === 'B');
    const format = matchData.format as 'fourball' | 'foursomes' | 'singles' | 'scramble';
    
    // Get allowance from competition (default to 0.90 if not set)
    const allowance = matchData.competitions.handicap_allowance ?? 0.90;

    let sMap: Record<string, number> = {};
    if (format === 'singles' || format === 'fourball') {
      const allPH = players.map(p => p.playing_handicap);
      const strokes = calcStrokesReceived(format, allPH, allowance);
      players.forEach((p, i) => { sMap[p.id] = strokes[i] ?? 0; });
    } else if (format === 'foursomes') {
      const phA = teamA.reduce((s, p) => s + p.playing_handicap, 0) / Math.max(teamA.length, 1);
      const phB = teamB.reduce((s, p) => s + p.playing_handicap, 0) / Math.max(teamB.length, 1);
      const strokes = calcStrokesReceived('foursomes', [phA, phB], allowance);
      teamA.forEach(p => { sMap[p.id] = strokes[0]; });
      teamB.forEach(p => { sMap[p.id] = strokes[1]; });
    } else if (format === 'scramble') {
      const [a1, a2, b1, b2] = [
        teamA[0]?.playing_handicap ?? 0, teamA[1]?.playing_handicap ?? 0,
        teamB[0]?.playing_handicap ?? 0, teamB[1]?.playing_hand
