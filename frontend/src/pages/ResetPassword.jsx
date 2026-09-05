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
import AuthShell from "../components/AuthShell";
import { ArrowLeft, TriangleAlert } from "lucide-react";

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
            setMessage({ text: "Password updated. Taking you to login…", type: "success" });
            redirectTimerRef.current = setTimeout(() => navigate("/login", { replace: true }), 2000);
        } catch (err) {
            setMessage({ text: err.message || "Something went wrong.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <SEO title="Reset Password | Core Atoms" description="Choose a new password for your account." />
            <AuthShell title="Set a new password" subtitle="Choose a strong password for your account.">
                {status === "verifying" && (
                    <div className="space-y-3 py-6 text-center" role="status" aria-live="polite">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
                        <p className="text-sm text-stone-500">Verifying your reset link…</p>
                    </div>
                )}

                {status === "invalid" && (
                    <div className="space-y-5">
                        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-soft px-4 py-3">
                            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-deep" strokeWidth={1.75} aria-hidden="true" />
                            <div>
                                <p className="text-sm font-semibold text-ink">This reset link isn't valid</p>
                                <p className="mt-1 text-sm leading-relaxed text-stone-600">
                                    Reset links expire after 1 hour and can only be used once. Request a fresh one and open it from your email.
                                </p>
                            </div>
                        </div>
                        <Link to="/forgot-password" className="btn-primary btn-lg w-full">Request a new link</Link>
                        <p className="text-center text-sm">
                            <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline underline-offset-4">
                                <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                                Back to login
                            </Link>
                        </p>
                    </div>
                )}

                {status === "ready" && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="reset-password" className="mb-1.5 block text-[13px] font-semibold text-ink">New password</label>
                            <input id="reset-password" name="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} className="input" autoFocus minLength={MIN_PASSWORD_LENGTH} />
                        </div>
                        <div>
                            <label htmlFor="reset-confirm" className="mb-1.5 block text-[13px] font-semibold text-ink">Confirm password</label>
                            <input id="reset-confirm" name="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Repeat your password" className="input" minLength={MIN_PASSWORD_LENGTH} />
                        </div>

                        {message.text && (
                            <div role="alert" className={`rounded-xl px-4 py-3 text-sm ${message.type === "success"
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border border-red-200 bg-red-50 text-red-700"
                                }`}>
                                {message.text}
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="btn-primary btn-lg w-full disabled:opacity-60">
                            {loading ? "Updating…" : "Update password"}
                        </button>
                    </form>
                )}
            </AuthShell>
        </>
    );
}
