# Contributing to German Law Vault

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5 (strict), Tailwind CSS 4
- **Database**: Supabase (PostgreSQL 17) — 8 migrations
- **Vector Search**: Qdrant Cloud (E5-small, 384d) — 103,586 points in `german_norms`
- **Testing**: Vitest 4.1+, React Testing Library
- **Linting**: ESLint 9, Prettier 3
- **Animation**: motion 12.40+
- **Validation**: Zod 4.4+

## Development Setup

### Prerequisites
- Node.js 22+
- Docker (optional — for local Ollama AI)
- Supabase CLI (optional — for local DB)

### Getting Started
```bash
cd nextjs
npm install
cp .env.example .env.local
# Edit .env.local with Supabase + Qdrant credentials
npm run dev  # → http://localhost:3000
```

### Local Services (Optional — for Local AI mode)
```bash
docker compose up -d  # Starts Ollama + broker
```

## Commands
```bash
npm run dev            # Start dev server (localhost:3000)
npm test               # Run all tests (Vitest) — 38 files, 309 tests
npx vitest --watch     # Watch mode for TDD
npm run test:coverage  # Coverage report
npx tsc --noEmit       # Type check (must be clean before commit)
npm run lint           # ESLint
npm run build          # Production build
```

## Code Quality Standards
- **TypeScript**: Strict mode. No `any` or `@ts-ignore`.
- **Validation**: All API routes must validate input with Zod schemas.
- **Error handling**: Use `errorResponse()` / `successResponse()` from `lib/api-utils.ts`. Catch blocks must sanitize errors with `sanitizeErrorMessage()`.
- **Testing**: 309 tests across 38 files. Maintain all tests passing before committing.
- **API keys**: Never log or expose plaintext API keys. Use `sanitizeErrorMessage()` in catch blocks. Keys are encrypted at rest with AES-256-GCM (`lib/encryption.ts`).

## Architecture

```
nextjs/src/
├── app/                    # Next.js App Router pages + API routes
│   ├── api/                # API route handlers (Zod + errorResponse pattern)
│   │   ├── __tests__/      # API route tests
│   │   ├── chat/           # Chat endpoint (4 modes: basic/browser/cloud/local)
│   │   ├── guidance/       # Legal guidance engine (3-5 outcome paths)
│   │   ├── explain/        # Norm explanation (server-side key resolution only)
│   │   ├── search/         # Qdrant semantic search
│   │   ├── laws/           # Law metadata + norm scroll
│   │   ├── bookmarks/      # Bookmark CRUD
│   │   └── settings/       # User API key management
│   └── ...                 # Page components
├── components/             # React components
│   ├── __tests__/          # Component tests
│   ├── auth-context.tsx    # Auth provider
│   ├── chat-context.tsx    # Chat mode + language persistence
│   └── ...
├── hooks/                  # React hooks
│   └── useLanguage.ts      # 57 UI strings × 9 languages (t() function)
├── lib/                    # Shared utilities
│   ├── ai-provider.ts      # OpenAI, Anthropic, OpenAI-compatible (callXxx)
│   ├── chat.ts             # Chat response + norm explanation generation
│   ├── guidance.ts         # Guidance engine (playbook-aware path generation)
│   ├── qdrant.ts           # Qdrant vector search (E5-small managed inference)
│   ├── rate-limiter.ts     # In-memory sliding window (10 AI / 60 search req/min)
│   ├── sanitize.ts         # API key pattern detection + sanitization
│   ├── encryption.ts       # AES-256-GCM encryption/decryption
│   ├── supabase-server.ts  # Lazy-env-eval server client
│   └── api-utils.ts        # successResponse / errorResponse helpers
├── workers/                # Web workers (Transformers.js)
└── __tests__/              # Page-level tests
```

## API Endpoints

| Method | Endpoint | Rate Limit | Auth | Purpose |
|--------|----------|-----------|------|---------|
| GET | `/api/search` | 60/min | Public | Semantic search via Qdrant |
| POST | `/api/chat` | 10/min | Varies | AI chat (4 modes) |
| POST | `/api/guidance` | 10/min | Public | Generate 3-5 outcome paths |
| POST | `/api/guidance/generate-doc` | 10/min | Auth | Generate legal doc from template |
| POST | `/api/explain` | 10/min | Public | Explain a norm (server key only) |
| GET | `/api/laws/[key]` | Public | Law metadata + norms |
| GET | `/api/diagnostics` | Public | System health check |
| GET/POST/DELETE | `/api/settings/api-key` | Auth | Encrypted API key management |
| GET/POST/PUT/DELETE | `/api/bookmarks/folders` | Auth | Folder CRUD |

## Database Migrations

