import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Switch,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  // Saved course selector
  const [showCourseSelector, setShowCourseSelector] = useState(false);
  const [savedCourses, setSavedCourses] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

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

  const openCourseSelector = async () => {
    setShowCourseSelector(true);
    setExpandedCourseId(null);
    setLoadingCourses(true);
    const { data } = await supabase.from('courses').select('*, course_tees(*)').order('name');
    setSavedCourses(data ?? []);
    setLoadingCourses(false);
  };

  const handleCreate = async () => {
    if (!user || !courseId) {
      Alert.alert('Missing Information', 'Please select or create a course first.');
      return;
    }
    setSaving(true);
    try {
      // 1. Insert all named players into the DB
      const validPlayers = players.filter(p => p.name?.trim());
      if (validPlayers.length < 2) throw new Error('At least 2 players are required');

      const { data: dbPlayers, error: pErr } = await supabase
        .from('players')
        .insert(validPlayers.map(p => ({
          name: p.name.trim(),
          handicap_index: parseFloat(String(p.handicap_index)) || 0,
          created_by_user_id: user.id,
        })))
        .select();
      if (pErr || !dbPlayers) throw pErr ?? new Error('Failed to insert players');

      // Map local draft ID → DB UUID
      const pidMap: Record<string, string> = {};
      validPlayers.forEach((p, i) => { pidMap[p.id] = dbPlayers[i]?.id ?? ''; });

      // 2. Create competition
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
      if (error || !comp) throw error ?? new Error('Failed to create competition');

      // 3. Create each match with a scorer_share_token + its players
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        const scorerToken = uid();
        const { data: dbMatch, error: mErr } = await supabase
          .from('matches')
          .insert({
            competition_id: comp.id,
            match_number: i + 1,
            format: m.format,
            session: m.session,
            session_date: m.session_date,
            status: 'pending',
            scorer_share_token: scorerToken,
            tee_id: teeId,
            holes_played: 0,
            points_a: 0,
            points_b: 0,
          })
          .select()
          .single();
        if (mErr || !dbMatch) throw mErr ?? new Error(`Failed to create match ${i + 1}`);

        const aRows = (m.players_a ?? [])
          .map((lid: string) => pidMap[lid]).filter(Boolean)
          .map((pid: string) => ({ match_id: dbMatch.id, player_id: pid, team: 'A', playing_handicap: 0 }));
        const bRows = (m.players_b ?? [])
          .map((lid: string) => pidMap[lid]).filter(Boolean)
          .map((pid: string) => ({ match_id: dbMatch.id, player_id: pid, team: 'B', playing_handicap: 0 }));
        const mpRows = [...aRows, ...bRows];
        if (mpRows.length > 0) {
          await supabase.from('match_players').insert(mpRows);
        }
      }

      router.replace(`/competition/${comp.id}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to create competition');
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

          {/* COURSE */}
          {step === 'course' && (
            <View style={styles.section}>
              <Text style={styles.sectionHint}>
                Course details (holes, par, stroke index) must be complete before adding players
              </Text>

              {/* Selected course banner */}
              {courseName ? (
                <View style={styles.courseSelectedBanner}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
                  <Text style={styles.courseSelectedName} numberOfLines={1}>{courseName}</Text>
                  <TouchableOpacity onPress={() => { setCourseId(null); setTeeId(null); setCourseName(''); }}>
                    <Ionicons name="close-circle-outline" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Option 1: Saved courses from DB */}
              <TouchableOpacity style={styles.addBtn} onPress={openCourseSelector}>
                <Ionicons name="library-outline" size={20} color={COLORS.accent} />
                <Text style={styles.addBtnText}>Choose Saved Course</Text>
              </TouchableOpacity>

              {/* Option 2: Scan or manual entry (full hole details via ScorecardScanScreen) */}
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowScanScreen(true)}>
                <Ionicons name="scan-outline" size={20} color={COLORS.accent} />
                <Text style={styles.addBtnText}>Scan Scorecard or Enter Manually</Text>
              </TouchableOpacity>
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
              <View style={styles.reviewCard}>
                <Text style={styles.reviewEventName}>{name}</Text>
                <View style={styles.reviewRows}>
                  <View style={styles.reviewRow}>
                    <Ionicons name="golf-outline" size={15} color={COLORS.textMuted} />
                    <Text style={styles.reviewRowText}>{courseName || 'No course selected'}</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Ionicons name="calendar-outline" size={15} color={COLORS.textMuted} />
                    <Text style={styles.reviewRowText}>{startDate} – {endDate}</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Ionicons name="people-outline" size={15} color={COLORS.textMuted} />
                    <Text style={styles.reviewRowText}>{players.filter(p => p.name?.trim()).length} players · {matches.length} {matches.length === 1 ? 'match' : 'matches'}</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <View style={[styles.reviewDot, { backgroundColor: teamAColour }]} />
                    <Text style={[styles.reviewRowText, { color: teamAColour }]}>{teamAName}</Text>
                    <Text style={styles.reviewRowText}> vs </Text>
                    <View style={[styles.reviewDot, { backgroundColor: teamBColour }]} />
                    <Text style={[styles.reviewRowText, { color: teamBColour }]}>{teamBName}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.reviewHint}>
                Each match will get a unique scorer link you can share with the scorer after creation.
              </Text>
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

      {/* Course Selector Modal */}
      <Modal
        visible={showCourseSelector}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCourseSelector(false)}
      >
        <SafeAreaView style={styles.selectorContainer}>
          <View style={styles.selectorHeader}>
            <Text style={styles.selectorTitle}>Choose Course</Text>
            <TouchableOpacity onPress={() => setShowCourseSelector(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {loadingCourses ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginTop: 48 }} />
          ) : savedCourses.length === 0 ? (
            <View style={styles.selectorEmpty}>
              <Text style={styles.selectorEmptyText}>
                No saved courses yet.{'\n'}Scan or manually enter a course first.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}>
              {savedCourses.map(course => (
                <View key={course.id} style={styles.courseSelectorCard}>
                  <TouchableOpacity
                    style={styles.courseSelectorHeader}
                    onPress={() => setExpandedCourseId(expandedCourseId === course.id ? null : course.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.courseSelectorName}>{course.name}</Text>
                      <Text style={styles.courseSelectorMeta}>
                        {course.holes_count ?? 18} holes · {(course.course_tees ?? []).length} tee{(course.course_tees ?? []).length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Ionicons
                      name={expandedCourseId === course.id ? 'chevron-up' : 'chevron-down'}
                      size={18} color={COLORS.textMuted}
                    />
                  </TouchableOpacity>
                  {expandedCourseId === course.id && (
                    <View style={styles.teesRow}>
                      {(course.course_tees ?? []).length === 0 ? (
                        <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>No tees saved for this course</Text>
                      ) : (course.course_tees ?? []).map((tee: any) => (
                        <TouchableOpacity
                          key={tee.id}
                          style={[styles.teePill, teeId === tee.id && styles.teePillSelected]}
                          onPress={() => {
                            setCourseId(course.id);
                            setTeeId(tee.id);
                            setCourseName(`${course.name} · ${tee.tee_name}`);
                            setShowCourseSelector(false);
                            setExpandedCourseId(null);
                          }}
                        >
                          <Text style={[styles.teePillText, teeId === tee.id && styles.teePillTextSelected]}>
                            {tee.tee_name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
              <View style={{ height: SPACING.xl }} />
            </ScrollView>
          )}
        </SafeAreaView>
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
  // Course selected banner
  courseSelectedBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.accentLight, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.accentBorder, padding: SPACING.md },
  courseSelectedName: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.accent },

  // Review card
  reviewCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, gap: SPACING.md },
  reviewEventName: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  reviewRows: { gap: SPACING.sm },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  reviewRowText: { fontSize: 14, color: COLORS.textSecondary },
  reviewDot: { width: 10, height: 10, borderRadius: 5 },
  reviewHint: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18 },

  // Course selector modal
  selectorContainer: { flex: 1, backgroundColor: COLORS.background },
  selectorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, paddingTop: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  selectorTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  selectorEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  selectorEmptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
  courseSelectorCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  courseSelectorHeader: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  courseSelectorName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  courseSelectorMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  teesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surfaceHigh },
  teePill: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  teePillSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  teePillText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  teePillTextSelected: { color: '#fff' },
});
