# German Law Vault — AI-Assisted Development Guide

## Project Overview
German Law Vault provides a comprehensive search engine and AI-guided legal assistant for all 6,000+ German federal laws from gesetze-im-internet.de.

## Architecture
- **Frontend**: Next.js 16 (App Router) with React 19
- **Database**: Supabase (PostgreSQL 17) with Row Level Security
- **Vector Search**: Qdrant Cloud with E5-small managed inference (103,586 norm points)
- **AI Providers**: OpenAI, Anthropic, OpenAI-compatible (BYO API key)
- **Local AI**: Ollama via broker.py
- **Browser AI**: Transformers.js web worker

## Key Conventions
- TypeScript strict mode — no `any` or `@ts-ignore`
- All API routes use Zod validation + `errorResponse()`/`successResponse()` from `lib/api-utils.ts`
- Dual-storage bookmarks: localStorage for anonymous, Supabase for authenticated
- 9 languages: DE/EN/TR/AR/FR/ES/PL/UK/RU
- 4 chat modes: basic, browser, cloud, local

## Critical Gotchas
- **Qdrant E5-small prefix**: `searchNorms()` in `lib/qdrant.ts` MUST prepend `"query: "` to user search text. Indexed docs use `"passage: "` prefix. Without this, results are random.
- **Server client**: Server-side Supabase queries use `getServerClient(cookieStore)` from `lib/supabase-server.ts`
- **API key encryption**: Keys stored in `user_api_keys` table, encrypted with AES-256-GCM. Use `encryptApiKey()`/`decryptApiKey()` from `lib/encryption.ts`.
- **Graceful degradation**: All external services (Qdrant, AI providers) have fallback paths. Don't crash — degrade.

## Commands
```bash
cd nextjs && npm run dev         # Development
cd nextjs && npm test            # Run tests
cd nextjs && npx tsc --noEmit   # Type check
cd nextjs && npm run lint        # Lint
```
