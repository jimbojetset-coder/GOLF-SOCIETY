/**
 * Profile & Settings Tab — Light Theme
 *
 * Sections:
 * 1. Profile card — avatar initials, name, email, HCP badge
 * 2. Your details — display name, home course, handicap index
 * 3. Scoring layout picker — Card / Grid
 * 4. Handicap history — last differentials, WHS suggestion
 * 5. App — version, sign out
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  StyleSheet, SafeAreaView, Alert, ScrollView,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/api/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../src/constants/theme';

type ScoringLayout = 'card' | 'grid';

const APP_VERSION = '1.0.0';

export default function SettingsTab() {
  const { user, signOut } = useAuth();

  const [profile,        setProfile]        = useState<any>(null);
  const [displayName,    setDisplayName]    = useState('');
  const [homeCourse,     setHomeCourse]     = useState('');
  const [handicapIndex,  setHandicapIndex]  = useState('');
  const [scoringLayout,  setScoringLayout]  = useState<ScoringLayout>('card');
  const [roundResults,   setRoundResults]   = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [dirty,          setDirty]          = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from('user_profiles').select('*').eq('user_id', user.id).single();

    if (data) {
      setProfile(data);
      setDisplayName(data.display_name ?? '');
      setHomeCourse(data.home_course ?? '');
      setHandicapIndex(data.handicap_index?.toString() ?? '');
      setScoringLayout(data.scoring_layout ?? 'card');
    } else {
      const { data: created } = await supabase
        .from('user_profiles')
        .insert({ user_id: user.id, display_name: user.email?.split('@')[0] ?? '' })
        .select().single();
      if (created) { setProfile(created); setDisplayName(created.display_name ?? ''); }
    }

    const { data: rounds } = await supabase
      .from('round_results')
      .select('*, competitions(name, event_date)')
      .order('created_at', { ascending: false }).limit(20);
    setRoundResults(rounds ?? []);
    setLoading(false);
    setDirty(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!user || !dirty) return;
    setSaving(true);
    const hcap = handicapIndex ? parseFloat(handicapIndex) : null;
    if (hcap !== null && (isNaN(hcap) || hcap < 0 || hcap > 54)) {
      Alert.alert('Invalid handicap', 'Handicap Index must be between 0.0 and 54.0');
      setSaving(false); return;
    }
    const { error } = await supabase.from('user_profiles').update({
      display_name: displayName.trim() || null,
      home_course: homeCourse.trim() || null,
      handicap_index: hcap,
      scoring_layout: scoringLayout,
    }).eq('user_id', user.id);
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else { setDirty(false); Alert.alert('Saved ✓', 'Your profile has been updated.'); }
  };

  const handleSignOut = () => Alert.alert('Sign out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: signOut },
  ]);

  const initials = displayName
    ? displayName.trim().split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
    : (user?.email?.[0] ?? '?').toUpperCase();

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator color={COLORS.accent} style={{ marginTop: 80 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Page title ── */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Profile</Text>
        </View>
        <View style={styles.divider} />

        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName || 'No name set'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
          {profile?.handicap_index != null && (
            <View style={styles.hcpBadge}>
              <Text style={styles.hcpBadgeLabel}>HCP</Text>
              <Text style={styles.hcpBadgeValue}>{parseFloat(profile.handicap_index).toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile?.rounds_submitted ?? 0}</Text>
            <Text style={styles.statLabel}>Rounds</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{roundResults.length}</Text>
            <Text style={styles.statLabel}>Results</Text>
          </View>
          {profile?.home_course && (
            <View style={[styles.statCard, { flex: 2 }]}>
              <Text style={styles.statValue} numberOfLines={1}>{profile.home_course}</Text>
              <Text style={styles.statLabel}>Home Course</Text>
            </View>
          )}
        </View>

        {/* ── Your Details ── */}
        <Text style={styles.sectionTitle}>Your Details</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>DISPLAY NAME</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={v => { setDisplayName(v); setDirty(true); }}
            placeholder="Your name"
            placeholderTextColor={COLORS.textMuted}
            maxLength={40}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>HOME COURSE</Text>
          <TextInput
            style={styles.input}
            value={homeCourse}
            onChangeText={v => { setHomeCourse(v); setDirty(true); }}
            placeholder="e.g. Royal Birkdale"
            placeholderTextColor={COLORS.textMuted}
            maxLength={60}
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.inputLabelRow}>
            <Text style={styles.inputLabel}>HANDICAP INDEX</Text>
            <Text style={styles.inputLabelHint}>WHS · 0.0 – 54.0</Text>
          </View>
          <TextInput
            style={styles.input}
            value={handicapIndex}
            onChangeText={v => { setHandicapIndex(v); setDirty(true); }}
            placeholder="e.g. 14.2"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="decimal-pad"
          />
        </View>

        {/* ── Scoring Layout ── */}
        <Text style={styles.sectionTitle}>Scoring Layout</Text>
        <Text style={styles.sectionSubtitle}>How scores are entered during a match</Text>

        <View style={styles.layoutRow}>
          {(['card', 'grid'] as ScoringLayout[]).map(key => {
            const active = scoringLayout === key;
            const icon   = key === 'card' ? 'layers-outline' : 'grid-outline';
            const label  = key === 'card' ? 'Card per Hole' : 'Scorecard Grid';
            const desc   = key === 'card' ? 'One hole at a time — best for outdoor use' : 'Full scorecard visible at once';
            return (
              <TouchableOpacity
                key={key}
                style={[styles.layoutCard, active && styles.layoutCardActive]}
                onPress={() => { setScoringLayout(key); setDirty(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name={icon as any} size={24} color={active ? COLORS.accent : COLORS.textMuted} />
                <Text style={[styles.layoutLabel, active && styles.layoutLabelActive]}>{label}</Text>
                <Text style={styles.layoutDesc}>{desc}</Text>
                {active && (
                  <View style={styles.layoutCheck}>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Handicap History ── */}
        {roundResults.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Handicap History</Text>
            <Text style={styles.sectionSubtitle}>Last {roundResults.length} round{roundResults.length !== 1 ? 's' : ''} on record</Text>
            <View style={styles.hcpTable}>
              <View style={styles.hcpTableHeader}>
                <Text style={[styles.hcpTableCell, { flex: 2 }]}>Competition</Text>
                <Text style={styles.hcpTableCell}>Gross</Text>
                <Text style={styles.hcpTableCell}>Diff</Text>
                <Text style={styles.hcpTableCell}>Pts</Text>
              </View>
              {roundResults.slice(0, 8).map((r, i) => (
                <View key={r.id} style={[styles.hcpTableRow, i % 2 === 0 && { backgroundColor: COLORS.surfaceHigh }]}>
                  <Text style={[styles.hcpTableCell, { flex: 2, color: COLORS.text }]} numberOfLines={1}>
                    {r.competitions?.name ?? '—'}
                  </Text>
                  <Text style={styles.hcpTableCell}>{r.gross_score ?? '—'}</Text>
                  <Text style={[styles.hcpTableCell, { color: COLORS.accent }]}>
                    {r.score_differential != null ? parseFloat(r.score_differential).toFixed(1) : '—'}
                  </Text>
                  <Text style={styles.hcpTableCell}>{r.stableford_points ?? '—'}</Text>
                </View>
              ))}
            </View>
            {profile?.handicap_index != null && (
              <View style={styles.hcpSuggestion}>
                <Ionicons name="trending-down-outline" size={18} color={COLORS.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.hcpSuggestionTitle}>Current Handicap Index</Text>
                  <Text style={styles.hcpSuggestionValue}>{parseFloat(profile.handicap_index).toFixed(1)}</Text>
                  {roundResults.length < 20 && (
                    <Text style={styles.hcpSuggestionWarn}>⚠  Based on {roundResults.length} round{roundResults.length !== 1 ? 's' : ''} — limited data</Text>
                  )}
                </View>
              </View>
            )}
          </>
        )}

        {/* ── Save button ── */}
        {dirty && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        )}

        {/* ── App section ── */}
        <Text style={styles.sectionTitle}>App</Text>

        <View style={styles.appRows}>
          <View style={styles.appRow}>
            <Text style={styles.appRowLabel}>Version</Text>
            <Text style={styles.appRowValue}>{APP_VERSION}</Text>
          </View>
          <View style={styles.rowDivider} />
          <TouchableOpacity style={styles.appRow} onPress={() => Alert.alert('Coming soon', 'Account management will be available in a future update.')}>
            <Text style={styles.appRowLabel}>Account</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll:    { padding: SPACING.md, gap: SPACING.md },

  pageHeader: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  pageTitle: { fontSize: 30, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  divider:   { height: 1, backgroundColor: COLORS.border, marginBottom: SPACING.sm },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, gap: SPACING.md,
    ...SHADOW.card,
  },
  avatarWrap: {
    width: 56, height: 56, borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentLight,
    borderWidth: 2, borderColor: COLORS.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:   { fontSize: 20, fontWeight: '800', color: COLORS.accent },
  profileInfo:  { flex: 1 },
  profileName:  { fontSize: 17, fontWeight: '700', color: COLORS.text },
  profileEmail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  hcpBadge: {
    backgroundColor: COLORS.accentLight,
    borderWidth: 1, borderColor: COLORS.accentBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    alignItems: 'center', minWidth: 52,
  },
  hcpBadgeLabel: { fontSize: 9, fontWeight: '800', color: COLORS.accent, letterSpacing: 1 },
  hcpBadgeValue: { fontSize: 20, fontWeight: '800', color: COLORS.accent, lineHeight: 24 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, alignItems: 'center',
    ...SHADOW.card,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },

  // Section headings
  sectionTitle:    { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: SPACING.sm },
  sectionSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: -SPACING.sm + 2 },

  // Inputs
  inputGroup: { gap: 6 },
  inputLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputLabel:    { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  inputLabelHint:{ fontSize: 10, color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
    fontSize: 16, color: COLORS.text,
    borderWidth: 1.5, borderColor: COLORS.border,
    ...SHADOW.card,
  },

  // Scoring layout picker
  layoutRow: { flexDirection: 'row', gap: SPACING.sm },
  layoutCard: {
    flex: 1, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border,
    padding: SPACING.md, gap: 6, position: 'relative',
    ...SHADOW.card,
  },
  layoutCardActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentLight },
  layoutLabel:      { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  layoutLabelActive:{ color: COLORS.accent },
  layoutDesc:       { fontSize: 11, color: COLORS.textMuted, lineHeight: 16 },
  layoutCheck:      { position: 'absolute', top: SPACING.sm, right: SPACING.sm },

  // Handicap table
  hcpTable: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  hcpTableHeader: {
    flexDirection: 'row', backgroundColor: COLORS.surfaceHigh,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  hcpTableRow:  { flexDirection: 'row', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  hcpTableCell: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  hcpSuggestion: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.accentBorder,
    padding: SPACING.md,
  },
  hcpSuggestionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.5 },
  hcpSuggestionValue: { fontSize: 28, fontWeight: '800', color: COLORS.text, lineHeight: 34 },
  hcpSuggestionWarn:  { fontSize: 11, color: COLORS.warning, marginTop: 2 },

  // Save button
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOW.fab,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  // App rows
  appRows: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  appRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  appRowLabel: { fontSize: 15, color: COLORS.text },
  appRowValue: { fontSize: 14, color: COLORS.textMuted },
  rowDivider:  { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },

  // Sign out
  signOutBtn: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1, borderColor: COLORS.dangerBorder,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: COLORS.danger },
});
