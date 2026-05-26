/**
 * Live Leaderboard Tab — Light Theme
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  ActivityIndicator, TouchableOpacity, RefreshControl, Alert, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/api/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS, SHADOW, FORMAT_LABELS } from '../../src/constants/theme';
import { parseStoredResult } from '../../src/utils/matchStatus';

// ── Types ─────────────────────────────────────────────────────

interface Competition {
  id: string; name: string;
  team_a_name: string; team_a_colour: string;
  team_b_name: string; team_b_colour: string;
  team_a_points: number; team_b_points: number;
  status: string; hide_leaderboard: boolean;
  results_hidden_count: number; created_by_user_id: string;
}

interface Match {
  id: string; match_number: number; format: string;
  session: string; session_date?: string;
  status: string; result: string | null;
  winning_team: 'A' | 'B' | 'halved' | null;
  points_a: number; points_b: number; holes_played: number;
  playerNames: string[];
}

interface HighlightEvent {
  id: string; player_id: string; hole_number: number;
  event_type: string; team: 'A' | 'B'; timestamp: string; player_name?: string;
}

const HIGHLIGHT_EMOJI: Record<string, string> = {
  hole_in_one: '🕳️', albatross: '🌟', eagle: '🦅', birdie: '🐦',
};

const SESSION_LABELS: Record<string, string> = {
  morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
};

// ── Match Row ─────────────────────────────────────────────────

function MatchRow({ match, comp, hidden }: { match: Match; comp: Competition; hidden: boolean }) {
  const statusInfo = parseStoredResult(match.result, comp.team_a_name, comp.team_b_name);
  const isLive     = match.status === 'in_progress';
  const isComplete = match.status === 'complete';

  const accentCol = match.winning_team === 'A'
    ? comp.team_a_colour
    : match.winning_team === 'B'
    ? comp.team_b_colour
    : isLive ? COLORS.accent : COLORS.textMuted;

  const accentBg = match.winning_team === 'A'
    ? comp.team_a_colour + '14'
    : match.winning_team === 'B'
    ? comp.team_b_colour + '14'
    : isLive ? COLORS.accentLight : COLORS.surface;

  const teamAPlayers = match.playerNames.filter((_, i) => i % 2 === 0);
  const teamBPlayers = match.playerNames.filter((_, i) => i % 2 === 1);

  return (
    <View style={[styles.matchCard, { backgroundColor: accentBg, borderColor: accentCol + '40' }]}>
      {/* Left accent bar */}
      <View style={[styles.matchAccentBar, { backgroundColor: accentCol }]} />

      <View style={styles.matchContent}>
        {/* Top row: format + LIVE badge + status */}
        <View style={styles.matchTopRow}>
          <View style={styles.matchTopLeft}>
            {isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            )}
            <Text style={styles.matchFormat}>{FORMAT_LABELS[match.format] ?? match.format}</Text>
          </View>
          {isComplete && !hidden && (
            <View style={[styles.ptsBadge, { backgroundColor: accentCol + '20', borderColor: accentCol + '50' }]}>
              <Text style={[styles.ptsBadgeText, { color: accentCol }]}>
                {match.points_a === 1 ? '1 pt' : match.points_a === 0.5 ? '½ pt each' : '0 pt'}
              </Text>
            </View>
          )}
        </View>

        {/* Players row */}
        <View style={styles.matchPlayersRow}>
          <View style={styles.matchTeamSide}>
            <Text style={[styles.matchTeamLabel, { color: comp.team_a_colour }]}>
              {comp.team_a_name.toUpperCase()}
            </Text>
            <Text style={styles.matchPlayerNames} numberOfLines={1}>
              {teamAPlayers.join(' / ') || '—'}
            </Text>
          </View>

          <Text style={styles.matchVs}>vs</Text>

          <View style={[styles.matchTeamSide, styles.matchTeamRight]}>
            <Text style={[styles.matchTeamLabel, { color: comp.team_b_colour }]}>
              {comp.team_b_name.toUpperCase()}
            </Text>
            <Text style={[styles.matchPlayerNames, { textAlign: 'right' }]} numberOfLines={1}>
              {teamBPlayers.join(' / ') || '—'}
            </Text>
          </View>
        </View>

        {/* Status */}
        <View style={styles.matchStatusRow}>
          {hidden ? (
            <View style={styles.hiddenPill}>
              <Ionicons name="lock-closed" size={10} color={COLORS.textMuted} />
              <Text style={styles.hiddenText}>Result hidden</Text>
            </View>
          ) : (
            <Text style={[styles.matchStatusText, { color: accentCol }]}>
              {isLive && match.holes_played > 0 ? `Thru ${match.holes_played}  ·  ` : ''}
              {statusInfo.label || (match.status === 'pending' ? 'Not started' : '')}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function LeaderboardTab() {
  const { competitionId } = useLocalSearchParams<{ competitionId?: string }>();
  const { user }  = useAuth();
  const router    = useRouter();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches,     setMatches]     = useState<Match[]>([]);
  const [highlights,  setHighlights]  = useState<HighlightEvent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [hlIdx,       setHlIdx]       = useState(0);

  const isCreator  = competition?.created_by_user_id === user?.id;
  const compClosed = competition?.status === 'closed' || competition?.status === 'history';

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    let q = supabase.from('competitions').select('*');
    if (competitionId) q = q.eq('id', competitionId);
    else q = q.eq('status', 'active').order('created_at', { ascending: false }).limit(1);
    const { data: compData } = await q.single();
    if (!compData) { setLoading(false); setRefreshing(false); return; }
    setCompetition(compData);

    const { data: matchData } = await supabase
      .from('matches')
      .select('*, match_players(team, players(name))')
      .eq('competition_id', compData.id)
      .order('match_number');
    setMatches((matchData ?? []).map((m: any) => ({
      ...m,
      playerNames: (m.match_players ?? []).map((mp: any) => mp.players?.name ?? ''),
    })));

    const { data: hlData } = await supabase
      .from('highlight_events')
      .select('*, players(name)')
      .eq('competition_id', compData.id)
      .in('event_type', ['hole_in_one', 'albatross', 'eagle', 'birdie'])
      .order('timestamp', { ascending: false })
      .limit(12);
    setHighlights((hlData ?? []).map((h: any) => ({ ...h, player_name: h.players?.name })));

    setLoading(false); setRefreshing(false);
  }, [competitionId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (highlights.length < 2) return;
    const t = setInterval(() => setHlIdx(i => (i + 1) % highlights.length), 4000);
    return () => clearInterval(t);
  }, [highlights]);

  const isMatchHidden = (match: Match, completed: Match[]): boolean => {
    if (match.status !== 'complete') return false;
    if (isCreator || compClosed) return false;
    if (!competition || competition.results_hidden_count === 0) return false;
    const sorted = [...completed].sort((a, b) => a.match_number - b.match_number);
    const hiddenSet = new Set(sorted.slice(Math.max(0, sorted.length - competition.results_hidden_count)).map(m => m.id));
    return hiddenSet.has(match.id);
  };

  const closeComp = () => {
    if (!competition) return;
    Alert.alert('Close competition?',
      'This will reveal all hidden results and move it to History.',
      [{ text: 'Cancel', style: 'cancel' }, {
        text: 'Close & reveal', style: 'destructive',
        onPress: async () => {
          await supabase.from('competitions').update({ status: 'history' }).eq('id', competition.id);
          router.replace('/(tabs)/history');
        },
      }]);
  };

  // ── Loading / empty states ─────────────────────────────────

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
    </SafeAreaView>
  );

  if (!competition) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🏆</Text>
        <Text style={styles.emptyTitle}>No active competition</Text>
        <Text style={styles.emptySubtitle}>Create a competition to see the live leaderboard.</Text>
      </View>
    </SafeAreaView>
  );

  if (competition.hide_leaderboard && !isCreator) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.locked}>
        <Ionicons name="lock-closed" size={44} color={COLORS.textMuted} />
        <Text style={styles.lockedTitle}>Leaderboard hidden</Text>
        <Text style={styles.lockedSub}>The organiser will reveal results when the competition closes.</Text>
      </View>
    </SafeAreaView>
  );

  // ── Group matches by session_date + session ────────────────
  const completed = matches.filter(m => m.status === 'complete');
  type Session = { key: string; label: string; matches: Match[] };
  const sessionMap = new Map<string, Session>();
  for (const m of matches) {
    const key = `${m.session_date ?? 'tbd'}_${m.session ?? ''}`;
    if (!sessionMap.has(key)) {
      const dateLabel = m.session_date
        ? new Date(m.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
        : 'Unscheduled';
      const sesLabel = SESSION_LABELS[m.session ?? ''] ?? (m.session ?? '');
      sessionMap.set(key, { key, label: `${dateLabel}${sesLabel ? `  ·  ${sesLabel}` : ''}`, matches: [] });
    }
    sessionMap.get(key)!.matches.push(m);
  }
  const sessions = [...sessionMap.values()];

  const totalA = completed.reduce((s, m) => s + (m.points_a ?? 0), 0);
  const totalB = completed.reduce((s, m) => s + (m.points_b ?? 0), 0);
  const hl = highlights[hlIdx];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.accent} />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Team Score Header ── */}
        <View style={styles.scoreHeader}>
          <View style={[styles.teamBlock, { backgroundColor: competition.team_a_colour + '12', borderColor: competition.team_a_colour + '50' }]}>
            <Text style={[styles.teamName, { color: competition.team_a_colour }]}>{competition.team_a_name.toUpperCase()}</Text>
            <Text style={[styles.teamPoints, { color: competition.team_a_colour }]}>{totalA}</Text>
          </View>
          <View style={styles.scoreCenter}>
            <Text style={styles.scoreSeparator}>—</Text>
            <Text style={styles.scoreSubtitle}>{completed.length} of {matches.length} done</Text>
          </View>
          <View style={[styles.teamBlock, styles.teamBlockRight, { backgroundColor: competition.team_b_colour + '12', borderColor: competition.team_b_colour + '50' }]}>
            <Text style={[styles.teamName, { color: competition.team_b_colour }]}>{competition.team_b_name.toUpperCase()}</Text>
            <Text style={[styles.teamPoints, { color: competition.team_b_colour }]}>{totalB}</Text>
          </View>
        </View>

        {/* ── Highlights ticker ── */}
        {hl && (
          <View style={styles.hlBanner}>
            <Text style={styles.hlEmoji}>{HIGHLIGHT_EMOJI[hl.event_type] ?? '⭐'}</Text>
            <Text style={styles.hlText} numberOfLines={1}>
              <Text style={{ fontWeight: '800', color: hl.team === 'A' ? competition.team_a_colour : competition.team_b_colour }}>
                {hl.player_name}
              </Text>
              {'  '}
              <Text style={{ fontWeight: '600', color: COLORS.text }}>
                {hl.event_type.replace('_', ' ')}
              </Text>
              {'  ·  Hole '}{hl.hole_number}
            </Text>
            <View style={styles.hlDots}>
              {highlights.map((_, i) => (
                <View key={i} style={[styles.hlDot, i === hlIdx && styles.hlDotActive]} />
              ))}
            </View>
          </View>
        )}

        {/* ── Sessions ── */}
        {sessions.map(session => (
          <View key={session.key}>
            <Text style={styles.sessionLabel}>{session.label.toUpperCase()}</Text>
            {session.matches.map(m => (
              <MatchRow
                key={m.id}
                match={m}
                comp={competition}
                hidden={isMatchHidden(m, completed)}
              />
            ))}
          </View>
        ))}

        {/* ── Creator controls ── */}
        {isCreator && !compClosed && (
          <TouchableOpacity style={styles.closeBtn} onPress={closeComp} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>Close Competition & Reveal Results</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll:    { padding: SPACING.md, gap: SPACING.sm },

  // Score header
  scoreHeader: {
    flexDirection: 'row', alignItems: 'stretch',
    gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  teamBlock: {
    flex: 1, borderWidth: 1.5, borderRadius: RADIUS.lg,
    padding: SPACING.md, alignItems: 'center',
    ...SHADOW.card,
  },
  teamBlockRight: {},
  teamName:   { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  teamPoints: { fontSize: 44, fontWeight: '800', lineHeight: 52 },
  scoreCenter: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  scoreSeparator: { fontSize: 24, fontWeight: '300', color: COLORS.border },
  scoreSubtitle:  { fontSize: 10, color: COLORS.textMuted, marginTop: 4 },

  // Highlights
  hlBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  hlEmoji: { fontSize: 18 },
  hlText:  { flex: 1, fontSize: 13, fontWeight: '500', color: COLORS.white },
  hlDots:  { flexDirection: 'row', gap: 4 },
  hlDot:   { width: 5, height: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.white + '60' },
  hlDotActive: { backgroundColor: COLORS.white },

  // Session
  sessionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    color: COLORS.textMuted,
    marginTop: SPACING.md, marginBottom: SPACING.xs,
    marginLeft: 4,
  },

  // Match card
  matchCard: {
    flexDirection: 'row', borderWidth: 1,
    borderRadius: RADIUS.lg, overflow: 'hidden',
    marginBottom: SPACING.sm,
    ...SHADOW.card,
  },
  matchAccentBar:  { width: 4 },
  matchContent:    { flex: 1, padding: SPACING.md, gap: 8 },
  matchTopRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  matchTopLeft:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  matchFormat:     { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.5 },

  liveBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.accentLight, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot:       { width: 6, height: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.accent },
  liveBadgeText: { fontSize: 9, fontWeight: '800', color: COLORS.accent, letterSpacing: 1 },

  ptsBadge:     { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3 },
  ptsBadgeText: { fontSize: 11, fontWeight: '700' },

  matchPlayersRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  matchTeamSide:   { flex: 1 },
  matchTeamRight:  { alignItems: 'flex-end' },
  matchTeamLabel:  { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  matchPlayerNames:{ fontSize: 13, fontWeight: '600', color: COLORS.text },
  matchVs:         { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },

  matchStatusRow: { flexDirection: 'row', alignItems: 'center' },
  matchStatusText:{ fontSize: 13, fontWeight: '700' },
  hiddenPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceHigh, borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  hiddenText: { fontSize: 11, color: COLORS.textMuted },

  // Close button
  closeBtn: {
    marginTop: SPACING.lg,
    borderWidth: 1.5, borderColor: COLORS.dangerBorder,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.md,
    alignItems: 'center', backgroundColor: COLORS.dangerLight,
  },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.danger },

  // Empty / locked states
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  locked:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  lockedTitle:{ fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.sm },
  lockedSub:  { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
});
