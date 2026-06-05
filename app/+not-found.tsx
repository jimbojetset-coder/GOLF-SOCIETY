/**
 * Catch-all route for any URL the router doesn't recognise.
 * Replaces expo-router's default debug "Unmatched route / Sitemap" screen
 * with a graceful redirect back to the home tab.
 */
import { Redirect } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '../src/constants/theme';

export default function NotFoundCatchAll() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  // Send users to the right place based on auth state
  return <Redirect href={session ? '/(tabs)/competition' : '/(auth)/sign-in'} />;
}
