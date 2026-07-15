import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuth } from '../src/hooks/useAuth';
import { useJoinCompetition } from '../src/hooks/useJoinCompetition';

// Module-level holder for a share token that arrived before the user signed in.
// Using a module variable instead of `globalThis` keeps it TypeScript-strict
// safe and isolated from the global namespace.
let pendingShareToken: string | undefined;
export function setPendingShareToken(token: string | undefined) {
  pendingShareToken = token;
}

function Navigation() {
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
      const t = pendingShareToken;
      if (t) {
        pendingShareToken = undefined;
        router.replace(`/join/${t}`);
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

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Navigation />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
