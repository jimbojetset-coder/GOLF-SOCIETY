---
name: Expo SDK 54 breaking API changes
description: expo-file-system and expo-image-picker top-level APIs changed in SDK 54 (installed via Expo ~54.0.x); code written against older SDKs won't compile as-is.
---

- `expo-image-picker` (v17+) dropped `ImagePicker.MediaTypeOptions.Images` (enum). The new `mediaTypes` option takes a `MediaType` string union directly: use `mediaTypes: 'images'` (or `['images']`), not an enum member.
- `expo-file-system` (v19+) replaced the classic `readAsStringAsync`/`EncodingType`/`writeAsStringAsync` API with a new File/Directory class API at the top-level import. The old API still exists but must be imported from the subpath `expo-file-system/legacy`, e.g. `import * as FileSystem from 'expo-file-system/legacy'`.

**Why:** Ported/older React Native code (e.g. from a different scaffold or an older Expo SDK) that calls these APIs the old way will fail `tsc`/runtime with "property does not exist on type" errors until updated.

**How to apply:** When porting Expo/RN code into a workspace scaffold pinned to Expo ~54, grep for `MediaTypeOptions` and `EncodingType`/`readAsStringAsync` usages first and fix them as above before running typecheck.
