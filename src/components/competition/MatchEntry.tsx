/**
 * Define a single match: format, day, session, players, scorer.
 *
 * Player assignment rules:
 *  - Singles / Foursomes: 1 player per team
 *  - Fourball / Scramble: up to 2 players per team
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
  session_date: string;
  session: 'Morning' | 'Afternoon' | 'Evening';
  scorer_player_id: string | null;
  // Player draft IDs per team
  players_a: string[];   // 1 or 2 draft IDs from team A
  players_b: string[];   // 1 or 2 draft IDs from team B
}

const FORMATS: MatchDraft['format'][] = ['fourball', 'foursomes', 'singles', 'scramble'];
const SESSIONS: MatchDraft['session'][] = ['Morning', 'Afternoon', 'Evening'];

// How many players each team needs per format
const TEAM_SIZE: Record<MatchDraft['format'], number> = {
  singles: 1,
  foursomes: 1,
  fourball: 2,
  scramble: 2,
};

interface Props {
  match: MatchDraft;
  matchNumber: number;
  eventDays: string[];
  players: PlayerDraft[];
  teamAName: string;
  teamBName: string;
  teamAColour: string;
  teamBColour: string;
  onUpdate: (m: MatchDraft) => void;
  onRemove: () => void;
}

export default function MatchEntry({
  match, matchNumber, eventDays, players,
  teamAName, teamBName, teamAColour, teamBColour,
  onUpdate, onRemove,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const update = (fields: Partial<MatchDraft>) => onUpdate({ ...match, ...fields });

  const teamAPlayers = players.filter(p => p.team === 'A' && p.name.trim());
  const teamBPlayers = players.filter(p => p.team === 'B' && p.name.trim());
  const appPlayers   = players.filter(p => p.has_app && p.name.trim());
  const maxPerTeam   = TEAM_SIZE[match.format];

  const togglePlayer = (team: 'A' | 'B', draftId: string) => {
    const field = team === 'A' ? 'players_a' : 'players_b';
    const current = match[field];
    if (current.includes(draftId)) {
      update({ [field]: current.filter(id => id !== draftId) });
    } else if (current.length < maxPerTeam) {
      update({ [field]: [...current, draftId] });
    } else if (maxPerTeam === 1) {
      // Singles/Foursomes — swap
      update({ [field]: [draftId] });
    }
  };

  const renderPlayerChips = (teamPlayers: PlayerDraft[], team: 'A' | 'B', colour: string) => {
    const selected = team === 'A' ? match.players_a : match.players_b;
    if (teamPlayers.length === 0) {
      return <Text style={styles.noScorer}>No {team === 'A' ? teamAName : teamBName} players added yet.</Text>;
    }
    return (
      <View style={styles.chipRow}>
        {teamPlayers.map(p => {
          const active = selected.includes(p.id);
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, active && { backgroundColor: colour, borderColor: colour }]}
              onPress={() => togglePlayer(team, p.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {p.name}
              </Text>
              {active && maxPerTeam > 1 && (
                <Text style={[styles.chipBadge, { color: colour + 'CC' }]}>
                  {selected.indexOf(p.id) + 1}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const teamAValid = match.players_a.length === maxPerTeam;
  const teamBValid = match.players_b.length === maxPerTeam;

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(e => !e)}>
        <View style={[styles.matchNum, (!teamAValid || !teamBValid) && styles.matchNumWarning]}>
          <Text style={styles.matchNumText}>{matchNumber}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.matchSummary}>
            {FORMAT_LABELS[match.format]} · {fmtDay(match.session_date)} {match.session}
          </Text>
          {(teamAValid && teamBValid) ? (
            <Text style={styles.matchSubSummary}>
              {match.players_a.map(id => players.find(p => p.id === id)?.name).join(' & ')}
              {' vs '}
              {match.players_b.map(id => players.find(p => p.id === id)?.name).join(' & ')}
            </Text>
          ) : (
            <Text style={styles.matchSubWarning}>Players not yet assigned</Text>
          )}
        </View>
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
                onPress={() => update({ format: f, players_a: [], players_b: [] })}
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

          {/* Team A players */}
          <View style={styles.teamLabelRow}>
            <View style={[styles.teamDot, { backgroundColor: teamAColour }]} />
            <Text style={[styles.label, { color: teamAColour, marginTop: 0 }]}>
              {teamAName} — pick {maxPerTeam}
            </Text>
            {teamAValid && <Ionicons name="checkmark-circle" size={16} color={teamAColour} />}
          </View>
          {renderPlayerChips(teamAPlayers, 'A', teamAColour)}

          {/* Team B players */}
          <View style={styles.teamLabelRow}>
            <View style={[styles.teamDot, { backgroundColor: teamBColour }]} />
            <Text style={[styles.label, { color: teamBColour, marginTop: 0 }]}>
              {teamBName} — pick {maxPerTeam}
            </Text>
            {teamBValid && <Ionicons name="checkmark-circle" size={16} color={teamBColour} />}
          </View>
          {renderPlayerChips(teamBPlayers, 'B', teamBColour)}

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
  matchNumWarning: { backgroundColor: COLORS.gold },
  matchNumText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  matchSummary:    { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  matchSubSummary: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  matchSubWarning: { fontSize: 11, color: COLORS.gold, marginTop: 2 },
  body: { padding: SPACING.md, paddingTop: 0, gap: SPACING.sm },
  label: { fontSize: 12, color: COLORS.textSecondary, marginTop: SPACING.sm },
  teamLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginTop: SPACING.sm,
  },
  teamDot: { width: 8, height: 8, borderRadius: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipBadge:      { fontSize: 11, fontWeight: '700' },
  noScorer:       { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginTop: SPACING.sm,
  },
  removeBtnText: { fontSize: 13, color: COLORS.danger },
});
