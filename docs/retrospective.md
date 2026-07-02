# German Law Vault — Project Retrospective

> **Date:** 2026-07-02
> **Phase:** Hybrid Search + Benchmarking (Sprint 6b)
> **Branch:** `main` (SHA `d6e40ed`)

---

## 1. Project Vision

German Law Vault makes all 6,000+ German federal laws searchable and understandable through semantic search, AI-powered guidance, and four chat tiers. The goal is to bridge the gap between complex legal texts and non-lawyers who need to understand their rights.

---

## 2. Architecture Decisions & Rationale

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **Hybrid Search (Dense + BM25)** | Pure vector search was too weak for short legal queries | 85/15 split provides best GerLayQA results |
| **3-Stage Fallback Chain** | Qdrant failures or weak hits shouldn't return empty results | Postgres `pg_trgm` provides reliable "safety net" |
| **GerLayQA Evaluation** | Optimization needs measurable metrics | Baseline MRR@10 is 0.0461 (significant over baseline) |
| **Next.js 16 App Router** | Full-stack React with RSC, API routes, middleware | SSR hydration complexity; CSP conflicts with client-side WASM |
| **Supabase (PostgreSQL)** | Managed Postgres with built-in Auth, RLS, real-time | Free plan limits; no pg_cron on free tier |
| Qdrant Cloud (managed inference) | No self-hosting vector infrastructure; E5-small built-in | 384d embeddings weak for 100K+ legal norms; vendor lock-in |
| **Dual-storage bookmarks** | Offline-first with localStorage + Supabase sync | Complex conflict resolution on reconnect |
| **BYO API Key (Cloud AI)** | No server-side API costs; user brings their own key | Key rotation breaks encryption; user friction |
| **Local AI via broker** | Fully offline capable; user controls model | Requires Python + Ollama setup |
| **Browser AI (Transformers.js)** | Zero-install client-side inference | CSP conflicts; WASM loading issues; limited model size |
| **AES-256-GCM encryption** | User API keys encrypted at rest | Key rotation invalidates all stored keys |
| **Supabase-backed rate limiter** | Distributed rate limiting without Redis | ~0.5ms overhead per check; no pg_cron for cleanup |
| **Zod validation on all API routes** | Type-safe input validation | Boilerplate for simple endpoints |

---

## 3. What We Built

### 3.1 AI Chat Tiers

| Tier | How It Works | Status |
|------|-------------|--------|
| **Basic** | Server returns search results only (no AI) | ✅ Working |
| **Browser** | Transformers.js runs models client-side | ⚠️ CSP issues, WASM blocked |
| **Cloud** | BYO API key → OpenAI/Anthropic/Ollama-compatible | ✅ Working (needs user API key) |
| **Local** | Broker → Ollama on local machine | ✅ Working (qwen2.5:1.5b, confirmed 26 Jun) |

### 3.2 Security Features (Sprint 5)

- **CSP hardening**: script-src, script-src-elem, worker-src, connect-src with explicit sources
- **SSRF mitigation**: Broker URL regex validation; custom endpoint IP range blocking
- **Rate limiting**: Supabase-backed with IP hashing; per-endpoint limits
- **Zod validation**: Every API route validates input before processing
- **UUID validation**: All ID params verified as valid UUIDs
- **IDOR prevention**: Conversation ownership verified before save
- **Input sanitization**: Error messages sanitized to prevent info leaks
- **Secret scanning**: Gitleaks pre-commit hook + CI pipeline
- **Encryption**: AES-256-GCM for stored API keys

### 3.3 Search System

- **Hybrid Search**: Application-level fusion of E5-small dense embeddings + BM25 scoring.
- **Reranking**: Keyword reranking + law diversity boost.
- **3-Stage Fallback**: Qdrant Hybrid → Postgres Trigram (`norms` table) → Supabase `ilike`.
- **Pre-Search**: Law abbreviation pre-search (StVG, StVO, BGB, etc.).
- **Evaluation**: GerLayQA benchmark suite (MRR@10: 0.0461).

