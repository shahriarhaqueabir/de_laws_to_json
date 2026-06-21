# German Law Vault ⚖️

**6,000+ German Federal Laws — AI-Guided Legal Analysis & Semantic Search**

German Law Vault provides a comprehensive search engine and AI-guided legal assistant for all German federal laws from [gesetze-im-internet.de](https://www.gesetze-im-internet.de/). Users can search in any of 9 languages, bookmark laws into case folders with uniform AI-guidance properties, run AI-powered legal analysis to get 3–5 structured outcome paths with risk/cost estimates, and generate German legal documents from templates.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![Laws](https://img.shields.io/badge/laws-6000+-green.svg)](https://www.gesetze-im-internet.de/)
[![Search](https://img.shields.io/badge/search-Semantic-blue.svg)](https://qdrant.tech)

---

## Architecture

```
                      ┌───────────────────────────┐
                      │    Vercel (Next.js 16)     │
                      │    App Router + API Routes │
                      └──────────┬────────────────┘
                                 │
                 ┌───────────────┴────────────────┐
                 │                                 │
       ┌─────────▼──────────┐          ┌──────────▼──────────┐
       │  Supabase (PG 17)   │          │  Qdrant Cloud        │
       │  Law Metadata       │          │  Vector Search       │
       │  User Data (RLS)    │          │  E5-small Embeddings │
       │  Bookmarks/Folders  │          │  384d Managed Inf.   │
       │  Guidance Sessions  │          └──────────────────────┘
       │  Case Files/Paths   │
       │  API Keys (Encrypted)│
       └──────────────────────┘
```

## Features

### 🔍 Semantic Search
- Search 6,000+ German federal laws by meaning using Qdrant Cloud with `intfloat/multilingual-e5-small` (managed inference)
- 9 language support: DE / EN / TR / AR / FR / ES / PL / UK / RU
- Category browsing and pagination

### 📚 Bookmark System (v2)
- **Dual-storage**: localStorage for anonymous users + Supabase sync when signed in
- **Folder organization**: Create case folders with 8 uniform AI-guidance properties
- **Cross-device sync**: Bookmarks persist locally until sign-in, then merge to cloud

### Folder Properties (Uniform — 8 Fields)
Every `bookmark_folder` feeds the AI guidance engine:

| Field | Type | Description |
|-------|------|-------------|
| `incident_date` | DATE | When did the situation occur? |
| `dispute_value` | NUMERIC(12,2) | Streitwert (EUR) |
| `status` | ENUM | pre_action → consulting → filed → in_progress → resolved |
| `opposing_party` | TEXT | Employer, landlord, etc. |
| `deadline_date` | DATE | Critical statutory deadline |
| `court_name` | TEXT | Court if proceedings started |
| `case_number` | TEXT | Aktenzeichen |
| `notes` | TEXT | Free-text context for AI prompt |

### 🤖 AI Guidance Engine
1. Describe your legal situation in any of 9 languages
2. Optionally select a case folder for context
3. Engine searches Qdrant for relevant norms (E5-small with `query:` prefix)
4. Cross-references with folder's bookmarked laws
5. Loads remediation playbooks matching the category
6. AI generates **3–5 structured outcome paths** with:
   - Risk assessment (low/medium/high with explanations)
   - Cost estimates (RVG/GKG fee calculation)
   - Step-by-step recommended actions
   - Estimated timelines
   - Success probability
7. Sessions auto-saved to DB (signed-in users)

### 📄 Remediation Playbooks (8 Categories)
| Category | Issue Types |
|----------|-------------|
| labor | wrongful_dismissal |
| housing | rent_reduction |
| consumer | deposit_retention, withdrawal, warranty |
| traffic | fine_contest |
| family | custody |
| public | defense_strategy |

### 📝 Document Templates (5 Templates)
Generate filled German legal documents from handlebars templates:
- **widerspruch**: Objection to an administrative decision
- **mahnung**: Formal demand / dunning letter
- **kuendigung**: Termination notice (employment/rental)
- **einspruch**: Objection to a fine notice (traffic)
- **klage**: Statement of claim / complaint

Templates auto-fill from folder properties (name, opposing party, court, case number, incident date, dispute value, notes).

### 💬 4 Chat Modes
| Mode | Description |
|------|-------------|
| Basic Search | Search laws, show relevant paragraphs. No AI |
| Browser AI | Transformers.js model in browser (~1GB). Fully private |
| Cloud AI | BYO API key (OpenAI / Anthropic / OpenAI-compatible) |
| Local AI | Ollama via broker.py. Fully private |

### 🔐 Auth & Security
- **RLS enforcement**: All user-owned tables (bookmarks, folders, conversations, case_files, guidance_paths, user_api_keys) protected by Row Level Security
- **AES-256-GCM encryption**: AI provider keys encrypted at rest
- **Anonymous mode**: Search and basic guidance work without sign-in
- **User-owned data**: No user can access another user's data

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.2.9 |
| UI | React | 19.2.4 |
| Language | TypeScript | 5.x (strict) |
| Database | Supabase PostgreSQL | 17 |
| Vector Search | Qdrant Cloud | E5-small managed inference |
| Validation | Zod | 4.4+ |
| Testing | Vitest | 4.1+ |
| Styling | Tailwind CSS | 4.x |
| Animation | motion | 12.40+ |
| Icons | lucide-react | latest |

## Quick Start

```bash
# Install dependencies
cd nextjs && npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and Qdrant credentials

# Start dev server
npm run dev          # → http://localhost:3000
```

### Prerequisites
- Node.js 18+
- Supabase project (free tier)
- Qdrant Cloud cluster (free tier, E5-small managed inference)
- (Optional) Ollama + broker.py for local AI mode

## Commands

```bash
# Development
cd nextjs && npm run dev              # Start dev server

# Testing
cd nextjs && npx vitest run           # Run all 300+ tests
cd nextjs && npx vitest --watch       # Watch mode
cd nextjs && npm run test:coverage    # Coverage report

# TypeScript
cd nextjs && npx tsc --noEmit         # Type check

# Lint
cd nextjs && npm run lint             # ESLint

# Database (Supabase CLI)
cd supabase && npx supabase db pull   # Pull schema
cd supabase && npx supabase migration up  # Apply migrations
```

## Database Schema

### Key Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `laws` | 6,000+ German federal laws | Public read |
| `bookmarks` | User bookmarks with folder FK | User-owned |
| `bookmark_folders` | Folders with 8 uniform AI-guidance properties | User-owned |
| `conversations` | Chat conversations | User-owned |
| `messages` | Chat messages per conversation | User-owned |
| `case_files` | User legal situation records (auto-created by guidance) | User-owned |
| `guidance_paths` | AI-generated outcome paths (3-5 per case) | User-owned |
| `norm_explanations` | Cached AI explanations (per norm+language) | Public read/insert |
| `user_api_keys` | Encrypted AI provider keys | User-owned |
| `remediation_playbooks` | 8 seed legal playbooks | Public read |
| `document_templates` | 5 seed German legal templates | Public read |

### Relationship Diagram

```
auth.users (Supabase built-in)
 ├── conversations.user_id ── user owns conversations
 │    └── messages.conversation_id ── messages in conversation
 ├── bookmarks.user_id ── user bookmarks a law/norm
 │    ├── laws.key ── which law
 │    ├── bookmark_folders.id (folder_id FK) ── folder grouping
 │    └── unique(user_id, law_key, norm_id)
 ├── bookmark_folders.user_id ── user's folders
 │    └── 8 uniform properties → feed AI guidance engine
 ├── case_files.user_id ── user's legal situation record
 │    └── guidance_paths.case_file_id ── AI-generated paths
 │    └── remediation_playbooks.category ── matched playbook
 ├── norm_explanations.norm_id + lang ── AI explanation cache
 │    └── FK norm_explanations.law_key → laws.key
 ├── user_api_keys.user_id (PK) ── encrypted AI provider keys
 ├── remediation_playbooks (public read-only) ── 8 seed playbooks
 ├── document_templates (public read-only) ── 5 seed templates
 └── laws.key ── 6,000+ German federal laws (read-only public)
```

### RLS Model
- **laws** (public read): Anyone can browse law metadata
- **bookmarks** (user-owned): `auth.uid() = user_id`
- **bookmark_folders** (user-owned): `auth.uid() = user_id`
- **case_files** (user-owned): `auth.uid() = user_id`
- **guidance_paths** (user-owned): via `case_file_id` → `case_files.user_id`
- **conversations** (user-owned): `auth.uid() = user_id`
- **messages** (user-owned): via `conversation_id` → `conversations.user_id`
- **user_api_keys** (user-owned): `auth.uid() = user_id`
- **norm_explanations** (public): Anyone can read/insert
- **remediation_playbooks** (public): Read-only
- **document_templates** (public): Read-only

## API Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/search?q=&category=&page=` | Semantic search via Qdrant | Public |
| GET | `/api/laws/[key]` | Law metadata + norms from Qdrant scroll | Public |
| POST | `/api/guidance` | Generate 3-5 outcome paths | Public (AI requires API key) |
| POST | `/api/guidance/generate-doc` | Generate legal document from template | Auth required |
| GET | `/api/guidance/sessions` | List user's guidance history | Auth required |
| GET | `/api/guidance/sessions/[id]` | Get session + guidance paths | Auth required |
| DELETE | `/api/guidance/sessions/[id]` | Delete a guidance session | Auth required |
| GET | `/api/bookmarks/folders` | List user's bookmark folders | Auth required |
| POST | `/api/bookmarks/folders` | Create bookmark folder | Auth required |
| PATCH | `/api/bookmarks/folders?id=` | Update folder properties | Auth required |
| DELETE | `/api/bookmarks/folders?id=` | Delete folder | Auth required |
| GET | `/api/settings/api-key/status` | Check stored API key status | Auth required |
| POST | `/api/settings/api-key` | Save encrypted API key | Auth required |
| DELETE | `/api/settings/api-key` | Remove stored API key | Auth required |
| GET | `/api/chat` | Chat with AI (basic/browser/cloud/local) | Varies |

## Critical Technical Details

### E5-small Query Prefix
The `searchNorms()` function in `qdrant.ts` **must** prepend `"query: "` to the user's search text before passing it to Qdrant managed inference. The indexed documents use `"passage: "` prefix. Without this, search results are effectively random.

### Folder Property Sync
Folder CRUD uses a **local-first** pattern: operations write to localStorage immediately and attempt Supabase sync in the background. This ensures anonymous users have full functionality with seamless upgrade when they sign in.

## Production URLs

- **App**: https://ai-assisted-german-law-shahriarhaqueabir.vercel.app
- **Supabase project**: `zuhhimmdlnsjuwksitpb`
- **Qdrant collection**: `german_norms` (E5-small, 384d)

## Testing

**302 tests | 37 files | all passing**

```bash
npm test                                  # Run full suite
npx vitest run --reporter=verbose         # Verbose output
npx vitest run --coverage                 # Coverage
npx vitest run path/to/test               # Single file
```

Key test files:
- `lib/__tests__/guidance.test.ts` — Guidance engine (parsing, costs, deadlines)
- `lib/__tests__/qdrant.test.ts` — Qdrant search with E5 prefix
- `lib/__tests__/bookmarks.test.ts` — Bookmark CRUD
- `lib/__tests__/chat.test.ts` — AI provider routing
- `lib/__tests__/encryption.test.ts` — AES-256-GCM key encryption
- `lib/__tests__/fees.test.ts` — RVG/GKG cost calculation
- `app/api/__tests__/search.test.ts` — Search API
- `app/api/__tests__/guidance.test.ts` — Guidance API
- `app/api/__tests__/bookmarks-folders.test.ts` — Folder CRUD API
- `components/__tests__/folder-modal.test.tsx` — Folder modal
- `app/__tests__/bookmarks-page.test.tsx` — Bookmarks page

## Security & Privacy
- **Vector Search**: Queries sent to Qdrant Cloud for semantic matching
- **Translation**: Local via Transformers.js WASM. No external API calls
- **AI Chat**: Local via Ollama (data stays on machine) or Cloud via BYO API key
- **API Keys**: AES-256-GCM encrypted at rest in Supabase
- **All user data**: Protected by Row Level Security
- **Anonymous mode**: Full functionality without account, data stored in localStorage

## License
Apache License 2.0 — See [LICENSE](LICENSE) for details.

---

**Built with ❤️ for accessible German legal information**
