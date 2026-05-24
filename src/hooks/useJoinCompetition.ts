import { useEffect } from 'react';
import { useURL } from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '../api/supabase';
import { useAuth } from './useAuth';

/**
 * Listens for deep links: golfscoring://join/<share_token>
 *
 * Authenticated  → calls join_competition() RPC immediately, navigates to leaderboard.
 * Unauthenticated → stores token in global._pendingShareToken, redirects to sign-in.
 *                   Root layout picks it up after auth completes.
 */
export function useJoinCompetition() {
  const url    = useURL();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!url) return;

    // Match alphanumeric share tokens (not just hex)
    const match = url.match(/join\/([A-Za-z0-9_-]+)/);
    if (!match) return;

    const shareToken = match[1];
    if (shareToken === 'link') return; // manual entry screen — handled by router

    if (user) {
      handleJoin(shareToken);
    } else {
      global._pendingShareToken = shareToken;
      router.replace('/(auth)/sign-in');
    }
  }, [url, user]);

  const handleJoin = async (shareToken: string) => {
    const { data, error } = await supabase.rpc('join_competition', {
      p_share_token: shareToken,
    });

    if (error || data?.error) {
      console.warn('Join competition failed:', error?.message ?? data?.error);
      // Navigate to manual join screen so user can try again
      router.replace(`/join/link`);
      return;
    }

    router.replace(`/(tabs)/leaderboard?competitionId=${data.competition_id}`);
  };
}

declare global {
  var _pendingShareToken: string | undefined;
}
