"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth-context";
import { LogIn, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const { signIn, signUp, user } = useAuth();
  const router = useRouter();

  if (user) {
    router.push("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const result =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password);

    if (result) {
      setError(result);
    } else if (mode === "signup") {
      setSuccess("Account created! Check your email for confirmation.");
    } else {
      // Clear guest chat history on successful sign-in
      sessionStorage.removeItem("glv_guest_chat");
      router.push("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="bg-[#1a1a1a] w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-[#888888]" />
          </div>
          <h1 className="text-3xl font-bold text-[#e8e8e8]">
            {mode === "signin" ? "Initialize Session" : "Create Account"}
          </h1>
          <p className="text-[#a3a3a3] mt-2">
            {mode === "signin"
              ? "Establish a secure link to sync bookmarks"
              : "Create an account to save your progress"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#141414] shadow-[0_1px_3px_rgba(0,0,0,0.6)] border border-[#2a2a2a] p-8 space-y-5"
        >
          {error && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] text-[#a3a3a3] px-4 py-3 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-[#1a1a1a] border border-[#888888] text-[#888888] px-4 py-3 text-sm">
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#e8e8e8] mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#e8e8e8] focus:outline-none focus:ring-1 focus:ring-[#888888] transition-shadow duration-100"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#e8e8e8] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#e8e8e8] focus:outline-none focus:ring-1 focus:ring-[#888888] transition-shadow duration-100"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#888888] hover:bg-[#aaaaaa] text-[#e8e8e8] font-bold py-3 disabled:opacity-50 transition-colors duration-100 active:translate-y-[1px] flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LogIn className="w-5 h-5" />
            )}
            {mode === "signin" ? "Initialize Session" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-[#a3a3a3] mt-6">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-[#888888] hover:underline"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-[#888888] hover:underline"
              >
                Initialize session
              </button>
            </>
          )}
        </p>

        <p className="text-center mt-4">
          <Link
            href="/"
            className="text-xs text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors duration-100"
          >
            \u2190 Back to search
          </Link>
        </p>
      </div>
    </div>
  );
}
