import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  competitionName: string;
  shareToken: string;
}

export default function ShareCompetitionButton({ competitionName, shareToken }: Props) {
  const handleShare = async () => {
    const deepLink = Linking.createURL(`join/${shareToken}`);

    // Universal fallback link (works before app is installed too)
    const message =
      `You're invited to follow "${competitionName}" live on Golf Scoring!\n\n` +
      `Open the app and tap this link to join:\n${deepLink}\n\n` +
      `Don't have the app? Download Golf Scoring from the App Store / Google Play.`;

    try {
      await Share.share({ message, title: `Join ${competitionName}` });
    } catch (err: any) {
      Alert.alert('Share failed', err.message);
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handleShare}>
      <Ionicons name="share-outline" size={18} color={COLORS.accent} />
      <Text style={styles.text}>Invite Spectators</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6,
    borderWidth: 1, borderColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  text: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
});
