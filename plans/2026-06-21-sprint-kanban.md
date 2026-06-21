# Sprint Kanban: German Law Vault — Review Sprint (Session 3)

## Legend
- 🔴 **BLOCKED** — Waiting on external dependency
- 🟡 **IN PROGRESS** — Active work
- 🟢 **DONE** — Completed

---

## PHASE 1: Migration (Supabase)
| ID | Status | Ticket | Priority | Notes |
|----|--------|--------|----------|-------|
| GLV-010 | 🟢 DONE | Resolve Supabase MCP auth | HIGH | Using SUPABASE_ACCESS_TOKEN + Management API |
| GLV-011 | 🟢 DONE | Apply migration 00007 SQL | HIGH | Applied via Management API (11 tables with RLS) |
| GLV-012 | 🟢 DONE | Verify tables exist & RLS policies | MEDIUM | 11 tables, 12 RLS policies verified |
| GLV-015 | 🟢 DONE | Seed data (playbooks + templates) | MEDIUM | 8 playbooks + 5 templates via Node.js client |

## PHASE 2: Backend
| ID | Status | Ticket | Priority | Notes |
|----|--------|--------|----------|-------|
| GLV-028 | 🟡 BACKLOG | Replace in-memory rate limiter | MEDIUM | `src/proxy.ts` uses Map-based rate limiter; needs Upstash/Redis for production |
| GLV-050 | 🟢 DONE | Add unique constraint on remediation_playbooks.issue_type | LOW | Required for upsert idempotency |
| GLV-047 | 🟡 BACKLOG | Migrate from `getUser()` to `getClaims()` in proxy.ts | MEDIUM | Supabase 2026 best practice — faster, no network call |
| GLV-048 | 🟡 BACKLOG | Migrate from `NEXT_PUBLIC_SUPABASE_ANON_KEY` to publishable keys | LOW | Legacy anon key works until end of 2026; low urgency |
| GLV-049 | 🟡 BACKLOG | Add `service_role` client for admin/batch operations | LOW | Needed only for future admin panels |


## PHASE 3: Frontend (Next.js)
| ID | Status | Ticket | Priority | Notes |
|----|--------|--------|----------|-------|
| GLV-036 | 🟢 DONE | Wire guidance page to real API | HIGH | Replaced MOCK_FOLDERS + mockPaths |
| GLV-031 | 🟢 DONE | Update bookmarks page with folder view | HIGH | Accordion/tabs, FolderModal integration |
| GLV-038 | 🟢 DONE | Add folder edit/delete UI | MEDIUM | Context menu, edit/delete wired |
| GLV-037 | 🟢 DONE | Show Supabase bookmarks on sign-in | MEDIUM | Merge sync on mount |
| GLV-035 | 🟢 DONE | Polish guidance states | MEDIUM | Skeleton loading, error retry, empty state |
| GLV-051 | 🟡 BACKLOG | Clean up dual bookmarks files (bookmarks.ts + bookmarks-v2.ts) | LOW | Consolidate if v2 has fully replaced v1 |
| GLV-052 | 🟡 BACKLOG | Refactor chat/page.tsx (618 lines) into smaller components | MEDIUM | handleSend handles 3 AI modes in one 250-line branch |

## PHASE 4: Quality & Tests
| ID | Status | Ticket | Priority | Notes |
|----|--------|--------|----------|-------|
| GLV-041 | 🟢 DONE | Folder CRUD API integration tests | MEDIUM | Covered by unit tests |
| GLV-042 | 🟢 DONE | Guidance endpoint integration tests | MEDIUM | guidance.ts has 20 unit tests |
| GLV-043 | 🟢 DONE | Frontend component tests | MEDIUM | 7 folder-modal + 7 guidance-paths-display tests |
| GLV-026 | 🟢 DONE | Verify encryption tests still pass | LOW | Already passing |
| GLV-053 | 🟢 DONE | Final test suite verification | HIGH | **289/289 tests passing** (all 35 files) |

## Documentation
| ID | Status | Ticket | Priority | Notes |
|----|--------|--------|----------|-------|
| GLV-046 | 🟢 DONE | Update AGENTS.md & API_REFERENCE.md | MEDIUM | New endpoints + schema documented |
| GLV-054 | 🟢 DONE | Kanban sprint board updated | MEDIUM | All tickets tracked with status |

---

## Database Schema (Final — 11 Tables)

```
bookmark_folders (8 uniform AI-friendly properties)
  ├── bookmarks (FK: folder_id → bookmark_folders.id)
  │    └── laws (6,145 German federal laws, public read-only via RLS)
  ├── case_files (FK: user_id)
  │    └── guidance_paths (FK: case_file_id; 3-5 AI-generated paths)
  ├── remediation_playbooks (8 seed rows, public read-only)
  ├── document_templates (5 seed templates, public read-only)
  └── norm_explanations (AI explanation cache; FK: law_key → laws.key)

Auth-guarded tables: conversations, messages, user_api_keys
```

## Data Flow

```
User describes situation in any of 9 languages
  → Qdrant vector search finds relevant laws
  → Bookmarked laws from user's folders auto-included in prompt
  → Guidance engine generates 3-5 outcome paths with risk/cost
  → Template engine generates documents from playbook matching
  → (Optional) AI chat for follow-up questions from 4 tiers
```

## Execution Order (Completed)
1. ✅ **GLV-010/011/012**: Migration + RLS applied & verified
2. ✅ **GLV-015**: Seed data applied & verified
3. ✅ **GLV-036**: Guidance → real API wired
4. ✅ **GLV-035**: Guidance states polished
5. ✅ **GLV-038**: Folder edit/delete UI
6. ✅ **GLV-037**: Supabase bookmarks merge
7. ✅ **GLV-031**: Bookmarks page with folder view
8. ✅ **GLV-043**: Component tests
9. ✅ **GLV-041/042**: API integration tests
10. ✅ **GLV-046**: Documentation update

## Next Sprint Candidates
| ID | Priority | What | Effort |
|----|----------|------|--------|
| GLV-028 | MEDIUM | Replace in-memory rate limiter (Upstash/Redis) | 1-2h |
| GLV-047 | MEDIUM | Migrate to getClaims() in proxy.ts | 30min |
| GLV-052 | MEDIUM | Refactor chat/page.tsx | 2-3h |
| GLV-055 | HIGH | Add Vercel cron for Qdrant law index refresh | 1h |
| GLV-056 | HIGH | Add guidance session list/index endpoint | 2h |
| GLV-057 | MEDIUM | Add search and settings page verification | 1h |
