/**
 * Scoring utilities — implements the rules for Golf Society
 * Updated to support dynamic Handicap Allowances (75%, 90%, etc.)
 */

// ── Playing Handicap ─────────────────────────────────────────
export function calcPlayingHandicap(
  handicapIndex: number,
  slopeRating: number,
  courseRating: number,
  par: number
): number {
  return Math.round(handicapIndex * (slopeRating / 113) + (courseRating - par));
}

// ── Strokes received per player ───────────────────────────────
// Added 'allowance' parameter (e.g., 0.9 for 90%, 0.75 for 75%)
export function calcStrokesReceived(
  format: 'fourball' | 'foursomes' | 'singles' | 'scramble',
  playingHandicaps: number[],
  allowance: number = 0.90 
): number[] {
  const min = Math.min(...playingHandicaps);

  switch (format) {
    case 'singles':
      // Singles match play is typically 100% of the difference
      return playingHandicaps.map(h => h - min);

    case 'fourball': {
      // Each player gets the specified % of the difference vs lowest in match
      return playingHandicaps.map(h => Math.round((h - min) * allowance));
    }

    case 'foursomes': {
      // Team handicap = combined total * allowance (usually 50% or 75%)
      const teamHandicaps = playingHandicaps.map(h => Math.round(h * allowance));
      const minTeam = Math.min(...teamHandicaps);
      return teamHandicaps.map(h => h - minTeam);
    }

    case 'scramble': {
      // USGA scramble: lowest * 0.25 + partner * 0.15
      const [a1, a2, b1, b2] = playingHandicaps;
      const teamA = Math.round(Math.min(a1, a2) * 0.25 + Math.max(a1, a2) * 0.15);
      const teamB = Math.round(Math.min(b1, b2) * 0.25 + Math.max(b1, b2) * 0.15);
      const minT = Math.min(teamA, teamB);
      return [teamA - minT, teamB - minT];
    }

    default:
      return playingHandicaps.map(() => 0);
  }
}

// ── Does a player get a stroke on this hole? ──────────────────
export function getsStrokeOnHole(strokesReceived: number, strokeIndex: number): boolean {
  if (strokesReceived <= 0) return false;
  if (strokesReceived >= 18) return true;
  return strokeIndex <= strokesReceived;
}

// ── Extra strokes for handicaps >18 ──────────────────────────
export function extraStrokesOnHole(strokesReceived: number, strokeIndex: number): number {
  if (strokesReceived <= 0) return 0;
  const base = Math.floor(strokesReceived / 18);
  const remainder = strokesReceived % 18;
  return base + (strokeIndex <= remainder ? 1 : 0);
}

// ── Net score ─────────────────────────────────────────────────
export function netScore(grossScore: number, strokesReceived: number, strokeIndex: number): number {
  return grossScore - extraStrokesOnHole(strokesReceived, strokeIndex);
}

// ── Hole result ───────────────────────────────────────────────
export function holeResult(netA: number, netB: number): 'A' | 'B' | 'halved' {
  if (netA < netB) return 'A';
  if (netB < netA) return 'B';
  return 'halved';
}

// ── Match status string ───────────────────────────────────────
export function matchStatusString(
  holesUp: number,
  leadingTeam: 'A' | 'B' | null,
  holesRemaining: number,
  teamAName = 'A',
  teamBName = 'B'
): string {
  if (leadingTeam === null || holesUp === 0) return 'A/S';
  const name = leadingTeam === 'A' ? teamAName : teamBName;

  if (holesUp > holesRemaining) {
    return `${name} ${holesUp}&${holesRemaining}`;
  }
  if (holesUp === holesRemaining) {
    return `Dormie ${holesUp}`;
  }
  return `${name} ${holesUp}UP`;
}

// ── Final result after 18 holes ───────────────────────────────
export function finalResult(
  holesUp: number,
  leadingTeam: 'A' | 'B' | null,
  holeMatchEnded: number,
  teamAName = 'A',
  teamBName = 'B'
): { result: string; winning_team: 'A' | 'B' | 'halved'; points_a: number; points_b: number } {
  if (!leadingTeam || holesUp === 0) {
    return { result: 'A/S', winning_team: 'halved', points_a: 0.5, points_b: 0.5 };
  }
  const holesRemaining = 18 - holeMatchEnded;
  const name = leadingTeam === 'A' ? teamAName : teamBName;
  const result = holesRemaining === 0
    ? `${name} 1UP`
    : `${name} ${holesUp}&${holesRemaining}`;
  return {
    result,
    winning_team: leadingTeam,
    points_a: leadingTeam === 'A' ? 1 : 0,
    points_b: leadingTeam === 'B' ? 1 : 0,
  };
}

// ── Stableford ────────────────────────────────────────────────
export function stablefordPoints(grossScore: number, par: number, strokesReceived: number, strokeIndex: number): number {
  const strokes = extraStrokesOnHole(strokesReceived, strokeIndex);
  const netPar = par + strokes;
  const diff = netPar - grossScore; 
  return Math.max(0, diff + 2); 
}

// ── WHS Score Differential ────────────────────────────────────
export function scoreDifferential(
  adjustedGross: number,
  courseRating: number,
  slopeRating: number,
  pcc = 0
): number {
  return parseFloat(((113 / slopeRating) * (adjustedGross - courseRating - pcc)).toFixed(1));
}

// ── Highlight Detection ───────────────────────────────────────
export function detectHighlight(grossScore: number, par: number): string | null {
  if (grossScore <= 0) return null;
  const diff = grossScore - par;
  if (grossScore === 1) return 'hole_in_one';
  if (diff <= -3) return 'albatross';
  if (diff === -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  return null;
}
