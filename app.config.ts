@'
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Golf Scoring',
  slug: 'golf-scoring-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.golfscoring.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
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
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: '35.0.0',
          kotlinVersion: '1.9.24',
          packagingOptions: {
            pickFirst: [
              '**/libc++_shared.so',
              '**/libjsc.so',
            ],
          },
        },
      },
    ],
  ],
  scheme: 'golfscoring',
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: 'ff4a6dc9-7971-405e-870d-ab8b0d4fb00c',
    },
  },
});
'@ | Out-File -Encoding utf8 app.config.ts
