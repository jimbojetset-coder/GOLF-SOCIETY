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
