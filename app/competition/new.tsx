import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Switch,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/api/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';
import DatePicker from '../../src/components/shared/DatePicker';
import ColourPicker from '../../src/components/shared/ColourPicker';
import PlayerEntry, { type PlayerDraft } from '../../src/components/competition/PlayerEntry';
import MatchEntry, { type MatchDraft } from '../../src/components/competition/MatchEntry';
import HeroImagePicker from '../../src/components/competition/HeroImagePicker';
import { DEFAULT_HERO } from '../../src/constants/heroImages';
import { todayISO, addDays, dateRange, fmtDay, fmtFull } from '../../src/utils/dateHelpers';
import { calcPlayingHandicap } from '../../src/utils/scoring';
import ScorecardScanScreen from '../../src/screens/ScorecardScanScreen';

const uid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

// ── Steps ─────────────────────────────────────────────────────
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

// ── Defaults ──────────────────────────────────────────────────
const DEFAULT_SLOPE = 113;
const DEFAULT_RATING = 72;
const DEFAULT_PAR = 72;

export default function NewCompetitionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState<Step>('details');
  const [saving, setSaving] = useState(false);

  // Details
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [hideLeaderboard, setHideLeaderboard] = useState(false);

  // Course
  const [courseId, setCourseId] = useState<string | null>(null);
  const [teeId, setTeeId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>('');
  const [showScanScreen, setShowScanScreen] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualSavingCourse, setManualSavingCourse] = useState(false);
  const [resultsHiddenCount, setResultsHiddenCount] = useState(0);

  // Teams
  const [teamAName, setTeamAName] = useState('Europe');
  const [teamAColour, setTeamAColour] = useState('#E63946');
  const [teamBName, setTeamBName] = useState('USA');
  const [teamBColour, setTeamBColour] = useState('#457B9D');

  // Dates
  const [startDate, setStartDate] = useState(addDays(todayISO(), 7));
  const [endDate, setEndDate] = useState(addDays(todayISO(), 9));

  // Handicap
  const [handicapAllowance, setHandicapAllowance] = useState<number>(0.9);

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
    {
      id: uid(),
      format: 'fourball',
      session_date: addDays(todayISO(), 7),
      session: 'Morning',
      scorer_player_id: null,
      players_a: [],
      players_b: []
    },
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

  // Manual course save
  const saveManualCourse = async () => {
    if (!user) return;
    const trimmed = manualName.trim();
    if (trimmed.length < 2) {
      Alert.alert('Course name', 'Please enter a course name.');
      return;
    }
    setManualSavingCourse(true);
    try {
      const { data: courseData, error: courseErr } = await supabase
        .from('courses')
        .insert({
          name: trimmed,
          holes_count: 18,
          created_by_user_id: user.id,
          source: 'manual',
          is_verified: false,
        })
        .select()
        .single();
      if (courseErr) throw courseErr;

      const { data: teeData, error: teeErr } = await supabase
        .from('course_tees')
        .insert({
          course_id: courseData.id,
          tee_name: 'Yellow',
          tee_colour: 'Yellow',
          course_rating: DEFAULT_RATING,
          slope_rating: DEFAULT_SLOPE,
          total_par: DEFAULT_PAR,
        })
        .select()
        .single();
      if (teeErr) throw teeErr;

      setCourseId(courseData.id);
      setTeeId(teeData.id);
      setCourseName(trimmed);
      setShowManualEntry(false);
      setManualName('');
      Alert.alert('Success', 'Course saved successfully.');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Could not save the course.');
    } finally {
      setManualSavingCourse(false);
    }
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 'details': return name.trim().length > 2;
      case 'course': return !!courseId || showManualEntry;
      case 'teams': return teamAName.trim().length > 0 && teamBName.trim().length > 0;
      case 'dates': return startDate && endDate && startDate <= endDate;
      case 'players': return players.filter(p => p.name.trim().length > 0).length >= 2;
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

  const handleCreate = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const shareToken = uid();
      const baseCompetition = {
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
        hide_last_n_results: resultsHiddenCount,
        handicap_allowance: handicapAllowance,
      };

      const { data: comp, error } = await supabase
        .from('competitions')
        .insert(baseCompetition)
        .select()
        .single();

      if (error || !comp) throw error;

      Alert.alert('Success', 'Competition created!');
      router.replace(`/(tabs)/leaderboard?competitionId=${comp.id}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Something went wrong');
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

          {/* DETAILS STEP */}
          {step === 'details' && (
            <View style={styles.section}>
              <Text style={styles.label}>Event Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ryder Cup 2026"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Notes / Description (optional)</Text>
              <TextInput
                style={[styles.input, { height: 100 }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Friendly match between Europe and USA..."
              />

              <HeroImagePicker onImageSelected={setHeroImageUrl} initialUrl={heroImageUrl} />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Hide leaderboard until event ends</Text>
                <Switch value={hideLeaderboard} onValueChange={setHideLeaderboard} />
              </View>
            </View>
          )}

          {/* COURSE STEP */}
          {step === 'course' && (
            <View style={styles.section}>
              <Text style={styles.sectionHint}>Choose or create the course for this competition.</Text>
              {/* Course selection would go here - simplified for now */}
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowManualEntry(true)}>
                <Ionicons name="add-circle-outline" size={20} color={COLORS.accent} />
                <Text style={styles.addBtnText}>Add Course Manually</Text>
              </TouchableOpacity>

              {courseName ? (
                <Text style={{ color: COLORS.accent, marginTop: 12 }}>Selected: {courseName}</Text>
              ) : null}

              {/* Manual entry modal would be implemented here if needed */}
              {showManualEntry && (
                <View style={styles.section}>
                  <TextInput
                    style={styles.input}
                    value={manualName}
                    onChangeText={setManualName}
                    placeholder="Course name (e.g. Wentworth West)"
                  />
                  <TouchableOpacity style={styles.nextBtn} onPress={saveManualCourse} disabled={manualSavingCourse}>
                    {manualSavingCourse ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Save Course</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* TEAMS STEP */}
          {step === 'teams' && (
            <View style={styles.section}>
              <Text style={styles.label}>Team A</Text>
              <TextInput style={styles.input} value={teamAName} onChangeText={setTeamAName} />
              <ColourPicker color={teamAColour} onChange={setTeamAColour} />

              <Text style={styles.label}>Team B</Text>
              <TextInput style={styles.input} value={teamBName} onChangeText={setTeamBName} />
              <ColourPicker color={teamBColour} onChange={setTeamBColour} />
            </View>
          )}

          {/* DATES STEP */}
          {step === 'dates' && (
            <View style={styles.section}>
              <DatePicker label="Start Date" value={startDate} onChange={setStartDate} />
              <DatePicker label="End Date" value={endDate} onChange={setEndDate} />
            </View>
          )}

          {/* PLAYERS STEP */}
          {step === 'players' && (
            <View style={styles.section}>
              <Text style={styles.sectionHint}>Add players to each team</Text>
              {players.map((player, index) => (
                <PlayerEntry
                  key={player.id}
                  player={player}
                  onUpdate={(data) => updatePlayer(player.id, data)}
                  onRemove={() => removePlayer(player.id)}
                  teamAName={teamAName}
                  teamBName={teamBName}
                />
              ))}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={styles.addBtn} onPress={() => addPlayer('A')}>
                  <Text style={styles.addBtnText}>+ Team A Player</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={() => addPlayer('B')}>
                  <Text style={styles.addBtnText}>+ Team B Player</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* MATCHES STEP */}
          {step === 'matches' && (
            <View style={styles.section}>
              <Text style={styles.sectionHint}>
                Add the matches for your event. Assign each one to a day and session.
              </Text>
              {matches.map((m, i) => (
                <MatchEntry
                  key={m.id}
                  match={m}
                  matchNumber={i + 1}
                  eventDays={eventDays}
                  players={players}
                  teamAName={teamAName}
                  teamBName={teamBName}
                  teamAColour={teamAColour}
                  teamBColour={teamBColour}
                  onUpdate={(data) => updateMatch(m.id, data)}
                  onRemove={() => removeMatch(m.id)}
                />
              ))}
              <TouchableOpacity style={styles.addBtn} onPress={addMatch}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
                <Text style={[styles.addBtnText, { color: COLORS.accent }]}>Add another match</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* REVIEW STEP */}
          {step === 'review' && (
            <View style={styles.section}>
              <Text style={styles.sectionHint}>Review your competition before creating it.</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', marginVertical: 8 }}>Event: {name}</Text>
              <Text>Course: {courseName || 'Not selected'}</Text>
              <Text>Dates: {startDate} — {endDate}</Text>
              <Text>Matches: {matches.length}</Text>
              <Text>Players: {players.filter(p => p.name).length}</Text>
            </View>
          )}

          <View style={styles.ctaRow}>
            {step !== 'review' ? (
              <TouchableOpacity
                style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
                onPress={next}
                disabled={!canProceed()}
              >
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.createBtn, saving && styles.nextBtnDisabled]}
                onPress={handleCreate}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <>
                  <Ionicons name="golf-outline" size={18} color="#fff" />
                  <Text style={styles.nextBtnText}>Create Competition</Text>
                </>}
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: SPACING.xl * 2 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  progressBar: { flexDirection: 'row', gap: 4, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  progressStep: { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  progressStepDone: { backgroundColor: COLORS.accent },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  backBtn: { width: 38, height: 38, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  stepTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  section: { gap: SPACING.md },
  sectionHint: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },
  label: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: { backgroundColor: COLORS.surfaceHigh, borderRadius: RADIUS.md, padding: SPACING.md, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  switchLabel: { flex: 1, fontSize: 15, color: COLORS.text },
  ctaRow: { marginTop: SPACING.xl, gap: SPACING.sm },
  nextBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  createBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border },
  addBtnText: { fontWeight: '600', color: COLORS.text },
});
