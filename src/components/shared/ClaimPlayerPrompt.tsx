/**
 * ClaimPlayerPrompt
 *
 * Shown after sign-in if there are unclaimed ghost players matching
 * the user's email (looked up by name match heuristic or explicit invite).
 *
 * Usage: mount in the (tabs) layout; it auto-checks and shows a
 * bottom sheet if any claimable players are found.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

interface GhostPlayer {
  id: string;
  name: string;
  handicap_index: number | null;
  competition_name?: string;
}

export default function ClaimPlayerPrompt() {
  const { user } = useAuth();
  const [players, setPlayers]   = useState<GhostPlayer[]>([]);
  const [visible, setVisible]   = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimed, setClaimed]   = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) checkForGhostPlayers();
  }, [user]);

  const checkForGhostPlayers = async () => {
    // Find players with no user_id in competitions the user has access to
    // Heuristic: match by display_name from user_profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', user!.id)
      .single();

    if (!profile?.display_name) return;

    const { data } = await supabase
      .from('players')
      .select('id, name, handicap_index, competitions(name)')
      .is('user_id', null)
      .ilike('name', `%${profile.display_name.split(' ')[0]}%`)
      .limit(5);

    if (data && data.length > 0) {
      const mapped: GhostPlayer[] = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        handicap_index: p.handicap_index,
        competition_name: p.competitions?.name,
      }));
      setPlayers(mapped);
      setVisible(true);
    }
  };

  const handleClaim = async (playerId: string) => {
    setClaiming(playerId);
    const { data } = await supabase.rpc('claim_ghost_player', { p_player_id: playerId });
    setClaiming(null);
    if (data?.success) {
      setClaimed(prev => new Set([...prev, playerId]));
    }
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  const allClaimed = players.every(p => claimed.has(p.id));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Is this you?</Text>
            <Text style={styles.subtitle}>
              We found player profiles that might be yours from previous competitions.
              Claim them to link your history.
            </Text>
          </View>

          {allClaimed ? (
            <View style={styles.successBlock}>
              <Ionicons name="checkmark-circle" size={48} color={COLORS.accent} />
              <Text style={styles.successText}>All claimed! Your stats are now linked.</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={handleDismiss}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={players}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const isClaimed = claimed.has(item.id);
                const isClaiming = claiming === item.id;
                return (
                  <View style={[styles.playerRow, isClaimed && styles.playerRowClaimed]}>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>{item.name}</Text>
                      <Text style={styles.playerMeta}>
                        {item.competition_name ?? 'Competition'}
                        {item.handicap_index != null ? `  ·  HCP ${item.handicap_index}` : ''}
                      </Text>
                    </View>
                    {isClaimed ? (
                      <View style={styles.claimedBadge}>
                        <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                        <Text style={styles.claimedText}>Claimed</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.claimBtn}
                        onPress={() => handleClaim(item.id)}
                        disabled={!!claiming}
                      >
                        {isClaiming
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={styles.claimBtnText}>That's me</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
              ListFooterComponent={
                <TouchableOpacity style={styles.notMeBtn} onPress={handleDismiss}>
                  <Text style={styles.notMeText}>None of these are me</Text>
                </TouchableOpacity>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.lg * 1.5,
    borderTopRightRadius: RADIUS.lg * 1.5,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1, borderColor: COLORS.border,
    gap: SPACING.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: SPACING.sm,
  },
  header: { gap: 6 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },

  playerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.sm, gap: SPACING.sm,
  },
  playerRowClaimed: { borderColor: COLORS.accent + '55', backgroundColor: COLORS.accentDim },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  playerMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  claimBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    minWidth: 90, alignItems: 'center',
  },
  claimBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  claimedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  claimedText: { fontSize: 13, fontWeight: '700', color: COLORS.accent },

  successBlock: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg },
  successText: { fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  doneBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
  },
  doneBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  notMeBtn: { alignItems: 'center', paddingVertical: SPACING.md },
  notMeText: { color: COLORS.textSecondary, fontSize: 14 },
});
