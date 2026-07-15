import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Switch,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/api/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import DatePicker from '../../src/components/shared/DatePicker';
import ColourPicker from '../../src/components/shared/ColourPicker';
import PlayerEntry, { type PlayerDraft } from '../../src/components/competition/PlayerEntry';
import MatchEntry, { type MatchDraft } from '../../src/components/competition/MatchEntry';
import HeroImagePicker from '../../src/components/competition/HeroImagePicker';
import { DEFAULT_HERO } from '../../src/constants/heroImages';
import { todayISO, addDays, dateRange } from '../../src/utils/dateHelpers';
import ScorecardScanScreen from '../../src/screens/ScorecardScanScreen';

const uid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

type Step = 'details' | 'course' | 'teams' | 'dates' | 'players' | 'matches' | 'review';

const STEPS: Step[] = ['details', 'course', 'teams', 'dates', 'players', 'matches', 'review'];

const STEP_LABELS: Record<Step, string> = {
  details: 'Event Details',
  course: 'Course',
  teams: 'Teams',
  dates: 'Dates',
  players: 'Players',
  matches: 'Matches',
  review: 'Review & Create',
};

export default function NewCompetitionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState<Step>('details');
  const [saving, setSaving] = useState(false);
  const [showScanScreen, setShowScanScreen] = useState(false);
  const [showManualCourseModal, setShowManualCourseModal] = useState(false);
  const [manualCourseNameInput, setManualCourseNameInput] = useState('');
  const [manualCourseSaving, setManualCourseSaving] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [hideLeaderboard, setHideLeaderboard] = useState(false);

  // Course
  const [courseId, setCourseId] = useState<string | null>(null);
  const [teeId, setTeeId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState('');

  // Teams
  const [teamAName, setTeamAName] = useState('Europe');
  const [teamAColour, setTeamAColour] = useState('#E63946');
  const [teamBName, setTeamBName] = useState('USA');
  const [teamBColour, setTeamBColour] = useState('#457B9D');

  // Dates
  const [startDate, setStartDate] = useState(addDays(todayISO(), 7));
  const [endDate, setEndDate] = useState(addDays(todayISO(), 9));

  // Players
  const [players, setPlayers] = useState<PlayerDraft[]>([
    { id: uid(), name: '', handicap_index: '', team: 'A', has_app: false },
    { id: uid(), name: '', handicap_index: '', team: 'B', has_app: false },
  ]);

  const addPlayer = (team: 'A' | 'B') => {
    setPlayers(prev => [...prev, { id: uid(), name: '', handicap_index: '', team, has_app: false }]);
  };

  const updatePlayer = (id: string, data: PlayerDraft) =>
    setPlayers(prev => prev.map(p => p.id === id ? data : p));

  const removePlayer = (id: string) =>
    setPlayers(prev => prev.filter(p => p.id !== id));

  // Matches
  const [matches, setMatches] = useState<MatchDraft[]>([
    { id: uid(), format: 'fourball', session_date: addDays(todayISO(), 7), session: 'Morning', scorer_player_id: null, players_a: [], players_b: [] },
  ]);

  const addMatch = () => {
    const defaultDate = startDate || addDays(todayISO(), 7);
    setMatches(prev => [...prev, {
      id: uid(),
      format: 'fourball',
      session_date: defaultDate,
      session: 'Afternoon',
      scorer_player_id: null,
      players_a: [],
      players_b: [],
    }]);
  };

  const updateMatch = (id: string, data: MatchDraft) =>
    setMatches(prev => prev.map(m => m.id === id ? data : m));

  const removeMatch = (id: string) =>
    setMatches(prev => prev.filter(m => m.id !== id));

  const canProceed = (): boolean => {
    switch (step) {
      case 'details': return name.trim().length > 2;
      case 'course': return !!courseId;
      case 'teams': return teamAName.trim().length > 0 && teamBName.trim().length > 0;
      case 'dates': return !!startDate && !!endDate && startDate <= endDate;
      case 'players': return players.filter(p => p.name?.trim()).length >= 2;
      case 'matches': return matches.length > 0;
      default: return true;
    }
  };

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1]);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const back = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) {
      setStep(STEPS[idx - 1]);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      router.back();
    }
  };

  const handleCreateManualCourse = async () => {
    const trimmed = manualCourseNameInput.trim();
    if (!trimmed || !user) return;
    setManualCourseSaving(true);
    try {
      const { data: courseData, error: courseErr } = await supabase
        .from('courses')
        .insert({ name: trimmed, holes_count: 18, created_by_user_id: user.id, source: 'manual' })
        .select()
        .single();
      if (courseErr || !courseData) throw courseErr ?? new Error('No course returned');

      const { data: teeData, error: teeErr } = await supabase
        .from('course_tees')
        .insert({ course_id: courseData.id, tee_name: 'Yellow', tee_colour: 'Yellow', course_rating: 72, slope_rating: 113, total_par: 72 })
        .select()
        .single();
      if (teeErr || !teeData) throw teeErr ?? new Error('No tee returned');

      setCourseId(courseData.id);
      setTeeId(teeData.id);
      setCourseName(trimmed);
      setShowManualCourseModal(false);
      Alert.alert('Success', 'Course created');
    } catch (e) {
      Alert.alert('Error', 'Could not create course');
    } finally {
      setManualCourseSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !courseId) {
      Alert.alert('Missing Information', 'Please select or create a course.');
      return;
    }
    setSaving(true);
    try {
      const shareToken = uid();
      const { data: comp, error } = await supabase
        .from('competitions')
        .insert({
          name: name.trim(),
          notes: notes.trim() || null,
          start_date: startDate,
          end_date: endDate,
          event_date: startDate,
          course_id: courseId,
          tee_id: teeId,
          team_a_name: teamAName.trim(),
          team_a_colour: teamAColour,
          team_b_name: teamBName.trim(),
          team_b_colour: teamBColour,
          status: 'active',
          created_by_user_id: user.id,
          share_token: shareToken,
          hero_image_url: heroImageUrl ?? DEFAULT_HERO,
          hide_leaderboard: hideLeaderboard,
          team_a_points: 0,
          team_b_points: 0,
          handicap_allowance: 0.9,
        })
        .select()
        .single();

      if (error || !comp) throw error;

      Alert.alert('Success', 'Competition created!');
      router.replace(`/(tabs)/leaderboard?competitionId=${comp.id}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const eventDays = dateRange(startDate, endDate);
  const stepIndex = STEPS.indexOf(step);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressBar}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.progressStep, i <= stepIndex && styles.progressStepDone]} />
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <View style={styles.titleRow}>
            <TouchableOpacity onPress={back} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.stepTitle}>{STEP_LABELS[step]}</Text>
          </View>

          {/* DETAILS */}
          {step === 'details' && (
            <View style={styles.section}>
              <Text style={styles.label}>Event Name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ryder Cup 2026" />
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput style={[styles.input, { height: 100 }]} value={notes} onChangeText={setNotes} multiline />
              <HeroImagePicker value={heroImageUrl} onChange={setHeroImageUrl} />
            </View>
          )}

          {/* COURSE - Full Manual + Scan + Edit */}
          {step === 'course' && (
            <View style={styles.section}>
              <Text style={styles.sectionHint}>Add or scan a course</Text>

              <TouchableOpacity style={styles.addBtn} onPress={() => setShowScanScreen(true)}>
                <Ionicons name="scan-outline" size={20} color={COLORS.accent} />
                <Text style={styles.addBtnText}>Scan Scorecard (then edit)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.addBtn} onPress={() => {
                setManualCourseNameInput('');
                setShowManualCourseModal(true);
              }}>
                <Ionicons name="create-outline" size={20} color={COLORS.accent} />
                <Text style={styles.addBtnText}>Manual Course Entry</Text>
              </TouchableOpacity>

              {courseName && <Text style={{ color: COLORS.accent, marginTop: 12, fontWeight: '600' }}>✓ {courseName}</Text>}
            </View>
          )}

          {/* TEAMS, DATES, PLAYERS, MATCHES, REVIEW ... (same as before) */}
          {step === 'teams' && (
            <View style={styles.section}>
              <Text style={styles.label}>Team A</Text>
              <TextInput style={styles.input} value={teamAName} onChangeText={setTeamAName} />
              <ColourPicker value={teamAColour} onChange={setTeamAColour} />
              <Text style={styles.label}>Team B</Text>
              <TextInput style={styles.input} value={teamBName} onChangeText={setTeamBName} />
              <ColourPicker value={teamBColour} onChange={setTeamBColour} />
            </View>
          )}

          {step === 'dates' && (
            <View style={styles.section}>
              <DatePicker label="Start Date" value={startDate} onChange={setStartDate} />
              <DatePicker label="End Date" value={endDate} onChange={setEndDate} />
            </View>
          )}

          {step === 'players' && (
            <View style={styles.section}>
              {players.map(p => (
                <PlayerEntry key={p.id} player={p} onUpdate={d => updatePlayer(p.id, d)} onRemove={() => removePlayer(p.id)} teamAName={teamAName} teamBName={teamBName} teamAColour={teamAColour} teamBColour={teamBColour} />
              ))}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={styles.addBtn} onPress={() => addPlayer('A')}><Text style={styles.addBtnText}>+ Team A</Text></TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={() => addPlayer('B')}><Text style={styles.addBtnText}>+ Team B</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {step === 'matches' && (
            <View style={styles.section}>
              {matches.map((m, i) => (
                <MatchEntry key={m.id} match={m} matchNumber={i+1} eventDays={eventDays} players={players} teamAName={teamAName} teamBName={teamBName} teamAColour={teamAColour} teamBColour={teamBColour} onUpdate={d => updateMatch(m.id, d)} onRemove={() => removeMatch(m.id)} />
              ))}
              <TouchableOpacity style={styles.addBtn} onPress={addMatch}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
                <Text style={styles.addBtnText}>Add Match</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'review' && (
            <View style={styles.section}>
              <Text style={{ fontSize: 18, fontWeight: '700' }}>{name}</Text>
              <Text>Course: {courseName || 'Not selected'}</Text>
              <Text>Dates: {startDate} – {endDate}</Text>
              <Text>Players: {players.filter(p => p.name?.trim()).length}</Text>
              <Text>Matches: {matches.length}</Text>
            </View>
          )}

          <View style={styles.ctaRow}>
            {step !== 'review' ? (
              <TouchableOpacity style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]} onPress={next} disabled={!canProceed()}>
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create Competition</Text>}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {showScanScreen && (
        <ScorecardScanScreen
          onConfirm={(cId, tId, cName) => {
            setCourseId(cId);
            setTeeId(tId);
            setCourseName(cName);
            setShowScanScreen(false);
          }}
          onCancel={() => setShowScanScreen(false)}
        />
      )}

      <Modal
        visible={showManualCourseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManualCourseModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.manualModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowManualCourseModal(false)}
          />
          <View style={styles.manualModalCard}>
            <Text style={styles.manualModalTitle}>Manual Course</Text>
            <Text style={styles.manualModalHint}>Enter course name</Text>
            <TextInput
              style={styles.input}
              value={manualCourseNameInput}
              onChangeText={setManualCourseNameInput}
              placeholder="e.g. Augusta National"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
              editable={!manualCourseSaving}
            />
            <View style={styles.manualModalActions}>
              <TouchableOpacity
                style={styles.manualModalCancel}
                onPress={() => setShowManualCourseModal(false)}
                disabled={manualCourseSaving}
              >
                <Text style={styles.manualModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.manualModalCreate, !manualCourseNameInput.trim() && styles.nextBtnDisabled]}
                onPress={handleCreateManualCourse}
                disabled={!manualCourseNameInput.trim() || manualCourseSaving}
              >
                {manualCourseSaving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.manualModalCreateText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  progressBar: { flexDirection: 'row', gap: 4, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  progressStep: { flex: 1, height: 4, backgroundColor: COLORS.border, borderRadius: 2 },
  progressStepDone: { backgroundColor: COLORS.accent },
  content: { padding: SPACING.md, paddingBottom: 120 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  backBtn: { width: 38, height: 38, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  stepTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  section: { gap: SPACING.md, marginBottom: SPACING.lg },
  sectionHint: { fontSize: 13, color: COLORS.textMuted },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: COLORS.surfaceHigh, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: SPACING.md, backgroundColor: COLORS.surfaceHigh, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  addBtnText: { fontWeight: '600' },
  ctaRow: { marginTop: SPACING.xl },
  nextBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  createBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  manualModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: SPACING.lg },
  manualModalCard: { width: '100%', backgroundColor: COLORS.background, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.sm },
  manualModalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  manualModalHint: { fontSize: 13, color: COLORS.textMuted, marginBottom: 4 },
  manualModalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  manualModalCancel: { flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center', backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border },
  manualModalCancelText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  manualModalCreate: { flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center', backgroundColor: COLORS.accent },
  manualModalCreateText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
