import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase/client";

export default function Login() {
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  const redirectAfterLogin = async (uid) => {
    const { data } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
    if (data?.role === "admin") navigate("/admin", { replace: true });
    else navigate("/", { replace: true });
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({ text: "Check your email to confirm your account.", type: "success" });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await redirectAfterLogin(data.user.id);
      }
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f] shadow-sm mx-auto mb-5">
            <span className="text-lg font-bold text-white tracking-wider">CA</span>
          </div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            {isSignup
              ? "Start your wellness journey with Core Atoms."
              : "Sign in to manage your orders and preferences."}
          </p>
        </div>

        <div className="card p-8 space-y-6">
          {/* Google */}
          <button
            onClick={handleGoogle}
            className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-[#E8E4DE] bg-white px-5 py-3 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 hover:shadow transition-all duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.7 3.2l6.5-6.5C35.2 2.3 29.9 0 24 0 14.7 0 6.7 5.4 2.7 13.3l7.6 5.9C12.1 13.3 17.6 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.7-2 5-4.2 6.6l6.6 5.1c3.8-3.5 6.3-8.6 6.3-15.7z"/>
              <path fill="#FBBC05" d="M10.3 28.2c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.6-5.9C1 17.1 0 20.4 0 23.5s1 6.4 2.7 9.1l7.6-5.9z"/>
              <path fill="#34A853" d="M24 47c6 0 11.1-2 14.8-5.4l-6.6-5.1c-2 1.3-4.6 2.1-8.2 2.1-6.4 0-11.9-3.8-13.8-9.7l-7.6 5.9C6.7 42.6 14.7 47 24 47z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E8E4DE]" />
            <span className="text-xs text-stone-400 font-medium">or continue with email</span>
            <div className="flex-1 h-px bg-[#E8E4DE]" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="input" />
            </div>

            {message.text && (
              <div className={`rounded-xl px-4 py-3 text-sm ${
                message.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                  : "bg-red-50 border border-red-200 text-red-600"
              }`}>
                {message.text}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-stone-500">
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <button onClick={() => { setIsSignup(!isSignup); setMessage({ text: "", type: "" }); }}
              className="font-semibold text-[#1e3a5f] hover:underline">
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
