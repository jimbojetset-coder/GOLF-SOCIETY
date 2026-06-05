import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Switch,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// simple local ID for UI keys only (not persisted to DB)
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
  course: 'Course',
  details: 'Event Details',
  teams: 'Teams',
  dates: 'Dates',
  players: 'Players',
  matches: 'Matches',
  review: 'Review & Create',
};

// ── Default course rating/slope for playing handicap calc ─────
const DEFAULT_SLOPE = 113;
const DEFAULT_RATING = 72;
const DEFAULT_PAR = 72;

const FORMAT_LABEL: Record<MatchDraft['format'], string> = {
  fourball: 'Fourball',
  foursomes: 'Foursomes',
  singles: 'Singles',
  scramble: 'Scramble',
};

export default function NewCompetitionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState<Step>('details');
  const [saving, setSaving] = useState(false);

  // ── Details ──────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [hideLeaderboard, setHideLeaderboard] = useState(false);
  // Course / tee (from scan or manual)
  const [courseId, setCourseId] = useState<string | null>(null);
  const [teeId, setTeeId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>('');
  const [showScanScreen, setShowScanScreen] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualSavingCourse, setManualSavingCourse] = useState(false);
  const [resultsHiddenCount, setResultsHiddenCount] = useState(0);

  // ── Teams ────────────────────────────────────────────────────
  const [teamAName, setTeamAName] = useState('Europe');
  const [teamAColour, setTeamAColour] = useState('#E63946');
  const [teamBName, setTeamBName] = useState('USA');
  const [teamBColour, setTeamBColour] = useState('#457B9D');

  // ── Dates ────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(addDays(todayISO(), 7));
  const [endDate, setEndDate] = useState(addDays(todayISO(), 9));

  // ── Handicap allowance (75% / 90% / 100%) ───────────────────
  const [handicapAllowance, setHandicapAllowance] = useState<number>(0.9);

  // ── Players ──────────────────────────────────────────────────
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

  // ── Matches ──────────────────────────────────────────────────
  const [matches, setMatches] = useState<MatchDraft[]>([
    { id: uid(), format: 'fourball', session_date: startDate, session: 'Morning', scorer_player_id: null, players_a: [], players_b: [] },
  ]);

  const addMatch = () => setMatches(prev => [...prev, {
    id: uid(), format: 'fourball',
    session_date: startDate, session: 'Afternoon',
    scorer_player_id: null, players_a: [], players_b: [],
  }]);

  const updateMatch = (id: string, data: MatchDraft) =>
    setMatches(prev => prev.map(m => m.id === id ? data : m));

  const removeMatch = (id: string) =>
    setMatches(prev => prev.filter(m => m.id !== id));

  // ── Manual course entry ─────────────────────────────────────
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
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Could not save the course.');
    } finally {
      setManualSavingCourse(false);
    }
  };

  // ── Validation ───────────────────────────────────────────────
  const canProceed = (): boolean => {
    switch (step) {
      case 'details': return name.trim().length > 0;
      case 'course': return true; // scan / manual entry is optional
      case 'teams': return teamAName.trim().length > 0 && teamBName.trim().length > 0;
      case 'dates': return startDate <= endDate;
      case 'players': return players.filter(p => p.name.trim()).length >= 2;
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

  // ── Save ─────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // 1. Generate share token
      const shareToken = uid();

      // 2. Build the competition payload. We split optional / newer columns
      //    out so that if a Supabase project hasn't been migrated to the
      //    latest schema yet, the basic insert still succeeds.
      const baseCompetition: Record<string, any> = {
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
      };

      const optionalCols: Record<string, any> = {
        hide_last_n_results: resultsHiddenCount,
        handicap_allowance: handicapAllowance,
      };

      // First try with all columns; if a missing-column error comes back,
      // retry with only the base columns so users on old schemas can still
      // create competitions while they migrate.
      let comp: any = null;
      const insertWith = async (extra: Record<string, any>) => {
        return await supabase
          .from('competitions')
          .insert({ ...baseCompetition, ...extra })
          .select()
          .single();
      };

      let { data, error: compErr } = await insertWith(optionalCols);
      if (compErr && /Could not find the .* column/.test(compErr.message)) {
        ({ data, error: compErr } = await insertWith({}));
      }
      if (compErr || !data) throw compErr ?? new Error('Failed to create competition');
      comp = data;

      // 3. Create players
      const validPlayers = players.filter(p => p.name.trim());
      const playerInserts = validPlayers.map(p => ({
        competition_id: comp.id,
        name: p.name.trim(),
        handicap_index: p.handicap_index ? parseFloat(p.handicap_index) : null,
        playing_handicap: p.handicap_index
          ? calcPlayingHandicap(parseFloat(p.handicap_index), DEFAULT_SLOPE, DEFAULT_RATING, DEFAULT_PAR)
          : null,
        team: p.team,
        user_id: null,
      }));

      const { data: createdPlayers, error: playerErr } = await supabase
        .from('players')
        .insert(playerInserts)
        .select();

      if (playerErr) throw playerErr;

      const playerIdMap: Record<string, string> = {};
      validPlayers.forEach((draft, i) => {
        if (createdPlayers?.[i]) playerIdMap[draft.id] = createdPlayers[i].id;
      });

      // 4. Create matches
      const matchInserts = matches.map((m, i) => ({
        competition_id: comp.id,
        match_number: i + 1,
        format: m.format,
        session_date: m.session_date,
        session: m.session,
        status: 'pending',
        points_a: 0,
        points_b: 0,
        holes_played: 0,
        scorer_user_id: null,
        scorer_share_token: uid(),
      }));

      const { error: matchErr } = await supabase
        .from('matches')
        .insert(matchInserts);

      if (matchErr) throw matchErr;

      // 5. Create match_players rows
      const { data: createdMatches } = await supabase
        .from('matches')
        .select('id, match_number')
        .eq('competition_id', comp.id)
        .order('match_number');

      const matchPlayerInserts: any[] = [];
      for (const draft of matches) {
        const dbMatch = createdMatches?.find(m => m.match_number === matches.indexOf(draft) + 1);
        if (!dbMatch) continue;

        const allDraftIds = [...draft.players_a, ...draft.players_b];
        for (const draftId of allDraftIds) {
          const dbPlayerId = playerIdMap[draftId];
          if (!dbPlayerId) continue;
          const draftPlayer = validPlayers.find(p => p.id === draftId);
          if (!draftPlayer) continue;
          const ph = draftPlayer.handicap_index
            ? calcPlayingHandicap(parseFloat(draftPlayer.handicap_index), DEFAULT_SLOPE, DEFAULT_RATING, DEFAULT_PAR)
            : 0;
          matchPlayerInserts.push({
            match_id: dbMatch.id,
            player_id: dbPlayerId,
            team: draftPlayer.team,
            playing_handicap: ph,
            strokes_received: 0,
          });
        }
      }

      if (matchPlayerInserts.length > 0) {
        const { error: mpErr } = await supabase.from('match_players').insert(matchPlayerInserts);
        if (mpErr) console.warn('match_players insert error:', mpErr.message);
      }

      // 6. Navigate to the new competition
      router.replace(`/(tabs)/leaderboard?competitionId=${comp.id}`);

    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  const eventDays = dateRange(startDate, endDate);
  const stepIndex = STEPS.indexOf(step);

  const teamAPlayers = players.filter(p => p.team === 'A' && p.name);
  const teamBPlayers = players.filter(p => p.team === 'B' && p.name);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressBar}>
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[
              styles.progressStep,
              i <= stepIndex && styles.progressStepDone,
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <View style={styles.titleRow}>
            <TouchableOpacity onPress={back} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.stepTitle}>{STEP_LABELS[step]}</Text>
          </View>

          {/* ── STEP: Details ── */}
          {step === 'details' && (
            <View style={styles.section}>
              <Text style={styles.label}>Competition name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Club Ryder Cup 2026"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
              />
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any extra info about the event…"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
              />
              <HeroImagePicker value={heroImageUrl} onChange={setHeroImageUrl} />

              <Text style={styles.sectionSubheading}>Privacy</Text>

              <View style={styles.privacyRow}>
                <View style={styles.privacyRowLeft}>
                  <Ionicons name="eye-off-outline" size={18} color={COLORS.textSecondary} />
                  <View>
                    <Text style={styles.privacyLabel}>Hide leaderboard</Text>
                    <Text style={styles.privacyHint}>Players can't see the leaderboard until you reveal it</Text>
                  </View>
                </View>
                <Switch
                  value={hideLeaderboard}
                  onValueChange={setHideLeaderboard}
                  trackColor={{ true: COLORS.accent, false: COLORS.surfaceHigh }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.privacyBlock}>
                <View style={styles.privacyBlockHeader}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.privacyLabel}>Hide last results</Text>
                    <Text style={styles.privacyHint}>
                      {resultsHiddenCount === 0
                        ? 'All results visible as matches finish'
                        : resultsHiddenCount === 99
                        ? 'All results hidden until competition closes'
                        : `Last ${resultsHiddenCount} completed match${resultsHiddenCount > 1 ? 'es' : ''} hidden until competition closes`}
                    </Text>
                  </View>
                </View>
                <View style={styles.hiddenCountRow}>
                  {[0, 1, 2, 3, 5, 99].map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.countChip, resultsHiddenCount === n && styles.countChipSelected]}
                      onPress={() => setResultsHiddenCount(n)}
                    >
                      <Text style={[styles.countChipText, resultsHiddenCount === n && styles.countChipTextSelected]}>
                        {n === 0 ? 'None' : n === 99 ? 'All' : `${n}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.sectionSubheading}>Handicap Allowance</Text>
              <View style={styles.allowanceRow}>
                {[
                  { label: '75%', value: 0.75 },
                  { label: '90%', value: 0.90 },
                  { label: '100%', value: 1.00 },
                ].map(({ label, value }) => (
                  <TouchableOpacity
                    key={label}
                    style={[styles.allowanceBtn, handicapAllowance === value && styles.allowanceBtnActive]}
                    onPress={() => setHandicapAllowance(value)}
                  >
                    <Text style={[styles.allowanceBtnText, handicapAllowance === value && styles.allowanceBtnTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── STEP: Course ── */}
          {step === 'course' && !showScanScreen && (
            <View style={styles.section}>
              <Text style={styles.label}>Course (optional)</Text>
              <Text style={styles.sectionSubtext}>
                Scan a scorecard to auto-fill holes, par, and stroke index — or add
                a course by name and edit details later. You can also skip this entirely.
              </Text>

              {courseId ? (
                /* Course already set */
                <View style={styles.courseDoneCard}>
                  <View style={styles.courseDoneLeft}>
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} />
                    <View>
                      <Text style={styles.courseDoneName}>{courseName}</Text>
                      <Text style={styles.courseDoneHint}>Course set</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => { setCourseId(null); setTeeId(null); setCourseName(''); }}>
                    <Ionicons name="close-circle-outline" size={22} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : showManualEntry ? (
                <View style={styles.manualCard}>
                  <Text style={styles.label}>Course name</Text>
                  <TextInput
                    style={styles.input}
                    value={manualName}
                    onChangeText={setManualName}
                    placeholder="e.g. Royal Birkdale"
                    placeholderTextColor={COLORS.textMuted}
                    autoFocus
                  />
                  <View style={styles.manualBtnRow}>
                    <TouchableOpacity
                      style={[styles.manualBtnSecondary]}
                      onPress={() => { setShowManualEntry(false); setManualName(''); }}
                    >
                      <Text style={styles.manualBtnSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.manualBtnPrimary, manualSavingCourse && { opacity: 0.5 }]}
                      onPress={saveManualCourse}
                      disabled={manualSavingCourse}
                    >
                      {manualSavingCourse
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.manualBtnPrimaryText}>Save course</Text>}
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.manualHint}>
                    A default 18-hole / par-72 yellow tee will be saved. You can edit details later.
                  </Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity style={styles.scanBtn} onPress={() => setShowScanScreen(true)}>
                    <Ionicons name="scan-outline" size={22} color={COLORS.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.scanBtnText}>Scan Scorecard</Text>
                      <Text style={styles.scanBtnSub}>AI-extracts holes, par, SI, rating</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.manualBtn} onPress={() => setShowManualEntry(true)}>
                    <Ionicons name="create-outline" size={22} color={COLORS.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.manualBtnText}>Add manually</Text>
                      <Text style={styles.manualBtnSub}>Just enter the course name</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.skipBtn} onPress={next}>
                <Text style={styles.skipBtnText}>{courseId ? 'Continue →' : 'Skip for now →'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scan screen — full overlay */}
          {step === 'course' && showScanScreen && (
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

          {/* ── STEP: Teams ── */}
          {step === 'teams' && (
            <View style={styles.section}>
              <View style={styles.teamBlock}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Team A name *</Text>
                  <Text style={styles.labelHint}>First 3 chars used in score pill · max 20</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={teamAName}
                  onChangeText={setTeamAName}
                  placeholder="e.g. Europe"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={20}
                />
                <ColourPicker
                  value={teamAColour}
                  onChange={setTeamAColour}
                  label="Team A colour"
                />
              </View>

              <View style={[styles.teamBlock, { marginTop: SPACING.lg }]}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Team B name *</Text>
                  <Text style={styles.labelHint}>First 3 chars used in score pill · max 20</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={teamBName}
                  onChangeText={setTeamBName}
                  placeholder="e.g. USA"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={20}
                />
                <ColourPicker
                  value={teamBColour}
                  onChange={setTeamBColour}
                  label="Team B colour"
                />
              </View>

              <View style={styles.previewRow}>
                <View style={[styles.previewTeam, { backgroundColor: teamAColour + '22' }]}>
                  <View style={[styles.previewDot, { backgroundColor: teamAColour }]} />
                  <Text style={[styles.previewName, { color: teamAColour }]}>{teamAName || 'Team A'}</Text>
                </View>
                <Text style={styles.vs}>vs</Text>
                <View style={[styles.previewTeam, { backgroundColor: teamBColour + '22' }]}>
                  <View style={[styles.previewDot, { backgroundColor: teamBColour }]} />
                  <Text style={[styles.previewName, { color: teamBColour }]}>{teamBName || 'Team B'}</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── STEP: Dates ── */}
          {step === 'dates' && (
            <View style={styles.section}>
              <Text style={styles.sectionHint}>
                Select the first and last day of your event. Matches can be assigned to any day in this range.
              </Text>
              <DatePicker
                label="Start date"
                value={startDate}
                onChange={d => {
                  setStartDate(d);
                  if (d > endDate) setEndDate(d);
                }}
              />
              <View style={{ height: SPACING.lg }} />
              <DatePicker
                label="End date"
                value={endDate}
                onChange={setEndDate}
                minDate={startDate}
              />
              <View style={styles.dateSummary}>
                <Text style={styles.dateSummaryText}>
                  {startDate === endDate
                    ? `Single day event: ${fmtFull(startDate)}`
                    : `${fmtFull(startDate)} → ${fmtFull(endDate)} (${eventDays.length} days)`}
                </Text>
              </View>
            </View>
          )}

          {/* ── STEP: Players ── */}
          {step === 'players' && (
            <View style={styles.section}>
              <Text style={styles.sectionHint}>
                Add all players. They don't need the app — just a name and handicap is enough.
                Toggle "Has the app" for anyone who'll be scoring a match.
              </Text>

              <View style={styles.teamSection}>
                <View style={[styles.teamHeader, { borderLeftColor: teamAColour }]}>
                  <Text style={[styles.teamHeaderText, { color: teamAColour }]}>{teamAName}</Text>
                  <Text style={styles.teamCount}>{teamAPlayers.length} players</Text>
                </View>
                {players.filter(p => p.team === 'A').map(p => (
                  <PlayerEntry
                    key={p.id}
                    player={p}
                    teamAName={teamAName}
                    teamBName={teamBName}
                    teamAColour={teamAColour}
                    teamBColour={teamBColour}
                    onUpdate={data => updatePlayer(p.id, data)}
                    onRemove={() => removePlayer(p.id)}
                  />
                ))}
                <TouchableOpacity style={styles.addBtn} onPress={() => addPlayer('A')}>
                  <Ionicons name="add-circle-outline" size={18} color={teamAColour} />
                  <Text style={[styles.addBtnText, { color: teamAColour }]}>Add {teamAName} player</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.teamSection}>
                <View style={[styles.teamHeader, { borderLeftColor: teamBColour }]}>
                  <Text style={[styles.teamHeaderText, { color: teamBColour }]}>{teamBName}</Text>
                  <Text style={styles.teamCount}>{teamBPlayers.length} players</Text>
                </View>
                {players.filter(p => p.team === 'B').map(p => (
                  <PlayerEntry
                    key={p.id}
                    player={p}
                    teamAName={teamAName}
                    teamBName={teamBName}
                    teamAColour={teamAColour}
                    teamBColour={teamBColour}
                    onUpdate={data => updatePlayer(p.id, data)}
                    onRemove={() => removePlayer(p.id)}
                  />
                ))}
                <TouchableOpacity style={styles.addBtn} onPress={() => addPlayer('B')}>
                  <Ionicons name="add-circle-outline" size={18} color={teamBColour} />
                  <Text style={[styles.addBtnText, { color: teamBColour }]}>Add {teamBName} player</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── STEP: Matches ── */}
          {step === 'matches' && (
            <View style={styles.section}>
              <Text style={styles.sectionHint}>
                Add the matches for your event. Assign each one to a day and session.
                Scorers can be nominated now or later.
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
                  onUpdate={data => updateMatch(m.id, data)}
                  onRemove={() => removeMatch(m.id)}
                />
              ))}
              <TouchableOpacity style={styles.addBtn} onPress={addMatch}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
                <Text style={[styles.addBtnText, { color: COLORS.accent }]}>Add another match</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP: Review ── */}
          {step === 'review' && (
            <View style={styles.section}>
              <View style={styles.reviewBlock}>
                <Text style={styles.reviewLabel}>Event</Text>
                <Text style={styles.reviewValue}>{name}</Text>
                {notes ? <Text style={styles.reviewHint}>{notes}</Text> : null}
              </View>

              <View style={styles.reviewBlock}>
                <Text style={styles.reviewLabel}>Dates</Text>
                <Text style={styles.reviewValue}>
                  {startDate === endDate
                    ? fmtFull(startDate)
                    : `${fmtFull(startDate)} – ${fmtFull(endDate)}`}
                </Text>
              </View>

              <View style={styles.reviewBlock}>
                <Text style={styles.reviewLabel}>Teams</Text>
                <View style={styles.reviewTeams}>
                  <Text style={[styles.reviewTeamName, { color: teamAColour }]}>{teamAName}</Text>
                  <Text style={styles.vs}>vs</Text>
                  <Text style={[styles.reviewTeamName, { color: teamBColour }]}>{teamBName}</Text>
                </View>
              </View>

              {/* Matches & their tee groups */}
              <View style={styles.reviewBlock}>
                <Text style={styles.reviewLabel}>Matches & Tee Groups ({matches.length})</Text>
                {matches.map((m, i) => {
                  const aNames = m.players_a
                    .map(id => players.find(p => p.id === id)?.name)
                    .filter(Boolean) as string[];
                  const bNames = m.players_b
                    .map(id => players.find(p => p.id === id)?.name)
                    .filter(Boolean) as string[];

                  return (
                    <View key={m.id} style={styles.reviewMatchCard}>
                      <View style={styles.reviewMatchHeader}>
                        <View style={styles.reviewMatchNum}>
                          <Text style={styles.reviewMatchNumText}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewMatchTitle}>
                            {FORMAT_LABEL[m.format]}
                          </Text>
                          <Text style={styles.reviewMatchSub}>
                            {fmtDay(m.session_date)} · {m.session}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.reviewTeeGroup}>
                        <View style={[styles.reviewTeeSide, { borderLeftColor: teamAColour }]}>
                          <Text style={[styles.reviewTeeTeamName, { color: teamAColour }]}>{teamAName}</Text>
                          {aNames.length > 0
                            ? aNames.map((n, j) => (
                                <Text key={j} style={styles.reviewTeeName}>· {n}</Text>
                              ))
                            : <Text style={styles.reviewTeeMissing}>Not assigned</Text>}
                        </View>
                        <View style={[styles.reviewTeeSide, { borderLeftColor: teamBColour }]}>
                          <Text style={[styles.reviewTeeTeamName, { color: teamBColour }]}>{teamBName}</Text>
                          {bNames.length > 0
                            ? bNames.map((n, j) => (
                                <Text key={j} style={styles.reviewTeeName}>· {n}</Text>
                              ))
                            : <Text style={styles.reviewTeeMissing}>Not assigned</Text>}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Full roster (collapsed reference) */}
              <View style={styles.reviewBlock}>
                <Text style={styles.reviewLabel}>Full Roster ({players.filter(p => p.name).length})</Text>
                {['A', 'B'].map(team => (
                  <View key={team} style={{ marginTop: 4 }}>
                    <Text style={[styles.reviewTeamHeader, {
                      color: team === 'A' ? teamAColour : teamBColour,
                    }]}>
                      {team === 'A' ? teamAName : teamBName}
                    </Text>
                    {players.filter(p => p.team === team && p.name).map(p => (
                      <Text key={p.id} style={styles.reviewPlayerRow}>
                        {p.name}{p.handicap_index ? ` (HCP ${p.handicap_index})` : ''}{p.has_app ? ' 📱' : ''}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* CTA */}
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
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name="golf-outline" size={18} color="#fff" />
                      <Text style={styles.nextBtnText}>Create Competition</Text>
                    </>
                }
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
  container:    { flex: 1, backgroundColor: COLORS.background },

  progressBar: {
    flexDirection: 'row', gap: 4,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm,
  },
  progressStep:     { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  progressStepDone: { backgroundColor: COLORS.accent },

  content:  { padding: SPACING.md, paddingBottom: SPACING.xxl },
  titleRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: SPACING.sm, marginBottom: SPACING.lg,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceHigh,
    borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  stepTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },

  section:     { gap: SPACING.md },
  sectionHint: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },

  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: -4 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: -4 },
  labelHint: { fontSize: 10, color: COLORS.textMuted },

  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    color: COLORS.text, fontSize: 16,
    borderWidth: 1.5, borderColor: COLORS.border,
    ...SHADOW.card,
  },
  inputFocused: { borderColor: COLORS.accent },
  multiline: { height: 88, textAlignVertical: 'top' },

  teamBlock: { gap: SPACING.md },
  teamSection: { gap: SPACING.sm },
  teamHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 4, paddingLeft: SPACING.sm,
    marginBottom: 4,
  },
  teamHeaderText: { fontSize: 15, fontWeight: '800' },
  teamCount:      { fontSize: 12, color: COLORS.textMuted },

  previewRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.xl, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  previewTeam: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: RADIUS.md, padding: 10 },
  previewDot:  { width: 12, height: 12, borderRadius: 6 },
  previewName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  vs:          { fontSize: 13, color: COLORS.textMuted },

  dateSummary: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.accentBorder,
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  dateSummaryText: { fontSize: 15, fontWeight: '700', color: COLORS.accent },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: SPACING.sm,
  },
  addBtnText: { fontSize: 14, fontWeight: '600' },

  reviewBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
    gap: 6,
    ...SHADOW.card,
  },
  reviewLabel:       { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.2 },
  reviewValue:       { fontSize: 17, fontWeight: '700', color: COLORS.text },
  reviewHint:        { fontSize: 13, color: COLORS.textMuted },
  sectionSubheading: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.2, marginTop: SPACING.md, marginBottom: 2 },
  reviewTeams:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewTeamName:    { fontSize: 17, fontWeight: '800' },
  reviewTeamHeader:  { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginTop: 6 },
  reviewPlayerRow:   { fontSize: 14, color: COLORS.text, paddingLeft: 8, paddingVertical: 2 },

  // Match cards in review
  reviewMatchCard: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  reviewMatchHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  reviewMatchNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  reviewMatchNumText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  reviewMatchTitle:   { fontSize: 14, fontWeight: '700', color: COLORS.text },
  reviewMatchSub:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  reviewTeeGroup:     { flexDirection: 'row', gap: SPACING.sm },
  reviewTeeSide: {
    flex: 1,
    borderLeftWidth: 3, paddingLeft: SPACING.sm,
    paddingVertical: 4,
  },
  reviewTeeTeamName: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  reviewTeeName:     { fontSize: 13, color: COLORS.text, paddingVertical: 1 },
  reviewTeeMissing:  { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },

  // Privacy
  privacyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, gap: SPACING.sm,
    ...SHADOW.card,
  },
  privacyRowLeft:    { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, flex: 1 },
  privacyLabel:      { fontSize: 14, fontWeight: '600', color: COLORS.text },
  privacyHint:       { fontSize: 11, color: COLORS.textMuted, marginTop: 2, maxWidth: 240 },
  privacyBlock: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, gap: SPACING.md,
    ...SHADOW.card,
  },
  privacyBlockHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  hiddenCountRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  countChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceHigh,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  countChipSelected:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  countChipText:         { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  allowanceRow: {
    flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs,
  },
  allowanceBtn: {
    flex: 1, paddingVertical: 10, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', backgroundColor: COLORS.surface,
  },
  allowanceBtnActive: {
    borderColor: COLORS.accent, backgroundColor: COLORS.accent + '15',
  },
  allowanceBtnText: {
    fontSize: 14, fontWeight: '600', color: COLORS.textSecondary,
  },
  allowanceBtnTextActive: {
    color: COLORS.accent,
  },
  countChipTextSelected: { color: COLORS.white },
  sectionSubtext:        { fontSize: 12, color: COLORS.textMuted, lineHeight: 18, marginBottom: SPACING.sm },

  // Course scan + manual entry
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.accentLight, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.accentBorder,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  scanBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.accent },
  scanBtnSub:  { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  manualBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  manualBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  manualBtnSub:  { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  manualCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.accentBorder,
    padding: SPACING.md, gap: SPACING.sm,
    ...SHADOW.card,
  },
  manualBtnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: 4 },
  manualBtnPrimary: {
    flex: 1, backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  manualBtnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  manualBtnSecondary: {
    flex: 1, backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 2,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  manualBtnSecondaryText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 },
  manualHint: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  courseDoneCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.accentLight, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.accentBorder,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  courseDoneLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  courseDoneName: { fontSize: 15, fontWeight: '700', color: COLORS.accent },
  courseDoneHint: { fontSize: 11, color: COLORS.textMuted },
  skipBtn:        { alignItems: 'center', padding: SPACING.md },
  skipBtnText:    { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },

  pillPreview: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: SPACING.md,
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.full, alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  pillPreviewTeam:   { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  pillPreviewMiddle: { paddingHorizontal: 10 },
  pillPreviewLabel:  { fontSize: 13, fontWeight: '700', color: COLORS.text },

  ctaRow: { marginTop: SPACING.xl, gap: SPACING.sm },
  nextBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.md,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    ...SHADOW.fab,
  },
  createBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.md,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    ...SHADOW.fab,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText:     { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
