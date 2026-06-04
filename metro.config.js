const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package.json "exports" field so packages like nanoid resolve correctly.
// Keep the default condition names (which include "react-native") so RN-specific
// builds of packages like react-native-reanimated continue to load.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
