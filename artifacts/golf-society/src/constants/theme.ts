/**
 * Theme — Outdoor Light
 *
 * Pure white base, near-black text, high-contrast for direct sunlight.
 * Colour used only for team identity and key status indicators.
 */

export const COLORS = {
  // ── Base surfaces
  background:  '#FFFFFF',
  surface:     '#F8F9FB',   // off-white card
  surfaceHigh: '#F1F3F7',   // slightly deeper — alternating rows, pressed states
  border:      '#E4E7EC',   // default card border
  borderStrong:'#C8CDD6',   // input focus, dividers

  // ── Text
  text:          '#0A0C10',  // near-black — max contrast
  textSecondary: '#3D4A58',  // dark grey — secondary labels
  textMuted:     '#8896A4',  // placeholder, metadata

  // ── Accent (green)
  accent:        '#16A34A',  // primary CTA, active states, LIVE badge
  accentLight:   '#F0FDF4',  // pale green tint backgrounds
  accentBorder:  '#86EFAC',  // green card borders

  // ── Team colours — deep, readable in sun
  teamA:         '#B91C1C',  // Europe — deep red
  teamALight:    '#FEF2F2',  // pale red tint
  teamABorder:   '#FCA5A5',  // red card border

  teamB:         '#1D4ED8',  // USA — deep blue
  teamBLight:    '#EFF6FF',  // pale blue tint
  teamBBorder:   '#93C5FD',  // blue card border

  // ── Status / semantic
  gold:          '#A16207',  // winner labels — readable on white
  goldLight:     '#FEF9C3',
  goldBorder:    '#FDE68A',

  warning:       '#92400E',  // amber text on white
  warningLight:  '#FFFBEB',
  warningBorder: '#FCD34D',

  danger:        '#B91C1C',
  dangerLight:   '#FEF2F2',
  dangerBorder:  '#FCA5A5',

  accentDim:     '#BBF7D0',  // pale green — ghost/dim accent

  // ── Misc
  white:   '#FFFFFF',
  black:   '#000000',
};

export const FONTS = {
  regular:    'System',
  medium:     'System',
  semiBold:   'System',
  bold:       'System',
  extraBold:  'System',
};

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const RADIUS = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  28,
  full: 999,
};

export const SHADOW = {
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  4,
    elevation:     2,
  },
  cardMd: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  8,
    elevation:     3,
  },
  fab: {
    shadowColor:   '#16A34A',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius:  12,
    elevation:     6,
  },
};

export const FORMAT_LABELS: Record<string, string> = {
  fourball:  'Fourball',
  foursomes: 'Foursomes',
  singles:   'Singles',
  scramble:  'Scramble',
};

// ── Utility helpers ──────────────────────────────────────────

/** Return the light/border colours for a given team colour hex */
export function teamTints(hex: string): { light: string; border: string } {
  const low = hex.toLowerCase();
  if (low.includes('b91c') || low.includes('dc26') || low.includes('e63') || low.includes('ef44')) {
    return { light: COLORS.teamALight, border: COLORS.teamABorder };
  }
  if (low.includes('1d4e') || low.includes('2563') || low.includes('3b82') || low.includes('457b')) {
    return { light: COLORS.teamBLight, border: COLORS.teamBBorder };
  }
  return { light: COLORS.surface, border: COLORS.border };
}
