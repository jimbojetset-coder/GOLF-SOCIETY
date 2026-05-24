import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/api/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS, FORMAT_LABELS } from '../../src/constants/theme';

export default function ScoringTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [assignedMatches, setAssignedMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchMatches(); }, [user]);

  const fetchMatches = async () => {
    // Matches where user is assigned as scorer
    const { data } = await supabase
      .from('matches')
      .select('*, competitions(name, team_a_name, team_a_colour, team_b_name, team_b_colour)')
      .eq('scorer_user_id', user!.id)
      .neq('status', 'complete')
      .order('match_number');

    if (data) setAssignedMatches(data);
    setLoading(false);
  };

  if (loading) return <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scoring</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {assignedMatches.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🏌️</Text>
            <Text style={styles.emptyTitle}>No matches assigned</Text>
            <Text style={styles.emptySubtitle}>
              When a competition organiser assigns you as scorer for a match, it will appear here.
            </Text>
            <Text style={styles.emptyHint}>
              You can also open a match using a share link from WhatsApp.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>YOUR MATCHES TO SCORE</Text>
            {assignedMatches.map((match) => (
              <TouchableOpacity
                key={match.id}
                style={styles.matchCard}
                onPress={() => router.push(`/scoring/${match.id}`)}
              >
                <View style={styles.matchCardHeader}>
                  <Text style={styles.matchFormat}>{FORMAT_LABELS[match.format]}</Text>
                  <View style={[
                    styles.statusPill,
                    match.status === 'in_progress' ? styles.statusActive : styles.statusPending,
                  ]}>
                    <Text style={[
                      styles.statusPillText,
                      match.status === 'in_progress' ? styles.statusActiveText : styles.statusPendingText,
                    ]}>
                      {match.status === 'in_progress' ? '● LIVE' : 'START'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.competitionName}>{match.competitions?.name}</Text>
                <View style={styles.teamsRow}>
                  <Text style={[styles.teamLabel, { color: match.competitions?.team_a_colour }]}>
                    {match.competitions?.team_a_name}
                  </Text>
                  <Text style={styles.vs}>vs</Text>
                  <Text style={[styles.teamLabel, { color: match.competitions?.team_b_colour }]}>
                    {match.competitions?.team_b_name}
                  </Text>
                </View>
                {match.result && (
                  <Text style={styles.currentResult}>Current: {match.result}</Text>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.md, paddingTop: SPACING.lg },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  content: { padding: SPACING.md, gap: SPACING.md },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1, marginBottom: 4,
  },
  matchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  matchCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.sm,
  },
  matchFormat: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  statusPill: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusActive: { backgroundColor: COLORS.accentDim },
  statusPending: { backgroundColor: COLORS.surfaceHigh },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  statusActiveText: { color: COLORS.accent },
  statusPendingText: { color: COLORS.textSecondary },
  competitionName: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  teamsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamLabel: { fontSize: 15, fontWeight: '700' },
  vs: { fontSize: 12, color: COLORS.textMuted },
  currentResult: { fontSize: 13, color: COLORS.warning, marginTop: SPACING.sm, fontWeight: '600' },
  empty: { paddingTop: 60, alignItems: 'center', gap: SPACING.sm },
  emptyEmoji: { fontSize: 64, marginBottom: SPACING.sm },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 280 },
  emptyHint: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', maxWidth: 280, marginTop: 8 },
});
