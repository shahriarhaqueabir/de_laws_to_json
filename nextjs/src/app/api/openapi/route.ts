import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_SEARCH_RATE_LIMIT,
} from "../../../lib/rate-limiter";

const PRODUCTION_URL = "https://ai-assisted-german-law.vercel.app";
const LOCAL_URL = "http://localhost:3000";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "German Law Vault API",
    version: "1.0.0",
    description:
      "REST API for searching, explaining, and getting guidance on German federal laws.",
  },
  paths: {
    "/api/search": {
      get: {
        tags: ["Search"],
        summary: "Semantic search across German laws",
        parameters: [
          {
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string" },
            description:
              "Search query (auto-translated to German for embedding)",
          },
          {
            name: "category",
            in: "query",
            required: false,
            schema: { type: "string" },
            description:
              "Filter by law category (e.g. labor, housing, consumer)",
          },
          {
            name: "lang",
            in: "query",
            required: false,
            schema: { type: "string", default: "de" },
            description:
              "Response language (de, en, tr, ar, fr, es, pl, uk, ru)",
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", default: 1, minimum: 1, maximum: 100 },
            description: "Page number (20 results per page)",
          },
        ],
        responses: {
          "200": {
            description: "Search results grouped by law",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: { $ref: "#/components/schemas/LawResult" },
                    },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
          "422": { description: "Validation error" },
          "500": { description: "Search failed" },
        },
      },
    },
    "/api/laws/{key}": {
      get: {
        tags: ["Laws"],
        summary: "Get law metadata and norms by law key",
        parameters: [
          {
            name: "key",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Law abbreviation key (e.g. AGG, ArbZG, BGB)",
          },
        ],
        responses: {
          "200": {
            description: "Law metadata with norms",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LawDetail" },
              },
            },
          },
          "404": { description: "Law not found" },
        },
      },
    },
    "/api/laws": {
      get: {
        tags: ["Laws"],
        summary: "List all laws with pagination and optional filtering",
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1, minimum: 1, maximum: 500 },
            description: "Page number (max 500)",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50, minimum: 1, maximum: 1000 },
            description: "Results per page (max 1000)",
          },
          {
            name: "category",
            in: "query",
            schema: { type: "string" },
            description: "Filter by category key (e.g. labor, housing)",
          },
          {
            name: "search",
            in: "query",
            schema: { type: "string" },
            description: "Search by title, key, or alt_title (ILike match)",
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of laws",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          key: { type: "string" },
                          title: { type: "string" },
                          alt_title: { type: "string" },
                          category: { type: "string" },
                        },
                      },
                    },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    totalPages: { type: "integer" },
                  },
                },
              },
            },
          },
          "500": { description: "Failed to fetch laws" },
        },
      },
    },
    "/api/diagnostics": {
      get: {
        tags: ["System"],
        summary: "Check system health (Supabase + Qdrant connectivity)",
        responses: {
          "200": {
            description: "System status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    timestamp: { type: "string" },
                    env: { type: "object" },
                    checks: {
                      type: "object",
                      properties: {
                        supabase: {
                          type: "object",
                          properties: {
                            status: { type: "string" },
                            message: { type: "string" },
                          },
                        },
                        qdrant: {
                          type: "object",
                          properties: {
                            status: { type: "string" },
                            message: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/explain": {
      post: {
        tags: ["Explain"],
        summary: "Generate AI explanation of a legal norm",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ExplainRequest" },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Explanation with translation, summary, implications, next steps",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ExplainResponse" },
              },
            },
          },
          "422": { description: "Validation error" },
          "500": { description: "Explanation failed" },
        },
      },
    },
    "/api/chat": {
      post: {
        tags: ["Chat"],
        summary: "Chat with AI about German law",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChatRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Chat response" },
          "422": { description: "Validation error" },
          "500": { description: "Chat failed" },
        },
      },
    },
    "/api/guidance": {
      post: {
        tags: ["Guidance"],
        summary: "Generate legal guidance paths for a situation",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GuidanceRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Guidance paths generated" },
          "422": { description: "Validation error" },
          "500": { description: "Guidance failed" },
        },
      },
    },
    "/api/guidance/sessions": {
      get: {
        tags: ["Guidance"],
        summary: "List user's guidance sessions (auth required)",
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
          },
        ],
        responses: {
          "200": { description: "List of sessions" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/guidance/sessions/{id}": {
      get: {
        tags: ["Guidance"],
        summary: "Get a saved guidance session (auth required)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Session details" },
          "401": { description: "Unauthorized" },
          "404": { description: "Session not found" },
        },
      },
      delete: {
        tags: ["Guidance"],
        summary: "Delete a guidance session (auth required)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Deleted" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/guidance/generate-doc": {
      post: {
        tags: ["Guidance"],
        summary: "Generate a legal document from a template (auth required)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  sessionId: { type: "string", format: "uuid" },
                  templateId: { type: "string" },
                  pathNumber: { type: "integer" },
                  language: { type: "string", default: "de" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Document generated" },
          "401": { description: "Unauthorized" },
          "500": { description: "Generation failed" },
        },
      },
    },
    "/api/bookmarks/folders": {
      get: {
        tags: ["Bookmarks"],
        summary: "List user's bookmark folders (auth required)",
        responses: {
          "200": { description: "List of folders" },
          "401": { description: "Unauthorized" },
        },
      },
      post: {
        tags: ["Bookmarks"],
        summary: "Create bookmark folder (auth required)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  category: { type: "string" },
                },
                required: ["name"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Folder created" },
          "401": { description: "Unauthorized" },
        },
      },
      patch: {
        tags: ["Bookmarks"],
        summary: "Update folder properties (auth required)",
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  category: { type: "string" },
                  incident_date: { type: "string", nullable: true },
                  dispute_value: { type: "number" },
                  status: {
                    type: "string",
                    enum: [
                      "pre_action",
                      "consulting",
                      "filed",
                      "in_progress",
                      "resolved",
                    ],
                  },
                  opposing_party: { type: "string" },
                  deadline_date: { type: "string", nullable: true },
                  court_name: { type: "string" },
                  case_number: { type: "string" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Folder updated" },
          "401": { description: "Unauthorized" },
        },
      },
      delete: {
        tags: ["Bookmarks"],
        summary: "Delete folder (auth required)",
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Folder deleted" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/settings/api-key": {
      get: {
        tags: ["Settings"],
        summary: "Check stored API key status (auth required)",
        responses: {
          "200": { description: "Key status" },
          "401": { description: "Unauthorized" },
        },
      },
      post: {
        tags: ["Settings"],
        summary: "Save encrypted API key (auth required)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  apiKey: { type: "string" },
                  provider: {
                    type: "string",
                    enum: ["openai", "anthropic", "openai-compatible"],
                  },
                },
                required: ["apiKey", "provider"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Key saved" },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
        },
      },
      delete: {
        tags: ["Settings"],
        summary: "Remove stored API key (auth required)",
        responses: {
          "200": { description: "Key removed" },
          "401": { description: "Unauthorized" },
        },
      },
    },
  },
  components: {
    schemas: {
      LawResult: {
        type: "object",
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          category: { type: "string" },
          relevance: { type: "integer" },
          normHits: { type: "integer" },
          contextSummary: { type: "string" },
          relevantNorms: {
            type: "array",
            items: {
              type: "object",
              properties: {
                normId: { type: "string" },
                title: { type: "string" },
                content: { type: "string" },
              },
            },
          },
        },
      },
      LawDetail: {
        type: "object",
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          alt_title: { type: "string" },
          category: { type: "string" },
          norms: {
            type: "array",
            items: { type: "object" },
          },
        },
      },
      ExplainRequest: {
        type: "object",
        required: ["normId", "lawKey", "content", "lang"],
        properties: {
          normId: { type: "string", description: "Norm identifier (e.g. § 1)" },
          lawKey: {
            type: "string",
            description: "Law abbreviation (e.g. AGG)",
          },
          content: {
            type: "string",
            description: "Full German text of the norm",
          },
          lang: {
            type: "string",
            default: "en",
            description: "Target language for explanation",
          },
          lawTitle: { type: "string" },
          mode: { type: "string", enum: ["local"] },
          provider: { type: "string" },
          model: { type: "string" },
        },
      },
      ExplainResponse: {
        type: "object",
        properties: {
          norm_id: { type: "string" },
          law_key: { type: "string" },
          law_title: { type: "string" },
          lang: { type: "string" },
          translation: { type: "string" },
          summary: { type: "string" },
          implications: { type: "string" },
          next_steps: { type: "string" },
          disclaimer: { type: "string" },
          is_official: { type: "boolean" },
        },
      },
      ChatRequest: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string" },
          conversationId: { type: "string" },
          mode: {
            type: "string",
            enum: ["basic", "browser", "cloud", "local"],
          },
          model: { type: "string" },
          customEndpoint: { type: "string" },
          language: { type: "string" },
          ollamaParams: {
            type: "object",
            properties: {
              temperature: { type: "number" },
              top_p: { type: "number" },
              top_k: { type: "integer" },
              max_tokens: { type: "integer" },
              system_prompt: { type: "string" },
            },
          },
        },
      },
      GuidanceRequest: {
        type: "object",
        required: ["situation"],
        properties: {
          situation: {
            type: "string",
            minLength: 10,
            maxLength: 10000,
          },
          language: { type: "string", default: "en" },
          folder_id: { type: "string", format: "uuid", nullable: true },
          folder_context: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              category: { type: "string" },
              incident_date: { type: "string", nullable: true },
              dispute_value: { type: "number" },
              status: { type: "string" },
              opposing_party: { type: "string" },
              deadline_date: { type: "string", nullable: true },
              court_name: { type: "string" },
              case_number: { type: "string" },
              notes: { type: "string" },
            },
          },
          provider: { type: "string", default: "openai" },
          model: { type: "string", default: "gpt-4o-mini" },
        },
      },
    },
  },
};

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, headers: rateLimitHeaders } = await checkRateLimit(
    ip,
    DEFAULT_SEARCH_RATE_LIMIT,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests" } },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  const host = req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  const currentUrl = `${protocol}://${host}`;

  // Production is always the default server in the list
  const servers = [
    { url: PRODUCTION_URL, description: "Production" },
  ];

  // Add current host as second option (only if different from production)
  if (currentUrl !== PRODUCTION_URL) {
    servers.push({ url: currentUrl, description: "Current deployment" });
  }

  // Add localhost as third option
  if (currentUrl !== LOCAL_URL) {
    servers.push({ url: LOCAL_URL, description: "Local development" });
  }

  return NextResponse.json({ ...spec, servers });
}
