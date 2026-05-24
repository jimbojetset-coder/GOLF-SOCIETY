import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Switch, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { pickAndUploadPlayerPhoto } from '../../utils/uploadPhoto';

export interface PlayerDraft {
  id: string;
  name: string;
  handicap_index: string;
  team: 'A' | 'B';
  has_app: boolean;
  photo_url?: string;
}

interface Props {
  player: PlayerDraft;
  teamAName: string;
  teamBName: string;
  teamAColour: string;
  teamBColour: string;
  onUpdate: (p: PlayerDraft) => void;
  onRemove: () => void;
}

export default function PlayerEntry({
  player, teamAName, teamBName, teamAColour, teamBColour,
  onUpdate, onRemove,
}: Props) {
  const [expanded, setExpanded] = useState(!player.name);
  const [uploading, setUploading] = useState(false);

  const update = (fields: Partial<PlayerDraft>) => onUpdate({ ...player, ...fields });

  const handlePhotoPress = async () => {
    setUploading(true);
    const url = await pickAndUploadPlayerPhoto(player.id);
    if (url) update({ photo_url: url });
    setUploading(false);
  };

  const teamColour = player.team === 'A' ? teamAColour : teamBColour;
  const teamName = player.team === 'A' ? teamAName : teamBName;

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(e => !e)}>
        {/* Avatar */}
        <TouchableOpacity
          style={[styles.avatar, { borderColor: teamColour }]}
          onPress={handlePhotoPress}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={teamColour} />
          ) : player.photo_url ? (
            <Image source={{ uri: player.photo_url }} style={styles.avatarImg} />
          ) : (
            <Text style={[styles.avatarInitial, { color: teamColour }]}>
              {player.name ? player.name[0].toUpperCase() : '?'}
            </Text>
          )}
          {/* Camera badge */}
          {!uploading && (
            <View style={[styles.cameraBadge, { backgroundColor: teamColour }]}>
              <Ionicons name="camera" size={8} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <View style={[styles.teamPill, { backgroundColor: teamColour + '33' }]}>
          <Text style={[styles.teamPillText, { color: teamColour }]}>{teamName}</Text>
        </View>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.name || 'New player'}
        </Text>
        {player.handicap_index !== '' && (
          <Text style={styles.hcp}>HCP {player.handicap_index}</Text>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16} color={COLORS.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {/* Photo picker (larger tap area in expanded view) */}
          <TouchableOpacity style={styles.photoRow} onPress={handlePhotoPress} disabled={uploading}>
            <View style={[styles.avatarLarge, { borderColor: teamColour }]}>
              {uploading ? (
                <ActivityIndicator color={teamColour} />
              ) : player.photo_url ? (
                <Image source={{ uri: player.photo_url }} style={styles.avatarLargeImg} />
              ) : (
                <Ionicons name="camera-outline" size={28} color={COLORS.textMuted} />
              )}
            </View>
            <View>
              <Text style={styles.photoLabel}>
                {player.photo_url ? 'Change photo' : 'Add photo'}
              </Text>
              <Text style={styles.photoHint}>Optional · compressed automatically</Text>
            </View>
          </TouchableOpacity>

          {/* Name */}
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={player.name}
            onChangeText={v => update({ name: v })}
            placeholder="e.g. Rory McIlroy"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="words"
          />

          {/* Handicap */}
          <Text style={styles.label}>Handicap Index</Text>
          <TextInput
            style={styles.input}
            value={player.handicap_index}
            onChangeText={v => update({ handicap_index: v })}
            placeholder="e.g. 14.2 (leave blank if unknown)"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="decimal-pad"
          />

          {/* Team toggle */}
          <Text style={styles.label}>Team</Text>
          <View style={styles.teamToggle}>
            <TouchableOpacity
              style={[styles.teamBtn, player.team === 'A' && { backgroundColor: teamAColour }]}
              onPress={() => update({ team: 'A' })}
            >
              <Text style={[styles.teamBtnText, player.team === 'A' && styles.teamBtnActive]}>
                {teamAName}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.teamBtn, player.team === 'B' && { backgroundColor: teamBColour }]}
              onPress={() => update({ team: 'B' })}
            >
              <Text style={[styles.teamBtnText, player.team === 'B' && styles.teamBtnActive]}>
                {teamBName}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Has app toggle */}
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Has the app</Text>
              <Text style={styles.switchHint}>Can be nominated as scorer for a match</Text>
            </View>
            <Switch
              value={player.has_app}
              onValueChange={v => update({ has_app: v })}
              trackColor={{ true: COLORS.accent, false: COLORS.surfaceHigh }}
              thumbColor="#fff"
            />
          </View>

          {/* Remove */}
          <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
            <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
            <Text style={styles.removeBtnText}>Remove player</Text>
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
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarInitial: { fontSize: 15, fontWeight: '800' },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 14, height: 14, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.surfaceHigh,
  },
  teamPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  teamPillText: { fontSize: 11, fontWeight: '700' },
  playerName: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.text },
  hcp: { fontSize: 12, color: COLORS.textSecondary },
  body: { padding: SPACING.md, paddingTop: 0, gap: SPACING.sm },
  photoRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
    marginTop: SPACING.sm,
  },
  avatarLarge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.surfaceHigh,
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarLargeImg: { width: 64, height: 64, borderRadius: 32 },
  photoLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  photoHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  label: { fontSize: 12, color: COLORS.textSecondary, marginTop: SPACING.sm },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    color: COLORS.text,
    fontSize: 15,
    borderWidth: 1, borderColor: COLORS.border,
  },
  teamToggle: { flexDirection: 'row', gap: 8 },
  teamBtn: {
    flex: 1, padding: SPACING.sm,
    borderRadius: RADIUS.md, alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  teamBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  teamBtnActive: { color: '#fff' },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: SPACING.sm,
  },
  switchLabel: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  switchHint: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: SPACING.sm,
  },
  removeBtnText: { fontSize: 13, color: COLORS.danger },
});
