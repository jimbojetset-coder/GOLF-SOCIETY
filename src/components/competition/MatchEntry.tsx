/**
 * Define a single match: format, day, session, scorer.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FORMAT_LABELS } from '../../constants/theme';
import { fmtDay } from '../../utils/dateHelpers';
import type { PlayerDraft } from './PlayerEntry';

export interface MatchDraft {
  id: string;
  format: 'fourball' | 'foursomes' | 'singles' | 'scramble';
  session_date: string;   // YYYY-MM-DD
  session: 'Morning' | 'Afternoon' | 'Evening';
  scorer_player_id: string | null;  // draft player id
}

const FORMATS: MatchDraft['format'][] = ['fourball', 'foursomes', 'singles', 'scramble'];
const SESSIONS: MatchDraft['session'][] = ['Morning', 'Afternoon', 'Evening'];

interface Props {
  match: MatchDraft;
  matchNumber: number;
  eventDays: string[];
  players: PlayerDraft[];   // only has_app players can be scorers
  onUpdate: (m: MatchDraft) => void;
  onRemove: () => void;
}

export default function MatchEntry({
  match, matchNumber, eventDays, players, onUpdate, onRemove,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const update = (fields: Partial<MatchDraft>) => onUpdate({ ...match, ...fields });
  const appPlayers = players.filter(p => p.has_app && p.name);

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(e => !e)}>
        <View style={styles.matchNum}>
          <Text style={styles.matchNumText}>{matchNumber}</Text>
        </View>
        <Text style={styles.matchSummary}>
          {FORMAT_LABELS[match.format]} · {fmtDay(match.session_date)} {match.session}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16} color={COLORS.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>

          {/* Format */}
          <Text style={styles.label}>Format</Text>
          <View style={styles.chipRow}>
            {FORMATS.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, match.format === f && styles.chipActive]}
                onPress={() => update({ format: f })}
              >
                <Text style={[styles.chipText, match.format === f && styles.chipTextActive]}>
                  {FORMAT_LABELS[f]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Day */}
          <Text style={styles.label}>Day</Text>
          <View style={styles.chipRow}>
            {eventDays.map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, match.session_date === d && styles.chipActive]}
                onPress={() => update({ session_date: d })}
              >
                <Text style={[styles.chipText, match.session_date === d && styles.chipTextActive]}>
                  {fmtDay(d)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Session */}
          <Text style={styles.label}>Session</Text>
          <View style={styles.chipRow}>
            {SESSIONS.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, match.session === s && styles.chipActive]}
                onPress={() => update({ session: s })}
              >
                <Text style={[styles.chipText, match.session === s && styles.chipTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Scorer */}
          <Text style={styles.label}>Nominated scorer</Text>
          {appPlayers.length === 0 ? (
            <Text style={styles.noScorer}>
              No players with the app yet — you can assign a scorer later.
            </Text>
          ) : (
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, match.scorer_player_id === null && styles.chipActive]}
                onPress={() => update({ scorer_player_id: null })}
              >
                <Text style={[styles.chipText, match.scorer_player_id === null && styles.chipTextActive]}>
                  Assign later
                </Text>
              </TouchableOpacity>
              {appPlayers.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chip, match.scorer_player_id === p.id && styles.chipActive]}
                  onPress={() => update({ scorer_player_id: p.id })}
                >
                  <Text style={[styles.chipText, match.scorer_player_id === p.id && styles.chipTextActive]}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
            <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
            <Text style={styles.removeBtnText}>Remove match</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, gap: SPACING.sm,
  },
  matchNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  matchNumText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  matchSummary: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '600' },
  body: { padding: SPACING.md, paddingTop: 0, gap: SPACING.sm },
  label: { fontSize: 12, color: COLORS.textSecondary, marginTop: SPACING.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  noScorer: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginTop: SPACING.sm,
  },
  removeBtnText: { fontSize: 13, color: COLORS.danger },
});
