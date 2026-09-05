/**
 * Login.jsx — Authentication page (sign in / sign up).
 *
 * Supports both email+password and Google OAuth via Supabase Auth.
 * After login, admins are redirected to `/admin` and customers to `/`.
 * Toggle between sign-in and sign-up modes in the same form.
 *
 * @module pages/Login
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../services/supabase/client";
import { useAuth } from "../context/AuthContext";
import SEO from "../components/SEO";
import AuthShell from "../components/AuthShell";

/** Minimum password length — mirrors the rule enforced on ResetPassword. */
const MIN_PASSWORD_LENGTH = 6;

/**
 * Sanitises the `?redirect=` parameter written by `ProtectedRoute`.
 *
 * Only same-origin, path-relative targets are allowed: `//evil.com` and
 * `https://evil.com` are open redirects that would send a freshly
 * authenticated user off-site, so anything but a single leading slash is
 * discarded in favour of the default destination.
 */
function safeRedirect(raw) {
  if (!raw) return null;
  let value;
  try { value = decodeURIComponent(raw); } catch { return null; }
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  // `//host` and `/\host` are both protocol-relative in browsers
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = useMemo(() => safeRedirect(searchParams.get("redirect")), [searchParams]);
  const { loading: authLoading, isAuthenticated, isAdmin, roleResolved } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // The single post-authentication redirect path — covers password sign-in, the
  // Google OAuth callback and landing here while already signed in. It waits for
  // the authoritative role so admins aren't sent to `/` and bounced.
  useEffect(() => {
    if (authLoading || !isAuthenticated || !roleResolved) return;
    navigate(redirectTo || (isAdmin ? "/admin" : "/"), { replace: true });
  }, [authLoading, isAuthenticated, isAdmin, roleResolved, redirectTo, navigate]);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setMessage({ text: "", type: "" });

    if (isSignup) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setMessage({ text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, type: "error" });
        return;
      }
      if (password !== confirm) {
        setMessage({ text: "Passwords don't match.", type: "error" });
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({ text: "Check your email to confirm your account.", type: "success" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Navigation is handled by the redirect effect once the role resolves.
      }
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setMessage({ text: "", type: "" });
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
      if (error) throw error;
      // On success the browser navigates to Google — leave the button disabled.
    } catch (err) {
      setMessage({
        text: err.message || "Google sign-in is unavailable right now. Please use email instead.",
        type: "error",
      });
      setGoogleLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignup((prev) => !prev);
    setConfirm("");
    setMessage({ text: "", type: "" });
  };

  return (
    <>
      <SEO title="Login | Core Atoms" description="Sign in or create an account to manage your orders." />
      <AuthShell
        title={isSignup ? "Create your account" : "Welcome back"}
        subtitle={isSignup ? "Order tracking, replacements and CoreCoins, all in one place." : "Sign in to manage your orders and preferences."}
      >
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="btn-secondary h-12 w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.7 3.2l6.5-6.5C35.2 2.3 29.9 0 24 0 14.7 0 6.7 5.4 2.7 13.3l7.6 5.9C12.1 13.3 17.6 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.7-2 5-4.2 6.6l6.6 5.1c3.8-3.5 6.3-8.6 6.3-15.7z" />
            <path fill="#FBBC05" d="M10.3 28.2c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.6-5.9C1 17.1 0 20.4 0 23.5s1 6.4 2.7 9.1l7.6-5.9z" />
            <path fill="#34A853" d="M24 47c6 0 11.1-2 14.8-5.4l-6.6-5.1c-2 1.3-4.6 2.1-8.2 2.1-6.4 0-11.9-3.8-13.8-9.7l-7.6 5.9C6.7 42.6 14.7 47 24 47z" />
          </svg>
          {googleLoading ? "Opening Google…" : "Continue with Google"}
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs text-stone-400">or with email</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-[13px] font-semibold text-ink">Email address</label>
            <input id="login-email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="input" />
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="login-password" className="block text-[13px] font-semibold text-ink">Password</label>
              {!isSignup && (
                <Link to="/forgot-password" className="text-xs font-semibold text-brand hover:underline underline-offset-4">Forgot password?</Link>
              )}
            </div>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={isSignup ? MIN_PASSWORD_LENGTH : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder={isSignup ? `At least ${MIN_PASSWORD_LENGTH} characters` : "Your password"}
              className="input"
            />
          </div>

          {isSignup && (
            <div>
              <label htmlFor="login-confirm" className="mb-1.5 block text-[13px] font-semibold text-ink">Confirm password</label>
              <input id="login-confirm" name="confirm-password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Repeat your password" className="input" />
            </div>
          )}

          {message.text && (
            <div role="alert" className={`rounded-xl px-4 py-3 text-sm ${message.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-700"
              }`}>
              {message.text}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary btn-lg w-full disabled:opacity-60">
            {loading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          {isSignup ? "Already have an account? " : "New to Core Atoms? "}
          <button onClick={toggleMode} className="font-semibold text-brand hover:underline underline-offset-4">
            {isSignup ? "Sign in" : "Create an account"}
          </button>
        </p>
      </AuthShell>
    </>
  );
}
