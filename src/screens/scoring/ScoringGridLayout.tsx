/**
 * Layout 2 — Scorecard Grid
 * All 18 holes in a scrollable table. Tap a cell to edit inline.
 * Running match status shown in the rightmost column.
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/theme';

interface HoleScore {
  hole: number;
  par: number;
  strokeIndex: number;
  scoreA: number | null;
  scoreA2?: number | null;
  scoreB: number | null;
  scoreB2?: number | null;
  holeResult?: 'A' | 'B' | 'halved' | null;
  matchStatusAfter?: string;
}

interface Player {
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

interface Props {
  holes: HoleScore[];
  players: Player[];
  teamAName: string;
  teamBName: string;
  teamAColour: string;
  teamBColour: string;
  matchStatus: { label: string; leader: 'A' | 'B' | null };
  format: string;
  onScoreChange: (hole: number, field: keyof HoleScore, value: number | null) => void;
  onComplete: () => void;
}

interface EditingCell {
  hole: number;
  field: keyof HoleScore;
  current: number | null;
  label: string;
  par: number;
  colour: string;
}

// Score colour coding
function scoreColour(score: number | null, par: number, strokes: number): string {
  if (score === null) return COLORS.text;
  const net = score - strokes;
  const diff = net - par;
  if (diff <= -2) return '#F4A261'; // eagle+
  if (diff === -1) return '#2A9D8F'; // birdie
  if (diff === 0) return COLORS.text; // par
  if (diff === 1) return '#E76F51'; // bogey
  return '#E63946'; // double+
}

function ScoreCell({
  score, par, strokes, colour, onPress,
}: {
  score: number | null;
  par: number;
  strokes: number;
  colour: string;
  onPress: () => void;
}) {
  const col = scoreColour(score, par, strokes);
  const diff = score !== null ? score - strokes - par : null;
  const isEaglePlus = diff !== null && diff <= -2;
  const isBirdie = diff === -1;
  const isDoublePlus = diff !== null && diff >= 2;

  return (
    <TouchableOpacity style={styles.scoreCell} onPress={onPress}>
      {score !== null ? (
        <View style={[
          styles.scoreCellInner,
          isBirdie && { borderRadius: 999, borderWidth: 1.5, borderColor: col },
          isEaglePlus && { borderRadius: 999, borderWidth: 2.5, borderColor: col },
          isDoublePlus && { borderWidth: 1.5, borderColor: col },
        ]}>
          <Text style={[styles.scoreCellText, { color: col }]}>{score}</Text>
        </View>
      ) : (
        <View style={styles.scoreCellEmpty}>
          <Text style={styles.scoreCellEmptyText}>—</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ScoringGridLayout({
  holes, players, teamAName, teamBName, teamAColour, teamBColour,
  matchStatus, format, onScoreChange, onComplete,
}: Props) {
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const playerA = players.find(p => p.team === 'A');
  const playerA2 = players.filter(p => p.team === 'A')[1];
  const playerB = players.find(p => p.team === 'B');
  const playerB2 = players.filter(p => p.team === 'B')[1];

  const showA2 = format === 'fourball' && !!playerA2;
  const showB2 = format === 'fourball' && !!playerB2;

  const getStrokesOnHole = (player: Player, strokeIndex: number) => {
    if (!player) return 0;
    const full = Math.floor(player.strokesReceived / 18);
    const extra = player.strokesReceived % 18;
    return full + (strokeIndex <= extra ? 1 : 0);
  };

  const openEdit = (hole: HoleScore, field: keyof HoleScore, player: Player, colour: string) => {
    setEditing({
      hole: hole.hole,
      field,
      current: (hole[field] as number | null) ?? null,
      label: player.name,
      par: hole.par,
      colour,
    });
    setEditValue(String(hole[field] ?? ''));
  };

  const confirmEdit = () => {
    if (!editing) return;
    const num = parseInt(editValue);
    onScoreChange(editing.hole, editing.field, isNaN(num) ? null : Math.max(1, Math.min(99, num)));
    setEditing(null);
  };

  // Totals
  const totalA = holes.reduce((s, h) => s + (h.scoreA ?? 0), 0);
  const totalB = holes.reduce((s, h) => s + (h.scoreB ?? 0), 0);

  // Split into front 9 / back 9
  const front = holes.slice(0, 9);
  const back = holes.slice(9);

  const renderHalfGrid = (half: HoleScore[], label: 'OUT' | 'IN') => (
    <>
      {/* Header row */}
      <View style={styles.row}>
        <View style={styles.cellHole}><Text style={styles.headerCell}>HOLE</Text></View>
        <View style={styles.cellPar}><Text style={styles.headerCell}>PAR</Text></View>
        <View style={styles.cellSI}><Text style={styles.headerCell}>SI</Text></View>
        {playerA && <View style={styles.cellScore}><Text style={[styles.headerCell, { color: teamAColour }]} numberOfLines={1}>{playerA.name.split(' ')[0]}</Text></View>}
        {showA2 && <View style={styles.cellScore}><Text style={[styles.headerCell, { color: teamAColour }]} numberOfLines={1}>{playerA2!.name.split(' ')[0]}</Text></View>}
        {playerB && <View style={styles.cellScore}><Text style={[styles.headerCell, { color: teamBColour }]} numberOfLines={1}>{playerB.name.split(' ')[0]}</Text></View>}
        {showB2 && <View style={styles.cellScore}><Text style={[styles.headerCell, { color: teamBColour }]} numberOfLines={1}>{playerB2!.name.split(' ')[0]}</Text></View>}
        <View style={styles.cellStatus}><Text style={styles.headerCell}>HOLE</Text></View>
      </View>

      {/* Hole rows */}
      {half.map(hole => (
        <View key={hole.hole} style={[styles.row, hole.hole % 2 === 0 && styles.rowAlt]}>
          <View style={styles.cellHole}><Text style={styles.holeNumText}>{hole.hole}</Text></View>
          <View style={styles.cellPar}><Text style={styles.parText}>{hole.par}</Text></View>
          <View style={styles.cellSI}><Text style={styles.siText}>{hole.strokeIndex}</Text></View>

          {playerA && (
            <ScoreCell
              score={hole.scoreA}
              par={hole.par}
              strokes={getStrokesOnHole(playerA, hole.strokeIndex)}
              colour={teamAColour}
              onPress={() => openEdit(hole, 'scoreA', playerA, teamAColour)}
            />
          )}
          {showA2 && (
            <ScoreCell
              score={hole.scoreA2 ?? null}
              par={hole.par}
              strokes={getStrokesOnHole(playerA2!, hole.strokeIndex)}
              colour={teamAColour}
              onPress={() => openEdit(hole, 'scoreA2', playerA2!, teamAColour)}
            />
          )}
          {playerB && (
            <ScoreCell
              score={hole.scoreB}
              par={hole.par}
              strokes={getStrokesOnHole(playerB, hole.strokeIndex)}
              colour={teamBColour}
              onPress={() => openEdit(hole, 'scoreB', playerB, teamBColour)}
            />
          )}
          {showB2 && (
            <ScoreCell
              score={hole.scoreB2 ?? null}
              par={hole.par}
              strokes={getStrokesOnHole(playerB2!, hole.strokeIndex)}
              colour={teamBColour}
              onPress={() => openEdit(hole, 'scoreB2', playerB2!, teamBColour)}
            />
          )}

          {/* Hole result */}
          <View style={styles.cellStatus}>
            {hole.holeResult ? (
              <Text style={[styles.holeResultText, {
                color: hole.holeResult === 'A' ? teamAColour
                  : hole.holeResult === 'B' ? teamBColour
                  : COLORS.textSecondary,
              }]}>
                {hole.holeResult === 'halved' ? '½' : hole.holeResult}
              </Text>
            ) : (
              <Text style={styles.siText}>—</Text>
            )}
          </View>
        </View>
      ))}

      {/* Subtotal row */}
      <View style={[styles.row, styles.totalRow]}>
        <View style={styles.cellHole}><Text style={styles.totalLabel}>{label}</Text></View>
        <View style={styles.cellPar}>
          <Text style={styles.totalValue}>{half.reduce((s, h) => s + h.par, 0)}</Text>
        </View>
        <View style={styles.cellSI} />
        {playerA && (
          <View style={styles.cellScore}>
            <Text style={[styles.totalValue, { color: teamAColour }]}>
              {half.reduce((s, h) => s + (h.scoreA ?? 0), 0) || '—'}
            </Text>
          </View>
        )}
        {showA2 && (
          <View style={styles.cellScore}>
            <Text style={[styles.totalValue, { color: teamAColour }]}>
              {half.reduce((s, h) => s + (h.scoreA2 ?? 0), 0) || '—'}
            </Text>
          </View>
        )}
        {playerB && (
          <View style={styles.cellScore}>
            <Text style={[styles.totalValue, { color: teamBColour }]}>
              {half.reduce((s, h) => s + (h.scoreB ?? 0), 0) || '—'}
            </Text>
          </View>
        )}
        {showB2 && (
          <View style={styles.cellScore}>
            <Text style={[styles.totalValue, { color: teamBColour }]}>
              {half.reduce((s, h) => s + (h.scoreB2 ?? 0), 0) || '—'}
            </Text>
          </View>
        )}
        <View style={styles.cellStatus} />
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Match status header */}
      <View style={styles.header}>
        <Text style={[styles.teamLabel, { color: teamAColour }]}>{teamAName}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{typeof matchStatus === 'string' ? matchStatus : matchStatus.label}</Text>
        </View>
        <Text style={[styles.teamLabel, { color: teamBColour }]}>{teamBName}</Text>
      </View>

      {/* Grid */}
      <ScrollView ref={scrollRef} contentContainerStyle={styles.grid}>
        {renderHalfGrid(front, 'OUT')}
        <View style={{ height: SPACING.md }} />
        {renderHalfGrid(back, 'IN')}

        {/* Grand total */}
        <View style={[styles.row, styles.grandTotalRow]}>
          <View style={styles.cellHole}><Text style={styles.totalLabel}>TOT</Text></View>
          <View style={styles.cellPar}>
            <Text style={styles.totalValue}>{holes.reduce((s, h) => s + h.par, 0)}</Text>
          </View>
          <View style={styles.cellSI} />
          {playerA && (
            <View style={styles.cellScore}>
              <Text style={[styles.grandTotal, { color: teamAColour }]}>{totalA || '—'}</Text>
            </View>
          )}
          {showA2 && <View style={styles.cellScore} />}
          {playerB && (
            <View style={styles.cellScore}>
              <Text style={[styles.grandTotal, { color: teamBColour }]}>{totalB || '—'}</Text>
            </View>
          )}
          {showB2 && <View style={styles.cellScore} />}
          <View style={styles.cellStatus} />
        </View>

        {/* Finish button */}
        {holes.every(h => h.scoreA !== null && h.scoreB !== null) && (
          <TouchableOpacity style={styles.finishBtn} onPress={onComplete}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.finishText}>Finish & Submit</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Inline edit modal */}
      <Modal visible={!!editing} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setEditing(null)} />
          {editing && (
            <View style={styles.editSheet}>
              <Text style={styles.editTitle}>{editing.label}</Text>
              <Text style={styles.editSubtitle}>Hole {editing.hole} · Par {editing.par}</Text>

              {/* Quick picks */}
              <View style={styles.quickRow}>
                {Array.from({ length: 9 }, (_, i) => i + 1).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.quickBtn,
                      parseInt(editValue) === s && { backgroundColor: editing.colour, borderColor: editing.colour },
                    ]}
                    onPress={() => { setEditValue(String(s)); }}
                  >
                    <Text style={[
                      styles.quickBtnText,
                      parseInt(editValue) === s && styles.quickBtnTextSelected,
                    ]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Manual text input */}
              <TextInput
                style={[styles.editInput, { borderColor: editing.colour }]}
                value={editValue}
                onChangeText={setEditValue}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                autoFocus
              />

              <View style={styles.editActions}>
                <TouchableOpacity style={styles.editCancel} onPress={() => setEditing(null)}>
                  <Text style={styles.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editConfirm, { backgroundColor: editing.colour }]}
                  onPress={confirmEdit}
                >
                  <Text style={styles.editConfirmText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const CELL_H = 38;

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  safeArea:    { flex: 1 },

  // Header
  headerBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background, gap: SPACING.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter:  { flex: 1, alignItems: 'center' },
  headerTitle:   { fontSize: 15, fontWeight: '800', color: COLORS.text },
  headerStatus:  { fontSize: 12, fontWeight: '700', color: COLORS.accent, marginTop: 1 },
  savingBadge: {
    backgroundColor: COLORS.accentLight, borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.accentBorder,
  },
  savingText: { fontSize: 10, fontWeight: '700', color: COLORS.accent },

  // Half toggle
  halfToggle: {
    flexDirection: 'row', backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
    padding: 3, alignSelf: 'center', margin: SPACING.sm,
  },
  halfBtn: {
    paddingHorizontal: 20, paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  halfBtnActive: { backgroundColor: COLORS.accent, ...SHADOW.card },
  halfBtnText:   { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  halfBtnTextActive: { color: COLORS.white },

  // Table
  tableWrap:   { flex: 1 },
  tableScroll: { flex: 1 },
  tableInner:  { minWidth: '100%' },

  // Header row
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceHigh,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.border,
  },
  th:      { justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.sm },
  thText:  { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.8 },
  thTeam:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // Data rows
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    minHeight: 48,
  },
  tableRowAlt: { backgroundColor: COLORS.surfaceHigh },
  tableRowLive:{ backgroundColor: COLORS.accentLight },

  // Cells
  cell: { justifyContent: 'center', alignItems: 'center', paddingVertical: 4 },
  cellHole:   { backgroundColor: COLORS.surfaceHigh },
  cellPar:    {},
  cellSI:     {},
  cellScore: {
    borderLeftWidth: 1, borderLeftColor: COLORS.border,
    borderRightWidth: 1, borderRightColor: COLORS.border,
  },
  cellStatus: { paddingHorizontal: 4 },

  holeNum:   { fontSize: 14, fontWeight: '800', color: COLORS.text },
  parText:   { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  siText:    { fontSize: 10, color: COLORS.textMuted },
  statusCellText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  // Score cell contents
  scoreBox: {
    width: 36, height: 34, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  scoreBoxFilled:   { backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border },
  scoreBoxEmpty:    { backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border, opacity: 0.6 },
  scoreBoxEntered:  { borderColor: COLORS.accent, borderWidth: 1.5, backgroundColor: COLORS.accentLight },
  scoreNum:         { fontSize: 16, fontWeight: '800', color: COLORS.text },
  stablefordDot: {
    position: 'absolute', top: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
  },
  stablefordDotText: { fontSize: 7, fontWeight: '800', color: COLORS.white },

  // Hole result icons
  wonDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  lostDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  halvedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.textMuted },

  // Totals row
  totalsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceHigh,
    borderTopWidth: 2, borderTopColor: COLORS.border,
    minHeight: 44,
  },
  totalLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted },
  totalVal:   { fontSize: 16, fontWeight: '800', color: COLORS.text },

  // Edit modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, gap: SPACING.md,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.border,
    ...SHADOW.cardMd,
  },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: COLORS.text },
  modalHoleInfo: { fontSize: 13, color: COLORS.textMuted },
  modalClose: {
    width: 34, height: 34, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Stepper
  stepperRow:   { flexDirection: 'row', gap: SPACING.sm },
  stepperBlock: { flex: 1, gap: 6 },
  stepperLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.8 },
  stepper:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  stepBtn: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceHigh, borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDec: { borderColor: COLORS.border },
  stepBtnInc: { backgroundColor: COLORS.accentLight, borderColor: COLORS.accentBorder },
  stepVal: {
    flex: 1, textAlign: 'center',
    fontSize: 28, fontWeight: '800', color: COLORS.text,
  },
  stepValEmpty: { fontSize: 18, color: COLORS.textMuted },

  stablefordRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.accentLight, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.accentBorder,
    padding: SPACING.sm,
  },
  stablefordLabel: { flex: 1, fontSize: 13, color: COLORS.textMuted },
  stablefordVal:   { fontSize: 16, fontWeight: '800', color: COLORS.accent },

  modalSaveBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md, alignItems: 'center',
    ...SHADOW.fab,
  },
  modalSaveText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  // Empty / error
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },

  // Match status header (top bar with team names + status pill)
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  teamLabel: { fontSize: 13, fontWeight: '800', flex: 1 },
  statusPill: {
    backgroundColor: COLORS.surfaceHigh, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700', color: COLORS.text },

  // Grid scroll container
  grid: { paddingBottom: SPACING.xl },

  // Generic row/header-cell aliases used by renderHalfGrid
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    minHeight: CELL_H,
  },
  rowAlt: { backgroundColor: COLORS.surfaceHigh },
  headerCell: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.6, textAlign: 'center' },

  holeNumText: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  holeResultText: { fontSize: 12, fontWeight: '800' },

  totalRow: { backgroundColor: COLORS.surfaceHigh, borderTopWidth: 1.5, borderTopColor: COLORS.border },
  totalValue: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  grandTotalRow: { backgroundColor: COLORS.surfaceHigh, borderTopWidth: 2, borderTopColor: COLORS.border },
  grandTotal: { fontSize: 16, fontWeight: '800', color: COLORS.text },

  // Score cell (used by ScoreCell component)
  scoreCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scoreCellInner: {
    width: 32, height: 32, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  scoreCellText: { fontSize: 14, fontWeight: '800' },
  scoreCellEmpty: {
    width: 32, height: 32, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border, opacity: 0.6,
  },
  scoreCellEmptyText: { fontSize: 12, color: COLORS.textMuted },

  // Finish button
  finishBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md, alignItems: 'center',
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    ...SHADOW.fab,
  },
  finishText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  // Edit modal
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  editSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, gap: SPACING.md,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.border,
    ...SHADOW.cardMd,
  },
  editTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  editSubtitle: { fontSize: 13, color: COLORS.textMuted },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  quickBtn: {
    width: 34, height: 34, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceHigh, borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  quickBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  quickBtnTextSelected: { color: COLORS.white },
  editInput: {
    backgroundColor: COLORS.surfaceHigh, borderRadius: RADIUS.md,
    borderWidth: 1.5, textAlign: 'center',
    fontSize: 28, fontWeight: '800', color: COLORS.text,
    paddingVertical: SPACING.sm,
  },
  editActions: { flexDirection: 'row', gap: SPACING.sm },
  editCancel: {
    flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.lg,
    alignItems: 'center', backgroundColor: COLORS.surfaceHigh,
    borderWidth: 1, borderColor: COLORS.border,
  },
  editCancelText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  editConfirm: { flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center' },
  editConfirmText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
