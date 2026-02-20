import { useState } from "react";
import { supabase } from "../services/supabase/client";
import Button from "../components/Button";

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMessage(err.message);
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-neutral-900">
            {isSignup ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-sm text-neutral-500">
            {isSignup
              ? "Sign up to start ordering premium nutraceuticals."
              : "Login to manage your orders and shipments."}
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-600">
                Email address
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-600">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
              />
            </div>
          </div>

          <Button type="submit" className="w-full">
            {loading ? "Please wait..." : isSignup ? "Sign Up" : "Login"}
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-neutral-200"></div>
          <span className="text-xs text-neutral-400">OR</span>
          <div className="flex-1 h-px bg-neutral-200"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.02] transition-all duration-200 ease-out transform"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.7 3.2l6.5-6.5C35.2 2.3 29.9 0 24 0 14.7 0 6.7 5.4 2.7 13.3l7.6 5.9C12.1 13.3 17.6 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.7-2 5-4.2 6.6l6.6 5.1c3.8-3.5 6.3-8.6 6.3-15.7z"/>
            <path fill="#FBBC05" d="M10.3 28.2c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.6-5.9C1 17.1 0 20.4 0 23.5s1 6.4 2.7 9.1l7.6-5.9z"/>
            <path fill="#34A853" d="M24 47c6 0 11.1-2 14.8-5.4l-6.6-5.1c-2 1.3-4.6 2.1-8.2 2.1-6.4 0-11.9-3.8-13.8-9.7l-7.6 5.9C6.7 42.6 14.7 47 24 47z"/>
          </svg>
          Continue with Google
        </button>

        {message && (
          <p className="text-sm text-center text-red-500">{message}</p>
        )}

        <div className="text-center text-sm text-neutral-600">
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsSignup(!isSignup)}
            className="text-indigo-600 font-medium hover:underline"
          >
            {isSignup ? "Login" : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
