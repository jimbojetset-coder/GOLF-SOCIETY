import { useEffect, useRef } from 'react';
import { useURL } from 'expo-linking';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabase';
import { useAuth } from './useAuth';

/**
 * Listens for deep links: golfscoring://join/<share_token>
 */
export function useJoinCompetition() {
  const url    = useURL();
  const { user } = useAuth();
  const router = useRouter();
  // Track which URLs we have already handled to prevent double-join
  const processedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!url) return;
    // Skip if we already processed this exact URL
    if (url === processedUrl.current) return;

    // Extract the token from the URL
    const match = url.match(/(?<![\w])join\/([A-Za-z0-9_-]+)/);
    if (!match) return;

    const shareToken = match[1];
    if (shareToken === 'link') return;

    const processLink = async () => {
      // Mark as processed before any async work to prevent re-entrancy
      processedUrl.current = url;

      if (user) {
        // User is logged in: join immediately
        await handleJoin(shareToken);
      } else {
        // User NOT logged in: Persist token to disk and go to sign-in
        await AsyncStorage.setItem('pending_share_token', shareToken);
        router.replace('/(auth)/sign-in');
      }
    };

    processLink();
  }, [url, user]);

  const handleJoin = async (shareToken: string) => {
    const { data, error } = await supabase.rpc('join_competition', {
      p_share_token: shareToken,
    });

    if (error || data?.error) {
      router.replace(`/join/link`);
      return;
    }

    router.replace(`/(tabs)/leaderboard?competitionId=${data.competition_id}`);
  };
}
