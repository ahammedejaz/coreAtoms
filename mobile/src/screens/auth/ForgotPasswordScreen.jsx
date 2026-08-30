/**
 * ForgotPasswordScreen — Password reset request.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase/client';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants/theme';

export default function ForgotPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleReset = async () => {
    if (!email.trim()) {
      setMessage({ text: 'Please enter your email address.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setMessage({ text: 'Password reset link sent! Check your email.', type: 'success' });
    } catch (err) {
      const raw = String(err?.message || '').toLowerCase();
      if (raw.includes('rate') || raw.includes('limit')) {
        setMessage({ text: 'Too many attempts. Please wait a moment and try again.', type: 'error' });
      } else if (raw.includes('not found') || raw.includes('no user')) {
        setMessage({ text: 'No account found with this email.', type: 'error' });
      } else {
        setMessage({ text: 'Failed to send reset link. Please try again.', type: 'error' });
      }
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you a link to reset your password.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {message.text ? (
            <View style={[styles.messageBox, message.type === 'success' ? styles.successBox : styles.errorBox]}>
              <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>
                {message.text}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleReset}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>Send Reset Link</Text>
            )}
          </Pressable>

          <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={styles.backText}>Back to Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    ...SHADOWS.md,
  },
  title: { ...FONTS.h2, textAlign: 'center', marginBottom: SPACING.sm },
  subtitle: { ...FONTS.caption, textAlign: 'center', marginBottom: SPACING.xxl },
  field: { marginBottom: SPACING.lg },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  messageBox: { borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: SPACING.md },
  successBox: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  successText: { color: '#047857' },
  errorText: { color: '#dc2626' },
  messageText: { fontSize: 13 },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  backLink: { alignItems: 'center', marginTop: SPACING.lg },
  backText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
});
