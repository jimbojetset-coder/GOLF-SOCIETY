import { useEffect } from 'react';
import { useURL } from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '../api/supabase';
import { useAuth } from './useAuth';

/**
 * Listens for deep links in the format:
 *   golfscoring://join/<share_token>
 *
 * If the user is authenticated, immediately calls join_competition()
 * and navigates to the competition leaderboard.
 *
 * If not yet authenticated, the share token is stored and picked up
 * by the auth flow after sign-in.
 */
export function useJoinCompetition() {
  const url = useURL();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!url) return;

    // Parse the share token from the deep link
    const match = url.match(/join\/([a-f0-9]+)/);
    if (!match) return;

    const shareToken = match[1];

    if (user) {
      handleJoin(shareToken);
    } else {
      // Store token so auth screen can redirect after sign-in
      global._pendingShareToken = shareToken;
      router.replace('/(auth)/sign-in');
    }
  }, [url, user]);

  const handleJoin = async (shareToken: string) => {
    const { data, error } = await supabase.rpc('join_competition', {
      p_share_token: shareToken,
    });

    if (error || data?.error) {
      console.warn('Failed to join competition:', error || data?.error);
      return;
    }

    // Navigate to leaderboard for this competition
    router.replace(`/(tabs)/leaderboard?competitionId=${data.competition_id}`);
  };
}

// Extend global for pending token (cleared after use)
declare global {
  var _pendingShareToken: string | undefined;
}
