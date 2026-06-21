<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Architecture Guidelines

- **Local AI Connectivity**: The bridge to local Ollama (port 9000) is **client-side only**. Cloud-hosted frontends (Vercel) cannot reach `localhost` via server-side props/API routes. Use the `ChatProvider` and client-side `fetch` to `localhost:9000`.
- **Managed Inference**: Qdrant Universal Query API requires the explicit `{ query: { text: string, model: string } }` structure for managed inference. 
    - **Current Model**: `intfloat/multilingual-e5-small`
    - **Specs**: Dense vector, 384 dimensions, 512 token context window.
    - **Constraint**: Raw strings or missing model keys trigger 400 errors.
- **Persistence**: 
    - Guest users: `sessionStorage` (key: `glv_guest_chat`). Cleared upon successful sign-in.
    - Authenticated: Supabase `conversations` and `messages` tables.
- **Design System**: Strict adherence to "Cinematic Legal Authority" (Obsidian/Basalt/Gold). No em-dashes (`—`) in UI; use hyphens (`-`) only.

## New Endpoints (Guidance + Folder System)

### Guidance Engine
- `POST /api/guidance` — Generate 3-5 legal outcome paths. Accepts `{situation, language, folder_context?, provider?, model?}`. Returns `{paths[], session_id?, generated_at}`.
  - 🟢 **AI-powered**: Uses user's API key from `user_api_keys` table (OpenAI/Anthropic/Ollama).
  - 🔄 **AI-less fallback**: Qdrant-based when no API key configured.
  - 📂 **Folder context**: 8 uniform properties feed the AI prompt (see `FolderContext` in `guidance.ts`).
  - 📚 **Bookmarked laws**: Auto-included in prompt when folder is selected.
  - 💰 **Cost estimation**: RVG/GKG calculator in `fees.ts`, attached server-side.
- `GET /api/guidance/sessions/[id]` — Retrieve saved guidance session + paths.
- `DELETE /api/guidance/sessions/[id]` — Delete guidance session.
- `POST /api/guidance/generate-doc` — Generate legal document from template + folder context.

### Bookmark Folders (Uniform Properties — 8 fields)
- `GET /api/bookmarks/folders` — List user's folders (auth required).
- `POST /api/bookmarks/folders` — Create folder (Zod validated).
- `PATCH /api/bookmarks/folders?id=X` — Update folder.
- `DELETE /api/bookmarks/folders?id=X` — Delete folder.

| Field | Type | AI Use |
|-------|------|--------|
| `incident_date` | DATE | Calculate deadlines via `diagnosis.ts` |
| `dispute_value` | NUMERIC | Cost estimation via `fees.ts` |
| `status` | ENUM | Determine urgency (pre_action→resolved) |
| `opposing_party` | TEXT | Check specific legal protections |
| `deadline_date` | DATE | Generate urgency warnings |
| `court_name` | TEXT | Jurisdiction-specific procedures |
| `case_number` | TEXT | Link to existing proceedings |
| `notes` | TEXT | Free-text AI prompt context injection |

### Dual-Storage Bookmarks
- **Anonymous**: localStorage only (`glv_bookmarks_v2`, `glv_folders`).
- **Signed in**: localStorage + Supabase (bi-directional merge via `syncBookmarksToSupabase()`).
- Library: `src/lib/bookmarks-v2.ts` — `BookmarkV2`, `BookmarkFolder`, `CreateFolderInput` types.

### Remediation Playbooks & Document Templates
- 8 seed playbooks in `supabase/seed_remediation_playbooks.sql` (wrongful_dismissal, rent_reduction, deposit_retention, withdrawal, warranty, fine_contest, custody, defense_strategy).
- 5 seed document templates in `supabase/seed_document_templates.sql`. Uses `Supabase/[template_slug]` as lookup key.
<!-- END:nextjs-agent-rules -->
