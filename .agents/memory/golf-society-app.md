---
name: Golf Society app
description: Notes on the golf-society Expo artifact — a ported GitHub repo (Supabase-backed golf match-play scoring app) with constraints on CI files.
---

- This artifact was ported from an external GitHub repo (`jimbojetset-coder/GOLF-SOCIETY`) into `artifacts/golf-society`. The scaffold's default files were replaced with the real app source (5-tab expo-router structure, Supabase client, scoring engine).
- `codemagic.yaml` and `eas.json` in this artifact are the user's existing CI/CD config and must not be modified — they were explicitly preserved during the port. Codemagic builds both iOS and **Android** APKs, so Android-only-incompatible RN APIs (e.g. `Alert.prompt`, which is iOS-only) are real bugs here, not just polish.
- Supabase URL/anon key are stored as regular (non-secret) shared env vars `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Expo's `EXPO_PUBLIC_` prefix bundles them into the client anyway, and the anon key is meant to be public (RLS enforces security), matching the same values already hardcoded in `codemagic.yaml`.
- App scheme is `golfscoring` (used by deep links `golfscoring://join/<token>`) — must match `app.json`'s `scheme` field; a placeholder scaffold value here silently breaks deep-link joins.
