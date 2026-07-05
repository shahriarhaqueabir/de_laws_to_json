# Project Instructions

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, Lucide React, Framer Motion.
- **Backend (API)**: Next.js API Routes (Route Handlers).
- **Backend (Broker)**: FastAPI (Python 3.12+), Uvicorn.
- **Database**: Supabase (PostgreSQL 17) with RLS.
- **Vector Search**: Qdrant Cloud (E5-small embeddings).
- **AI**: OpenAI, Anthropic, Ollama (Local), Transformers.js (Browser).
- **Testing**: Vitest, RTL, Playwright (Next.js), Pytest (Python).

## Code Style
- **TypeScript**: Strict mode, Zod for validation.
- **Naming**: 
  - Next.js: kebab-case for files/directories, PascalCase for components.
  - Python: snake_case for functions/variables.
- **Patterns**:
  - API responses use `errorResponse()`/`successResponse()` from `lib/api-utils.ts`.
  - Supabase client: Use `getServerClient(cookieStore)` in API routes.
  - Encryption: AES-256-GCM for API keys via `lib/encryption.ts`.

## Testing
- **Next.js**: `npm test` (Vitest), `npm run test:watch`, `npm run test:coverage`.
- **Python**: `cd tests && python run_all_tests.py`.
- **E2E**: `npx playwright test`.

## Build & Run
- **Frontend Dev**: `cd nextjs && npm run dev`
- **Frontend Build**: `cd nextjs && npm run build`
- **Linter**: `cd nextjs && npm run lint`
- **Python Broker**: `python broker/broker.py`

## Project Structure
- `nextjs/src/app/api/`: Next.js API route handlers.
- `nextjs/src/app/`: Next.js pages and layouts.
- `nextjs/src/lib/`: Shared utilities (Supabase, Qdrant, AI).
- `nextjs/src/components/`: React UI components.
- `broker/`: Python broker for local Ollama connectivity.
- `scripts/`: Python scripts for data processing and indexing.
- `supabase/migrations/`: SQL schema and RLS policies.
- `tests/`: Python test suite.

## Conventions
- **Rate Limiting**: Supabase-backed sliding-window in `lib/rate-limiter.ts`.
- **Security**: Strict CSP in `next.config.ts`, RLS on all user tables.
- **Commits**: Follow project's current git style (if applicable).