### 3.4 Guidance Engine

- Category detection from natural language queries
- Remediation playbooks (8 categories)
- Document template generation (5 templates)
- Cost/risk calculator (RVG/GKG)
- Multi-language support (9 languages)

### 3.5 Bookmark System (v2)

- Dual-storage (localStorage + Supabase)
- 8 uniform AI-guidance folder properties
- Full CRUD with encryption on sensitive fields

---

## 4. What Worked & What Didn't

### ✅ Worked Well

- **Next.js App Router** with RSC for static content, client components for interactivity
- **Supabase Auth** + RLS for user data isolation
- **Dual-storage bookmarks** survive offline and sync when online
- **Law abbreviation pre-search** catches exact law lookups before vector search
- **Local AI broker** provides fully offline legal assistance
- **Rate limiter migration** from in-memory to Supabase (distributed, persistent)

### ⚠️ Partial Success

- **Qdrant E5-small search**: Works for broad queries but returns irrelevant results for short legal queries within a crowded category. The 384d embedding space can't distinguish substantive from procedural traffic law norms, for example. Keyword reranking helps but doesn't fully solve it.
- **Browser AI (Transformers.js)**: Models load but CSP blocks WASM binary loading. Explicit `script-src-elem` directive helps but may not be sufficient for all browsers.
- **Category detection**: Good for clear keywords (`car accident` → traffic), less reliable for ambiguous phrasing.

### ❌ Didn't Work / Known Issues

- **E5-small 384d embeddings** are fundamentally inadequate for 100K+ fine-grained legal norms. A 768d+ model (e5-base, e5-large, or a legal-domain fine-tuned model) would improve results significantly — but requires re-indexing the entire collection.
- **pg_cron** not available on Supabase Free Plan, so rate limit cleanup is called inline.
- **Edge Functions** (`legal-cases`, `file-case`) exist in Supabase but have no corresponding code. Origin unknown — likely from a different project.
- **authdbsupabase connection error** — investigated via `postgres_logs` warehouse. Two connection attempts from IPv6 Supabase infra within 10s. Not recurring. Benign Supabase health probe for a database that doesn't exist in older projects. **Closed.**
- **Hydration mismatch** on `ChatProvider` — fixed with `opacity-0` wrapper during SSR, but the NavBar plug icon vs file-text icon mismatch may still appear intermittently.
- **Sequential thinking tool** crashes with "server shut down" on this Windows machine.
- **`execute_sql` tool** consistently fails with "server shut down" — requires manual SQL execution via Supabase Dashboard.

---

## 5. Known Security Gaps (Low Risk)

| Issue | Impact | Mitigation |
|-------|--------|------------|
| `norm_explanations` RLS has `WITH CHECK (true)` | Anyone can INSERT cache entries | Rate limited (10/min); Zod validated; no PII in table |
| `check_rate_limit` executable by anon/authenticated | Users could call rate limiter directly | Revoked EXECUTE from anon/authenticated in migration 00009 |
| `rate_limits` table has CRUD grants to anon | RLS still blocks row access | Function-based access; no direct table access from client |
| CSP `worker-src` allows CDN script loading | XSS via compromised CDN | `cdn.jsdelivr.net` is pinned; CSP reporting would detect abuse |

---

## 6. Infrastructure

| Service | Purpose | Plan | Cost |
|---------|---------|------|------|
| Supabase | Database + Auth | Free | $0 |
| Qdrant Cloud | Vector search | Free tier (1GB) | $0 |
| Vercel | Hosting | Hobby | $0 |
| Ollama (local) | Local AI | Self-hosted | $0 |
| OpenAI/Anthropic (optional) | Cloud AI | BYO key | User pays |

---

## 7. Future Roadmap

### Short-term (Next Sprint)

