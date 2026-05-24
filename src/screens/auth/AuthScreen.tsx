import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export default function AuthScreen() {
  const { signInWithOTP, verifyOTP } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await signInWithOTP(email.trim().toLowerCase());
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setStep('otp');
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    const { error } = await verifyOTP(email.trim().toLowerCase(), otp.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Invalid code', 'Please check the code and try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Logo area */}
        <Text style={styles.logo}>⛳</Text>
        <Text style={styles.title}>Golf Scoring</Text>
        <Text style={styles.subtitle}>Ryder Cup-style competition tracker</Text>

        <View style={styles.card}>
          {step === 'email' ? (
            <>
              <Text style={styles.label}>Enter your email to sign in</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <TouchableOpacity
                style={[styles.button, !email.trim() && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={loading || !email.trim()}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send Magic Code →</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Check your email</Text>
              <Text style={styles.hint}>We sent a 6-digit code to {email}</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="000000"
                placeholderTextColor={COLORS.textMuted}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.button, otp.length < 6 && styles.buttonDisabled]}
                onPress={handleVerifyOTP}
                disabled={loading || otp.length < 6}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify →</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep('email')} style={styles.backLink}>
                <Text style={styles.backLinkText}>← Use different email</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', padding: SPACING.lg },
  logo: { fontSize: 64, textAlign: 'center', marginBottom: SPACING.sm },
  title: {
    fontSize: 32, fontWeight: '800', color: COLORS.text,
    textAlign: 'center', marginBottom: 4,
  },
  subtitle: {
    fontSize: 14, color: COLORS.textSecondary,
    textAlign: 'center', marginBottom: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  hint: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.md },
  input: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  otpInput: {
    fontSize: 28, fontWeight: '700',
    textAlign: 'center', letterSpacing: 8,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backLink: { marginTop: SPACING.md, alignItems: 'center' },
  backLinkText: { color: COLORS.textSecondary, fontSize: 14 },
});
