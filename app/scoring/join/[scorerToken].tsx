/**
 * /scoring/join/[scorerToken] — Scorer deep link handler
 *
 * When a match organiser shares a scorer link, this screen:
 * 1. Looks up the match by scorer_share_token
 * 2. Auto-joins the competition as a member (if not already)
 * 3. Sets scorer_user_id on the match to the current user
 * 4. Redirects to the live scoring screen
 *
 * Deep link: golfscoring://scoring/join/<scorerToken>
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/api/supabase';
import { useAuth } from '../../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS, SHADOW, FORMAT_LABELS } from '../../../src/constants/theme';

type Status = 'loading' | 'confirm' | 'claiming' | 'success' | 'error' | 'already_claimed';

export default function ScorerJoinScreen() {
  const { scorerToken } = useLocalSearchParams<{ scorerToken: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [status,    setStatus]    = useState<Status>('loading');
  const [match,     setMatch]     = useState<any>(null);
  const [comp,      setComp]      = useState<any>(null);
  const [errorMsg,  setErrorMsg]  = useState('');

  useEffect(() => {
    if (scorerToken && user) lookupMatch();
  }, [scorerToken, user]);

  const lookupMatch = async () => {
    setStatus('loading');

    const { data, error } = await supabase
      .from('matches')
      .select('*, competitions(*)')
      .eq('scorer_share_token', scorerToken)
      .single();

    if (error || !data) {
      setErrorMsg('This scorer link is invalid or has expired.');
      setStatus('error');
      return;
    }

    setMatch(data);
    setComp(data.competitions);

    // Already claimed by someone else?
    if (data.scorer_user_id && data.scorer_user_id !== user?.id) {
      setStatus('already_claimed');
      return;
    }

    // Already claimed by this user — go straight to scoring
    if (data.scorer_user_id === user?.id) {
      router.replace(`/scoring/${data.id}`);
      return;
    }

    // Prompt to confirm
    setStatus('confirm');
  };

  const claimMatch = async () => {
    if (!match || !user || !comp) return;
    setStatus('claiming');

    // 1. Join competition as member (ignore error if already a member)
    await supabase.rpc('join_competition', {
      p_share_token: comp.share_token,
    });

    // 2. Claim the scorer role on this match
    const { error } = await supabase
      .from('matches')
      .update({ scorer_user_id: user.id })
      .eq('id', match.id)
      .eq('scorer_share_token', scorerToken); // safety: only update if token still matches

    if (error) {
      setErrorMsg('Could not claim this match. Try again.');
      setStatus('error');
      return;
    }

    setStatus('success');
    setTimeout(() => {
      router.replace(`/scoring/${match.id}`);
    }, 1200);
  };

  // ── Loading ───────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
          <Text style={styles.hint}>Looking up your match…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ─────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>🔗</Text>
          <Text style={styles.title}>Link not found</Text>
          <Text style={styles.subtitle}>{errorMsg}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)/competition')}>
            <Text style={styles.btnText}>Go to Competitions</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Already claimed by another user ──────────────────────
  if (status === 'already_claimed') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>⛳</Text>
          <Text style={styles.title}>Already claimed</Text>
          <Text style={styles.subtitle}>
            Another scorer has already claimed this match.
            Contact the organiser if this is a mistake.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)/competition')}>
            <Text style={styles.btnText}>Go to Competitions</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success ───────────────────────────────────────────────
  if (status === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>🏌️</Text>
          <Text style={styles.title}>You're the scorer!</Text>
          <Text style={styles.subtitle}>Opening the scoring screen…</Text>
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.md }} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Confirm ───────────────────────────────────────────────
  const teamAColour = comp?.team_a_colour ?? COLORS.accent;
  const teamBColour = comp?.team_b_colour ?? COLORS.textMuted;
  const formatLabel = FORMAT_LABELS[match?.format] ?? match?.format ?? 'Match';
  const sessionLabel = [match?.session_date
    ? new Date(match.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : null, match?.session].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Scorer Invite</Text>
      </View>

      <View style={styles.inner}>
        <Text style={styles.bigEmoji}>📋</Text>
        <Text style={styles.title}>You've been nominated</Text>
        <Text style={styles.subtitle}>
          You've been invited to score a match in{' '}
          <Text style={{ fontWeight: '700', color: COLORS.text }}>{comp?.name}</Text>.
        </Text>

        {/* Match card */}
        <View style={styles.matchCard}>
          {/* Competition */}
          <View style={styles.matchRow}>
            <Text style={styles.matchMetaLabel}>COMPETITION</Text>
            <Text style={styles.matchMetaValue}>{comp?.name}</Text>
          </View>

          {/* Format */}
          <View style={styles.dividerLine} />
          <View style={styles.matchRow}>
            <Text style={styles.matchMetaLabel}>FORMAT</Text>
            <Text style={styles.matchMetaValue}>{formatLabel}</Text>
          </View>

          {/* Session */}
          <View style={styles.dividerLine} />
          <View style={styles.matchRow}>
            <Text style={styles.matchMetaLabel}>SESSION</Text>
            <Text style={styles.matchMetaValue}>{sessionLabel || '—'}</Text>
          </View>

          {/* Teams */}
          <View style={styles.dividerLine} />
          <View style={styles.teamsRow}>
            <View style={[styles.teamPill, { backgroundColor: teamAColour + '18', borderColor: teamAColour + '40' }]}>
              <View style={[styles.teamDot, { backgroundColor: teamAColour }]} />
              <Text style={[styles.teamPillText, { color: teamAColour }]}>{comp?.team_a_name}</Text>
            </View>
            <Text style={styles.vsText}>vs</Text>
            <View style={[styles.teamPill, { backgroundColor: teamBColour + '18', borderColor: teamBColour + '40' }]}>
              <View style={[styles.teamDot, { backgroundColor: teamBColour }]} />
              <Text style={[styles.teamPillText, { color: teamBColour }]}>{comp?.team_b_name}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.hint}>
          Tapping below will add you as the scorer for this match.
          You'll be able to enter scores hole by hole.
        </Text>

        <TouchableOpacity
          style={[styles.btn, status === 'claiming' && styles.btnDisabled]}
          onPress={claimMatch}
          disabled={status === 'claiming'}
          activeOpacity={0.85}
        >
          {status === 'claiming'
            ? <ActivityIndicator color={COLORS.white} />
            : (
              <View style={styles.btnInner}>
                <Ionicons name="pencil" size={18} color={COLORS.white} />
                <Text style={styles.btnText}>Accept &amp; Start Scoring</Text>
              </View>
            )
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(tabs)/competition')}>
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>
      </View>
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
  navTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: SPACING.xl, gap: SPACING.md,
  },
  inner: {
    flex: 1, padding: SPACING.lg, alignItems: 'center',
    justifyContent: 'center', gap: SPACING.md,
  },
  bigEmoji: { fontSize: 52, marginBottom: SPACING.sm },
  title:    { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', maxWidth: 300, lineHeight: 20 },
  hint:     { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', maxWidth: 300, lineHeight: 18 },

  matchCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.lg, gap: SPACING.sm,
    ...SHADOW.card,
  },
  matchRow:       { gap: 3 },
  matchMetaLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  matchMetaValue: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  dividerLine:    { height: 1, backgroundColor: COLORS.border },

  teamsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: SPACING.sm,
  },
  teamPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: RADIUS.md, borderWidth: 1,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm,
  },
  teamDot:      { width: 8, height: 8, borderRadius: 4 },
  teamPillText: { fontSize: 13, fontWeight: '700' },
  vsText:       { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },

  btn: {
    width: '100%', backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.md + 2,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.fab,
  },
  btnDisabled: { opacity: 0.5 },
  btnInner:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  btnText:     { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  declineText: { fontSize: 14, color: COLORS.textMuted, marginTop: SPACING.sm },
});