1. **Fix Browser AI WASM loading** — Switch to CDN-hosted WASM or `wasm-unsafe-eval` + `strict-dynamic` CSP approach
2. **Improve Qdrant search** — Re-index with a 768d+ model (e5-base, e5-large) or add a hybrid BM25 + vector search
3. **Full-text search migration** — Add `tsvector` column to `laws` table for PostgreSQL native full-text search as co-primary with Qdrant
4. **Authdbsupabase investigation** — Correlate log timestamps to find the calling component

### Medium-term

5. **Rate limit cleanup cron** — If Supabase plan allows pg_cron, schedule periodic cleanup; otherwise implement inline expiration check
6. **Add CSP reporting** — `report-uri` or `report-to` directive to catch CSP violations in production
7. **Session management** — Token refresh, session timeout, concurrent session limits
8. **Audit logging** — Log security-relevant events (auth failures, rate limit hits, IDOR attempts)

### Long-term

9. **Fine-tune a legal-domain embedding model** — Train on German legal texts for better semantic understanding
10. **Multi-tenant support** — Organization accounts with shared bookmark folders
11. **Citation graph** — Link laws to court decisions (BGH, BVerfG, etc.)
12. **Mobile app** — React Native or PWA with offline-first architecture

---

## 8. Key Lessons Learned

1. **Vector search is not a silver bullet** for legal text retrieval. E5-small (384d) is simply too weak for 100K+ fine-grained norms in a crowded semantic space. A hybrid keyword + vector approach (BM25 + Dense) would significantly outperform pure vector search.

2. **SSR + client WASM = CSP headache**. Next.js server-side rendering sets strict CSP defaults that conflict with client-side WASM loading. Always test CSP in the deployed environment, not just in dev mode.

3. **Rate limiting must survive restarts**. In-memory rate limiting is lost on server restart. Migrating to Supabase cost ~0.5ms per check but provides durable, distributed rate limiting across all instances.

4. **Dual-storage bookmarks are worth the complexity**. Users with intermittent connectivity can still access and modify their bookmarks offline. The sync logic handles conflicts with timestamp-based resolution.

5. **Security is a process, not a feature**. Each sprint uncovered new attack surfaces — SSRF via broker URL, IDOR via missing ownership check, CSP bypass via missing `script-src-elem`. Regular security reviews are essential.

6. **Windows development has unique pain points**. Git hooks need explicit installation; gitleaks temp file paths break on Windows; background processes die when terminal closes. The `setup-local-ai.ps1` script automates most of this but OS-specific issues remain.

---

## 9. File Inventory

| Path | Purpose | Status |
|------|---------|--------|
| `nextjs/src/app/` | App Router pages | ✅ Active |
| `nextjs/src/components/` | React components | ✅ Active |
| `nextjs/src/lib/` | Shared utilities | ✅ Active |
| `nextjs/src/hooks/` | React hooks | ✅ Active |
| `nextjs/src/workers/` | Web workers | ✅ Active |
| `broker/broker.py` | Local AI broker | ✅ Active |
| `supabase/migrations/` | 11 migrations | ✅ Active |
| `scripts/` | Setup + seed scripts | ✅ Active |
| `docs/security-architecture.md` | Security docs | ✅ Active |
| `docs/retrospective.md` | This file | ✅ Active |
| `docs/adr/` | Architecture decision records | ⚠️ Partial |
| `plans/` | Sprint plans | ✅ Active |

---

## 10. Metrics

| Metric | Value |
|--------|-------|
| Database tables | 12 |
| Laws indexed | 6,000+ |
| Norm embeddings | 103,586 |
| Support languages | 9 |
| AI chat modes | 4 |
| Bookmark folders properties | 8 (uniform) |
| Migrations | 9 |
| Tests | 42 files, 392 tests (Vitest) |
| CSP directives | 8 (plus script-src-elem, worker-src) |
| API endpoints | ~25 |
| GitHub stars | N/A (new project) |

---

*Retrospective compiled 2026-06-26. Last SHA: `85e3a2b`.*
