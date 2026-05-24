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
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

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
  name: string;
  team: 'A' | 'B';
  strokesReceived: number;
}

interface Props {
  holes: HoleScore[];
  players: Player[];
  teamAName: string;
  teamBName: string;
  teamAColour: string;
  teamBColour: string;
  matchStatus: string;
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
          <Text style={styles.statusText}>{matchStatus}</Text>
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
        <TouchableOpacity style={styles.finishBtn} onPress={onComplete}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.finishText}>Finish & Submit</Text>
        </TouchableOpacity>

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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  teamLabel: { fontSize: 14, fontWeight: '800' },
  statusPill: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statusText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  grid: { paddingHorizontal: SPACING.sm },
  row: {
    flexDirection: 'row', alignItems: 'center',
    height: CELL_H,
  },
  rowAlt: { backgroundColor: COLORS.surfaceHigh + '44' },
  totalRow: {
    height: CELL_H + 4,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border,
  },
  grandTotalRow: {
    height: CELL_H + 8,
    backgroundColor: COLORS.surface,
    borderTopWidth: 2, borderBottomWidth: 1, borderColor: COLORS.accent + '55',
    marginTop: 4,
  },
  // Column widths
  cellHole: { width: 36, alignItems: 'center' },
  cellPar: { width: 30, alignItems: 'center' },
  cellSI: { width: 30, alignItems: 'center' },
  cellScore: { flex: 1, alignItems: 'center' },
  cellStatus: { width: 36, alignItems: 'center' },
  // Text styles
  headerCell: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5 },
  holeNumText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  parText: { fontSize: 13, color: COLORS.textSecondary },
  siText: { fontSize: 11, color: COLORS.textMuted },
  totalLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary },
  totalValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  grandTotal: { fontSize: 16, fontWeight: '900' },
  holeResultText: { fontSize: 12, fontWeight: '800' },
  // Score cell
  scoreCell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: CELL_H },
  scoreCellInner: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  scoreCellText: { fontSize: 14, fontWeight: '700' },
  scoreCellEmpty: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  scoreCellEmptyText: { fontSize: 14, color: COLORS.border },
  // Finish
  finishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#2A7D2E',
    borderRadius: RADIUS.md, padding: SPACING.md,
    marginTop: SPACING.lg, marginHorizontal: SPACING.md,
  },
  finishText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Edit modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  editSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, gap: SPACING.md,
  },
  editTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  editSubtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: -8 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickBtn: {
    width: 34, height: 42, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceHigh,
    borderWidth: 1, borderColor: COLORS.border,
  },
  quickBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  quickBtnTextSelected: { color: '#fff' },
  editInput: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.md, padding: SPACING.md,
    color: COLORS.text, fontSize: 28, fontWeight: '800',
    textAlign: 'center',
    borderWidth: 2,
  },
  editActions: { flexDirection: 'row', gap: SPACING.md },
  editCancel: {
    flex: 1, padding: SPACING.md,
    borderRadius: RADIUS.md, alignItems: 'center',
    backgroundColor: COLORS.surfaceHigh,
    borderWidth: 1, borderColor: COLORS.border,
  },
  editCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  editConfirm: {
    flex: 2, padding: SPACING.md,
    borderRadius: RADIUS.md, alignItems: 'center',
  },
  editConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
