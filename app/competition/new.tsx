import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Switch,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// simple local ID for UI keys only
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

  // Manual course
  const saveManualCourse = async () => { /* ... same as before ... */ };
  // (keeping your original saveManualCourse function)

  const canProceed = (): boolean => { /* same as before */ };
  const next = () => { /* same */ };
  const back = () => { /* same */ };

  const handleCreate = async () => { /* same as before */ };

  // Render
  const eventDays = dateRange(startDate, endDate);
  const stepIndex = STEPS.indexOf(step);
  const teamAPlayers = players.filter(p => p.team === 'A' && p.name);
  const teamBPlayers = players.filter(p => p.team === 'B' && p.name);

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

          {/* All your original steps remain the same except Matches */}
          {/* Details, Course, Teams, Dates, Players, Review stay unchanged */}

          {/* FIXED MATCHES STEP */}
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

// Keep all your original styles at the bottom
const styles = StyleSheet.create({ /* paste all your original styles here */ });
