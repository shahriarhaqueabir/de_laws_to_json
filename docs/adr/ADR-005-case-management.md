# ADR-005: Case Management Module

**Status**: Accepted (2026-06-21)

## Context

Users need to track their legal situations across the entire lifecycle — from initial research through resolution. The app generates 3-5 AI-guided outcome paths per case, and users need to save, revisit, and manage these sessions.

## Decision

Implement case management through three tightly coupled entities:

- **`case_files`**: One record per user-submitted situation. Contains the raw situation description, language, and folder context. Auto-created by the guidance engine on `POST /api/guidance`.
- **`guidance_paths`**: 3-5 outcome paths per case file. Each path has title, summary, detailed analysis, risk level, cost estimate, and recommended actions. Saved as separate rows for independent retrieval and comparison.
- **Folder properties** (`bookmark_folders`): 8 uniform AI-guidance fields (incident_date, dispute_value, status, opposing_party, deadline_date, court_name, case_number, notes) that feed into the guidance prompt.

Case management is accessed via `/guidance/history` (list) and `/guidance/sessions/[id]` (detail). The delete endpoint cascades from `case_files` to `guidance_paths`.

## Consequences

- Positive: Clean separation of concerns — case_files owns the situation, guidance_paths owns the AI output
- Positive: 8 uniform folder properties simplify AI prompt construction
- Positive: Auto-creation ensures no orphan sessions
- Negative: Users cannot manually create case_files (only via guidance API)
