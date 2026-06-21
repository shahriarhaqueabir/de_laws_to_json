# German Law Vault — Production Runbook

## Architecture Overview

```
User (browser) → Next.js (Vercel) → Supabase (PostgreSQL + Auth)
                                      → Qdrant Cloud (Vector Search)
                                      → LibreTranslate (Translation)
                                      → OpenAI/Anthropic (AI Guidance)
```

## Environments

| Environment | URL | Qdrant | Supabase | Vercel Project |
|-------------|-----|--------|----------|----------------|
| Production | `ai-assisted-german-law.vercel.app` | ✅ Configured | ✅ Cloud (zuhhimmdlnsjuwksitpb) | `ai-assisted-german-law` |
| Preview | `*-ai-assisted-german-law.vercel.app` | ❌ Not configured | ✅ Cloud | Preview branches |
| Local | `localhost:3000` | ❌ Not configured | ❌ Local or Cloud | N/A |

## Required Environment Variables

### Vercel (Production)

| Variable | Source | Required |
|----------|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API | ✅ |
| `QDRANT_URL` | Qdrant Cloud → Cluster → API | ✅ (falls back to Supabase text search) |
| `QDRANT_API_KEY` | Qdrant Cloud → Cluster → API | ✅ (falls back to Supabase text search) |
| `SUPABASE_ACCESS_TOKEN` | Supabase Dashboard → Access Tokens | For MCP/CI |
| `ENCRYPTION_KEY` | Generated via `openssl rand -hex 32` | For user API key encryption |

### Local Development (.env.local)

Copy from `.env.example` or obtain from team. Qdrant is optional locally — search gracefully degrades to Supabase ILIKE text search.

## Critical Architecture Decisions

### 1. E5-small Query Prefix

**CRITICAL**: Every Qdrant search query MUST be prefixed with `query: `. Indexed documents use `passage: ` prefix. Without the prefix, results are effectively random.

- File: `nextjs/src/lib/qdrant.ts` — `searchNorms()` function
- The prefix `query: ` is hardcoded — do not remove

### 2. Translation Chain

When translating non-German queries/results, the following chain is used:

```
1. Legal term map (fast, no API call) — ~120 shared terms in translate-server.ts
2. LibreTranslate API (free, ~30 req/min on public instance)
3. Graceful fallback — returns original text
```

**For production**: Self-host LibreTranslate via Docker to avoid rate limits:
```bash
docker run -d -p 5000:5000 libretranslate/libretranslate
```
Then update `LIBRE_API_URL` in `translate-server.ts`.

### 3. Guidance Tiers

| Tier | Requires | Capabilities |
|------|----------|-------------|
| Basic | Nothing | Search results + raw law snippets |
| Full | OpenAI/Anthropic API key | 3-5 structured outcome paths with risk/cost analysis |
| Document Generation | Full tier + signed in | Generate filled legal document from template |

### 4. Bookmark Storage (Dual)

Anonymous users: localStorage under `glv_bookmarks` key
Authenticated users: localStorage + Supabase sync

### 5. Language Persistence

- Stored in ChatContext → localStorage under `glv_chat_settings`
- `useLanguage()` hook reads from ChatContext and provides `t()` for translated UI strings
- 9 supported languages: DE, EN, TR, AR, FR, ES, PL, UK, RU

## Database

### Connection
- **Host**: `zuhhimmdlnsjuwksitpb.supabase.co`
- **Port**: 5432 (PostgreSQL)
- **MCP**: `https://mcp.supabase.com/mcp?project_ref=zuhhimmdlnsjuwksitpb`

### Migrations
All migrations are in `supabase/migrations/00001-00007`. Apply with:
```bash
supabase migration up
```

### Key Tables

| Table | RLS | Purpose |
|-------|-----|---------|
| `laws` | Public read | 6,145 German federal statutes |
| `bookmarks` | User-owned | Law bookmarks with folder FK |
| `bookmark_folders` | User-owned | 8 uniform AI-guidance property folders |
| `case_files` | User-owned | Legal situation records |
| `guidance_paths` | Via case_file | 3-5 AI-generated outcome paths |
| `norm_explanations` | Public read/insert | Cached AI explanations |
| `user_api_keys` | User-owned | Encrypted AI provider keys |
| `remediation_playbooks` | Public read | 8 seed legal playbooks |
| `document_templates` | Public read | 5 seed German templates |
| `conversations` | User-owned | Chat conversations |
| `messages` | Via conversation | Chat messages |

## Qdrant

### Collection
- **Name**: `german_norms`
- **Model**: `intfloat/multilingual-e5-small` (managed inference)
- **Dimensions**: 384
- **Points**: ~103,586
- **Payload**: law_key, law_title, category, norm_id, norm_title, content

### Connection
- **URL**: `https://e703bf49-0f82-4a21-a4c5-1f1c74855da7.europe-west3-0.gcp.cloud.qdrant.io:6333`
- **Dashboard**: Qdrant Cloud account

## Deployment

### Vercel
1. Push to `main` branch → auto-deploys to Production
2. PRs → auto-deploy Preview branches
3. Ensure QDRANT_URL/QDRANT_API_KEY are set in Production only
4. Preview deployments gracefully degrade without Qdrant

### Manual Build
```bash
cd nextjs
npm run build    # TypeScript check + Next.js build
npm test         # 311+ tests
```

## Health Checks

- `/api/search?q=test` — Search endpoint (tests Qdrant → Supabase fallback chain)
- `/api/diagnostics` — System diagnostics endpoint
- Test: `curl https://ai-assisted-german-law.vercel.app/api/search?q=BGB`

## Rollback

### Database
1. Identify the migration to roll back: `supabase migration list`
2. Create a new forward migration to undo changes
3. Apply: `supabase migration up`

### Code
1. Revert PR on GitHub
2. Vercel auto-deploys the revert

## Known Limitations

1. **Qdrant in Preview**: Preview deployments don't have Qdrant credentials. Search falls back to Supabase ILIKE which is less accurate.
2. **LibreTranslate rate limits**: Public API allows ~30 req/min. Self-host for production.
3. **English search quality**: Complex English queries that miss the term map fall to LibreTranslate or original query.
4. **Guidance free tier**: Without API key, returns raw search results instead of AI-generated paths.
5. **No E2E tests**: Unit tests cover logic; no full integration test against real Qdrant.

## Monitoring

- **Vercel Analytics**: Dashboard → Project → Analytics
- **Supabase Logs**: Dashboard → Project → Logs
- **Application logs**: `console.log` in API routes (visible in Vercel function logs)
