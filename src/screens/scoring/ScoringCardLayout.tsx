/**
 * Scoring Layout — Card per Hole (Light Theme)
 *
 * - Pure white base, deep colour accents per team
 * - Hole progress dots (tappable)
 * - Europe/USA tinted player cards with left accent bar
 * - Score stepper: large number, ± buttons, stableford badge
 * - Match status bar (green)
 * - Bottom-corner nav arrows
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, StatusBar,
} from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOW, FORMAT_LABELS } from '../../constants/theme';
import { stablefordPoints, extraStrokesOnHole } from '../../utils/scoring';

// ── Types ─────────────────────────────────────────────────────

export interface ScoringHole {
  hole: number;
  par: number;
  strokeIndex: number;
  yards?: number;
  scoreA: number | null;
  scoreA2?: number | null;
  scoreB: number | null;
  scoreB2?: number | null;
}

export interface ScoringPlayer {
  id: string;
  name: string;
  team: 'A' | 'B';
  teamColour: string;
  teamColourLight: string;
  teamColourBorder: string;
  strokesReceived: number;
  handicapIndex?: number;
  photoUrl?: string;
}

export interface ScoringCardProps {
  holes: ScoringHole[];
  players: ScoringPlayer[];
  teamAName: string;
  teamBName: string;
  teamAColour: string;
  teamBColour: string;
  matchStatus: { label: string; leader: 'A' | 'B' | null };
  format: string;
  sessionLabel?: string;
  onScoreChange: (holeNumber: number, field: keyof ScoringHole, value: number | null) => void;
  onComplete: () => void;
}

// ── Helpers ───────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.trim().split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
}

function relParLabel(gross: number, par: number): { text: string; color: string } {
  const d = gross - par;
  if (d <= -3) return { text: 'Albatross', color: '#7C3AED' };
  if (d === -2) return { text: 'Eagle',    color: '#D97706' };
  if (d === -1) return { text: 'Birdie',   color: COLORS.accent };
  if (d === 0)  return { text: 'Par',      color: COLORS.textSecondary };
  if (d === 1)  return { text: 'Bogey',    color: '#DC2626' };
  return { text: `+${d}`, color: '#991B1B' };
}

// ── Player Score Row ──────────────────────────────────────────

interface PlayerRowProps {
  player: ScoringPlayer;
  grossScore: number | null;
  par: number;
  strokeIndex: number;
  runningGross: number;
  teamName: string;
  onDecrease: () => void;
  onIncrease: () => void;
}

function PlayerRow({ player, grossScore, par, strokeIndex, runningGross, teamName, onDecrease, onIncrease }: PlayerRowProps) {
  const strokes = extraStrokesOnHole(player.strokesReceived, strokeIndex);
  const pts     = grossScore !== null ? stablefordPoints(grossScore, par, player.strokesReceived, strokeIndex) : null;
  const rel     = grossScore !== null ? relParLabel(grossScore, par) : null;

  return (
    <View style={[styles.playerCard, { backgroundColor: player.teamColourLight, borderColor: player.teamColourBorder }]}>
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: player.teamColour }]} />

      <View style={styles.playerBody}>
        {/* Avatar + info */}
        <View style={styles.playerLeft}>
          <View style={[styles.avatar, { backgroundColor: player.teamColour + '20', borderColor: player.teamColour }]}>
            <Text style={[styles.avatarText, { color: player.teamColour }]}>{getInitials(player.name)}</Text>
          </View>
          <View style={styles.playerInfo}>
            <Text style={[styles.playerTeamLabel, { color: player.teamColour }]}>{teamName.toUpperCase()}</Text>
            <Text style={styles.playerName}>{player.name}</Text>
            <Text style={styles.playerMeta}>
              {strokes > 0 ? `+${strokes} shot${strokes > 1 ? 's' : ''} this hole` : 'Scratch on this hole'}
              {runningGross > 0 ? `  ·  Gross ${runningGross}` : ''}
            </Text>
          </View>
        </View>

        {/* Score stepper */}
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.stepBtn} onPress={onDecrease} activeOpacity={0.7}>
            <Text style={styles.stepBtnText}>−</Text>
          </TouchableOpacity>

          <View style={[styles.scoreBox, grossScore !== null && { borderColor: player.teamColour }]}>
            {pts !== null && (
              <View style={[styles.ptsBadge, { backgroundColor: player.teamColour }]}>
                <Text style={styles.ptsBadgeText}>{pts}pt</Text>
              </View>
            )}
            <Text style={[styles.scoreNum, grossScore !== null && { color: player.teamColour }]}>
              {grossScore ?? '—'}
            </Text>
            {rel && <Text style={[styles.relPar, { color: rel.color }]}>{rel.text}</Text>}
          </View>

          <TouchableOpacity style={styles.stepBtn} onPress={onIncrease} activeOpacity={0.7}>
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function ScoringCardLayout({
  holes, players, teamAName, teamBName, teamAColour, teamBColour,
  matchStatus, format, sessionLabel = 'Round 1',
  onScoreChange, onComplete,
}: ScoringCardProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const hole    = holes[currentIdx];
  const isFirst = currentIdx === 0;
  const isLast  = currentIdx === holes.length - 1;

  const matchPlayers = useMemo(() => {
    const A = players.filter(p => p.team === 'A');
    const B = players.filter(p => p.team === 'B');
    const out: { player: ScoringPlayer; scoreField: keyof ScoringHole; teamName: string }[] = [];
    if (format === 'fourball' || format === 'singles') {
      const max = Math.max(A.length, B.length);
      for (let i = 0; i < max; i++) {
        if (A[i]) out.push({ player: A[i], scoreField: i === 0 ? 'scoreA' : 'scoreA2', teamName: teamAName });
        if (B[i]) out.push({ player: B[i], scoreField: i === 0 ? 'scoreB' : 'scoreB2', teamName: teamBName });
      }
    } else {
      if (A[0]) out.push({ player: A[0], scoreField: 'scoreA', teamName: teamAName });
      if (B[0]) out.push({ player: B[0], scoreField: 'scoreB', teamName: teamBName });
    }
    return out;
  }, [players, format]);

  const runningGross = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const { player, scoreField } of matchPlayers) {
      totals[player.id] = holes.slice(0, currentIdx + 1)
        .reduce((sum, h) => sum + ((h[scoreField] as number | null) ?? 0), 0);
    }
    return totals;
  }, [holes, currentIdx, matchPlayers]);

  const goTo = (idx: number) => { if (idx >= 0 && idx < holes.length) setCurrentIdx(idx); };

  const allScored = hole.scoreA !== null && hole.scoreB !== null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* ── Top nav bar ── */}
      <View style={styles.navBar}>
        <Text style={styles.navFormat}>{FORMAT_LABELS[format] ?? format}</Text>
        <Text style={styles.navSession}>{sessionLabel}</Text>
      </View>

      {/* ── Hole progress dots ── */}
      <View style={styles.dotsRow}>
        {holes.map((h, i) => {
          const scored  = holes[i].scoreA !== null || holes[i].scoreB !== null;
          const current = i === currentIdx;
          return (
            <TouchableOpacity key={h.hole} onPress={() => goTo(i)} hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}>
              <View style={[styles.dot, scored && styles.dotDone, current && styles.dotCurrent]}>
                {current && <Text style={styles.dotText}>{h.hole}</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hole card ── */}
        <View style={styles.holeCard}>
          <Text style={styles.holeLabel}>HOLE</Text>
          <Text style={styles.holeNum}>{hole.hole}</Text>
          <View style={styles.holeMeta}>
            <View style={styles.holeMetaChip}>
              <Text style={styles.holeMetaChipText}>Par {hole.par}</Text>
            </View>
            <View style={styles.holeMetaChip}>
              <Text style={styles.holeMetaChipText}>SI {hole.strokeIndex}</Text>
            </View>
            {hole.yards ? (
              <View style={styles.holeMetaChip}>
                <Text style={styles.holeMetaChipText}>{hole.yards} yds</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Player rows ── */}
        {matchPlayers.map(({ player, scoreField }) => {
          const score = hole[scoreField] as number | null;
          return (
            <PlayerRow
              key={player.id}
              player={player}
              grossScore={score}
              par={hole.par}
              strokeIndex={hole.strokeIndex}
              runningGross={runningGross[player.id] ?? 0}
              teamName={teamName}
              onDecrease={() => onScoreChange(hole.hole, scoreField, score !== null ? Math.max(1, score - 1) : hole.par - 1)}
              onIncrease={() => onScoreChange(hole.hole, scoreField, score !== null ? score + 1 : hole.par + 1)}
            />
          );
        })}

        {/* ── Match status ── */}
        <View style={[styles.statusBar,
          matchStatus.leader === 'A' && { backgroundColor: teamAColour + '14', borderColor: teamAColour + '40' },
          matchStatus.leader === 'B' && { backgroundColor: teamBColour + '14', borderColor: teamBColour + '40' },
          !matchStatus.leader          && { backgroundColor: COLORS.surface,    borderColor: COLORS.border },
        ]}>
          <View style={[styles.statusDot, {
            backgroundColor: matchStatus.leader === 'A' ? teamAColour : matchStatus.leader === 'B' ? teamBColour : COLORS.textMuted,
          }]} />
          <Text style={[styles.statusText, {
            color: matchStatus.leader === 'A' ? teamAColour : matchStatus.leader === 'B' ? teamBColour : COLORS.textSecondary,
          }]}>
            {matchStatus.label}
          </Text>
        </View>

        {/* ── Complete button (last hole only) ── */}
        {isLast && allScored && (
          <TouchableOpacity style={styles.completeBtn} onPress={onComplete} activeOpacity={0.8}>
            <Text style={styles.completeBtnText}>Complete Match</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Bottom nav arrows ── */}
      <View style={styles.navArrows}>
        <TouchableOpacity
          style={[styles.arrowBtn, isFirst && styles.arrowBtnDisabled]}
          onPress={() => goTo(currentIdx - 1)}
          disabled={isFirst}
          activeOpacity={0.7}
        >
          <Text style={[styles.arrowText, isFirst && styles.arrowTextDisabled]}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.holeProgress}>Hole {hole.hole} of {holes.length}</Text>

        <TouchableOpacity
          style={[styles.arrowBtn, styles.arrowBtnNext, isLast && styles.arrowBtnDisabled]}
          onPress={() => goTo(currentIdx + 1)}
          disabled={isLast}
          activeOpacity={0.7}
        >
          <Text style={[styles.arrowText, styles.arrowTextNext, isLast && styles.arrowTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  navFormat:  { fontSize: 15, fontWeight: '700', color: COLORS.text },
  navSession: { fontSize: 12, color: COLORS.textMuted },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.background,
  },
  dot: {
    width: 8, height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
  },
  dotDone:    { backgroundColor: COLORS.accent },
  dotCurrent: {
    width: 28, height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentLight,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { fontSize: 11, fontWeight: '700', color: COLORS.accent },

  scroll: { padding: SPACING.md, gap: SPACING.md },

  // ── Hole card
  holeCard: {
    backgroundColor: COLORS.accentLight,
    borderWidth: 1.5,
    borderColor: COLORS.accentBorder,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    ...SHADOW.card,
  },
  holeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: COLORS.accent, marginBottom: 2 },
  holeNum:   { fontSize: 64, fontWeight: '800', color: COLORS.text, lineHeight: 72 },
  holeMeta:  { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  holeMetaChip: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  holeMetaChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  // ── Player card
  playerCard: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  accentBar:  { width: 5 },
  playerBody: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md },

  playerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  avatar: {
    width: 42, height: 42, borderRadius: RADIUS.full,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:       { fontSize: 13, fontWeight: '700' },
  playerTeamLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  playerName:       { fontSize: 14, fontWeight: '700', color: COLORS.text },
  playerInfo:       { flex: 1 },
  playerMeta:       { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },

  // ── Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 32, height: 32, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceHigh,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, fontWeight: '300', color: COLORS.text, lineHeight: 28 },
  scoreBox: {
    width: 62, height: 68, borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
    ...SHADOW.card,
  },
  scoreNum:  { fontSize: 28, fontWeight: '800', color: COLORS.textMuted },
  relPar:    { fontSize: 9, fontWeight: '600', marginTop: 1 },
  ptsBadge: {
    position: 'absolute', top: -8, right: -8,
    borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 2,
    minWidth: 24, alignItems: 'center',
  },
  ptsBadgeText: { fontSize: 9, fontWeight: '800', color: COLORS.white },

  // ── Status bar
  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
  },
  statusDot:  { width: 8, height: 8, borderRadius: RADIUS.full },
  statusText: { fontSize: 14, fontWeight: '700' },

  // ── Complete btn
  completeBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOW.fab,
  },
  completeBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  // ── Nav arrows
  navArrows: {
    position: 'absolute', bottom: 90, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  arrowBtn: {
    width: 56, height: 56, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.borderStrong,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.cardMd,
  },
  arrowBtnNext:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  arrowBtnDisabled: { opacity: 0.3 },
  arrowText:        { fontSize: 28, fontWeight: '300', color: COLORS.text, lineHeight: 40 },
  arrowTextNext:    { color: COLORS.white },
  arrowTextDisabled:{},
  holeProgress:     { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
});
