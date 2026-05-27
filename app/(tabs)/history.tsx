/**
 * History Tab — Light Theme
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase, parseLocalDate } from '../../src/api/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';

export default function HistoryTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const { data } = await supabase
      .from('competitions')
      .select('*')
      .in('status', ['closed', 'history'])
      .order('start_date', { ascending: false });
    if (data) setCompetitions(data);
    setLoading(false);
  };

  const renderCard = ({ item }: { item: any }) => {
    const aWon  = item.team_a_points > item.team_b_points;
    const bWon  = item.team_b_points > item.team_a_points;
    const tied  = item.team_a_points === item.team_b_points;
    const winner = aWon ? item.team_a_name : bWon ? item.team_b_name : null;
    const winCol = aWon ? item.team_a_colour : item.team_b_colour;
    const dateStr = (item.start_date ?? item.event_date)
      ? parseLocalDate(item.start_date ?? item.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/competition/${item.id}/history`)}
        activeOpacity={0.85}
      >
        {/* Title row */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          {dateStr && <Text style={styles.cardDate}>{dateStr}</Text>}
        </View>

        {/* Scores */}
        <View style={styles.scoreRow}>
          <View style={styles.teamSide}>
            <Text style={[styles.teamLabel, { color: item.team_a_colour }]}>{item.team_a_name}</Text>
            <Text style={[styles.teamScore, { color: item.team_a_colour }]}>{item.team_a_points}</Text>
          </View>
          <Text style={styles.scoreSep}>—</Text>
          <View style={[styles.teamSide, { alignItems: 'flex-end' }]}>
            <Text style={[styles.teamLabel, { color: item.team_b_colour }]}>{item.team_b_name}</Text>
            <Text style={[styles.teamScore, { color: item.team_b_colour }]}>{item.team_b_points}</Text>
          </View>
        </View>

        {/* Winner banner */}
        {winner && (
          <View style={[styles.winnerBanner, { backgroundColor: COLORS.goldLight, borderColor: COLORS.goldBorder }]}>
            <Text style={styles.winnerEmoji}>🏆</Text>
            <Text style={styles.winnerText}>
              <Text style={{ fontWeight: '800', color: winCol }}>{winner}</Text>
              {' won  '}{item.team_a_points} — {item.team_b_points}
            </Text>
          </View>
        )}
        {tied && (
          <View style={[styles.winnerBanner, { backgroundColor: COLORS.surfaceHigh, borderColor: COLORS.border }]}>
            <Text style={styles.winnerText}>🤝  Match tied</Text>
          </View>
        )}

        {/* View link */}
        <View style={styles.cardFooter}>
          <Text style={styles.viewLink}>View stats</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.accent} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        {competitions.length > 0 && (
          <Text style={styles.headerCount}>{competitions.length} competition{competitions.length !== 1 ? 's' : ''}</Text>
        )}
      </View>
      <View style={styles.divider} />

      {loading ? (
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 48 }} />
      ) : competitions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyTitle}>No past competitions</Text>
          <Text style={styles.emptySubtitle}>Closed competitions will appear here with full stats and handicap updates</Text>
        </View>
      ) : (
        <FlatList
          data={competitions}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.md,
    flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm,
  },
  headerTitle: { fontSize: 30, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  headerCount: { fontSize: 14, color: COLORS.textMuted },
  divider:     { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },

  list: { padding: SPACING.md, gap: SPACING.sm },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, gap: SPACING.sm,
    ...SHADOW.card,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle:  { fontSize: 17, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: SPACING.sm },
  cardDate:   { fontSize: 12, color: COLORS.textMuted },

  scoreRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceHigh, borderRadius: RADIUS.md, padding: SPACING.sm + 2 },
  teamSide:  { flex: 1 },
  teamLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  teamScore: { fontSize: 30, fontWeight: '800', lineHeight: 34 },
  scoreSep:  { fontSize: 20, fontWeight: '300', color: COLORS.border, paddingHorizontal: SPACING.sm },

  winnerBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  winnerEmoji: { fontSize: 16 },
  winnerText:  { fontSize: 13, color: COLORS.text },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewLink:   { fontSize: 13, fontWeight: '600', color: COLORS.accent },

  empty:         { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyEmoji:    { fontSize: 56, marginBottom: SPACING.sm },
  emptyTitle:    { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
});
