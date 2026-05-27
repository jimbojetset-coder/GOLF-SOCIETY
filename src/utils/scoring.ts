/**
 * Scoring utilities — implements the rules from scoring-engine.md
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
export function calcStrokesReceived(
  format: 'fourball' | 'foursomes' | 'singles' | 'scramble',
  playingHandicaps: number[],
  allowance = 1.0
): number[] {
  // Apply allowance to all playing handicaps before any calculation
  const adjusted = playingHandicaps.map(h => h * allowance);
  const min = Math.min(...adjusted);

  switch (format) {
    case 'singles':
      return adjusted.map(h => Math.round(h - min));

    case 'fourball': {
      // Each player gets 3/4 of difference vs lowest in match
      return adjusted.map(h => Math.round((h - min) * 0.75));
    }

    case 'foursomes': {
      // Team handicap = (sum of both) / 2, then 3/4 applied
      // adjusted = [teamA_combined, teamB_combined]
      const teamHandicaps = adjusted.map(h => Math.round(h * 0.75));
      const minTeam = Math.min(...teamHandicaps);
      return teamHandicaps.map(h => h - minTeam);
    }

    case 'scramble': {
      // USGA scramble: lowest * 0.25 + partner * 0.15
      const [a1, a2, b1, b2] = adjusted;
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
  const diff = netPar - grossScore; // positive = under net par
  return Math.max(0, diff + 2); // net par = 2 pts
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

// ── Net double bogey cap ──────────────────────────────────────
export function netDoubleBogeyMax(par: number, strokesOnHole: number): number {
  return par + 2 + strokesOnHole;
}

// ── WHS Handicap Index calculation ───────────────────────────
export function calcHandicapIndex(differentials: number[]): { index: number; note: string } {
  const n = differentials.length;
  if (n < 3) return { index: 0, note: 'Insufficient rounds (minimum 3)' };

  const sorted = [...differentials].sort((a, b) => a - b);

  let useBest: number;
  if (n >= 20) useBest = 8;
  else if (n === 19) useBest = 7;
  else if (n >= 17) useBest = 6;
  else if (n >= 15) useBest = 5;
  else if (n >= 12) useBest = 4;
  else if (n >= 9) useBest = 3;
  else if (n >= 6) useBest = 2;
  else useBest = 1;

  const best = sorted.slice(0, useBest);
  const avg = best.reduce((a, b) => a + b, 0) / best.length;
  const index = parseFloat((avg * 0.96).toFixed(1));
  const note = n < 20 ? `Based on ${n} rounds — limited data` : '';

  return { index, note };
}

// ── Highlight detection ───────────────────────────────────────
export function detectHighlight(grossScore: number, par: number): string | null {
  if (grossScore === 1) return 'hole_in_one';
  const diff = par - grossScore;
  if (diff >= 3) return 'albatross';
  if (diff === 2) return 'eagle';
  if (diff === 1) return 'birdie';
  if (diff === 0) return 'par';
  return null;
}
