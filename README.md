# Golf Scoring App

Ryder Cup-style golf event scoring — built with Expo + Supabase.

## Setup

### 1. Install dependencies
```bash
cd golf-app
npm install
```

### 2. Environment variables
Copy `.env.example` to `.env.local` and fill in your Supabase values:

```bash
cp .env.example .env.local
```

Get your **anon key** from: Supabase → Project Settings → API → `anon` `public` key.

```
EXPO_PUBLIC_SUPABASE_URL=https://ffkrwdvevjuloyxnliga.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Run
```bash
npx expo start
```

Scan the QR code with **Expo Go** on your phone.

---

## Project Structure

```
app/
  _layout.tsx          ← Root layout + auth guard
  (auth)/
    sign-in.tsx        ← Magic link / OTP auth
  (tabs)/
    competition.tsx    ← Tab 1: Create & manage competitions
    scoring.tsx        ← Tab 2: Score assigned matches
    leaderboard.tsx    ← Tab 3: Live Ryder Cup leaderboard
    history.tsx        ← Tab 4: Past competitions
    settings.tsx       ← Tab 5: Profile & handicap

src/
  api/
    supabase.ts        ← Supabase client + TypeScript types
  constants/
    theme.ts           ← Colours, spacing, typography
  hooks/
    useAuth.ts         ← Auth state hook (OTP flow)
  utils/
    scoring.ts         ← Full scoring engine (WHS, match play, stableford)
  screens/
    auth/
      AuthScreen.tsx   ← Email + OTP sign-in UI
```

## Still to build
- [ ] `app/competition/new.tsx` — Create competition form (teams, players, matches)
- [ ] `app/competition/[id].tsx` — Competition detail & match list
- [ ] `app/scoring/[matchId].tsx` — Hole-by-hole scoring screen
- [ ] Scorecard OCR integration (upload image → extract holes)
- [ ] Share links for scorers (WhatsApp deep link)
- [ ] Competition close flow + handicap suggestions
