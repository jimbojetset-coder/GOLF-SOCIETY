/**
 * ScorecardScanScreen - Enhanced with Manual Creation + Full Editing
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../api/supabase';
import { useAuth } from '../hooks/useAuth';
import { scanScorecard, type ExtractedScorecard, type ExtractedTee, type ExtractedHole } from '../utils/scanScorecard';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

type Step = 'choose' | 'scanning' | 'review' | 'saving';

interface Props {
  onConfirm: (courseId: string, teeId: string, courseName: string) => void;
  onCancel: () => void;
}

export default function ScorecardScanScreen({ onConfirm, onCancel }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('choose');
  const [progressMsg, setProgressMsg] = useState('');
  const [scanResult, setScanResult] = useState<{ scan_id: string; image_url: string; extracted: ExtractedScorecard } | null>(null);
  const [selectedTeeIdx, setSelectedTeeIdx] = useState(0);
  const [editedName, setEditedName] = useState('');
  const [editedHoles, setEditedHoles] = useState<ExtractedHole[]>([]);
  const [saving, setSaving] = useState(false);

  // Tee details — editable in review step
  const [manualTeeName, setManualTeeName] = useState('Yellow');
  const [manualTeeColour, setManualTeeColour] = useState('Yellow');
  const [manualSlopeRating, setManualSlopeRating] = useState('113');
  const [manualCourseRating, setManualCourseRating] = useState('72.0');
  const [manualTotalPar, setManualTotalPar] = useState('72');

  // ── Scan Flow ─────────────────────────────────────────────
  const handleScan = async (source: 'camera' | 'library') => {
    if (!user) return;
    setStep('scanning');
    setProgressMsg('Starting AI scan…');
    const result = await scanScorecard(source, user.id, (msg) => setProgressMsg(msg));
    if (!result) {
      setStep('choose');
      return;
    }
    setScanResult(result);
    setEditedName(result.extracted.course_name ?? '');
    setEditedHoles([...result.extracted.holes]);
    setStep('review');
  };

  // ── Full Manual Entry ─────────────────────────────────────
  const startManualEntry = () => {
    setEditedName('');
    setEditedHoles(Array.from({ length: 18 }, (_, i) => ({
      hole_number: i + 1,
      par: 4,
      stroke_index: i + 1,
      yards_by_tee: {},
    })));
    setScanResult(null);
    setStep('review');
  };

  // ── Save ──────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!user) return;
    setSaving(true);
    setStep('saving');

    const courseName = editedName.trim() || (scanResult?.extracted.course_name ?? 'Manual Course');
    const teeName = scanResult
      ? (scanResult.extracted.tees[selectedTeeIdx]?.tee_name || manualTeeName)
      : manualTeeName;

    try {
      const { data: courseData, error: courseErr } = await supabase
        .from('courses')
        .insert({
          name: courseName,
          holes_count: 18,
          created_by_user_id: user.id,
          source: scanResult ? 'scan' : 'manual',
          is_verified: false,
        })
        .select()
        .single();
      if (courseErr) throw courseErr;

      const { data: teeData, error: teeErr } = await supabase
        .from('course_tees')
        .insert({
          course_id: courseData.id,
          tee_name: teeName,
          tee_colour: teeName,
          course_rating: parseFloat(manualCourseRating) || 72,
          slope_rating: parseInt(manualSlopeRating) || 113,
          total_par: parseInt(manualTotalPar) || 72,
        })
        .select()
        .single();
      if (teeErr) throw teeErr;

      const holeInserts = editedHoles.map(h => ({
        course_id: courseData.id,
        tee_id: teeData.id,
        hole_number: h.hole_number,
        par: h.par,
        stroke_index: h.stroke_index,
        yards: h.yards_by_tee?.[teeName] ?? null,
      }));

      const { error: holesErr } = await supabase.from('course_holes').insert(holeInserts);
      if (holesErr) throw holesErr;

      if (scanResult) {
        await supabase
          .from('scorecard_scans')
          .update({ status: 'confirmed', course_id: courseData.id })
          .eq('id', scanResult.scan_id);
      }

      onConfirm(courseData.id, teeData.id, courseName);
    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? 'Unknown error');
      setStep('review');
    } finally {
      setSaving(false);
    }
  };

  const updateHole = (holeNumber: number, field: 'par' | 'stroke_index', value: number) => {
    setEditedHoles(prev =>
      prev.map(h =>
        h.hole_number === holeNumber ? { ...h, [field]: Math.max(1, Math.min(field === 'par' ? 9 : 18, value || 1)) } : h
      )
    );
  };

  const updateHoleYards = (holeNumber: number, yardsStr: string) => {
    const teeKey = scanResult
      ? (scanResult.extracted.tees[selectedTeeIdx]?.tee_name ?? manualTeeName)
      : manualTeeName;
    setEditedHoles(prev =>
      prev.map(h =>
        h.hole_number === holeNumber
          ? { ...h, yards_by_tee: { ...h.yards_by_tee, [teeKey]: parseInt(yardsStr) || 0 } }
          : h
      )
    );
  };

  // ── Choose Screen ─────────────────────────────────────────
  if (step === 'choose') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Course</Text>
        </View>
        <View style={styles.chooseBody}>
          <Text style={styles.chooseEmoji}>⛳</Text>
          <Text style={styles.chooseTitle}>Add a Course</Text>
          <Text style={styles.chooseSubtitle}>Scan a scorecard or create manually</Text>

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
            <TouchableOpacity style={styles.sourceCard} onPress={startManualEntry}>
              <View style={styles.sourceIcon}>
                <Ionicons name="create-outline" size={32} color={COLORS.accent} />
              </View>
              <Text style={styles.sourceLabel}>Manual Entry</Text>
              <Text style={styles.sourceHint}>Create from scratch</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tipBox}>
            <Ionicons name="bulb-outline" size={16} color={COLORS.warning} />
            <Text style={styles.tipText}>
              Tip: For best scan results include the full scorecard — especially hole numbers, par, and stroke index.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'scanning' || step === 'saving') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scanningBody}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.scanningTitle}>{step === 'scanning' ? 'Scanning…' : 'Saving course…'}</Text>
          <Text style={styles.scanningStep}>{progressMsg}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Review + Manual Edit Screen ───────────────────────────
  if (step === 'review') {
    const currentHoles = editedHoles.length > 0 
      ? editedHoles.sort((a, b) => a.hole_number - b.hole_number) 
      : (scanResult?.extracted.holes || []);
    const tee = scanResult?.extracted.tees[selectedTeeIdx] ?? { tee_name: 'Yellow' };

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('choose')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review & Edit Course</Text>
          <TouchableOpacity
            style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={saving}
          >
            <Text style={styles.confirmBtnText}>Save Course ✓</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.reviewScroll} showsVerticalScrollIndicator={false}>
          {scanResult && (
            <Image source={{ uri: scanResult.image_url }} style={styles.thumbnail} resizeMode="cover" />
          )}

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

          {/* Tee Details */}
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>Tee Details</Text>
            <View style={styles.teeGrid}>
              <View style={styles.teeField}>
                <Text style={styles.teeFieldLabel}>Tee Name</Text>
                <TextInput
                  style={styles.teeInput}
                  value={manualTeeName}
                  onChangeText={setManualTeeName}
                  placeholder="e.g. Yellow"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
              <View style={styles.teeField}>
                <Text style={styles.teeFieldLabel}>Colour</Text>
                <TextInput
                  style={styles.teeInput}
                  value={manualTeeColour}
                  onChangeText={setManualTeeColour}
                  placeholder="e.g. Yellow"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
              <View style={styles.teeField}>
                <Text style={styles.teeFieldLabel}>Course Rating</Text>
                <TextInput
                  style={styles.teeInput}
                  value={manualCourseRating}
                  onChangeText={setManualCourseRating}
                  placeholder="72.0"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.teeField}>
                <Text style={styles.teeFieldLabel}>Slope Rating</Text>
                <TextInput
                  style={styles.teeInput}
                  value={manualSlopeRating}
                  onChangeText={setManualSlopeRating}
                  placeholder="113"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.teeField}>
                <Text style={styles.teeFieldLabel}>Total Par</Text>
                <TextInput
                  style={styles.teeInput}
                  value={manualTotalPar}
                  onChangeText={setManualTotalPar}
                  placeholder="72"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </View>

          {/* Editable Holes Table */}
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>Holes — Tap fields to edit</Text>
            <View style={styles.holesTable}>
              <View style={[styles.holeRow, styles.holeRowHeader]}>
                <Text style={[styles.holeCell, styles.holeCellHeader, { flex: 0.6 }]}>Hole</Text>
                <Text style={[styles.holeCell, styles.holeCellHeader]}>Par</Text>
                <Text style={[styles.holeCell, styles.holeCellHeader]}>SI</Text>
                <Text style={[styles.holeCell, styles.holeCellHeader]}>Yds</Text>
              </View>
              {currentHoles.map((h, i) => (
                <View key={h.hole_number} style={[styles.holeRow, i % 2 === 0 && styles.holeRowAlt]}>
                  <Text style={[styles.holeCell, { flex: 0.6, fontWeight: '700', color: COLORS.accent }]}>{h.hole_number}</Text>
                  <TextInput
                    style={styles.holeInput}
                    value={h.par.toString()}
                    onChangeText={(v) => updateHole(h.hole_number, 'par', parseInt(v) || 4)}
                    keyboardType="number-pad"
                    maxLength={1}
                  />
                  <TextInput
                    style={styles.holeInput}
                    value={h.stroke_index.toString()}
                    onChangeText={(v) => updateHole(h.hole_number, 'stroke_index', parseInt(v) || 1)}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <TextInput
                    style={[styles.holeInput, { color: COLORS.textSecondary }]}
                    value={String(h.yards_by_tee?.[manualTeeName] ?? '')}
                    onChangeText={(v) => updateHoleYards(h.hole_number, v)}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="—"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.rescanBtn} onPress={() => setStep('choose')}>
            <Ionicons name="refresh-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.rescanText}>Start Over</Text>
          </TouchableOpacity>
          <View style={{ height: SPACING.xl * 2 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
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

  scanningBody: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: SPACING.md, padding: SPACING.xl,
  },
  scanningTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  scanningStep: { fontSize: 14, color: COLORS.textSecondary },

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
  holesTable: {
    borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  holeRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm, paddingVertical: 8, alignItems: 'center',
  },
  holeRowHeader: { backgroundColor: COLORS.surfaceHigh },
  holeRowAlt: { backgroundColor: COLORS.background + '88' },
  holeCell: { flex: 1, fontSize: 14, color: COLORS.text, textAlign: 'center' },
  holeCellHeader: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5 },
  holeInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    textAlign: 'center',
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rescanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: SPACING.md,
  },
  rescanText: { fontSize: 13, color: COLORS.textSecondary },

  // Tee details form
  teeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  teeField: { minWidth: '45%', flex: 1 },
  teeFieldLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.6, marginBottom: 4 },
  teeInput: {
    backgroundColor: COLORS.surfaceHigh, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm, paddingVertical: 8,
    color: COLORS.text, fontSize: 14, fontWeight: '600',
  },
});
