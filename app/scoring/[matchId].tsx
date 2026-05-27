/**
 * Live scoring screen — /scoring/[matchId]
 *
 * Loads match + players + holes, renders ScoringCardLayout,
 * persists every score change to Supabase in real time,
 * and computes match status after each hole using the scoring engine.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, ActivityIndicator, Alert, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/api/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS, SHADOW, teamTints } from '../../src/constants/theme';
import ScoringCardLayout, {
  type ScoringHole,
  type ScoringPlayer,
} from '../../src/screens/scoring/ScoringCardLayout';
import ScoringGridLayout from '../../src/screens/scoring/ScoringGridLayout';
import {
  extraStrokesOnHole,
  netScore,
  holeResult,
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

// ── getTeamNet: Best Ball / Foursomes team net score ─────────
// Returns the lowest net score among a team's players on a given hole.
// For singles/foursomes (1 score per side) this is just that player's net.
// For fourball/scramble (2 scores per side) this picks the better ball.
function getTeamNet(
  h: ScoringHole,
  teamPlayers: DBPlayer[],
  sMap: Record<string, number>,
): number {
  const isA = teamPlayers[0]?.team === 'A';
  const rawScores: (number | null | undefined)[] = isA
    ? [h.scoreA, h.scoreA2]
    : [h.scoreB, h.scoreB2];
  const nets = rawScores.map((s, i) =>
    s != null && teamPlayers[i] != null
      ? netScore(s, sMap[teamPlayers[i].id] ?? 0, h.strokeIndex)
      : 999,
  );
  return Math.min(...nets);
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
  const [matchStatus, setMatchStatus] = useState<{ label: string; leader: 'A' | 'B' | null }>({ label: 'A/S', leader: null });
  const [saving, setSaving] = useState(false);
  const [scoringLayout, setScoringLayout] = useState<'card' | 'grid'>('card');
  const [strokesMap, setStrokesMap] = useState<Record<string, number>>({});

  // Per-hole debounce timers — one timer per hole so entering hole 4 never
  // cancels a pending save for hole 3
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // Per-hole in-flight flag — prevents two concurrent DB writes for the same hole
  const saveInFlight = useRef<Record<number, boolean>>({});
  // Per-hole pending flag — set when a new score arrives while a save is in-flight;
  // the in-flight save will re-run once it completes, picking up the latest holesRef value
  const savePending = useRef<Record<number, boolean>>({});
  // Always-current holes ref — avoids stale closure in debounced persistScore
  const holesRef = useRef<ScoringHole[]>([]);

  // ── Save error tracking ────────────────────────────────────
  // Tracks which hole numbers had a failed save — drives the error banner
  const saveErrorHoles = useRef<Set<number>>(new Set());
  const [hasSaveError, setHasSaveError] = useState(false);

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
    holesRef.current = builtHoles;
    setStrokesMap(strokesMap);
    recalcMatchStatus(builtHoles, players, strokesMap, matchData.competitions.team_a_name, matchData.competitions.team_b_name);
    setLoading(false);

    // Mark match as in_progress if pending
    if (matchData.status === 'pending') {
      await supabase.from('matches').update({ status: 'in_progress' }).eq('id', matchId);
    }
  };

  // Keep holesRef in sync AND recalculate match status whenever holes change.
  // Doing both here keeps recalcMatchStatus out of the setHoles updater —
  // calling a setState inside another setState's updater is a side-effect and
  // fires twice in React StrictMode, causing matchStatus to flicker.
  useEffect(() => {
    holesRef.current = holes;
    if (holes.length && dbPlayers.length && competition) {
      recalcMatchStatus(holes, dbPlayers, strokesMap, competition.team_a_name, competition.team_b_name);
    }
  }, [holes]); // dbPlayers/strokesMap/competition are stable after loadMatch — intentional omission

  // ── Recalculate match status after every score change ──────
  // Uses getTeamNet so 4-ball picks the best net per team (not just player 1).
  const recalcMatchStatus = (
    currentHoles: ScoringHole[],
    players: DBPlayer[],
    sMap: Record<string, number>,
    teamAName: string,
    teamBName: string,
  ) => {
    const teamA = players.filter(p => p.team === 'A');
    const teamB = players.filter(p => p.team === 'B');

    let holesUp = 0;
    let leader: 'A' | 'B' | null = null;
    let holesPlayed = 0;

    for (const h of currentHoles) {
      // A hole counts once at least one player per side has a score
      const hasA = h.scoreA !== null || h.scoreA2 !== null;
      const hasB = h.scoreB !== null || h.scoreB2 !== null;
      if (!hasA || !hasB) break;

      holesPlayed++;
      const nA = getTeamNet(h, teamA, sMap);
      const nB = getTeamNet(h, teamB, sMap);
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
    if (!leader || holesUp === 0) {
      setMatchStatus({ label: 'A/S', leader: null });
    } else if (holesUp > holesRemaining) {
      setMatchStatus({ label: `${holesUp}&${holesRemaining}`, leader });
    } else if (holesUp === holesRemaining) {
      setMatchStatus({ label: `Dormie ${holesUp}`, leader });
    } else {
      setMatchStatus({ label: `${holesUp}UP`, leader });
    }
  };

  // ── Score change handler ───────────────────────────────────
  const handleScoreChange = useCallback((
    holeNumber: number,
    field: keyof ScoringHole,
    value: number | null,
  ) => {
    // Pure state update — no side-effects inside the updater.
    // Match status recalc is handled by the useEffect that watches holes.
    setHoles(prev =>
      prev.map(h => h.hole === holeNumber ? { ...h, [field]: value } : h)
    );

    // Per-hole debounced DB save — clearing hole 3's timer never cancels hole 4's.
    // No field/value passed: persistScore reads everything from holesRef at fire time.
    if (saveTimers.current[holeNumber]) clearTimeout(saveTimers.current[holeNumber]);
    saveTimers.current[holeNumber] = setTimeout(() => persistScore(holeNumber), 800);
  }, [dbPlayers, competition, matchId, strokesMap]);

  // ── Persist a single hole's scores ────────────────────────
  //
  // Takes only holeNumber — all score values are read from holesRef.current at
  // the moment the write fires, guaranteeing we always save the freshest data.
  //
  // Race-condition guard:
  //   If a write is already in-flight for this hole when the debounce fires,
  //   we set savePending[hole] = true and return immediately.  When the
  //   in-flight request settles we check savePending and, if set, do one
  //   final write with the latest holesRef snapshot.  This means at most one
  //   DB write is ever in-flight per hole, and the last value always wins.
  const persistScore = useCallback(async (holeNumber: number): Promise<void> => {
    // Guard: if already saving this hole, flag it and bail — we'll re-run below
    if (saveInFlight.current[holeNumber]) {
      savePending.current[holeNumber] = true;
      return;
    }

    const holeData = holesRef.current.find(h => h.hole === holeNumber);
    if (!holeData) return;

    saveInFlight.current[holeNumber] = true;
    setSaving(true);

    try {
      const teamA = dbPlayers.filter(p => p.team === 'A');
      const teamB = dbPlayers.filter(p => p.team === 'B');

      // Always read ALL score fields from the ref — no stale field/value params
      const scorePayload: Partial<DBMatchScore> = {
        match_id: matchId,
        hole_number: holeNumber,
        par: holeData.par,
        stroke_index: holeData.strokeIndex,
        score_a: holeData.scoreA ?? null,
        score_b: holeData.scoreB ?? null,
        score_a_player2: holeData.scoreA2 ?? null,
        score_b_player2: holeData.scoreB2 ?? null,
      };

      // Compute net scores using getTeamNet — handles 4-ball best-ball correctly
      const teamANet = getTeamNet(holeData, teamA, strokesMap);
      const teamBNet = getTeamNet(holeData, teamB, strokesMap);
      const hasA = holeData.scoreA !== null || holeData.scoreA2 !== null;
      const hasB = holeData.scoreB !== null || holeData.scoreB2 !== null;
      if (hasA && hasB && teamANet !== 999 && teamBNet !== 999) {
        scorePayload.net_score_a = teamANet;
        scorePayload.net_score_b = teamBNet;
        scorePayload.hole_result = holeResult(teamANet, teamBNet);
      }

      const { error: upsertErr } = await supabase
        .from('match_scores')
        .upsert(scorePayload, { onConflict: 'match_id,hole_number' });

      if (upsertErr) {
        saveErrorHoles.current.add(holeNumber);
        setHasSaveError(true);
        return; // skip highlight detection if score didn't save
      }

      // Score saved cleanly — remove this hole from the error set
      saveErrorHoles.current.delete(holeNumber);
      if (saveErrorHoles.current.size === 0) setHasSaveError(false);

      // Highlight detection — check every player's score on this hole
      const candidates: Array<{ score: number | null; player: DBPlayer | undefined }> = [
        { score: holeData.scoreA,  player: teamA[0] },
        { score: holeData.scoreA2, player: teamA[1] },
        { score: holeData.scoreB,  player: teamB[0] },
        { score: holeData.scoreB2, player: teamB[1] },
      ];
      for (const { score, player } of candidates) {
        if (score !== null && player) {
          const highlight = detectHighlight(score, holeData.par);
          if (highlight && highlight !== 'par') {
            await supabase.from('highlight_events').upsert({
              competition_id: competition?.id,
              match_id: matchId,
              player_id: player.id,
              hole_number: holeNumber,
              event_type: highlight,
              team: player.team,
              timestamp: new Date().toISOString(),
            }, { onConflict: 'match_id,player_id,hole_number' });
          }
        }
      }
    } finally {
      saveInFlight.current[holeNumber] = false;

      if (savePending.current[holeNumber]) {
        // A new score arrived while we were saving — do one final write now
        // to ensure the very latest value is persisted
        savePending.current[holeNumber] = false;
        void persistScore(holeNumber);
      } else {
        setSaving(false);
      }
    }
  }, [dbPlayers, strokesMap, matchId, competition]);

  // ── Retry failed saves ────────────────────────────────────
  const handleRetry = useCallback(() => {
    const failedHoles = Array.from(saveErrorHoles.current);
    // Clear optimistically — individual holes will re-add if they fail again
    saveErrorHoles.current = new Set();
    setHasSaveError(false);
    failedHoles.forEach(h => void persistScore(h));
  }, [persistScore]);

  // ── Complete match ─────────────────────────────────────────
  // Wrapped in useCallback so the layout component receives a stable function
  // reference — without this every score entry causes an unnecessary re-render
  // of the entire layout. Uses holesRef so it always reads the latest scores
  // without needing `holes` in the dependency array.
  const handleComplete = useCallback(async () => {
    Alert.alert(
      'Finish round?',
      'This will submit all scores and mark the match as complete.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit', style: 'default',
          onPress: async () => {
            const currentHoles = holesRef.current;
            const teamA = dbPlayers.filter(p => p.team === 'A');
            const teamB = dbPlayers.filter(p => p.team === 'B');

            // Compute final result using getTeamNet — correct for all formats
            let holesUp = 0;
            let leader: 'A' | 'B' | null = null;
            let lastHolePlayed = 0;

            for (const h of currentHoles) {
              const hasA = h.scoreA !== null || h.scoreA2 !== null;
              const hasB = h.scoreB !== null || h.scoreB2 !== null;
              if (!hasA || !hasB) break;
              lastHolePlayed = h.hole;
              const nA = getTeamNet(h, teamA, strokesMap);
              const nB = getTeamNet(h, teamB, strokesMap);
              const res = holeResult(nA, nB);
              if (res === 'A') {
                if (leader === 'B') { holesUp--; if (holesUp === 0) leader = null; }
                else { leader = 'A'; holesUp++; }
              } else if (res === 'B') {
                if (leader === 'A') { holesUp--; if (holesUp === 0) leader = null; }
                else { leader = 'B'; holesUp++; }
              }
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
  }, [dbPlayers, strokesMap, competition, matchId, router]);

  // ── Build scoring players from DB ─────────────────────────
  const scoringPlayers: ScoringPlayer[] = dbPlayers.map(p => {
  const teamColour = p.team === 'A' ? competition?.team_a_colour ?? '#E63946' : competition?.team_b_colour ?? '#457B9D';
  const tints = teamTints(teamColour);
  return {
    id: p.id,
    name: p.name,
    initials: nameToInitials(p.name),
    team: p.team,
    teamColour,
    teamColourLight: tints.light,
    teamColourBorder: tints.border,
    strokesReceived: strokesMap[p.id] ?? 0,
    handicapIndex: p.handicap_index,
    photoUrl: p.photo_url,
  };
});
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
    <View style={{ flex: 1 }}>
      <LayoutComponent
      holes={holes}
      players={scoringPlayers}
      teamAName={competition?.team_a_name ?? 'A'}
      teamBName={competition?.team_b_name ?? 'B'}
      teamAColour={competition?.team_a_colour ?? '#E63946'}
      teamBColour={competition?.team_b_colour ?? '#457B9D'}
      matchStatus={matchStatus}
      format={match.format}
      sessionLabel={match.session ? `${match.session}` : 'Round 1'}
      onScoreChange={handleScoreChange}
      onComplete={handleComplete}
    />
    {hasSaveError && (
      <TouchableOpacity
        style={styles.errorBanner}
        onPress={handleRetry}
        activeOpacity={0.85}
      >
        <Text style={styles.errorBannerText}>⚠️  Score not saved — tap to retry</Text>
      </TouchableOpacity>
    )}
    </View>
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

  errorBanner: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: COLORS.danger,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    ...SHADOW.cardMd,
  },
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
