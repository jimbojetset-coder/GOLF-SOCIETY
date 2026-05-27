import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../src/hooks/useAuth';
import { useJoinCompetition } from '../src/hooks/useJoinCompetition';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  // Handle deep links for share tokens globally
  useJoinCompetition();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      // Pick up any pending share token stored before sign-in
      const pendingToken = global._pendingShareToken;
      if (pendingToken) {
        global._pendingShareToken = undefined;
        router.replace(`/join/${pendingToken}`);
      } else {
        router.replace('/(tabs)/competition');
      }
    }
  }, [session, loading, segments]);

  return (
    <>
      {/* Light theme — dark icons on white backgrounds */}
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
