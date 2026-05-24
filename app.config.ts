import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Golf Scoring',
  slug: 'golf-scoring-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0F1923',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.golfscoring.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0F1923',
    },
    package: 'com.golfscoring.app',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow Golf Scoring to access your photos for scorecard scanning.',
        cameraPermission: 'Allow Golf Scoring to use the camera to scan scorecards.',
      },
    ],
  ],
  scheme: 'golfscoring',
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: 'your-eas-project-id',
    },
  },
});
