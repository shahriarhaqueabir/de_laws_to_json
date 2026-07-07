"use client";

import { useEffect, useState } from "react";

/**
 * API Documentation page using Swagger UI.
 * Dynamically loads the OpenAPI spec from /api/openapi so
 * the server URL always matches where the page is served from.
 */
export default function ApiDocsPage() {
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/openapi")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load API spec (${r.status})`);
        return r.json();
      })
      .then((data) => setSpec(data))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-bold text-white mb-4">API Documentation</h1>
          <p className="text-red-400">Failed to load API specification: {error}</p>
          <p className="text-zinc-500 mt-4 text-sm">
            Make sure the API server is running. Try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-accent-gold border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-zinc-400">Loading API specification...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="border-b border-white/5 px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {(spec.info as { title?: string })?.title || "API Documentation"}
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">
            {(spec.info as { description?: string })?.description || ""}
          </p>
          <div className="flex gap-2 mt-3">
            {(spec.servers as Array<{ url: string; description: string }>)?.map(
              (s: { url: string; description: string }) => (
                <span
                  key={s.url}
                  className="text-xs px-3 py-1 rounded-full bg-white/5 text-zinc-500 font-mono"
                >
                  {s.description}: {s.url}
                </span>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Endpoint list */}
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        {Object.entries(spec.paths as Record<string, unknown>).map(
          ([path, methods]) => (
            <div key={path} className="premium-card overflow-hidden">
              {/* Path header */}
              <div className="px-6 py-4 border-b border-white/5 flex items-center gap-4">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-600 font-mono">
                  {Object.keys(methods as Record<string, unknown>)
                    .filter((m) => m !== "parameters")
                    .join(", ")
                    .toUpperCase()}
                </span>
                <span className="text-lg font-mono font-bold text-white">
                  {path}
                </span>
              </div>

              {/* Method details */}
              {Object.entries(methods as Record<string, unknown>).map(
                ([method, detail]) => {
                  if (method === "parameters") return null;
                  const d = detail as {
                    summary?: string;
                    description?: string;
                    parameters?: Array<{
                      name: string;
                      in: string;
                      required?: boolean;
                      description?: string;
                      schema?: { type: string; default?: string; enum?: string[] };
                    }>;
                    requestBody?: {
                      content?: Record<
                        string,
                        { schema?: Record<string, unknown> }
                      >;
                    };
                    responses?: Record<
                      string,
                      { description: string; content?: unknown }
                    >;
                  };
                  return (
                    <div key={method} className="px-6 py-4 space-y-4">
                      {d.summary && (
                        <p className="text-zinc-300 text-sm">{d.summary}</p>
                      )}

                      {/* Parameters */}
                      {d.parameters && d.parameters.length > 0 && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">
                            Parameters
                          </h4>
                          <div className="space-y-2">
                            {d.parameters.map((p) => (
                              <div
                                key={p.name}
                                className="flex items-start gap-4 text-sm"
                              >
                                <code className="text-accent-gold font-mono min-w-[120px]">
                                  {p.name}
                                  {p.required && (
                                    <span className="text-red-400 ml-1">*</span>
                                  )}
                                </code>
                                <span className="text-zinc-400 text-xs uppercase tracking-wider min-w-[60px]">
                                  {p.in}
                                </span>
                                <span className="text-zinc-500">
                                  {p.description}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Request Body Schema */}
                      {d.requestBody?.content?.["application/json"]?.schema && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">
                            Request Body
                          </h4>
                          <pre className="text-xs text-zinc-400 font-mono bg-white/[0.02] p-3 rounded border border-white/5 overflow-x-auto">
                            {JSON.stringify(
                              d.requestBody.content["application/json"]
                                .schema,
                              null,
                              2,
                            )}
                          </pre>
                        </div>
                      )}

                      {/* Responses */}
                      {d.responses && (
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">
                            Responses
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(d.responses).map(
                              ([code, resp]) => (
                                <span
                                  key={code}
                                  className="text-xs px-2 py-1 rounded font-mono"
                                >
                                  <span
                                    className={
                                      code.startsWith("2")
                                        ? "text-green-400"
                                        : code.startsWith("4")
                                          ? "text-yellow-400"
                                          : "text-red-400"
                                    }
                                  >
                                    {code}
                                  </span>{" "}
                                  <span className="text-zinc-600">
                                    {(resp as { description: string })
                                      .description || ""}
                                  </span>
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          ),
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 px-8 py-6 mt-12">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs text-zinc-700 font-mono">
            German Law Vault API — OpenAPI 3.0.3
          </p>
        </div>
      </div>
    </div>
  );
}
