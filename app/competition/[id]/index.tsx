/**
 * Competition Detail Screen — /competition/[id]
 *
 * Shows: header, live score, match list grouped by session,
 * share button, organiser controls (close / edit).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
  RefreshControl, Alert, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/api/supabase';
import { Share } from 'react-native';
import { useAuth } from '../../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS, SHADOW, FORMAT_LABELS } from '../../../src/constants/theme';
import ShareCompetitionButton from '../../../src/components/shared/ShareCompetitionButton';
import { parseStoredResult } from '../../../src/utils/matchStatus';

const SESSION_LABELS: Record<string, string> = {
  morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
};

export default function CompetitionDetailScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const router    = useRouter();
  const { user }  = useAuth();

  const [competition, setCompetition] = useState<any>(null);
  const [matches,     setMatches]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const isCreator  = competition?.created_by_user_id === user?.id;
  const compClosed = competition?.status === 'history' || competition?.status === 'closed';

  const load = useCallback(async (isRefresh = false) => {
    if (!id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);

    const { data: comp } = await supabase
      .from('competitions').select('*').eq('id', id).single();
    setCompetition(comp);

    const { data: matchData } = await supabase
      .from('matches')
      .select('*, match_players(team, players(id, name))')
      .eq('competition_id', id)
      .order('session_date', { ascending: true })
      .order('match_number', { ascending: true });
    setMatches(matchData ?? []);

    setLoading(false); setRefreshing(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);


  const shareScorerLink = async (match: any) => {
    if (!match.scorer_share_token) return;
    const url = `golfscoring://scoring/join/${match.scorer_share_token}`;
    const format = FORMAT_LABELS[match.format] ?? match.format;
    const session = match.session ? ` (${match.session})` : '';
    try {
      await Share.share({
        message: `You've been nominated as scorer for Match ${match.match_number} — ${format}${session} in ${competition.name}.\n\nOpen the scoring screen: ${url}`,
        title: `Score Match ${match.match_number}`,
      });
    } catch (_) {}
  };

  const closeCompetition = () => {
    Alert.alert(
      'Close competition?',
      'This will reveal all hidden results and move it to History.',
      [{ text: 'Cancel', style: 'cancel' }, {
        text: 'Close & reveal', style: 'destructive',
        onPress: async () => {
          await supabase.from('competitions').update({ status: 'history' }).eq('id', id);
          router.replace(`/competition/${id}/history`);
        },
      }]
    );
  };

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
    </SafeAreaView>
  );

  if (!competition) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Competition not found</Text>
      </View>
    </SafeAreaView>
  );

  const totalA = matches.filter(m => m.status === 'complete').reduce((s: number, m: any) => s + (m.points_a ?? 0), 0);
  const totalB = matches.filter(m => m.status === 'complete').reduce((s: number, m: any) => s + (m.points_b ?? 0), 0);
  const completed = matches.filter(m => m.status === 'complete').length;

  // Group by session_date + session
  type SessionGroup = { key: string; label: string; matches: any[] };
  const sessionMap = new Map<string, SessionGroup>();
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* ── Header bar ── */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{competition.name}</Text>
        {isCreator && competition.share_token && (
          <ShareCompetitionButton
            competitionName={competition.name}
            shareToken={competition.share_token}
            compact
          />
        )}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.accent} />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Score card ── */}
        <View style={styles.scoreCard}>
          <View style={[styles.teamBlock, { borderColor: competition.team_a_colour + '50', backgroundColor: competition.team_a_colour + '10' }]}>
            <Text style={[styles.teamName, { color: competition.team_a_colour }]}>{competition.team_a_name}</Text>
            <Text style={[styles.teamPoints, { color: competition.team_a_colour }]}>{totalA}</Text>
          </View>
          <View style={styles.scoreCenter}>
            <Text style={styles.scoreDash}>—</Text>
            <Text style={styles.scoreProgress}>{completed}/{matches.length}</Text>
          </View>
          <View style={[styles.teamBlock, styles.teamBlockRight, { borderColor: competition.team_b_colour + '50', backgroundColor: competition.team_b_colour + '10' }]}>
            <Text style={[styles.teamName, { color: competition.team_b_colour }]}>{competition.team_b_name}</Text>
            <Text style={[styles.teamPoints, { color: competition.team_b_colour }]}>{totalB}</Text>
          </View>
        </View>

        {/* Status pill */}
        <View style={styles.statusRow}>
          {competition.status === 'active' && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>LIVE</Text>
            </View>
          )}
          {compClosed && (
            <View style={styles.closedPill}>
              <Text style={styles.closedPillText}>CLOSED</Text>
            </View>
          )}
          {competition.start_date && (
            <Text style={styles.dateLabel}>
              {new Date(competition.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {competition.end_date && competition.end_date !== competition.start_date
                ? ` – ${new Date(competition.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                : ''}
            </Text>
          )}
        </View>

        {/* ── Match list by session ── */}
        {sessions.map(session => (
          <View key={session.key}>
            <Text style={styles.sessionLabel}>{session.label.toUpperCase()}</Text>
            {session.matches.map((match: any) => {
              const isLive     = match.status === 'in_progress';
              const isComplete = match.status === 'complete';
              const playersA   = (match.match_players ?? []).filter((mp: any) => mp.team === 'A').map((mp: any) => mp.players?.name ?? '—');
              const playersB   = (match.match_players ?? []).filter((mp: any) => mp.team === 'B').map((mp: any) => mp.players?.name ?? '—');
              const statusInfo = isComplete ? parseStoredResult(match.result, competition.team_a_name, competition.team_b_name) : null;
              const accentCol  = isLive ? COLORS.accent : isComplete ? (match.winning_team === 'A' ? competition.team_a_colour : match.winning_team === 'B' ? competition.team_b_colour : COLORS.textMuted) : COLORS.border;

              return (
                <View key={match.id} style={[styles.matchCard, { borderLeftColor: accentCol }]}>
                  {/* Top */}
                  <View style={styles.matchTop}>
                    <Text style={styles.matchFormat}>{FORMAT_LABELS[match.format] ?? match.format}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isLive && (
                        <View style={styles.liveBadge}>
                          <View style={styles.liveBadgeDot} />
                          <Text style={styles.liveBadgeText}>LIVE</Text>
                        </View>
                      )}
                      {isComplete && (
                        <Text style={[styles.resultText, { color: accentCol }]}>
                          {statusInfo ?? 'Complete'}
                        </Text>
                      )}
                      {match.status === 'pending' && (
                        <Text style={styles.pendingText}>Not started</Text>
                      )}
                    </View>
                  </View>

                  {/* Players */}
                  <View style={styles.matchPlayers}>
                    <View style={styles.matchTeam}>
                      <Text style={[styles.matchTeamLabel, { color: competition.team_a_colour }]}>
                        {competition.team_a_name.toUpperCase()}
                      </Text>
                      <Text style={styles.matchPlayerNames} numberOfLines={1}>
                        {playersA.join(' / ') || '—'}
                      </Text>
                    </View>
                    <Text style={styles.matchVs}>vs</Text>
                    <View style={[styles.matchTeam, { alignItems: 'flex-end' }]}>
                      <Text style={[styles.matchTeamLabel, { color: competition.team_b_colour }]}>
                        {competition.team_b_name.toUpperCase()}
                      </Text>
                      <Text style={[styles.matchPlayerNames, { textAlign: 'right' }]} numberOfLines={1}>
                        {playersB.join(' / ') || '—'}
                      </Text>
                    </View>
                  </View>

                  {/* Scorer share — creator only, pending or in_progress */}
                  {isCreator && !isComplete && match.scorer_share_token && (
                    <TouchableOpacity
                      style={styles.scorerShareBtn}
                      onPress={() => shareScorerLink(match)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="share-outline" size={14} color={COLORS.accent} />
                      <Text style={styles.scorerShareText}>
                        {match.scorer_user_id ? 'Scorer assigned · Share again' : 'Share scorer link'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* ── Organiser controls ── */}
        {isCreator && (
          <View style={styles.orgControls}>
            {competition.status === 'active' && (
              <TouchableOpacity style={styles.closeBtn} onPress={closeCompetition} activeOpacity={0.85}>
                <Text style={styles.closeBtnText}>Close Competition & Reveal Results</Text>
              </TouchableOpacity>
            )}
            {compClosed && (
              <TouchableOpacity
                style={styles.historyBtn}
                onPress={() => router.push(`/competition/${id}/history`)}
                activeOpacity={0.85}
              >
                <Ionicons name="stats-chart-outline" size={18} color={COLORS.accent} />
                <Text style={styles.historyBtnText}>View Full Stats & Results</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {!isCreator && compClosed && (
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => router.push(`/competition/${id}/history`)}
            activeOpacity={0.85}
          >
            <Ionicons name="stats-chart-outline" size={18} color={COLORS.accent} />
            <Text style={styles.historyBtnText}>View Full Stats & Results</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
          </TouchableOpacity>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  navBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.md,
    gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },

  scroll: { padding: SPACING.md, gap: SPACING.sm },

  // Score card
  scoreCard: {
    flexDirection: 'row', alignItems: 'stretch', gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  teamBlock: {
    flex: 1, borderWidth: 1.5, borderRadius: RADIUS.lg,
    padding: SPACING.md, alignItems: 'center',
    ...SHADOW.card,
  },
  teamBlockRight: {},
  teamName:   { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  teamPoints: { fontSize: 48, fontWeight: '800', lineHeight: 56 },
  scoreCenter:   { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  scoreDash:     { fontSize: 22, color: COLORS.border, fontWeight: '300' },
  scoreProgress: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },

  // Status row
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.accentLight, borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  liveDot:      { width: 6, height: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.accent },
  livePillText: { fontSize: 10, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.5 },
  closedPill: {
    backgroundColor: COLORS.surfaceHigh, borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  closedPillText: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  dateLabel:      { fontSize: 12, color: COLORS.textMuted },

  // Sessions
  sessionLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5,
    marginTop: SPACING.md, marginBottom: SPACING.xs, marginLeft: 2,
  },

  // Match cards
  matchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 4,
    padding: SPACING.md, gap: SPACING.sm,
    marginBottom: SPACING.sm,
    ...SHADOW.card,
  },
  matchTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchFormat:    { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.3 },
  resultText:     { fontSize: 13, fontWeight: '800' },
  pendingText:    { fontSize: 11, color: COLORS.textMuted },
  liveBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.accentLight, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  liveBadgeDot:   { width: 5, height: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.accent },
  liveBadgeText:  { fontSize: 9, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.5 },

  matchPlayers:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  matchTeam:        { flex: 1 },
  matchTeamLabel:   { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  matchPlayerNames: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  matchVs:          { fontSize: 11, color: COLORS.textMuted },

  // Organiser controls
  orgControls: { marginTop: SPACING.md, gap: SPACING.sm },
  closeBtn: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1, borderColor: COLORS.dangerBorder,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.danger },
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1, borderColor: COLORS.accentBorder,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    marginTop: SPACING.md,
    ...SHADOW.card,
  },
  historyBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.accent },

  // Empty
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
});
