# German Law Vault ⚖️

**6,000+ German Federal Laws — AI-Guided Legal Analysis & Semantic Search**

German Law Vault provides a comprehensive search engine and AI-guided legal assistant for all German federal laws from [gesetze-im-internet.de](https://www.gesetze-im-internet.de/). Users can search in any of 9 languages, bookmark laws into case folders with uniform AI-guidance properties, run AI-powered legal analysis to get 3–5 structured outcome paths with risk/cost estimates, and generate German legal documents from templates.

<div align="center">

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square)](LICENSE)
[![Website](https://img.shields.io/badge/website-live-brightgreen?style=flat-square)](https://ai-assisted-german-law-shahriarhaqueabir.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg?style=flat-square)](https://nextjs.org)
[![Laws](https://img.shields.io/badge/laws-6,000+-gold.svg?style=flat-square)](https://www.gesetze-im-internet.de/)
[![Tests](https://img.shields.io/badge/tests-516%20passing-brightgreen.svg?style=flat-square)](nextjs/)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](.github/pull_request_template.md)
[![Security](https://img.shields.io/badge/security-RLS%20%7C%20CSP%20%7C%20AES--256--GCM-purple.svg?style=flat-square)](docs/security-architecture.md)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue.svg?style=flat-square)](nextjs/tsconfig.json)

</div>

---

## Screenshots

| Search | AI Chat | Bookmark Folders |
|--------|---------|-----------------|
| ![Search](assets/Screenshot%201.png) | ![Chat](assets/Screenshot%202.png) | ![Folders](assets/Screenshot%204.png) |
| **Guidance** | **Law Viewer** | **Mobile** |
| ![Guidance](assets/Screenshot%203.png) | ![Laws](assets/Screenshot%205.png) | ![Mobile](assets/Screenshot%201.png) |

---

## Quick Demo

### 🔍 Hybrid Semantic Search
Search across all 6,000+ German federal laws using a hybrid BM25 + Dense vector approach. Results are ranked by combining multilingual embeddings (`intfloat/multilingual-e5-small`) with keyword relevance, ensuring both conceptual and exact matches.

### 📊 Performance Benchmarks (GerLayQA)
Measured against the GerLayQA legal benchmark:
- **MRR@10**: 0.0461
- **Recall@10**: 0.0633
- **Avg Latency**: ~200ms
- **Fallback Chain**: 3-stage (Qdrant Hybrid → Postgres Trigram → Postgres ILIKE)

### 🤖 AI Guidance Engine
Describe your legal situation in plain language (any of 9 languages). The engine finds relevant laws, generates 3–5 outcome paths with risk/cost analysis, and can produce filled legal documents.

### 📚 Bookmark System
Create case folders with 8 uniform properties (dispute value, opposing party, deadlines, court info) that feed into the AI guidance engine for context-aware analysis.

### 💬 4 Chat Modes
| Mode | How It Works | Privacy |
|------|-------------|---------|
| **Basic** | Server-side Qdrant vector search — no AI. Fast & free | ✅ No data leaves server |
| **Browser** | Transformers.js model runs in your browser (~1GB ONNX). Fully offline | ✅ Everything stays local |
| **Cloud** | Bring your own API key (OpenAI / Anthropic) — encrypted with AES-256-GCM | 🔒 Encrypted at rest |
| **Local** | Ollama via broker.py — your machine, your model. Health diagnostics + exponential backoff | ✅ 100% offline |

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

### 🔍 Hybrid Search (v2)
- Search 6,000+ German federal laws using **Hybrid Search** (Dense + Sparse/BM25)
- Multilingual support via `intfloat/multilingual-e5-small` with application-level BM25 reranking
- **3-Stage Fallback Chain**:
    1. **Qdrant Hybrid**: 85% Dense / 15% BM25 reranking
    2. **Postgres Trigram**: Fuzzy matching via `pg_trgm` on `norms` table
    3. **Postgres ILIKE**: Keyword fallback on `laws` table
- **In-memory cache**: 30s TTL, 500-item LRU cache for repeated searches (Qdrant with_vector: false)
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

## Security Architecture

See the comprehensive [Security Architecture Document](docs/security-architecture.md) for full details.

### Key Protections

| Threat | Mitigation |
|--------|-----------|
| XSS | CSP with restricted script-src + React auto-escaping |
| CSRF | Supabase SSR SameSite cookies + form-action 'self' CSP |
| SQL Injection | Parameterized Supabase client — no raw SQL |
| IDOR | RLS policies + API-level user_id filtering + UUID primary keys |
| API Key Leakage | AES-256-GCM encryption at rest + error message sanitization |
| Clickjacking | `frame-ancestors 'none'` CSP directive |
| Session Hijacking | HSTS + HttpOnly/Secure cookies + refresh token rotation |
| Spectre/Worker | COOP `same-origin` + COEP `credentialless` headers |
| Supply Chain | Dependabot + lockfile + gitleaks scanning |

### Privacy
- **Vector Search**: Queries sent to Qdrant Cloud for semantic matching
- **Translation**: Local via Transformers.js WASM. No external API calls
- **AI Chat**: Local via Ollama (data stays on machine) or Cloud via BYO API key
- **API Keys**: AES-256-GCM encrypted at rest in Supabase
- **All user data**: Protected by Row Level Security
- **Anonymous mode**: Full functionality without account, data stored in localStorage

## Documentation

| Document | Purpose |
|----------|---------|
| [Security Architecture](docs/security-architecture.md) | CSP, SSRF, rate limiting, encryption, RLS |
| [Project Retrospective](docs/retrospective.md) | Architecture decisions, what worked/didn't, roadmap |
| [Open Issues](docs/issues/) | Tracked backlog with acceptance criteria |
| [Sprint Plans](plans/) | Past and upcoming sprint plans |

## Contributing

Contributions are welcome! See the [contribution guidelines](.github/pull_request_template.md) and [security policy](.github/SECURITY.md) before getting started.

- **Bug reports**: Open an [issue](.github/ISSUE_TEMPLATE/bug_report.yml)
- **Feature requests**: Open an [issue](.github/ISSUE_TEMPLATE/feature_request.yml)
- **Security vulnerabilities**: Report via [GitHub Advisories](https://github.com/shahriarhaqueabir/AI-Assisted-German-Law/security/advisories/new)
- **Dependencies**: Managed via [Dependabot](.github/dependabot.yml)

## License

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

Apache License 2.0 — See [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with ❤️ for accessible German legal information</sub><br>
  <sub>⚖️ <em>Sub lege libertas</em> — Under the law, freedom</sub>
</div>
