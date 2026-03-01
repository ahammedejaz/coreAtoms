/**
 * ResetPassword.jsx — Set a new password after clicking the recovery link.
 *
 * When Supabase sends a recovery email, the link contains a token. Supabase
 * auto-exchanges this token on redirect and establishes a session. This page
 * then lets the user choose a new password via `updateUser({ password })`.
 *
 * @module pages/ResetPassword
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase/client";
import SEO from "../components/SEO";

export default function ResetPassword() {
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });
    const [sessionReady, setSessionReady] = useState(false);

    // Wait for the RECOVERY session that Supabase establishes from the email link
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
                setSessionReady(true);
            }
        });
        // Also check if there's already a session (user clicked link earlier)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setSessionReady(true);
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ text: "", type: "" });

        if (password.length < 6) {
            setMessage({ text: "Password must be at least 6 characters.", type: "error" });
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
            setTimeout(() => navigate("/login", { replace: true }), 2000);
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
                    {!sessionReady ? (
                        <div className="text-center py-6 space-y-3">
                            <div className="animate-spin inline-block h-6 w-6 border-2 border-stone-300 border-t-[#1e3a5f] rounded-full" />
                            <p className="text-sm text-stone-500">Verifying your reset link…</p>
                            <p className="text-xs text-stone-400">If this takes too long, the link may have expired. <a href="/forgot-password" className="font-semibold text-[#1e3a5f] hover:underline">Request a new one</a>.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-stone-600 mb-1.5">New password</label>
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="input" autoFocus minLength={6} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-stone-600 mb-1.5">Confirm password</label>
                                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="••••••••" className="input" minLength={6} />
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
