import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/hooks/useAuth';
import { useJoinCompetition } from '../src/hooks/useJoinCompetition';

/**
 * Root Layout
 * Handles authentication redirects and deep-link persistence
 */
export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  // Initialize the deep-link listener hook
  useJoinCompetition();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    const handleNavigation = async () => {
      if (!session && !inAuthGroup) {
        // Not logged in: send to sign-in
        router.replace('/(auth)/sign-in');
      } 
      else if (session && inAuthGroup) {
        /**
         * FIX: Persistence for Deep Links
         * Check AsyncStorage for any pending share tokens stored during the 
         * auth redirect process.
         */
        try {
          const pendingToken = await AsyncStorage.getItem('pending_share_token');
          
          if (pendingToken) {
            // Clear the token so we don't redirect multiple times
            await AsyncStorage.removeItem('pending_share_token');
            router.replace(`/join/${pendingToken}`);
          } else {
            // Standard login redirect
            router.replace('/(tabs)/competition');
          }
        } catch (e) {
          // Fallback if storage fails
          router.replace('/(tabs)/competition');
        }
      }
    };

    handleNavigation();
  }, [session, loading, segments]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Ensure the join route is available in the stack */}
        <Stack.Screen name="join/[token]" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
