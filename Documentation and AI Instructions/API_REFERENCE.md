# API Reference — German Law Vault (Next.js)

**Updated:** 2026-06-21  
**Version:** 3.0 (Guidance + Folder System)

---

## 🔍 Search Endpoints

### GET `/api/search`

Search German laws using natural language queries via Qdrant vector search.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | No | Search query (English or German). Omit to browse by category. |
| `category` | string | No | Filter by category (e.g., "housing", "labor", "civil") |
| `limit` | integer | No | Max results (default: 10, max: 50) |
| `page` | integer | No | Page number for pagination (default: 1, offset = (page-1) * limit) |

**Example:**
```bash
curl "/api/search?q=landlord%20refuses%20deposit&limit=10"
```

**Response:**
```json
{
  "data": [
    {
      "law_key": "BGB",
      "law_title": "Bürgerliches Gesetzbuch",
      "norm_id": "§ 548",
      "norm_title": "Ansprüche des Vermieters",
      "content": "Der Vermieter kann...",
      "score": 0.85,
      "category": "consumer"
    }
  ],
  "total": 1
}
```

---

### GET `/api/laws/[key]`

Get a specific law by its key (e.g., "BGB", "StGB").

**Example:**
```bash
curl "/api/laws/BGB"
```

**Response:**
```json
{
  "data": {
    "key": "BGB",
    "title": "Bürgerliches Gesetzbuch",
    "category": "consumer",
    "norms": [
      {
        "norm_id": "§ 433",
        "title": "Vertragstypische Pflichten beim Kaufvertrag",
        "content": "Durch den Kaufvertrag wird der Verkäufer einer Sache verpflichtet..."
      }
    ]
  }
}
```

---

## 🤖 Guidance Endpoints (NEW)

### POST `/api/guidance`

Generate 3-5 legal outcome paths for a user's situation. The AI engine cross-references 6,000+ German federal laws via Qdrant, user's bookmarked laws, and folder context.

**Request:**
```json
{
  "situation": "I was fired without notice after 5 years of employment",
  "language": "en",
  "folder_id": "uuid-optional",
  "folder_context": {
    "id": "uuid",
    "name": "Wrongful Dismissal",
    "category": "labor",
    "incident_date": "2026-05-15",
    "dispute_value": 15000,
    "status": "pre_action",
    "opposing_party": "Employer GmbH",
    "deadline_date": "2026-06-05",
    "court_name": "Arbeitsgericht Berlin",
    "case_number": "",
    "notes": "Was told verbally on May 15"
  },
  "provider": "openai",
  "model": "gpt-4o-mini"
}
```

**Response:**
```json
{
  "data": {
    "session_id": "uuid-or-null",
    "paths": [
      {
        "path_number": 1,
        "title": "Außergerichtliche Einigung (Out-of-Court Settlement)",
        "summary": "Negotiate directly...",
        "detailed_analysis": "Under German law...",
        "laws_cited": [
          { "law_key": "BGB", "norm_id": "§ 779", "law_title": "Bürgerliches Gesetzbuch" }
        ],
        "risk_level": "low",
        "risk_reason": "Low risk - no court exposure.",
        "cost_estimate": 1200,
        "cost_breakdown": { "court_fees": 0, "lawyer_fees": 1200, "total_risk": 2400 },
        "recommended_actions": ["Document facts", "Send demand letter"],
        "estimated_timeline": "2-6 weeks",
        "success_probability": 0.65
      }
    ],
    "folder_context": { "...": "..." },
    "generated_at": "2026-06-21T12:00:00.000Z",
    "language": "en"
  }
}
```

**Features:**
- **AI-powered**: Uses user's API key from `user_api_keys` table (OpenAI/Anthropic/Ollama).
- **AI-less fallback**: Returns Qdrant search results when no API key is configured.
- **Folder context**: 8 uniform properties enrich the AI prompt.
- **Bookmarked laws**: Auto-included when a folder is selected.
- **Cost estimation**: RVG/GKG calculator attached server-side.

---

### GET `/api/guidance/sessions/[id]`

Retrieve a saved guidance session with its paths.

**Response:**
```json
{
  "data": {
    "session": { "id": "uuid", "title": "...", "status": "active" },
    "paths": [ { "path_number": 1, "title": "...", "risk_level": "low" } ]
  }
}
```

---

### DELETE `/api/guidance/sessions/[id]`

Delete a guidance session.

**Response:**
```json
{ "data": { "deleted": true } }
```

---

### POST `/api/guidance/generate-doc`

Generate a legal document from a template + folder context.

**Request:**
```json
{
  "template_slug": "demand-letter",
  "folder_context": { "name": "Test Case", "opposing_party": "Employer GmbH" },
  "situation": "I was fired without notice"
}
```

**Response:**
```json
{
  "data": {
    "title": "Demand Letter - Test Case",
    "content": "Sehr geehrte Damen und Herren...",
    "template_slug": "demand-letter",
    "placeholders_filled": {
      "incident_date": "...",
      "dispute_value": "...",
      "opposing_party": "Employer GmbH"
    }
  }
}
```

---

## 📁 Bookmark Folder Endpoints (NEW)

### GET `/api/bookmarks/folders`

List the authenticated user's bookmark folders.

