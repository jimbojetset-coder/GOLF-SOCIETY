/**
 * Competition History Detail Screen
 * /competition/[id]/history
 *
 * Shows:
 * - Final scoreboard (team points, winner)
 * - Every match result with format, players, score
 * - Per-player stats: gross, net, stableford, highlights
 * - WHS handicap adjustment suggestions (flagged if < 20 rounds)
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/api/supabase';
import { COLORS, SPACING, RADIUS } from '../../../src/constants/theme';
import { parseStoredResult } from '../../../src/utils/matchStatus';

const FORMAT_LABEL: Record<string, string> = {
  fourball: 'Fourball',
  foursomes: 'Foursomes',
  singles: 'Singles',
  scramble: 'Scramble',
};

const HIGHLIGHT_EMOJI: Record<string, string> = {
  hole_in_one: '🕳️',
  albatross: '🌟',
  eagle: '🦅',
  birdie: '🐦',
};

export default function CompetitionHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [competition, setCompetition] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [playerStats, setPlayerStats] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    setLoading(true);

    // Competition
    const { data: comp } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', id)
      .single();
    setCompetition(comp);

    // Matches + players
    const { data: matchData } = await supabase
      .from('matches')
      .select('*, match_players(team, players(id, name, handicap_index))')
      .eq('competition_id', id)
      .order('match_number');
    setMatches(matchData ?? []);

    // Round results (player stats)
    const { data: roundData } = await supabase
      .from('round_results')
      .select('*, players(name, handicap_index)')
      .eq('competition_id', id)
      .order('stableford_points', { ascending: false });
    setPlayerStats(roundData ?? []);

    // Highlights
    const { data: hlData } = await supabase
      .from('highlight_events')
      .select('*, players(name)')
      .eq('competition_id', id)
      .order('timestamp');
    setHighlights(hlData ?? []);

    setLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!competition) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Competition not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const aWon = competition.team_a_points > competition.team_b_points;
  const bWon = competition.team_b_points > competition.team_a_points;
  const tied = competition.team_a_points === competition.team_b_points;

  const winnerName = aWon ? competition.team_a_name
    : bWon ? competition.team_b_name
    : null;
  const winnerColour = aWon ? competition.team_a_colour
    : bWon ? competition.team_b_colour
    : COLORS.textSecondary;

  const totalMatches = matches.length;
  const completedMatches = matches.filter(m => m.status === 'complete');

  // Group player stats by team
  const statsA = playerStats.filter(r => {
    const mp = matches.flatMap((m: any) => m.match_players ?? []);
    const entry = mp.find((p: any) => p.players?.id === r.player_id);
    return entry?.team === 'A';
  });
  const statsB = playerStats.filter(r => {
    const mp = matches.flatMap((m: any) => m.match_players ?? []);
    const entry = mp.find((p: any) => p.players?.id === r.player_id);
    return entry?.team === 'B';
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{competition.name}</Text>
          <Text style={styles.headerDate}>
            {competition.event_date
              ? new Date(competition.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : ''}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Final Scoreboard ── */}
        <View style={styles.finalBoard}>
          {/* Winner banner */}
          {!tied && winnerName && (
            <View style={[styles.winnerBanner, { borderColor: winnerColour + '55', backgroundColor: winnerColour + '15' }]}>
              <Text style={styles.winnerEmoji}>🏆</Text>
              <Text style={[styles.winnerText, { color: winnerColour }]}>
                {winnerName} win!
              </Text>
            </View>
          )}
          {tied && (
            <View style={styles.tiedBanner}>
              <Text style={styles.winnerEmoji}>🤝</Text>
              <Text style={styles.tiedText}>It's a tie!</Text>
            </View>
          )}

          {/* Score row */}
          <View style={styles.scoreRow}>
            <View style={styles.scoreTeam}>
              <Text style={[styles.scoreTeamName, { color: competition.team_a_colour }]}>
                {competition.team_a_name}
              </Text>
              <Text style={[styles.scorePoints, { color: competition.team_a_colour }, aWon && styles.scorePointsWinner]}>
                {competition.team_a_points % 1 === 0 ? competition.team_a_points : competition.team_a_points.toFixed(1)}
              </Text>
            </View>
            <View style={styles.scoreDivider}>
              <Text style={styles.scoreDividerText}>–</Text>
              <Text style={styles.scoreMatches}>{totalMatches} matches</Text>
            </View>
            <View style={[styles.scoreTeam, { alignItems: 'flex-end' }]}>
              <Text style={[styles.scoreTeamName, { color: competition.team_b_colour }]}>
                {competition.team_b_name}
              </Text>
              <Text style={[styles.scorePoints, { color: competition.team_b_colour }, bWon && styles.scorePointsWinner]}>
                {competition.team_b_points % 1 === 0 ? competition.team_b_points : competition.team_b_points.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Match Results ── */}
        <Text style={styles.sectionLabel}>MATCH RESULTS</Text>
        {completedMatches.map((match: any) => {
          const status = parseStoredResult(
            match.result ?? '',
            competition.team_a_name,
            competition.team_b_name,
          );
          const winColour = status.leader === 'A' ? competition.team_a_colour
            : status.leader === 'B' ? competition.team_b_colour
            : COLORS.textSecondary;
          const players = (match.match_players ?? []).map((mp: any) => ({
            name: mp.players?.name ?? '—',
            team: mp.team,
          }));
          const playersA = players.filter((p: any) => p.team === 'A').map((p: any) => p.name);
          const playersB = players.filter((p: any) => p.team === 'B').map((p: any) => p.name);

          return (
            <View key={match.id} style={styles.matchCard}>
              <View style={styles.matchCardHeader}>
                <Text style={styles.matchFormat}>{FORMAT_LABEL[match.format] ?? match.format}</Text>
                {match.session && <Text style={styles.matchSession}>{match.session}</Text>}
              </View>
              <View style={styles.matchTeamsRow}>
                <View style={styles.matchTeamBlock}>
                  {playersA.map((n: string, i: number) => (
                    <Text key={i} style={[styles.matchPlayerName, { color: competition.team_a_colour }]}>{n}</Text>
                  ))}
                </View>
                <View style={styles.matchResultCenter}>
                  {status.leader && (
                    <Text style={[styles.matchResultTeam, { color: winColour }]}>
                      {status.leader === 'A' ? competition.team_a_name.slice(0, 3).toUpperCase() : competition.team_b_name.slice(0, 3).toUpperCase()}
                    </Text>
                  )}
                  <Text style={[styles.matchResultLabel, { color: status.leader ? winColour : COLORS.textSecondary }]}>
                    {status.label}
                  </Text>
                  <View style={styles.matchPtsRow}>
                    <Text style={[styles.matchPts, { color: competition.team_a_colour }]}>
                      {match.points_a % 1 === 0 ? match.points_a : match.points_a?.toFixed(1)}
                    </Text>
                    <Text style={styles.matchPtsDash}>–</Text>
                    <Text style={[styles.matchPts, { color: competition.team_b_colour }]}>
                      {match.points_b % 1 === 0 ? match.points_b : match.points_b?.toFixed(1)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.matchTeamBlock, { alignItems: 'flex-end' }]}>
                  {playersB.map((n: string, i: number) => (
                    <Text key={i} style={[styles.matchPlayerName, { color: competition.team_b_colour }]}>{n}</Text>
                  ))}
                </View>
              </View>
            </View>
          );
        })}

        {/* ── Player Stats ── */}
        {playerStats.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>PLAYER STATS</Text>
            {[
              { label: competition.team_a_name, colour: competition.team_a_colour, stats: statsA },
              { label: competition.team_b_name, colour: competition.team_b_colour, stats: statsB },
            ].map(({ label, colour, stats }) => stats.length > 0 && (
              <View key={label} style={styles.statsTeamBlock}>
                <Text style={[styles.statsTeamHeader, { color: colour }]}>{label}</Text>
                {stats.map((r: any) => (
                  <View key={r.id} style={styles.statRow}>
                    <View style={styles.statRowLeft}>
                      <Text style={styles.statPlayerName}>{r.players?.name ?? '—'}</Text>
                      {r.handicap_adjustment_note && (
                        <Text style={styles.statNote}>⚠️ {r.handicap_adjustment_note}</Text>
                      )}
                    </View>
                    <View style={styles.statValues}>
                      <View style={styles.statBadge}>
                        <Text style={styles.statBadgeLabel}>Gross</Text>
                        <Text style={styles.statBadgeValue}>{r.gross_score ?? '—'}</Text>
                      </View>
                      <View style={styles.statBadge}>
                        <Text style={styles.statBadgeLabel}>Net</Text>
                        <Text style={styles.statBadgeValue}>{r.net_score ?? '—'}</Text>
                      </View>
                      <View style={[styles.statBadge, styles.statBadgeAccent]}>
                        <Text style={styles.statBadgeLabel}>Stbl</Text>
                        <Text style={[styles.statBadgeValue, { color: COLORS.accent }]}>{r.stableford_points ?? '—'}</Text>
                      </View>
                      {r.handicap_suggested != null && (
                        <View style={styles.statBadgeHcap}>
                          <Text style={styles.statBadgeLabel}>New HCP</Text>
                          <Text style={[styles.statBadgeValue, { color: COLORS.warning }]}>
                            {r.handicap_suggested}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {/* ── Highlights ── */}
        {highlights.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>HIGHLIGHTS</Text>
            <View style={styles.highlightsList}>
              {highlights.map((h: any) => {
                const team = matches.flatMap((m: any) => m.match_players ?? [])
                  .find((mp: any) => mp.players?.id === h.player_id)?.team;
                const colour = team === 'A' ? competition.team_a_colour : competition.team_b_colour;
                return (
                  <View key={h.id} style={styles.highlightRow}>
                    <Text style={styles.highlightEmoji}>{HIGHLIGHT_EMOJI[h.event_type] ?? '⭐'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightDesc}>
                        <Text style={[styles.highlightName, { color: colour }]}>{h.players?.name}</Text>
                        {' — '}{h.event_type.replace('_', ' ')} on hole {h.hole_number}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Notes */}
        {competition.notes && (
          <>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <Text style={styles.notesText}>{competition.notes}</Text>
          </>
        )}

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, paddingTop: SPACING.lg, gap: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  scroll: { padding: SPACING.md, gap: SPACING.sm },

  // Final board
  finalBoard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  winnerBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: RADIUS.md, borderWidth: 1,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  winnerEmoji: { fontSize: 22 },
  winnerText: { fontSize: 20, fontWeight: '900' },
  tiedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surfaceHigh,
  },
  tiedText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  scoreRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreTeam: { flex: 1 },
  scoreTeamName: { fontSize: 13, fontWeight: '700' },
  scorePoints: { fontSize: 52, fontWeight: '900', lineHeight: 58 },
  scorePointsWinner: { textShadowColor: 'rgba(255,255,255,0.1)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  scoreDivider: { width: 48, alignItems: 'center' },
  scoreDividerText: { fontSize: 28, color: COLORS.textMuted, fontWeight: '300' },
  scoreMatches: { fontSize: 10, color: COLORS.textMuted },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 1.5, marginTop: SPACING.md, marginBottom: 4,
  },

  // Match cards
  matchCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
    gap: SPACING.sm,
  },
  matchCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchFormat: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  matchSession: { fontSize: 12, color: COLORS.textMuted },
  matchTeamsRow: { flexDirection: 'row', alignItems: 'center' },
  matchTeamBlock: { flex: 1, gap: 2 },
  matchPlayerName: { fontSize: 13, fontWeight: '600' },
  matchResultCenter: { width: 80, alignItems: 'center', gap: 1 },
  matchResultTeam: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  matchResultLabel: { fontSize: 17, fontWeight: '900' },
  matchPtsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchPts: { fontSize: 12, fontWeight: '700' },
  matchPtsDash: { fontSize: 11, color: COLORS.textMuted },

  // Player stats
  statsTeamBlock: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', marginBottom: SPACING.sm,
  },
  statsTeamHeader: {
    fontSize: 12, fontWeight: '800', letterSpacing: 1,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  statRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border + '55',
    gap: SPACING.sm,
  },
  statRowLeft: { flex: 1 },
  statPlayerName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  statNote: { fontSize: 10, color: COLORS.warning, marginTop: 2 },
  statValues: { flexDirection: 'row', gap: 6 },
  statBadge: {
    alignItems: 'center', backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4,
    minWidth: 44,
  },
  statBadgeAccent: { borderWidth: 1, borderColor: COLORS.accent + '44' },
  statBadgeHcap: {
    alignItems: 'center', backgroundColor: COLORS.warning + '15',
    borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.warning + '33', minWidth: 52,
  },
  statBadgeLabel: { fontSize: 8, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  statBadgeValue: { fontSize: 16, fontWeight: '900', color: COLORS.text },

  // Highlights
  highlightsList: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  highlightRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border + '44',
  },
  highlightEmoji: { fontSize: 20 },
  highlightDesc: { fontSize: 13, color: COLORS.text },
  highlightName: { fontWeight: '800' },

  // Notes
  notesText: {
    fontSize: 14, color: COLORS.textSecondary, lineHeight: 22,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },

  // Empty
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
});
