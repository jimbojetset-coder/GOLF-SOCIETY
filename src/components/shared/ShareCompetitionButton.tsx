/**
 * ShareCompetitionButton
 *
 * Two modes:
 *  - default: full pill button labelled "Invite Spectators"
 *  - compact: icon-only circle for nav bars
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/theme';

interface Props {
  competitionName: string;
  shareToken: string;
  compact?: boolean;
}

export default function ShareCompetitionButton({ competitionName, shareToken, compact }: Props) {
  const handleShare = async () => {
    const deepLink = Linking.createURL(`join/${shareToken}`);
    const message =
      `You're invited to follow "${competitionName}" live!\n\n` +
      `Tap to join: ${deepLink}\n\n` +
      `Don't have Golf Society? Download it from the App Store or Google Play.`;

    try {
      await Share.share({ message, title: `Join ${competitionName}` });
    } catch (err: any) {
      Alert.alert('Share failed', err.message);
    }
  };

  if (compact) {
    return (
      <TouchableOpacity style={styles.compactBtn} onPress={handleShare} activeOpacity={0.8}>
        <Ionicons name="share-outline" size={18} color={COLORS.accent} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.fullBtn} onPress={handleShare} activeOpacity={0.85}>
      <Ionicons name="share-outline" size={16} color={COLORS.accent} />
      <Text style={styles.fullText}>Invite Spectators</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fullBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    ...SHADOW.card,
  },
  fullText: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },

  compactBtn: {
    width: 38, height: 38, borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1.5, borderColor: COLORS.accentBorder,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.card,
  },
});
