/**
 * Auth callback deep link.
 * Supabase magic-link flow redirects here as golfscoring://auth/callback.
 * The Supabase SDK already parses the session from the URL by the time
 * this screen renders, so we just need to redirect somewhere valid.
 */
import { Redirect } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';

export default function AuthCallback() {
  const { session } = useAuth();
  return <Redirect href={session ? '/(tabs)/competition' : '/(auth)/sign-in'} />;
}
