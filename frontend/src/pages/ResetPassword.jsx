/**
 * ResetPassword.jsx — Set a new password after clicking the recovery link.
 *
 * When Supabase sends a recovery email, the link contains a token. Supabase
 * auto-exchanges this token on redirect and establishes a session. This page
 * then lets the user choose a new password via `updateUser({ password })`.
 *
 * The gate only accepts a session that actually came from an emailed link — a
 * plain signed-in session is not a recovery session — and gives up with an
 * actionable error rather than spinning forever on an expired link.
 *
 * @module pages/ResetPassword
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase/client";
import SEO from "../components/SEO";

const MIN_PASSWORD_LENGTH = 6;
/** How long to wait for the recovery session before calling the link dead. */
const VERIFY_TIMEOUT_MS = 8000;

/**
 * Recovery markers left in the URL by the emailed link. Supabase strips the
 * hash once it has consumed it, so this is read at module load — as early as
 * this lazy route can manage — and only used as a hint.
 */
const URL_RECOVERY_HINT = (() => {
    try {
        if (window.location.hash.includes("type=recovery")) return true;
        const params = new URLSearchParams(window.location.search);
        return params.get("type") === "recovery" || params.has("code");
    } catch { return false; }
})();

/** GoTrue `amr` methods that mean "this session came from an emailed link". */
const LINK_AUTH_METHODS = new Set(["recovery", "otp", "magiclink", "invite"]);

/** Decodes a JWT payload. Unverified — used only to read the `amr` hint. */
function decodeJwtPayload(token) {
    try {
        const part = String(token).split(".")[1];
        if (!part) return null;
        return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    } catch { return null; }
}

/** True when the session was minted by a recovery/magic link, not a normal login. */
function isRecoverySession(session) {
    if (!session?.access_token) return false;
    const claims = decodeJwtPayload(session.access_token);
    const amr = Array.isArray(claims?.amr) ? claims.amr : [];
    return amr.some((entry) => LINK_AUTH_METHODS.has(String(entry?.method ?? entry).toLowerCase()));
}

export default function ResetPassword() {
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });
    /** "verifying" | "ready" | "invalid" */
    const [status, setStatus] = useState("verifying");
    const redirectTimerRef = useRef(null);

    // Wait for the RECOVERY session that Supabase establishes from the email link
    useEffect(() => {
        let settled = false;
        const accept = () => { if (!settled) { settled = true; setStatus("ready"); } };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY") accept();
            else if (isRecoverySession(session)) accept();
        });

        // The event can fire before this lazy page mounts, so also inspect the
        // session the client already holds.
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session && (URL_RECOVERY_HINT || isRecoverySession(session))) accept();
        });

        // Nothing arrived → the link is missing, malformed or expired. Say so
        // instead of leaving a spinner running forever.
        const timeout = setTimeout(() => {
            if (!settled) { settled = true; setStatus("invalid"); }
        }, VERIFY_TIMEOUT_MS);

        return () => {
            settled = true;
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    // Don't navigate out of an unmounted page
    useEffect(() => () => clearTimeout(redirectTimerRef.current), []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ text: "", type: "" });

        if (password.length < MIN_PASSWORD_LENGTH) {
            setMessage({ text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, type: "error" });
            return;
        }
        if (password !== confirm) {
            setMessage({ text: "Passwords don't match.", type: "error" });
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            // Sign out the recovery session so user starts fresh at login
            await supabase.auth.signOut();
            setMessage({ text: "Password updated successfully! Redirecting to login…", type: "success" });
            redirectTimerRef.current = setTimeout(() => navigate("/login", { replace: true }), 2000);
        } catch (err) {
            setMessage({ text: err.message || "Something went wrong.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center py-12">
            <SEO title="Reset Password | Core Atoms" description="Choose a new password for your account." />
            <div className="w-full max-w-md">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f] shadow-sm mx-auto mb-5">
                        <span className="text-lg font-bold text-white tracking-wider">CA</span>
                    </div>
                    <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Set new password</h1>
                    <p className="mt-2 text-sm text-stone-500">Choose a strong password for your account.</p>
                </div>

                <div className="card p-8">
                    {status === "verifying" && (
                        <div className="text-center py-6 space-y-3" role="status" aria-live="polite">
                            <div className="animate-spin inline-block h-6 w-6 border-2 border-stone-300 border-t-[#1e3a5f] rounded-full" />
                            <p className="text-sm text-stone-500">Verifying your reset link…</p>
                        </div>
                    )}

                    {status === "invalid" && (
                        <div className="text-center py-4 space-y-4">
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200">
                                <svg className="h-6 w-6 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-stone-900">This reset link isn't valid</p>
                                <p className="mt-1 text-sm text-stone-500 leading-relaxed">
                                    Reset links expire after 1 hour and can only be used once. Request a fresh one and open it from your email.
                                </p>
                            </div>
                            <Link to="/forgot-password" className="btn-primary inline-block px-5 py-2.5">Request a new link</Link>
                            <p className="text-sm text-stone-500">
                                <Link to="/login" className="font-semibold text-[#1e3a5f] hover:underline">← Back to login</Link>
                            </p>
                        </div>
                    )}

                    {status === "ready" && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="reset-password" className="block text-xs font-semibold text-stone-600 mb-1.5">New password</label>
                                <input id="reset-password" name="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="input" autoFocus minLength={MIN_PASSWORD_LENGTH} />
                            </div>
                            <div>
                                <label htmlFor="reset-confirm" className="block text-xs font-semibold text-stone-600 mb-1.5">Confirm password</label>
                                <input id="reset-confirm" name="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="••••••••" className="input" minLength={MIN_PASSWORD_LENGTH} />
                            </div>

                            {message.text && (
                                <div className={`rounded-xl px-4 py-3 text-sm ${message.type === "success"
                                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                    : "bg-red-50 border border-red-200 text-red-600"
                                    }`}>
                                    {message.text}
                                </div>
                            )}

                            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                                {loading ? "Updating…" : "Update password"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
