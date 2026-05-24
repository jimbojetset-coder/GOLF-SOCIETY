import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { RADIUS, SPACING } from '../../constants/theme';

const PRESETS = [
  '#E63946', // red
  '#457B9D', // blue
  '#2A9D8F', // teal
  '#E9C46A', // gold
  '#F4A261', // orange
  '#A8DADC', // sky
  '#6A0572', // purple
  '#2D6A4F', // green
  '#1D3557', // navy
  '#F1FAEE', // white
];

interface Props {
  value: string;
  onChange: (colour: string) => void;
  label?: string;
}

export default function ColourPicker({ value, onChange, label }: Props) {
  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        {PRESETS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.swatch, { backgroundColor: c }, value === c && styles.swatchSelected]}
            onPress={() => onChange(c)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#8FA3B1', marginBottom: SPACING.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 34, height: 34, borderRadius: RADIUS.full,
    borderWidth: 2, borderColor: 'transparent',
  },
  swatchSelected: { borderColor: '#fff', transform: [{ scale: 1.2 }] },
});