**Auth required:** Yes (cookie-based Supabase session).

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Wrongful Dismissal",
      "description": "Case regarding my termination",
      "category": "labor",
      "incident_date": "2026-05-15",
      "dispute_value": 15000.00,
      "status": "pre_action",
      "opposing_party": "Employer GmbH",
      "deadline_date": "2026-06-05",
      "court_name": "",
      "case_number": "",
      "notes": "Was told verbally",
      "created_at": "2026-06-21T12:00:00Z",
      "updated_at": "2026-06-21T12:00:00Z"
    }
  ]
}
```

### POST `/api/bookmarks/folders`

Create a new bookmark folder.

**Auth required:** Yes.

**Request:**
```json
{
  "name": "Wrongful Dismissal",
  "description": "Case regarding my termination",
  "category": "labor",
  "incident_date": "2026-05-15",
  "dispute_value": 15000,
  "status": "pre_action",
  "opposing_party": "Employer GmbH",
  "deadline_date": "2026-06-05",
  "court_name": "Arbeitsgericht Berlin",
  "case_number": "",
  "notes": "Some notes"
}
```

**Response:** (201 Created) — The created folder object.

### PATCH `/api/bookmarks/folders?id=X`

Update an existing folder.

**Auth required:** Yes. Only the folder's owner can update.

### DELETE `/api/bookmarks/folders?id=X`

Delete a folder.

**Auth required:** Yes. Bookmarks in the folder get `folder_id` set to NULL.

---

## 💬 Chat Endpoints

### POST `/api/chat`

AI chat with context from laws and norms. Supports streaming and non-streaming.

**Request:**
```json
{
  "message": "What does BGB § 433 say?",
  "conversation_id": "optional-uuid",
  "language": "en"
}
```

---

## 🔧 Admin Endpoints

### GET `/api/diagnostics`

System diagnostics and health check.

---

## Folder Properties Reference

The 8 uniform folder properties that feed the AI guidance engine:

| Field | Type | AI Use |
|-------|------|--------|
| `incident_date` | DATE | Calculate statutory deadlines via `calculateDeadline()` |
| `dispute_value` | NUMERIC(12,2) | Cost estimation (RVG/GKG) via `calculateTotalLegalRisk()` |
| `status` | ENUM(pre_action, consulting, filed, in_progress, resolved) | Determine urgency tier |
| `opposing_party` | TEXT(500) | Check specific legal protections (KSchG, BDSG) |
| `deadline_date` | DATE | Generate urgency warnings with days-remaining count |
| `court_name` | TEXT(200) | Jurisdiction-specific procedures |
| `case_number` | TEXT(200) | Link to existing court proceedings (Aktenzeichen) |
| `notes` | TEXT(5000) | Free-text injected into AI prompt |

---

## Rate Limits

| Endpoint | Limit | Period |
|----------|-------|--------|
| `/api/guidance` | 10 | 60 seconds |
| `/api/bookmarks/folders` | 30 | 60 seconds |
| `/api/search` | 100 | 60 seconds |
| `/api/chat` | 20 | 60 seconds |

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "details": []
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 422 | Invalid request body (Zod validation) |
| `UNAUTHORIZED` | 401 | User not signed in |
| `NOT_FOUND` | 404 | Resource not found |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Database Schema

### `bookmark_folders`
```sql
CREATE TABLE public.bookmark_folders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'other',
  incident_date   DATE,
  dispute_value   NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status          TEXT NOT NULL DEFAULT 'pre_action'
                  CHECK (status IN ('pre_action','consulting','filed','in_progress','resolved')),
  opposing_party  TEXT NOT NULL DEFAULT '',
  deadline_date   DATE,
  court_name      TEXT NOT NULL DEFAULT '',
  case_number     TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `guidance_paths`
```sql
CREATE TABLE public.guidance_paths (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id        UUID NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  path_number         SMALLINT NOT NULL CHECK (path_number BETWEEN 1 AND 5),
  title               TEXT NOT NULL,
  summary             TEXT NOT NULL,
  detailed_analysis   TEXT NOT NULL,
  laws_cited          JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_level          TEXT NOT NULL CHECK (risk_level IN ('low','medium','high')),
  cost_estimate       NUMERIC(12,2),
  recommended_actions TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `remediation_playbooks`
```sql
CREATE TABLE public.remediation_playbooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL,
  issue_type  TEXT NOT NULL UNIQUE,
  steps       JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `document_templates`
```sql
CREATE TABLE public.document_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'other',
  template    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Key Libraries

| Library | Path | Purpose |
|---------|------|---------|
| `guidance.ts` | `src/lib/guidance.ts` | Core engine: `generateGuidancePaths()`, `parseGuidanceResponse()`, `attachCostEstimates()`, `calculateDeadlineWarnings()`, `generateDocument()`, `getLanguagePrompt()` |
| `bookmarks-v2.ts` | `src/lib/bookmarks-v2.ts` | Dual-storage (localStorage + Supabase): `BookmarkV2`, `BookmarkFolder`, `getFolders()`, `createFolder()`, `updateFolder()`, `deleteFolder()`, `syncBookmarksToSupabase()` |
| `fees.ts` | `src/lib/fees.ts` | RVG/GKG cost calculator: `calculateTotalLegalRisk()` |
| `diagnosis.ts` | `src/lib/diagnosis.ts` | Deadline calculator: `calculateDeadline()` |
| `qdrant.ts` | `src/lib/qdrant.ts` | Vector search: `searchNorms(query, category?, topK?)` |

---

*Last updated: 2026-06-21*
