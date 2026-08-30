/**
 * LoginScreen — Email/password + Google OAuth authentication.
 * Fixes: Google login, post-login navigation, modern UI.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Animated, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../../services/supabase/client';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants/theme';

// Required for Google OAuth redirect
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Fade-in animation
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // Navigate away when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Use reset to reliably navigate to main tabs from a modal
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    }
  }, [isAuthenticated]);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setMessage({ text: 'Please enter email and password.', type: 'error' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage({ text: 'Please enter a valid email address.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        setMessage({ text: 'Check your email to confirm your account.', type: 'success' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        // AuthContext will detect the session change → isAuthenticated becomes true → goBack()
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }

    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      // Use explicit deep link scheme for production builds
      const redirectUrl = 'coreatoms://auth/callback';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl,
        );

        if (result.type === 'success' && result.url) {
          // Extract tokens from the redirect URL
          const url = new URL(result.url);
          const params = new URLSearchParams(url.hash?.substring(1) || url.search?.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            // AuthContext will detect the session → isAuthenticated → reset navigation
          }
        }
      }
    } catch (err) {
      setMessage({ text: err.message || 'Google sign-in failed', type: 'error' });
    }
    setGoogleLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={Keyboard.dismiss}
      >
        {/* Close button */}
        <Pressable style={[styles.closeBtn, { top: insets.top + 12 }]} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={COLORS.textSecondary} />
        </Pressable>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>CA</Text>
            </View>
            <Text style={styles.title}>
              {isSignup ? 'Create your account' : 'Welcome back'}
            </Text>
            <Text style={styles.subtitle}>
              {isSignup
                ? 'Start your wellness journey with Core Atoms.'
                : 'Sign in to manage your orders and preferences.'}
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Google OAuth */}
            <Pressable
              style={[styles.googleBtn, googleLoading && styles.buttonDisabled]}
              onPress={handleGoogle}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={COLORS.textPrimary} size="small" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#EA4335" />
                  <Text style={styles.googleText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with email</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  accessibilityHint={showPassword ? 'Tap to hide your password' : 'Tap to reveal your password'}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
                </Pressable>
              </View>
              {!isSignup && (
                <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotLink}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              )}
            </View>

            {/* Message */}
            {message.text ? (
              <View style={[styles.messageBox, message.type === 'success' ? styles.successBox : styles.errorBox]}>
                <Ionicons
                  name={message.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={message.type === 'success' ? '#047857' : '#dc2626'}
                />
                <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>
                  {message.text}
                </Text>
              </View>
            ) : null}

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                loading && styles.buttonDisabled,
                pressed && !loading && styles.buttonPressed,
              ]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignup ? 'Create account' : 'Sign in'}
                </Text>
              )}
            </Pressable>

            {/* Toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {isSignup ? 'Already have an account? ' : "Don't have an account? "}
              </Text>
              <Pressable onPress={() => { setIsSignup(!isSignup); setMessage({ text: '', type: '' }); }}>
                <Text style={styles.toggleLink}>{isSignup ? 'Sign in' : 'Sign up'}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
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
  closeBtn: {
    position: 'absolute', right: SPACING.xl, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.sm,
  },

  header: { alignItems: 'center', marginBottom: SPACING.xxxl },
  logoContainer: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  logoText: { color: COLORS.white, fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    ...SHADOWS.md,
  },

  // Google
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingVertical: 14, backgroundColor: COLORS.white,
  },
  googleText: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.xl, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },

  field: { marginBottom: SPACING.lg },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, letterSpacing: 0.3 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    backgroundColor: COLORS.white, overflow: 'hidden',
  },
  inputIcon: { paddingLeft: 14 },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  eyeBtn: { paddingRight: 14, paddingVertical: 10 },

  forgotLink: { alignSelf: 'flex-end', marginTop: 8 },
  forgotText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },

  messageBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: SPACING.md,
  },
  successBox: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  successText: { color: '#047857' },
  errorText: { color: '#dc2626' },
  messageText: { fontSize: 13, flex: 1 },

  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.sm,
  },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  toggleRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
  toggleText: { fontSize: 14, color: COLORS.textSecondary },
  toggleLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
});
