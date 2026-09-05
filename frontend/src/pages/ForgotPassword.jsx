/**
 * ForgotPassword.jsx — Request a password-reset email.
 *
 * Calls Supabase `resetPasswordForEmail` which sends a recovery link.
 * The link redirects the user to `/reset-password` where they set a new password.
 *
 * @module pages/ForgotPassword
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../services/supabase/client";
import SEO from "../components/SEO";
import AuthShell from "../components/AuthShell";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        const trimmed = email.trim();
        if (!trimmed) { setError("Please enter your email address"); return; }
        setLoading(true);
        try {
            const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (err) throw err;
            setSent(true);
        } catch (err) {
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <SEO title="Forgot Password | Core Atoms" description="Reset your password to regain access to your account." />
            <AuthShell
                title={sent ? "Check your email" : "Forgot your password?"}
                subtitle={sent
                    ? "We've sent a reset link to your inbox."
                    : "Enter your email and we'll send you a link to set a new one."}
            >
                {sent ? (
                    <div className="space-y-5">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
                            Check your inbox and spam folder for a reset link. It expires in one hour.
                        </div>
                        <p className="text-center text-sm text-stone-500">
                            Didn't receive it?{" "}
                            <button onClick={() => { setSent(false); setError(""); }} className="font-semibold text-brand hover:underline underline-offset-4">
                                Send it again
                            </button>
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="forgot-email" className="mb-1.5 block text-[13px] font-semibold text-ink">Email address</label>
                            <input id="forgot-email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="input" autoFocus />
                        </div>

                        {error && (
                            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="btn-primary btn-lg w-full disabled:opacity-60">
                            {loading ? "Sending…" : "Send reset link"}
                        </button>

                        <p className="text-xs leading-relaxed text-stone-500">
                            Signed up with Google? Password reset won't apply. Use <span className="font-semibold text-ink">Continue with Google</span> on the login page instead.
                        </p>
                    </form>
                )}

                <p className="mt-6 text-center text-sm">
                    <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline underline-offset-4">
                        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        Back to login
                    </Link>
                </p>
            </AuthShell>
        </>
    );
}