Migrations are in `supabase/migrations/` (00001–00008):

| Migration | Purpose |
|-----------|---------|
| 00001 | Initial schema (laws, bookmarks, conversations, messages) |
| 00002 | norm_explanations cache table |
| 00003 | Hybrid translation tables |
| 00004 | Remediation playbooks + document templates |
| 00005 | Schema drift capture |
| 00006 | user_api_keys with encrypted storage |
| 00007 | Guidance folders + case_files |
| 00008 | updated_at triggers + query indexes |

```bash
supabase migration new    # Create new migration
supabase db reset         # Reset with all migrations
supabase migration up     # Apply pending migrations
```

## Rate Limiting

AI endpoints (`/api/chat`, `/api/guidance`, `/api/guidance/generate-doc`, `/api/explain`): **10 requests/minute/IP**
Search endpoint (`/api/search`): **60 requests/minute/IP**

In-memory `Map<string, RateLimitEntry>` with `setInterval` cleanup every 5 min. Best-effort in serverless — replace with Redis for production scale.

See `lib/rate-limiter.ts`.

## Qdrant Vector Search

The project uses Qdrant Cloud with **intfloat/multilingual-e5-small** managed inference (384d).

### Critical: Query Prefix
`searchNorms()` in `qdrant.ts` MUST prepend `query: ` to user search text. Indexed documents use `passage: ` prefix. Without this, results are effectively random.

### Payload Indexes
To optimize law-key scroll queries:

```bash
export QDRANT_URL=<your-url>
export QDRANT_API_KEY=<your-key>
node scripts/create-qdrant-index.js
```

This creates a keyword payload index on `law_key` in the `german_norms` collection.

## Testing Guidelines

### Test Structure
- API route tests: `src/app/api/__tests__/`
- Component tests: `src/components/__tests__/`
- Lib tests: `src/lib/__tests__/`
- Hook tests: `src/hooks/__tests__/`
- Page tests: `src/app/__tests__/`

### Mock Pattern (API routes)
Tests mock `@supabase/ssr` at the library level using `vi.mock()` with a thenable pattern:

```typescript
const mockSupabaseResult = vi.hoisted(() => ({
  data: null as unknown,
  error: null as unknown,
  user: null as Record<string, unknown> | null,
  keyRow: null as Record<string, unknown> | null,
}));

vi.mock("@supabase/ssr", () => {
  const buildThenable = (result: any) => {
    const thenable = Promise.resolve(result);
    return Object.assign(thenable, {
      from: vi.fn((table: string) => {
        if (table === "user_api_keys") {
          return /* key-aware thenable */;
        }
        return thenable;
      }),
      select: vi.fn(() => thenable),
      eq: vi.fn(() => thenable),
      auth: { getUser: vi.fn() },
    });
  };
  return { createServerClient: vi.fn(() => buildThenable(mockSupabaseResult)) };
});
```

See `explain.test.ts`, `guidance.test.ts`, or `laws.test.ts` for canonical examples.

### Environment for Tests
Tests use `.env.test.local` (not committed). Set env vars directly in `vitest.setup.ts`:
```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.QDRANT_URL = "http://localhost:6333";
process.env.QDRANT_API_KEY = "test-qdrant-key";
process.env.SERVER_ENCRYPTION_KEY = "abcdef...1234";
```

## i18n / Localization

57 UI strings across 9 languages (DE/EN/TR/AR/FR/ES/PL/UK/RU). Managed via `useLanguage()` hook in `hooks/useLanguage.ts`.

To add a string:
1. Add key to `UI_STRINGS` object with all 9 language translations
2. Use `t("your.key")` in components
3. Use `t("your.key", { n: count })` for variable interpolation

Language detection reads from `ChatContext.settings.language`.

## Git Workflow
1. Create a branch from `main`
2. Make changes with frequent commits
3. Run `npm test && npx tsc --noEmit` before pushing
4. Open a PR to `main`
5. CI runs lint + type check + test + build automatically
6. Deploy is gated on `workflow_run.conclusion == 'success'`

## Security
- **No hardcoded secrets**: All secrets via environment variables
- **Pre-commit hook**: Runs gitleaks on staged changes
  - Windows: `powershell -ExecutionPolicy Bypass -File .githooks\install.ps1`
  - macOS/Linux: `git config core.hooksPath .githooks && chmod +x .githooks/pre-commit`
- **CI secret scanning**: Gitleaks runs on every push/PR
- **API keys**: AES-256-GCM encrypted at rest (`lib/encryption.ts`). Never logged. Key rotation detected and surfaced to user.
- **`.env.example`** is committed (tracked). Actual `.env`, `.env.local`, `.env.*.local` are gitignored.
