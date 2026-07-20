/**
 * Scoring Tab — Light Theme
 *
 * Shows all matches the current user is assigned to score.
 * Also shows a "scan to join via link" nudge for share-token entry.
 * Taps through to /scoring/[matchId].
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/api/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS, SHADOW, FORMAT_LABELS } from '../../src/constants/theme';

interface AssignedMatch {
  id: string;
  match_number: number;
  format: string;
  status: string;
  result: string | null;
  holes_played: number;
  session: string;
  session_date?: string;
  competitions: {
    id: string;
    name: string;
    team_a_name: string; team_a_colour: string;
    team_b_name: string; team_b_colour: string;
  };
}

const SESSION_LABELS: Record<string, string> = {
  morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
};

export default function ScoringTab() {
  const router  = useRouter();
  const { user } = useAuth();
  const [matches,    setMatches]    = useState<AssignedMatch[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);

    const { data } = await supabase
      .from('matches')
      .select('*, competitions(id, name, team_a_name, team_a_colour, team_b_name, team_b_colour)')
      .eq('scorer_user_id', user.id)
      .neq('status', 'complete')
      .order('session_date', { ascending: true })
      .order('match_number', { ascending: true });

    setMatches(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const getStatusConfig = (status: string) => {
    if (status === 'in_progress') return {
      label: 'IN PROGRESS',
      bg: COLORS.accentLight,
      color: COLORS.accent,
      dot: true,
    };
    return {
      label: 'NOT STARTED',
      bg: COLORS.surfaceHigh,
      color: COLORS.textMuted,
      dot: false,
    };
  };

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scoring</Text>
        {matches.length > 0 && (
          <Text style={styles.headerSub}>{matches.length} match{matches.length !== 1 ? 'es' : ''} assigned</Text>
        )}
      </View>
      <View style={styles.divider} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.accent} />}
      >
        {matches.length === 0 ? (
          /* ── Empty state ── */
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🏌️</Text>
            <Text style={styles.emptyTitle}>No matches assigned</Text>
            <Text style={styles.emptySub}>
              When an organiser assigns you as scorer, your matches appear here.
            </Text>

            {/* Join via link nudge */}
            <TouchableOpacity
              style={styles.joinCard}
              onPress={() => router.push('/join/link')}
              activeOpacity={0.85}
            >
              <View style={styles.joinCardLeft}>
                <Ionicons name="link-outline" size={22} color={COLORS.accent} />
                <View>
                  <Text style={styles.joinCardTitle}>Have a share link?</Text>
                  <Text style={styles.joinCardSub}>Tap to enter your access code</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>YOUR MATCHES TO SCORE</Text>

            {matches.map(match => {
              const cfg  = getStatusConfig(match.status);
              const comp = match.competitions;
              const sessionStr = [
                match.session_date
                  ? new Date(match.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                  : null,
                SESSION_LABELS[match.session ?? ''] ?? match.session,
              ].filter(Boolean).join('  ·  ');

              return (
                <TouchableOpacity
                  key={match.id}
                  style={styles.matchCard}
                  onPress={() => router.push(`/scoring/${match.id}`)}
                  activeOpacity={0.85}
                >
                  {/* Left accent bar */}
                  <View style={[styles.accentBar, { backgroundColor: match.status === 'in_progress' ? COLORS.accent : COLORS.border }]} />

                  <View style={styles.matchBody}>
                    {/* Top row */}
                    <View style={styles.matchTopRow}>
                      <Text style={styles.matchFormat}>{FORMAT_LABELS[match.format] ?? match.format}</Text>
                      <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                        {cfg.dot && <View style={styles.statusDot} />}
                        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>

                    {/* Competition name */}
                    <Text style={styles.compName}>{comp?.name}</Text>

                    {/* Teams */}
                    <View style={styles.teamsRow}>
                      <Text style={[styles.teamName, { color: comp?.team_a_colour }]}>
                        {comp?.team_a_name}
                      </Text>
                      <Text style={styles.vs}>vs</Text>
                      <Text style={[styles.teamName, { color: comp?.team_b_colour }]}>
                        {comp?.team_b_name}
                      </Text>
                    </View>

                    {/* Footer */}
                    <View style={styles.matchFooter}>
                      {sessionStr ? <Text style={styles.sessionLabel}>{sessionStr}</Text> : null}
                      {match.status === 'in_progress' && match.holes_played > 0 && (
                        <Text style={styles.holesPlayed}>Thru {match.holes_played}</Text>
                      )}
                      {match.result && (
                        <Text style={[styles.currentResult, { color: COLORS.accent }]}>{match.result}</Text>
                      )}
                      <View style={styles.goArrow}>
                        <Text style={styles.goArrowText}>
                          {match.status === 'in_progress' ? 'Continue' : 'Start'}
                        </Text>
                        <Ionicons name="arrow-forward-circle" size={20} color={COLORS.accent} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Join link nudge at bottom */}
            <TouchableOpacity
              style={styles.joinCardInline}
              onPress={() => router.push('/join/link')}
              activeOpacity={0.85}
            >
              <Ionicons name="link-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.joinCardInlineText}>Join another match via share link</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: { fontSize: 30, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  divider:     { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },

  scroll: { padding: SPACING.md, gap: SPACING.sm },

  sectionLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: COLORS.textMuted,
    marginBottom: SPACING.xs, marginTop: SPACING.xs,
  },

  // Match card
  matchCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  accentBar: { width: 4 },
  matchBody: { flex: 1, padding: SPACING.md, gap: 6 },

  matchTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchFormat: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.3 },

  statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot:   { width: 6, height: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.accent },
  statusText:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  compName:  { fontSize: 16, fontWeight: '700', color: COLORS.text },
  teamsRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  teamName:  { fontSize: 14, fontWeight: '700' },
  vs:        { fontSize: 11, color: COLORS.textMuted },

  matchFooter:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.sm, marginTop: 2 },
  sessionLabel:  { fontSize: 11, color: COLORS.textMuted, flex: 1 },
  holesPlayed:   { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  currentResult: { fontSize: 12, fontWeight: '700' },
  goArrow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  goArrowText:   { fontSize: 13, fontWeight: '700', color: COLORS.accent },

  // Empty state
  empty: { paddingTop: 48, alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.md },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  emptySub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', maxWidth: 280 },

  // Join card (empty state)
  joinCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.accentLight,
    borderWidth: 1.5, borderColor: COLORS.accentBorder,
    borderRadius: RADIUS.xl, padding: SPACING.md,
    marginTop: SPACING.sm, width: '100%',
    ...SHADOW.card,
  },
  joinCardLeft:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  joinCardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.accent },
  joinCardSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Join card inline (bottom of list)
  joinCardInline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: SPACING.md, marginTop: SPACING.sm,
  },
  joinCardInlineText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
});
