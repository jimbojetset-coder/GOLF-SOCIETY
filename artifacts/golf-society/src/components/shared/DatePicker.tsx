/**
 * Lightweight inline date picker — no native modules required.
 * Renders a scrollable row of day chips for ±30 days from today.
 */
import React, { useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { todayISO, addDays, fmtDay } from '../../utils/dateHelpers';

interface Props {
  value: string;           // YYYY-MM-DD
  onChange: (date: string) => void;
  minDate?: string;        // YYYY-MM-DD
  label?: string;
}

const TODAY = todayISO();
const DAYS = Array.from({ length: 60 }, (_, i) => addDays(TODAY, i));

export default function DatePicker({ value, onChange, minDate, label }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const available = minDate ? DAYS.filter(d => d >= minDate) : DAYS;

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {available.map((day) => {
          const selected = day === value;
          const parts = fmtDay(day).split(' ');
          return (
            <TouchableOpacity
              key={day}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(day)}
            >
              <Text style={[styles.chipWeekday, selected && styles.chipTextSelected]}>
                {parts[0]}
              </Text>
              <Text style={[styles.chipDay, selected && styles.chipTextSelected]}>
                {parts[1]}
              </Text>
              <Text style={[styles.chipMonth, selected && styles.chipTextSelected]}>
                {parts[2]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13, color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  row: { gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  chip: {
    width: 52, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md, alignItems: 'center',
    backgroundColor: COLORS.surfaceHigh,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipWeekday: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  chipDay: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  chipMonth: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
});
