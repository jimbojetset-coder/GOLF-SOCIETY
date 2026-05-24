/**
 * ScorecardScanScreen
 *
 * Flow:
 *  1. Choose source (Camera / Library)
 *  2. Scan in progress (spinner + step label)
 *  3. Review extracted data — course name, tees, holes
 *  4. Confirm → saves Course + CourseTee + CourseHole to Supabase
 *     then calls onConfirm(courseId, teeId) so the parent can use it
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../api/supabase';
import { useAuth } from '../hooks/useAuth';
import { scanScorecard, type ExtractedScorecard, type ExtractedTee } from '../utils/scanScorecard';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

type Step = 'choose' | 'scanning' | 'review' | 'saving';

interface Props {
  onConfirm: (courseId: string, teeId: string, courseName: string) => void;
  onCancel: () => void;
}

export default function ScorecardScanScreen({ onConfirm, onCancel }: Props) {
  const { user } = useAuth();

  const [step, setStep]                 = useState<Step>('choose');
  const [progressMsg, setProgressMsg]   = useState('');
  const [scanResult, setScanResult]     = useState<{ scan_id: string; image_url: string; extracted: ExtractedScorecard } | null>(null);
  const [selectedTeeIdx, setSelectedTeeIdx] = useState(0);
  const [editedName, setEditedName]     = useState('');
  const [saving, setSaving]             = useState(false);

  // ── Step 1: trigger scan ─────────────────────────────────
  const handleScan = async (source: 'camera' | 'library') => {
    if (!user) return;
    setStep('scanning');
    setProgressMsg('Starting…');

    const result = await scanScorecard(source, user.id, (msg) => setProgressMsg(msg));

    if (!result) {
      setStep('choose');
      return;
    }

    setScanResult(result);
    setEditedName(result.extracted.course_name ?? '');
    setStep('review');
  };

  // ── Step 4: save to Supabase ─────────────────────────────
  const handleConfirm = async () => {
    if (!scanResult || !user) return;
    setSaving(true);
    setStep('saving');

    const { extracted } = scanResult;
    const tee = extracted.tees[selectedTeeIdx];
    const courseName = editedName.trim() || extracted.course_name || 'Unknown Course';

    try {
      // Upsert course
      const { data: courseData, error: courseErr } = await supabase
        .from('courses')
        .insert({
          name: courseName,
          holes_count: extracted.holes.length,
          created_by_user_id: user.id,
          source: 'scan',
          is_verified: false,
        })
        .select()
        .single();

      if (courseErr) throw courseErr;
      const courseId = courseData.id;

      // Insert tee
      const { data: teeData, error: teeErr } = await supabase
        .from('course_tees')
        .insert({
          course_id: courseId,
          tee_name: tee.tee_name,
          tee_colour: tee.tee_colour ?? tee.tee_name,
          course_rating: tee.course_rating,
          slope_rating: tee.slope_rating ?? 113,
          total_yards: tee.total_yards,
          total_par: tee.total_par,
        })
        .select()
        .single();

      if (teeErr) throw teeErr;
      const teeId = teeData.id;

      // Insert holes
      const holeInserts = extracted.holes.map(h => ({
        course_id: courseId,
        tee_id: teeId,
        hole_number: h.hole_number,
        par: h.par,
        stroke_index: h.stroke_index,
        yards: h.yards_by_tee?.[tee.tee_name] ?? null,
      }));

      const { error: holesErr } = await supabase.from('course_holes').insert(holeInserts);
      if (holesErr) throw holesErr;

      // Link scan to course
      await supabase
        .from('scorecard_scans')
        .update({ status: 'confirmed', course_id: courseId })
        .eq('id', scanResult.scan_id);

      onConfirm(courseId, teeId, courseName);

    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? 'Unknown error');
      setStep('review');
      setSaving(false);
    }
  };

  // ── Renders ───────────────────────────────────────────────

  if (step === 'choose') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Scorecard</Text>
        </View>

        <View style={styles.chooseBody}>
          <Text style={styles.chooseEmoji}>⛳</Text>
          <Text style={styles.chooseTitle}>Add a course</Text>
          <Text style={styles.chooseSubtitle}>
            Take a photo of the scorecard or pick one from your library.
            AI will extract the holes, par, stroke index, and course rating.
          </Text>

          <View style={styles.sourceCards}>
            <TouchableOpacity style={styles.sourceCard} onPress={() => handleScan('camera')}>
              <View style={styles.sourceIcon}>
                <Ionicons name="camera-outline" size={32} color={COLORS.accent} />
              </View>
              <Text style={styles.sourceLabel}>Take Photo</Text>
              <Text style={styles.sourceHint}>Best results in good light</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sourceCard} onPress={() => handleScan('library')}>
              <View style={styles.sourceIcon}>
                <Ionicons name="images-outline" size={32} color={COLORS.accent} />
              </View>
              <Text style={styles.sourceLabel}>Photo Library</Text>
              <Text style={styles.sourceHint}>Pick an existing photo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tipBox}>
            <Ionicons name="bulb-outline" size={16} color={COLORS.warning} />
            <Text style={styles.tipText}>
              Tip: include the full scorecard in frame — especially hole numbers, par, and stroke index columns
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'scanning') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scanningBody}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.scanningTitle}>Scanning…</Text>
          <Text style={styles.scanningStep}>{progressMsg}</Text>
          <Text style={styles.scanningNote}>This usually takes 5–15 seconds</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'saving') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scanningBody}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.scanningTitle}>Saving course…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Review step ───────────────────────────────────────────
  if (step === 'review' && scanResult) {
    const { extracted, image_url } = scanResult;
    const tee: ExtractedTee = extracted.tees[selectedTeeIdx] ?? extracted.tees[0];
    const holes = extracted.holes.sort((a, b) => a.hole_number - b.hole_number);

    // Validate SI — all 1-18, no duplicates
    const siValues = holes.map(h => h.stroke_index).filter(Boolean);
    const siSet = new Set(siValues);
    const siValid = siSet.size === holes.length && siValues.every(v => v >= 1 && v <= 18);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('choose')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Scan</Text>
          <TouchableOpacity
            style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={saving}
          >
            <Text style={styles.confirmBtnText}>Use This ✓</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.reviewScroll} showsVerticalScrollIndicator={false}>

          {/* Scanned image thumbnail */}
          <Image source={{ uri: image_url }} style={styles.thumbnail} resizeMode="cover" />

          {/* Course name */}
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>Course Name</Text>
            <TextInput
              style={styles.courseNameInput}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Enter course name"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          {/* Tee selector */}
          {extracted.tees.length > 1 && (
            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Select Tee</Text>
              <View style={styles.teeRow}>
                {extracted.tees.map((t, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.teeChip, selectedTeeIdx === i && styles.teeChipSelected]}
                    onPress={() => setSelectedTeeIdx(i)}
                  >
                    <Text style={[styles.teeChipText, selectedTeeIdx === i && styles.teeChipTextSelected]}>
                      {t.tee_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Tee details */}
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>Tee Details — {tee.tee_name}</Text>
            <View style={styles.teeDetailGrid}>
              <TeeDetail label="Course Rating" value={tee.course_rating?.toString() ?? '—'} />
              <TeeDetail label="Slope" value={tee.slope_rating?.toString() ?? '113 (default)'} warn={!tee.slope_rating} />
              <TeeDetail label="Total Par" value={tee.total_par?.toString() ?? '—'} />
              <TeeDetail label="Yards" value={tee.total_yards?.toString() ?? '—'} />
            </View>
            {!tee.slope_rating && (
              <View style={styles.warnBox}>
                <Ionicons name="warning-outline" size={14} color={COLORS.warning} />
                <Text style={styles.warnText}>Slope rating not found — defaulting to 113 (standard). You can edit this in course settings.</Text>
              </View>
            )}
          </View>

          {/* SI validation warning */}
          {!siValid && (
            <View style={[styles.warnBox, { margin: 0, marginBottom: SPACING.sm }]}>
              <Ionicons name="alert-circle-outline" size={14} color={COLORS.warning} />
              <Text style={styles.warnText}>Stroke index values may be incomplete or duplicated — check the table below</Text>
            </View>
          )}

          {/* Holes table */}
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>{holes.length} Holes Extracted</Text>
            <View style={styles.holesTable}>
              {/* Header */}
              <View style={[styles.holeRow, styles.holeRowHeader]}>
                <Text style={[styles.holeCell, styles.holeCellHeader, { flex: 0.6 }]}>Hole</Text>
                <Text style={[styles.holeCell, styles.holeCellHeader]}>Par</Text>
                <Text style={[styles.holeCell, styles.holeCellHeader]}>SI</Text>
                <Text style={[styles.holeCell, styles.holeCellHeader]}>Yards</Text>
              </View>
              {holes.map((h, i) => {
                const yards = h.yards_by_tee?.[tee.tee_name] ?? null;
                const siOk = h.stroke_index >= 1 && h.stroke_index <= 18;
                return (
                  <View key={h.hole_number} style={[styles.holeRow, i % 2 === 0 && styles.holeRowAlt]}>
                    <Text style={[styles.holeCell, { flex: 0.6, fontWeight: '700', color: COLORS.accent }]}>{h.hole_number}</Text>
                    <Text style={styles.holeCell}>{h.par}</Text>
                    <Text style={[styles.holeCell, !siOk && { color: COLORS.warning }]}>{h.stroke_index ?? '?'}</Text>
                    <Text style={[styles.holeCell, { color: COLORS.textSecondary }]}>{yards ?? '—'}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Re-scan option */}
          <TouchableOpacity style={styles.rescanBtn} onPress={() => setStep('choose')}>
            <Ionicons name="refresh-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.rescanText}>Scan again with a different photo</Text>
          </TouchableOpacity>

          <View style={{ height: SPACING.xl * 2 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

function TeeDetail({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={teeDetailStyles.item}>
      <Text style={teeDetailStyles.label}>{label}</Text>
      <Text style={[teeDetailStyles.value, warn && { color: COLORS.warning }]}>{value}</Text>
    </View>
  );
}

const teeDetailStyles = StyleSheet.create({
  item: {
    flex: 1, minWidth: '45%',
    backgroundColor: COLORS.surfaceHigh, borderRadius: RADIUS.sm,
    padding: SPACING.sm, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  label: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  value: { fontSize: 18, fontWeight: '900', color: COLORS.text, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, paddingTop: SPACING.lg, gap: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: COLORS.text },
  confirmBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Choose
  chooseBody: {
    flex: 1, padding: SPACING.lg, alignItems: 'center',
    justifyContent: 'center', gap: SPACING.md,
  },
  chooseEmoji: { fontSize: 64 },
  chooseTitle: { fontSize: 26, fontWeight: '900', color: COLORS.text },
  chooseSubtitle: {
    fontSize: 14, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 22, maxWidth: 320,
  },
  sourceCards: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  sourceCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.lg, alignItems: 'center', gap: 8,
  },
  sourceIcon: {
    width: 60, height: 60, borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentDim, justifyContent: 'center', alignItems: 'center',
  },
  sourceLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sourceHint: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center' },
  tipBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: COLORS.warning + '15', borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.warning + '33',
    padding: SPACING.md, maxWidth: 340,
  },
  tipText: { fontSize: 12, color: COLORS.warning, flex: 1, lineHeight: 18 },

  // Scanning
  scanningBody: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: SPACING.md, padding: SPACING.xl,
  },
  scanningTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  scanningStep: { fontSize: 14, color: COLORS.textSecondary },
  scanningNote: { fontSize: 12, color: COLORS.textMuted },

  // Review
  reviewScroll: { padding: SPACING.md, gap: SPACING.md },
  thumbnail: {
    width: '100%', height: 180, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceHigh,
  },
  reviewSection: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
    gap: SPACING.sm,
  },
  reviewSectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  courseNameInput: {
    backgroundColor: COLORS.surfaceHigh, borderRadius: RADIUS.md,
    padding: SPACING.md, color: COLORS.text, fontSize: 17, fontWeight: '700',
    borderWidth: 1, borderColor: COLORS.border,
  },

  // Tee selector
  teeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  teeChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border,
  },
  teeChipSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  teeChipText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  teeChipTextSelected: { color: '#fff' },
  teeDetailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Holes table
  holesTable: {
    borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  holeRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm, paddingVertical: 7,
  },
  holeRowHeader: { backgroundColor: COLORS.surfaceHigh },
  holeRowAlt: { backgroundColor: COLORS.background + '88' },
  holeCell: { flex: 1, fontSize: 13, color: COLORS.text, textAlign: 'center' },
  holeCellHeader: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5 },

  // Warnings
  warnBox: {
    flexDirection: 'row', gap: 6, alignItems: 'flex-start',
    backgroundColor: COLORS.warning + '15', borderRadius: RADIUS.sm,
    padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.warning + '33',
  },
  warnText: { fontSize: 11, color: COLORS.warning, flex: 1, lineHeight: 17 },

  // Re-scan
  rescanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: SPACING.md,
  },
  rescanText: { fontSize: 13, color: COLORS.textSecondary },
});
