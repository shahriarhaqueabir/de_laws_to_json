# ADR-003: Legal Case Management Module

**Status**: Accepted (2026-06-21)
**Context**: Users need to track their legal proceedings alongside bookmarked laws. The original approach (migration 00005) created 6 separate tables (courts, profiles, legal_cases, case_documents, case_hearings, case_parties). The folder-property system replaced these, but the `case_files` table remained for AI session persistence.

## Decision

Use a lightweight **case session** model rather than a full legal case management system:

1. **`case_files`**: Created automatically when a signed-in user runs guidance. Stores the situation text, folder context snapshot, and status. Acts as a "session" for AI-generated guidance paths.
2. **`guidance_paths`**: 3-5 outcome paths per case_file. AI-generated with risk levels, cost estimates, and recommended actions. Enriched with local RVG/GKG fee calculations.
3. **`bookmark_folders`**: The user's primary organizational tool. The 8 uniform properties (incident_date, dispute_value, status, opposing_party, deadline_date, court_name, case_number, notes) cover all the fields users need for case tracking.

### Data Flow

```
User describes situation
  → POST /api/guidance
    → searchNorms() (Qdrant)
    → loadPlaybooks() (Supabase, by category)
    → buildGuidancePrompt() (situation + folder + bookmarks + playbooks + Qdrant results)
    → callAI() (OpenAI/Anthropic/Ollama)
    → parseGuidanceResponse() + attachCostEstimates()
    → INSERT INTO case_files (if signed in)
    → INSERT INTO guidance_paths (if signed in)
  → Return paths to frontend
```

### User-Facing Case Management

Users track cases via bookmark folders:
- Create a folder per legal situation
- Bookmark relevant laws into the folder
- Fill the 8 properties as information becomes available
- Run guidance with the folder selected to get AI outcome paths
- Generate documents from templates using folder properties

### Consequences

- No interactive court database or lookup
- Case tracking depends on users keeping folder properties updated
- Multiple guidance runs per folder create multiple `guidance_paths` entries linked via `case_files`
- The guidance history is accessible via the case_files API (GET /api/guidance/sessions)

### See Also

- `guidance.ts::generateGuidancePaths()`
- `guidance/route.ts` — case_file creation on guidance run
- `bookmark_folders` table (migration 00007)
