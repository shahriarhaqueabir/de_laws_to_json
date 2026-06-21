# German Law Vault — Next.js App

**Frontend for the AI-Assisted German Law Search & Guidance platform.**

This directory contains the Next.js 16 application (App Router) that provides the user-facing web interface for searching, browsing, bookmarking, and receiving AI-assisted guidance on German federal law.

## Quick Start

```bash
npm install
npm run dev        # → http://localhost:3000
```

Requires: Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and Qdrant credentials (`QDRANT_URL`, `QDRANT_API_KEY`) in the environment or `.env.local`.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run all tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run lint` | ESLint |

## Architecture

```
src/
├── app/                    # App Router pages & API routes
│   ├── api/                # REST API handlers (search, chat, guidance, etc.)
│   ├── chat/               # Chat conversation UI
│   ├── laws/               # Law detail pages
│   ├── search/             # Search results
│   ├── settings/           # User settings
│   └── guidance/           # AI guidance sessions
├── components/             # React components
│   ├── auth-context.tsx    # Auth state management
│   ├── chat-context.tsx    # Chat settings & language persistence
│   ├── conversation-list.tsx  # Chat history sidebar
│   ├── norm-viewer.tsx     # Law section viewer with AI explanations
│   └── ...
├── lib/                    # Shared utilities
│   ├── qdrant.ts           # Qdrant vector search client
│   ├── chat.ts             # AI chat (OpenAI/Anthropic/Ollama)
│   ├── supabase.ts         # Browser Supabase client
│   └── types.ts            # TypeScript types
└── workers/                # Web Workers (Transformers.js)
```

## Key Design Decisions

- **4 chat modes**: Basic (search-only), Browser (Transformers.js in-browser AI), Cloud (BYO API key), Local (Ollama via broker)
- **9 language support**: DE/EN/TR/AR/FR/ES/PL/UK/RU
- **Dual-storage bookmarks**: localStorage + Supabase sync
- **AES-256-GCM encryption** for stored AI provider keys
- **Self-hosted Geist font** via `geist` npm package (preserves COEP headers)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `QDRANT_URL` | Yes | Qdrant Cloud cluster URL |
| `QDRANT_API_KEY` | Yes | Qdrant API key |
| `SERVER_ENCRYPTION_KEY` | For cloud AI | 64-char hex key for AES-256-GCM |
| `NEXT_PUBLIC_BROKER_URL` | For local AI | Ollama broker URL (default: `http://localhost:9000`) |

## Deployment

Deployed on Vercel. The root `vercel.json` configures:
- Framework: `nextjs`
- Root directory: `nextjs`
- Region: `fra1` (Frankfurt)
