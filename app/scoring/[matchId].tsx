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

  // debounce ref — avoid hammering DB on rapid taps
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load everything ────────────────────────────────────────
  useEffect(() => {
    if (matchId) loadMatch();
  }, [matchId]);

  const loadMatch = async () => {
    setLoading(true);

    // 0. Load user's preferred layout
    if (user) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('scoring_layout')
        .eq('user_id', user.id)
        .single();
      if (prof?.scoring_layout) setScoringLayout(prof.scoring_layout as 'card' | 'grid');
    }

    // 1. Match + competition
    const { data: matchData } = await supabase
      .from('matches')
      .select('*, competitions(*)')
      .eq('id', matchId)
      .single();

    if (!matchData) { setLoading(false); return; }
    setMatch(matchData);
    setCompetition(matchData.competitions);

    // 2. Players in this match (via match_players join)
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

    // 3. Course holes
    const { data: courseHoles } = await supabase
      .from('course_holes')
      .select('*')
      .eq('tee_id', matchData.competitions.tee_id)
      .order('hole_number');

    // 4. Existing scores (if resuming)
    const { data: existingScores } = await supabase
      .from('match_scores')
      .select('*')
      .eq('match_id', matchId)
      .order('hole_number');

    const scoreMap: Record<number, DBMatchScore> = {};
    (existingScores ?? []).forEach((s: DBMatchScore) => { scoreMap[s.hole_number] = s; });

    // 5. Calculate strokes received per player
    const teamA = players.filter(p => p.team === 'A');
    const teamB = players.filter(p => p.team === 'B');
    const format = matchData.format as 'fourball' | 'foursomes' | 'singles' | 'scramble';

    let strokesMap: Record<string, number> = {};
    if (format === 'singles' || format === 'fourball') {
      const allPH = players.map(p => p.playing_handicap);
      const strokes = calcStrokesReceived(format, allPH);
      players.forEach((p, i) => { strokesMap[p.id] = strokes[i] ?? 0; });
    } else if (format === 'foursomes') {
      const phA = teamA.reduce((s, p) => s + p.playing_handicap, 0) / Math.max(teamA.length, 1);
      const phB = teamB.reduce((s, p) => s + p.playing_handicap, 0) / Math.max(teamB.length, 1);
      const strokes = calcStrokesReceived('foursomes', [phA, phB]);
      teamA.forEach(p => { strokesMap[p.id] = strokes[0]; });
      teamB.forEach(p => { strokesMap[p.id] = strokes[1]; });
    } else if (format === 'scramble') {
      const [a1, a2, b1, b2] = [
        teamA[0]?.playing_handicap ?? 0, teamA[1]?.playing_handicap ?? 0,
        teamB[0]?.playing_handicap ?? 0, teamB[1]?.playing_handicap ?? 0,
      ];
      const strokes = calcStrokesReceived('scramble', [a1, a2, b1, b2]);
      teamA.forEach(p => { strokesMap[p.id] = strokes[0]; });
      teamB.forEach(p => { strokesMap[p.id] = strokes[1]; });
    }

    // 6. Build holes array
    const builtHoles: ScoringHole[] = (courseHoles ?? []).map((ch: any) => {
      const existing = scoreMap[ch.hole_number];
      return {
        hole: ch.hole_number,
        par: ch.par,
        strokeIndex: ch.stroke_index,
        yards: ch.yards,
        scoreA: existing?.score_a ?? null,
        scoreA2: existing?.score_a_player2 ?? null,
        scoreB: existing?.score_b ?? null,
        scoreB2: existing?.score_b_player2 ?? null,
      };
    });

    // If no course holes (shouldn't happen but safety net)
    if (builtHoles.length === 0) {
      for (let i = 1; i <= 18; i++) {
        const existing = scoreMap[i];
        builtHoles.push({
          hole: i, par: 4, strokeIndex: i, yards: undefined,
          scoreA: existing?.score_a ?? null,
          scoreA2: existing?.score_a_player2 ?? null,
          scoreB: existing?.score_b ?? null,
          scoreB2: existing?.score_b_player2 ?? null,
        });
      }
    }

    setHoles(builtHoles);
    setStrokesMap(strokesMap);
    recalcMatchStatus(builtHoles, players, strokesMap, matchData.competitions.team_a_name, matchData.competitions.team_b_name);
    setLoading(false);

    // Mark match as in_progress if pending
    if (matchData.status === 'pending') {
      await supabase.from('matches').update({ status: 'in_progress' }).eq('id', matchId);
    }
  };

  // ── Recalculate match status after every score change ──────
  const recalcMatchStatus = (
    currentHoles: ScoringHole[],
    players: DBPlayer[],
    strokesMap: Record<string, number>,
    teamAName: string,
    teamBName: string,
  ) => {
    const teamA = players.filter(p => p.team === 'A');
    const teamB = players.filter(p => p.team === 'B');
    const strokesA = strokesMap[teamA[0]?.id] ?? 0;
    const strokesB = strokesMap[teamB[0]?.id] ?? 0;

    let holesUp = 0;
    let leader: 'A' | 'B' | null = null;
    let holesPlayed = 0;

    for (const h of currentHoles) {
      const sA = h.scoreA;
      const sB = h.scoreB;
      if (sA === null || sB === null) break;

      holesPlayed++;
      const nA = netScore(sA, strokesA, h.strokeIndex);
      const nB = netScore(sB, strokesB, h.strokeIndex);
      const result = holeResult(nA, nB);

      if (result === 'A') {
        if (leader === 'B') { holesUp--; if (holesUp === 0) leader = null; }
        else { leader = 'A'; holesUp++; }
      } else if (result === 'B') {
        if (leader === 'A') { holesUp--; if (holesUp === 0) leader = null; }
        else { leader = 'B'; holesUp++; }
      }
    }

    const holesRemaining = currentHoles.length - holesPlayed;
    const status = matchStatusString(holesUp, leader, holesRemaining, teamAName, teamBName);
    setMatchStatus(status);
  };

  // ── Score change handler ───────────────────────────────────
  const handleScoreChange = useCallback((
    holeNumber: number,
    field: keyof ScoringHole,
    value: number | null,
  ) => {
    setHoles(prev => {
      const updated = prev.map(h =>
        h.hole === holeNumber ? { ...h, [field]: value } : h
      );
      // Recalc status immediately in UI
      if (dbPlayers.length && competition) {
        const strokesMap: Record<string, number> = {};
        dbPlayers.forEach(p => {
          // Re-use strokes from existing computation — approximation for UI
          strokesMap[p.id] = 0;
        });
        recalcMatchStatus(updated, dbPlayers, strokesMap, competition.team_a_name, competition.team_b_name);
      }
      return updated;
    });

    // Debounced DB save
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistScore(holeNumber, field, value), 800);
  }, [dbPlayers, competition, matchId]);

  // ── Persist a single score change ─────────────────────────
  const persistScore = async (
    holeNumber: number,
    field: keyof ScoringHole,
    value: number | null,
  ) => {
    setSaving(true);
    const holeData = holes.find(h => h.hole === holeNumber);
    if (!holeData) { setSaving(false); return; }

    const teamA = dbPlayers.filter(p => p.team === 'A');
    const teamB = dbPlayers.filter(p => p.team === 'B');
    const strokesA = strokesMap[teamA[0]?.id] ?? 0;
    const strokesB = strokesMap[teamB[0]?.id] ?? 0;

    const scorePayload: Partial<DBMatchScore> = {
      match_id: matchId,
      hole_number: holeNumber,
      par: holeData.par,
      stroke_index: holeData.strokeIndex,
      score_a: field === 'scoreA' ? value : (holeData.scoreA ?? null),
      score_b: field === 'scoreB' ? value : (holeData.scoreB ?? null),
      score_a_player2: field === 'scoreA2' ? value : (holeData.scoreA2 ?? null),
      score_b_player2: field === 'scoreB2' ? value : (holeData.scoreB2 ?? null),
    };

    // Compute net scores and hole result if both sides have scores
    const effA = scorePayload.score_a;
    const effB = scorePayload.score_b;
    if (effA !== null && effB !== null) {
      const nA = netScore(effA, strokesA, holeData.strokeIndex);
      const nB = netScore(effB, strokesB, holeData.strokeIndex);
      scorePayload.net_score_a = nA;
      scorePayload.net_score_b = nB;
      scorePayload.hole_result = holeResult(nA, nB);
    }

    // Upsert by match_id + hole_number
    await supabase
      .from('match_scores')
      .upsert(scorePayload, { onConflict: 'match_id,hole_number' });

    // Highlight detection
    if (value !== null) {
      const playerForField = field === 'scoreA' ? teamA[0]
        : field === 'scoreA2' ? teamA[1]
        : field === 'scoreB' ? teamB[0]
        : teamB[1];

      if (playerForField) {
        const highlight = detectHighlight(value, holeData.par);
        if (highlight && highlight !== 'par') {
          const team = playerForField.team;
          await supabase.from('highlight_events').upsert({
            competition_id: competition?.id,
            match_id: matchId,
            player_id: playerForField.id,
            hole_number: holeNumber,
            event_type: highlight,
            team,
            timestamp: new Date().toISOString(),
          }, { onConflict: 'match_id,player_id,hole_number' });
        }
      }
    }

    setSaving(false);
  };

  // ── Complete match ─────────────────────────────────────────
  const handleComplete = async () => {
    Alert.alert(
      'Finish round?',
      'This will submit all scores and mark the match as complete.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit', style: 'default',
          onPress: async () => {
            const teamA = dbPlayers.filter(p => p.team === 'A');
            const teamB = dbPlayers.filter(p => p.team === 'B');

            // Compute final result
            let holesUp = 0;
            let leader: 'A' | 'B' | null = null;
            let lastHolePlayed = 0;

            for (const h of holes) {
              if (h.scoreA === null || h.scoreB === null) break;
              lastHolePlayed = h.hole;
              const nA = netScore(h.scoreA, 0, h.strokeIndex);
              const nB = netScore(h.scoreB, 0, h.strokeIndex);
              const res = holeResult(nA, nB);
              if (res === 'A') { leader = 'A'; holesUp = leader === 'B' ? holesUp - 1 : holesUp + 1; if (holesUp === 0) leader = null; }
              else if (res === 'B') { leader = 'B'; holesUp = leader === 'A' ? holesUp - 1 : holesUp + 1; if (holesUp === 0) leader = null; }
            }

            const final = finalResult(
              holesUp, leader, lastHolePlayed,
              competition?.team_a_name, competition?.team_b_name,
            );

            await supabase.from('matches').update({
              status: 'complete',
              result: final.result,
              winning_team: final.winning_team,
              points_a: final.points_a,
              points_b: final.points_b,
              holes_played: lastHolePlayed,
            }).eq('id', matchId);

            // Update competition totals (direct increment via RPC-safe update)
            if (competition?.id) {
              await supabase.rpc('increment_competition_points', {
                comp_id: competition.id,
                delta_a: final.points_a,
                delta_b: final.points_b,
              }).then(async ({ error: rpcErr }) => {
                if (rpcErr) {
                  // Fallback: manual read-then-write if RPC not available
                  const { data: comp } = await supabase
                    .from('competitions')
                    .select('team_a_points, team_b_points')
                    .eq('id', competition.id)
                    .single();
                  if (comp) {
                    await supabase.from('competitions').update({
                      team_a_points: (comp.team_a_points ?? 0) + final.points_a,
                      team_b_points: (comp.team_b_points ?? 0) + final.points_b,
                    }).eq('id', competition.id);
                  }
                }
              });
            }

            router.replace(`/(tabs)/leaderboard?competitionId=${competition?.id}`);
          },
        },
      ]
    );
  };

  // ── Build scoring players from DB ─────────────────────────
  const scoringPlayers: ScoringPlayer[] = dbPlayers.map(p => ({
    id: p.id,
    name: p.name,
    initials: nameToInitials(p.name),
    team: p.team,
    teamColour: p.team === 'A' ? competition?.team_a_colour ?? '#E63946' : competition?.team_b_colour ?? '#457B9D',
    strokesReceived: 0, // populated after load — see loadMatch
    handicapIndex: p.handicap_index,
    photoUrl: p.photo_url,
  }));

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading match…</Text>
      </View>
    );
  }

  if (!match || holes.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Match not found</Text>
      </View>
    );
  }

  const LayoutComponent = (scoringLayout === 'grid' ? ScoringGridLayout : ScoringCardLayout) as typeof ScoringCardLayout;
  return (
    <LayoutComponent
      holes={holes}
      players={scoringPlayers}
      teamAName={competition?.team_a_name ?? 'A'}
      teamBName={competition?.team_b_name ?? 'B'}
      teamAColour={competition?.team_a_colour ?? '#E63946'}
      teamBColour={competition?.team_b_colour ?? '#457B9D'}
      matchStatus={matchStatus}
      format={match.format}
      heroImageUri={competition?.hero_image_url ?? DEFAULT_HERO}
      sessionLabel={match.session ? `${match.session}` : 'Round 1'}
      onScoreChange={handleScoreChange}
      onComplete={handleComplete}
    />
  );
}

// ── Types re-exported for ScoringCardLayout ────────────────
export type { ScoringPlayer };

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, gap: 12,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: 15 },
});
