# ADR-001: Bookmark Folder Architecture with Uniform Properties

**Status**: Accepted (2026-06-21)
**Context**: Original plan had separate tables for courts, profiles, legal_cases, etc. (migration 00005). These were replaced by a simpler user-driven folder system.

## Decision

Use a single `bookmark_folders` table with 8 uniform `TEXT`/`DATE`/`NUMERIC` properties that feed into the AI guidance engine. Every folder has the same fields — users fill what they know.

### Rationale

1. **Simplicity over CRUD explosion**: 6 separate tables (courts, profiles, legal_cases, case_documents, case_hearings, case_parties) replaced by 1 table + 1 FK column on bookmarks.
2. **AI-ready shape**: The 8 properties map 1:1 to the `FolderContext` interface in `guidance.ts`, which feeds directly into the AI prompt builder.
3. **Uniform schema, not polymorphic**: Using JSONB for folder-specific fields would make it impossible to write typed Zod validators, generate structured prompts, or create cost/deadline calculations.
4. **Non-legal-user friendly**: A single folder with visible named fields is more approachable than navigating a complex legal case management hierarchy.

### Consequences

- No court reference data — users type court names as free text
- No structured case party tracking — users type opposing party as free text
- Guidance engine must handle sparse data gracefully (most fields optional)

### See Also

- `guidance.ts::FolderContext` interface
- `folder-modal.tsx` — the 8-field form
- Migration 00007 (drops migration 00005 tables)
