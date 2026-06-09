/**
 * Compete Tab — Competition List (Light Theme)
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
import ShareCompetitionButton from '../../src/components/shared/ShareCompetitionButton';

type Competition = {
  id: string; name: string; status: string;
  team_a_name: string; team_a_colour: string; team_a_points: number;
  team_b_name: string; team_b_colour: string; team_b_points: number;
  start_date?: string; event_date?: string;
  share_token?: string; created_by_user_id: string;
  notes?: string;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'LIVE', bg: COLORS.accentLight, text: COLORS.accent },
  closed: { label: 'CLOSED', bg: COLORS.surfaceHigh, text: COLORS.textMuted },
  history: { label: 'HISTORY', bg: COLORS.surfaceHigh, text: COLORS.textMuted },
  upcoming: { label: 'UPCOMING', bg: COLORS.goldLight, text: COLORS.gold },
};

export default function CompetitionTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [active, setActive] = useState<Competition[]>([]);
  const [upcoming, setUpcoming] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const { data } = await supabase
      .from('competitions')
      .select('*')
      .in('status', ['active', 'upcoming'])
      .order('created_at', { ascending: false });

    if (data) {
      setActive(data.filter((c: Competition) => c.status === 'active'));
      setUpcoming(data.filter((c: Competition) => c.status === 'upcoming'));
    }
    setLoading(false);
  };

  const renderCard = ({ item }: { item: Competition }) => {
    const isOwner = item.created_by_user_id === user?.id;
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.active;

    const dateLabel = (item.start_date ?? item.event_date)
      ? parseLocalDate(item.start_date ?? item.event_date!).toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'short' 
        })
      : 'No date';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/competition/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusPillText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Compact 1-line date + teams */}
        <View style={styles.compactInfo}>
          <Text style={styles.dateText}>{dateLabel}</Text>
          <Text style={styles.teamsText}>
            {item.team_a_name} vs {item.team_b_name}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          {isOwner && item.share_token && (
            <ShareCompetitionButton competitionName={item.name} shareToken={item.share_token} />
          )}
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  const allComps = [...active, ...upcoming];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
     
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Competitions</Text>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 48 }} />
      ) : allComps.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>⛳</Text>
          <Text style={styles.emptyTitle}>No active competitions</Text>
          <Text style={styles.emptySubtitle}>Create your first Ryder Cup event</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/competition/new')}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyBtnText}>Create Competition</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={allComps}
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
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.md,
  },
  headerTitle: { fontSize: 30, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },
  list: { padding: SPACING.md, gap: SPACING.sm },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1, 
    borderColor: COLORS.border,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: COLORS.text, 
    flex: 1, 
    marginRight: SPACING.sm 
  },
  statusPill: { 
    borderRadius: RADIUS.full, 
    paddingHorizontal: 10, 
    paddingVertical: 4 
  },
  statusPillText: { 
    fontSize: 10, 
    fontWeight: '800', 
    letterSpacing: 0.5 
  },

  // Compact row
  compactInfo: {
    marginBottom: 12,
  },
  dateText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  teamsText: {
    fontSize: 15,
    color: COLORS.text,
    marginTop: 2,
  },

  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  empty: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: SPACING.xl, 
    gap: SPACING.sm 
  },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.sm },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  emptyBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md, 
    paddingHorizontal: SPACING.xl,
    ...SHADOW.fab,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
