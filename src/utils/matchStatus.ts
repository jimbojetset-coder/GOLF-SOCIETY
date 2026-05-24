/**
 * Match status utilities — structured output for display.
 *
 * Returns a { label, leader } object so the UI can render
 * team names in their colours separately from the margin label.
 *
 * Examples:
 *   "2UP"      → leader = 'A', label = '2UP'
 *   "Dormie 3" → leader = 'A', label = 'Dormie 3'
 *   "3&2"      → leader = 'A', label = '3&2'
 *   "A/S"      → leader = null, label = 'A/S'
 *   "1UP"      → leader = 'A', label = '1UP'
 */
export interface MatchStatusResult {
  label: string;            // the margin text shown in the centre pill
  leader: 'A' | 'B' | null; // which team is leading (null = all square)
}

export function calcMatchStatus(
  holesUp: number,
  leadingTeam: 'A' | 'B' | null,
  holesRemaining: number,
): MatchStatusResult {
  if (!leadingTeam || holesUp === 0) {
    return { label: 'A/S', leader: null };
  }

  // Match already won (more up than holes left)
  if (holesUp > holesRemaining) {
    return { label: `${holesUp}&${holesRemaining}`, leader: leadingTeam };
  }

  // Dormie
  if (holesUp === holesRemaining) {
    return { label: `Dormie ${holesUp}`, leader: leadingTeam };
  }

  return { label: `${holesUp}UP`, leader: leadingTeam };
}

export function calcFinalStatus(
  holesUp: number,
  leadingTeam: 'A' | 'B' | null,
  lastHolePlayed: number,
): MatchStatusResult {
  if (!leadingTeam || holesUp === 0) {
    return { label: 'A/S', leader: null };
  }
  const holesRemaining = 18 - lastHolePlayed;
  const label = holesRemaining === 0
    ? '1UP'
    : `${holesUp}&${holesRemaining}`;
  return { label, leader: leadingTeam };
}

/**
 * Parse a stored result string back into a MatchStatusResult.
 * Used on the leaderboard where we only have the stored string.
 * e.g. "Europe 3&2" → { label: '3&2', leader: 'A' }
 *      "A/S"        → { label: 'A/S', leader: null }
 */
export function parseStoredResult(
  result: string,
  teamAName: string,
  teamBName: string,
): MatchStatusResult {
  if (!result || result === 'A/S') return { label: 'A/S', leader: null };
  if (result.startsWith(teamAName)) {
    return { label: result.replace(teamAName, '').trim(), leader: 'A' };
  }
  if (result.startsWith(teamBName)) {
    return { label: result.replace(teamBName, '').trim(), leader: 'B' };
  }
  return { label: result, leader: null };
}
