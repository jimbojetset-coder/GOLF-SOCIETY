/**
 * Auth Screen — Magic link / OTP sign-in
 * Light theme, two steps: email → 6-digit code
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, SafeAreaView, StatusBar,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/theme';

type Step = 'email' | 'otp';

export default function AuthScreen() {
  const { signInWithOTP, verifyOTP } = useAuth();
  const [email,   setEmail]   = useState('');
  const [otp,     setOtp]     = useState('');
  const [step,    setStep]    = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  const otpRef = useRef<TextInput>(null);

  const handleSendOTP = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);
    const { error } = await signInWithOTP(trimmed);
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 300);
    }
  };

  const handleVerifyOTP = async () => {
    const trimmed = otp.trim();
    if (trimmed.length < 6) return;
    setLoading(true);
    const { error } = await verifyOTP(email.trim().toLowerCase(), trimmed);
    setLoading(false);
    if (error) {
      Alert.alert('Invalid code', 'Check the code and try again, or request a new one.');
      setOtp('');
    }
  };

  const handleResend = async () => {
    setOtp('');
    setLoading(true);
    await signInWithOTP(email.trim().toLowerCase());
    setLoading(false);
    Alert.alert('Code resent', 'Check your email for a new code.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>

          {/* ── Logo ── */}
          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>⛳</Text>
          </View>
          <Text style={styles.appName}>Golf Society</Text>
          <Text style={styles.tagline}>Ryder Cup-style match play scoring</Text>

          {/* ── Card ── */}
          <View style={styles.card}>

            {step === 'email' ? (
              <>
                <Text style={styles.cardTitle}>Sign in</Text>
                <Text style={styles.cardSubtitle}>We'll email you a one-time code — no password needed.</Text>

                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={handleSendOTP}
                />

                <TouchableOpacity
                  style={[styles.btn, (!email.trim() || loading) && styles.btnDisabled]}
                  onPress={handleSendOTP}
                  disabled={!email.trim() || loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={COLORS.white} />
                    : <Text style={styles.btnText}>Send Magic Code</Text>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Check your email</Text>
                <Text style={styles.cardSubtitle}>
                  We sent a 6-digit code to{'\n'}
                  <Text style={styles.emailHighlight}>{email}</Text>
                </Text>

                <Text style={styles.label}>6-DIGIT CODE</Text>
                <TextInput
                  ref={otpRef}
                  style={[styles.input, styles.otpInput]}
                  placeholder="——————"
                  placeholderTextColor={COLORS.border}
                  value={otp}
                  onChangeText={v => {
                    setOtp(v.replace(/\D/g, '').slice(0, 6));
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyOTP}
                />

                <TouchableOpacity
                  style={[styles.btn, (otp.length < 6 || loading) && styles.btnDisabled]}
                  onPress={handleVerifyOTP}
                  disabled={otp.length < 6 || loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={COLORS.white} />
                    : <Text style={styles.btnText}>Verify & Sign In</Text>
                  }
                </TouchableOpacity>

                <View style={styles.otpFooter}>
                  <TouchableOpacity onPress={() => { setStep('email'); setOtp(''); }}>
                    <Text style={styles.secondaryLink}>← Different email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={styles.secondaryLink}>Resend code</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* ── Footer ── */}
          <Text style={styles.footer}>
            By signing in you agree to use this app responsibly and respect your playing partners.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  kav:  { flex: 1 },
  inner: {
    flex: 1, justifyContent: 'center',
    padding: SPACING.lg, gap: SPACING.md,
  },

  logoWrap: {
    width: 88, height: 88, borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentLight,
    borderWidth: 2, borderColor: COLORS.accentBorder,
    alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.cardMd,
  },
  logoEmoji: { fontSize: 40 },
  appName:   { fontSize: 32, fontWeight: '800', color: COLORS.text, textAlign: 'center', letterSpacing: -0.5 },
  tagline:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: -SPACING.sm },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.lg, gap: SPACING.md,
    ...SHADOW.cardMd,
    marginTop: SPACING.sm,
  },
  cardTitle:    { fontSize: 22, fontWeight: '800', color: COLORS.text },
  cardSubtitle: { fontSize: 14, color: COLORS.textMuted, lineHeight: 20, marginTop: -SPACING.sm },
  emailHighlight: { fontWeight: '700', color: COLORS.text },

  label: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.2 },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
    fontSize: 16, color: COLORS.text,
    marginTop: -SPACING.sm,
  },
  otpInput: {
    fontSize: 32, fontWeight: '800', textAlign: 'center',
    letterSpacing: 12, paddingVertical: SPACING.lg,
  },

  btn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.md,
    alignItems: 'center', ...SHADOW.fab,
  },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  otpFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: -SPACING.sm,
  },
  secondaryLink: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },

  footer: {
    fontSize: 11, color: COLORS.textMuted, textAlign: 'center',
    lineHeight: 17, paddingHorizontal: SPACING.md,
  },
});
