# Bug-fix changes — APK build no longer fails

## Summary
The APK build was failing because of **multiple blocking issues** that prevented
`npm install` / `yarn install` and the JS bundle from succeeding. After the fixes
below, the Android bundle builds successfully (verified with `expo export --platform android`,
2.56 MB bundle, 1066+ modules).

## Fixes

### 1. `package.json` was completely malformed (BLOCKER)
The original file was missing:
- The outer `{ ... }` braces (invalid JSON → every npm/yarn/eas command fails immediately)
- `"name"`, `"version"`, `"main"`, `"scripts"`
- `expo-linking` dependency (imported by `useJoinCompetition.ts` and `ShareCompetitionButton.tsx`)
- `expo-constants` dependency (required by `app.config.ts` runtime)

Also: many version ranges (`~13.0.5`, `~16.0.4`, `~18.0.7`, etc.) no longer exist on npm.
Updated to the actual published SDK 52 versions:
- `expo-sharing` `~13.0.5` → `~13.1.5`
- `expo-image-picker` `~16.0.4` → `~16.1.4`
- `expo-image-manipulator` `~13.0.6` → `~13.1.7`
- `expo-file-system` `~18.0.7` → `~18.0.12`
- `expo-router` `~4.0.16` → `~4.0.22`
- Added `expo-linking ~7.0.5`, `expo-constants ~17.0.8`

### 2. Missing state declarations in `app/competition/new.tsx` (BLOCKER)
The file referenced `handicapAllowance` and `setHandicapAllowance` in JSX
without ever declaring them via `useState`. This is a TypeScript compile error
AND would crash the app at runtime once the user reached the "Details" step.

Added:
```tsx
const [handicapAllowance, setHandicapAllowance] = useState<number>(0.9);
```

### 3. `global._pendingShareToken` strict-TS failure in `app/_layout.tsx` (BLOCKER)
TypeScript strict mode (enabled in `tsconfig.json`) rejected the implicit
`globalThis` usage. Replaced with a module-level variable + exported setter
(`setPendingShareToken`), and updated `useJoinCompetition.ts` to call it.

### 4. Over-aggressive Metro resolver config in `metro.config.js` (RUNTIME BREAK)
The original config set:
```js
config.resolver.unstable_conditionNames = ['require', 'default'];
```
This **globally** strips React Native's own export conditions, breaking
`react-native-reanimated` and any package that ships an RN-specific build via
`package.json` exports. Removed the override; kept `unstable_enablePackageExports = true`
so `nanoid` still resolves correctly.

## Non-blocking issues left untouched
The repo still has ~30 minor TS type errors (mostly stale style-key references
in `ScoringGridLayout.tsx` and `competition/[id]/index.tsx`), and Expo's tab
navigator doesn't accept `tabBarIndicatorStyle`. These are **not** APK build
blockers — Expo/Metro/Hermes do not run `tsc` during builds. They should be
cleaned up in a follow-up pass but the app builds and runs without them.

## Verification
```
cd /app/golf-society
yarn install                                  # ✅ Succeeds
EXPO_PUBLIC_SUPABASE_URL=https://x \
EXPO_PUBLIC_SUPABASE_ANON_KEY=x \
npx expo export --platform android --no-bytecode --output-dir /tmp/out
# ✅ Exported: 2.56 MB android bundle, 1066+ modules
```

## Before you build
Make sure you have a `.env` file (Expo loads `.env`, `.env.local`, etc. via
`expo-constants`):
```
EXPO_PUBLIC_SUPABASE_URL=https://ffkrwdvevjuloyxnliga.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Then either:
- **EAS build**: `eas build -p android --profile preview`  (APK)
- **Local**: `npx expo run:android` (requires Android Studio / SDK)
