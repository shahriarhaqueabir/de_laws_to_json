"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../../lib/supabase";

const supabase = createClient();
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

// ── Supabase OAuth consent flow ──────────────────────────────────────────
// Supabase redirects here after an OAuth app requests authorization,
// with these query params from the /auth/v1/oauth/authorize endpoint:
//   client_id, redirect_uri, scope, state, response_type

interface ClientInfo {
  name: string;
  icon_url: string | null;
  client_uri: string | null;
  description: string | null;
  scope_descriptions: string[];
}

interface OAuthRequest {
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  response_type: string;
}

export default function OAuthConsentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#666] animate-spin" />
        </div>
      }
    >
      <ConsentPageInner />
    </Suspense>
  );
}

function ConsentPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derive OAuth request from search params during render
  // (react-patterns: render is a pure function of props, avoid setState in effects)
  const client_id = searchParams.get("client_id");
  const redirect_uri = searchParams.get("redirect_uri");
  const scope = searchParams.get("scope");
  const state = searchParams.get("state");
  const response_type = searchParams.get("response_type") ?? "code";

  const hasRequiredParams = Boolean(
    client_id && redirect_uri && scope && state,
  );
  const infoError = hasRequiredParams
    ? null
    : "Invalid OAuth request: missing required parameters.";

  const oauthReq = useMemo<OAuthRequest | null>(() => {
    if (!hasRequiredParams) return null;
    return {
      client_id: client_id!,
      redirect_uri: redirect_uri!,
      scope: scope!,
      state: state!,
      response_type,
    };
  }, [client_id, redirect_uri, scope, state, response_type, hasRequiredParams]);

  const [user, setUser] = useState<unknown | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Check authentication
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setAuthLoading(false);
    });
  }, []);

  // 2. Fetch client info when OAuth request is valid
  useEffect(() => {
    if (!oauthReq) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    fetch(`${supabaseUrl}/auth/v1/oauth/apps/${oauthReq.client_id}`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          const descriptions: Record<string, string> = {
            openid: "View your identity and sign in",
            email: "View your email address",
            profile: "View your profile information",
            laws: "Access German law articles",
            bookmarks: "Manage your bookmarks",
          };

          setClientInfo({
            name: data.name ?? data.client_name ?? client_id,
            icon_url: data.icon_url ?? null,
            client_uri: data.client_uri ?? null,
            description: data.description ?? null,
            scope_descriptions: scope
              ? scope
                .split(" ")
                .map((s) => descriptions[s] ?? `Access scope: ${s}`)
              : [],
          });
        }
      })
      .catch(() => {
        // Non-fatal — name defaults to client_id
      });
  }, [oauthReq, client_id, scope]);

  // 3. Handle consent decision
  const handleDecision = useCallback(
    async (approved: boolean) => {
      if (!oauthReq) return;
      setSubmitting(true);
      setError(null);

      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

        if (approved) {
          // Get session access token
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            setError("You must be signed in to authorize an application.");
            setSubmitting(false);
            return;
          }

          // Issue authorization code via Supabase Auth API
          const res = await fetch(`${supabaseUrl}/auth/v1/oauth/authorize`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              client_id: oauthReq.client_id,
              redirect_uri: oauthReq.redirect_uri,
              scope: oauthReq.scope,
              state: oauthReq.state,
              response_type: oauthReq.response_type,
              action: "approve",
            }),
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => null);
            throw new Error(
              errBody?.error_description ??
              errBody?.error ??
              "Authorization request failed.",
            );
          }

          const data = await res.json();

          // Redirect back to the OAuth app with the code
          const redirectUrl = new URL(oauthReq.redirect_uri);
          redirectUrl.searchParams.set("code", data.code);
          redirectUrl.searchParams.set("state", oauthReq.state);
          router.replace(redirectUrl.toString());
        } else {
          // Deny — redirect back with error
          const redirectUrl = new URL(oauthReq.redirect_uri);
          redirectUrl.searchParams.set("error", "access_denied");
          redirectUrl.searchParams.set(
            "error_description",
            "The user denied the authorization request.",
          );
          redirectUrl.searchParams.set("state", oauthReq.state);
          router.replace(redirectUrl.toString());
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred.",
        );
        setSubmitting(false);
      }
    },
    [oauthReq, router],
  );

  // ── Loading state ─────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#666] animate-spin" />
      </div>
    );
  }

  // ── Not authenticated ─────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-[#1a1a1a] w-16 h-16 flex items-center justify-center mx-auto mb-6">
            <ShieldOff className="w-8 h-8 text-[#888]" />
          </div>
          <h1 className="text-2xl font-bold text-[#e8e8e8] mb-3">
            Authentication Required
          </h1>
          <p className="text-[#a3a3a3] mb-8">
            You need to sign in before authorizing an application.
          </p>
          <a
            href={`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}
            className="inline-block bg-[#888] hover:bg-[#aaa] text-[#e8e8e8] font-bold px-6 py-3 transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  // ── Invalid request ───────────────────────────────────────────────────
  if (infoError) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-[#1a1a1a] w-16 h-16 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-[#f59e0b]" />
          </div>
          <h1 className="text-2xl font-bold text-[#e8e8e8] mb-3">
            Invalid Request
          </h1>
          <p className="text-[#a3a3a3]">{infoError}</p>
        </div>
      </div>
    );
  }

  if (!oauthReq) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#666] animate-spin" />
      </div>
    );
  }

  // ── Consent UI ────────────────────────────────────────────────────────
  const scopeList = clientInfo?.scope_descriptions ?? oauthReq.scope.split(" ");

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-[#1a1a1a] w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-[#888]" />
          </div>
          <h1 className="text-2xl font-bold text-[#e8e8e8]">
            Authorization Request
          </h1>
          <p className="text-[#a3a3a3] mt-2">
            An application wants to access your account
          </p>
        </div>

        {/* Client card */}
        <div className="bg-[#141414] border border-[#2a2a2a] p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-[#1a1a1a] flex items-center justify-center shrink-0">
              {clientInfo?.icon_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clientInfo.icon_url}
                  alt=""
                  className="w-12 h-12 object-contain"
                />
              ) : (
                <ExternalLink className="w-6 h-6 text-[#666]" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#e8e8e8]">
                {clientInfo?.name ?? oauthReq.client_id}
              </h2>
              {clientInfo?.client_uri && (
                <a
                  href={clientInfo.client_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#666] hover:text-[#aaa] transition-colors"
                >
                  {clientInfo.client_uri}
                </a>
              )}
            </div>
          </div>
          {clientInfo?.description && (
            <p className="text-sm text-[#a3a3a3] border-t border-[#2a2a2a] pt-4 mt-2">
              {clientInfo.description}
            </p>
          )}
        </div>

        {/* Scope list */}
        <div className="bg-[#141414] border border-[#2a2a2a] p-6 mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#888] mb-4">
            This application will be able to:
          </h3>
          <ul className="space-y-3">
            {scopeList.map((scopeDesc, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm text-[#a3a3a3]"
              >
                <ShieldCheck className="w-4 h-4 text-[#666] mt-0.5 shrink-0" />
                <span>{scopeDesc}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] text-[#a3a3a3] px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleDecision(false)}
            disabled={submitting}
            className="flex-1 border border-[#2a2a2a] text-[#a3a3a3] hover:bg-[#1a1a1a] hover:text-[#e8e8e8] font-bold py-3 transition-colors disabled:opacity-50"
          >
            Deny
          </button>
          <button
            onClick={() => handleDecision(true)}
            disabled={submitting}
            className="flex-1 bg-[#888] hover:bg-[#aaa] text-[#e8e8e8] font-bold py-3 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
            Authorize
          </button>
        </div>

        {/* Signed in as */}
        <p className="text-center text-xs text-[#6b6b6b] mt-6">
          Signed in as{" "}
          <span className="text-[#888]">
            {((user as Record<string, unknown>).email as string) ??
              "Authenticated user"}
          </span>
        </p>
      </div>
    </div>
  );
}
