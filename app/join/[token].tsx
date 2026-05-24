import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/api/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING } from '../../src/constants/theme';

/**
 * Handles golfscoring://join/<token> deep links.
 * Calls the join_competition RPC then redirects to the leaderboard.
 */
export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<'joining' | 'error'>('joining');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!user || !token) return;
    join();
  }, [user, token]);

  const join = async () => {
    const { data, error } = await supabase.rpc('join_competition', {
      p_share_token: token,
    });

    if (error || data?.error) {
      setErrorMsg(data?.error ?? error?.message ?? 'Unknown error');
      setStatus('error');
      return;
    }

    // Short pause so the user sees the join confirmation
    setTimeout(() => {
      router.replace(`/(tabs)/leaderboard?competitionId=${data.competition_id}`);
    }, 800);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {status === 'joining' ? (
          <>
            <Text style={styles.emoji}>⛳</Text>
            <Text style={styles.title}>Joining competition…</Text>
            <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.md }} />
          </>
        ) : (
          <>
            <Text style={styles.emoji}>❌</Text>
            <Text style={styles.title}>Couldn't join</Text>
            <Text style={styles.subtitle}>{errorMsg}</Text>
            <Text
              style={styles.link}
              onPress={() => router.replace('/(tabs)/competition')}
            >
              Go to competitions →
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  emoji: { fontSize: 64, marginBottom: SPACING.md },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  link: { marginTop: SPACING.lg, color: COLORS.accent, fontSize: 15, fontWeight: '600' },
});
