/**
 * /join/[token] — Deep link handler
 *
 * Handles golfscoring://join/<token> deep links.
 * If token is "link" (from the scoring tab nudge) shows a manual entry form.
 * Otherwise auto-joins and redirects to leaderboard.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, SafeAreaView,
  StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/api/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';

type Status = 'idle' | 'joining' | 'success' | 'error';

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user }  = useRouter() as any;
  const router    = useRouter();
  const { user: authUser } = useAuth();

  // If token === 'link' we show a manual entry form
  const isManual = token === 'link' || !token;

  const [manualToken, setManualToken] = useState('');
  const [status,      setStatus]      = useState<Status>(isManual ? 'idle' : 'joining');
  const [errorMsg,    setErrorMsg]     = useState('');
  const [compName,    setCompName]     = useState('');

  useEffect(() => {
    if (!isManual && token && authUser) doJoin(token);
  }, [token, authUser]);

  const doJoin = async (t: string) => {
    setStatus('joining');
    setErrorMsg('');

    const { data, error } = await supabase.rpc('join_competition', {
      p_share_token: t.trim(),
    });

    if (error || data?.error) {
      setErrorMsg(data?.error ?? error?.message ?? 'Invalid or expired link');
      setStatus('error');
      return;
    }

    setCompName(data.competition_name ?? '');
    setStatus('success');

    setTimeout(() => {
      router.replace(`/(tabs)/leaderboard?competitionId=${data.competition_id}`);
    }, 1400);
  };

  // ── Auto-join loading ──────────────────────────────────────
  if (!isManual && status === 'joining') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>⛳</Text>
          <Text style={styles.title}>Joining competition…</Text>
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Success ──────────────────────────────────────────────
  if (status === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>🏌️</Text>
          <Text style={styles.title}>You're in!</Text>
          {compName ? <Text style={styles.subtitle}>{compName}</Text> : null}
          <Text style={styles.hint}>Taking you to the leaderboard…</Text>
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.md }} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error (auto-join) ─────────────────────────────────────
  if (!isManual && status === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>🔗</Text>
          <Text style={styles.title}>Couldn't join</Text>
          <Text style={styles.subtitle}>{errorMsg}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)/competition')}>
            <Text style={styles.btnText}>Go to Competitions</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Manual token entry ────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Join a Competition</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.manualInner}>
          <Text style={styles.bigEmoji}>🔗</Text>
          <Text style={styles.title}>Have a share link?</Text>
          <Text style={styles.subtitle}>
            Paste the access code from the WhatsApp message or share link you received.
          </Text>

          <View style={styles.card}>
            <Text style={styles.inputLabel}>ACCESS CODE</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="e.g. aBcDeFgHiJkLmNoP"
              placeholderTextColor={COLORS.textMuted}
              value={manualToken}
              onChangeText={v => { setManualToken(v.trim()); setErrorMsg(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={() => manualToken && doJoin(manualToken)}
            />
            {errorMsg ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, (!manualToken || status === 'joining') && styles.btnDisabled]}
              onPress={() => doJoin(manualToken)}
              disabled={!manualToken || status === 'joining'}
              activeOpacity={0.85}
            >
              {status === 'joining'
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.btnText}>Join Competition</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            Access codes are shared by competition organisers via WhatsApp or SMS.
            Each code is unique to that competition.
          </Text>
        </View>
      </KeyboardAvoidingView>
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
  manualInner: {
    flex: 1, padding: SPACING.lg, gap: SPACING.md,
    alignItems: 'center', justifyContent: 'center',
  },
  bigEmoji: { fontSize: 56, marginBottom: SPACING.sm },
  title:    { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', maxWidth: 300 },
  hint:     { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', maxWidth: 300, lineHeight: 18 },

  card: {
    width: '100%', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.lg, gap: SPACING.md,
    ...SHADOW.cardMd,
  },
  inputLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.2 },
  codeInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
    fontSize: 16, color: COLORS.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { fontSize: 13, color: COLORS.danger, flex: 1 },

  btn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md, alignItems: 'center',
    ...SHADOW.fab,
  },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
