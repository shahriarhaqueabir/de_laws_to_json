"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth-context";
import { useLanguage } from "../../hooks/useLanguage";
import { LogIn, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function AuthPage() {
  const { t } = useLanguage();
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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="bg-tertiary w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-zinc-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {mode === "signin" ? t("nav.sign_in") : t("auth.sign_up_button")}
          </h1>
          <p className="text-zinc-400 mt-2">
            {mode === "signin"
              ? "Sign in to sync bookmarks across devices"
              : "Create an account to save your progress"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-elevated shadow-[0_1px_3px_rgba(0,0,0,0.6)] border border-zinc-800 p-8 space-y-5"
        >
          {error && (
            <div
              className="bg-tertiary border border-zinc-700 text-zinc-400 px-4 py-3 text-sm"
              role="alert"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              className="bg-tertiary border border-zinc-500 text-zinc-400 px-4 py-3 text-sm"
              role="status"
            >
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("auth.email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-tertiary border border-zinc-700 text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold transition-shadow duration-100"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("auth.password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 bg-tertiary border border-zinc-700 text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold transition-shadow duration-100"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent-gold hover:bg-accent-gold-bright text-white font-bold py-3 disabled:opacity-50 transition-colors duration-100 active:translate-y-[1px] flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LogIn className="w-5 h-5" />
            )}
            {mode === "signin"
              ? t("auth.sign_in_button")
              : t("auth.sign_up_button")}
          </button>
        </form>

        <p className="text-center text-sm text-secondary mt-6">
          {mode === "signin" ? (
            <>
              {t("auth.no_account")}{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-accent-gold-body hover:underline"
              >
                {t("auth.sign_up_button")}
              </button>
            </>
          ) : (
            <>
              {t("auth.has_account")}{" "}
              <button
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-zinc-400 hover:underline"
              >
                {t("auth.sign_in_button")}
              </button>
            </>
          )}
        </p>

        <p className="text-center mt-4">
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors duration-100"
          >
            \u2190 Back to search
          </Link>
        </p>
      </div>
    </div>
  );
}
