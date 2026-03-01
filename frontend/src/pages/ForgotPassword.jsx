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
import { supabase } from "../services/supabase/client";
import SEO from "../components/SEO";

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
        <div className="min-h-[80vh] flex items-center justify-center py-12">
            <SEO title="Forgot Password | Core Atoms" description="Reset your password to regain access to your account." />
            <div className="w-full max-w-md">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f] shadow-sm mx-auto mb-5">
                        <span className="text-lg font-bold text-white tracking-wider">CA</span>
                    </div>
                    <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
                        {sent ? "Check your email" : "Forgot password?"}
                    </h1>
                    <p className="mt-2 text-sm text-stone-500">
                        {sent
                            ? "We've sent a password reset link to your email."
                            : "Enter your email and we'll send you a link to reset your password."}
                    </p>
                </div>

                <div className="card p-8 space-y-5">
                    {sent ? (
                        <>
                            {/* Success state */}
                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                                <strong>Email sent!</strong> Check your inbox (and spam folder) for a reset link. The link will expire in 1 hour.
                            </div>
                            <p className="text-xs text-stone-400 text-center">
                                Didn't receive it?{" "}
                                <button onClick={() => { setSent(false); setError(""); }} className="font-semibold text-[#1e3a5f] hover:underline">
                                    Try again
                                </button>
                            </p>
                        </>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-stone-600 mb-1.5">Email address</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="input" autoFocus />
                            </div>

                            {error && (
                                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                                    {error}
                                </div>
                            )}

                            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                                {loading ? "Sending…" : "Send reset link"}
                            </button>

                            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
                                <strong>Note:</strong> If you signed up with Google, password reset won't work. Please use <strong>"Continue with Google"</strong> on the login page instead.
                            </div>
                        </form>
                    )}

                    <p className="text-center text-sm text-stone-500">
                        <Link to="/login" className="font-semibold text-[#1e3a5f] hover:underline">← Back to login</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
