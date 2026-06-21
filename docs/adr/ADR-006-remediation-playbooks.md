# ADR-006: Remediation Playbooks & Document Templates

**Status**: Accepted (2026-06-21)

## Context

Users describe their legal situation in plain language (9 languages). The app needs to match their situation to a structured remediation strategy and optionally generate German legal documents. We need seed data that covers the most common legal issues.

## Decision

Two seed tables with static, curated content:

### `remediation_playbooks`
- 8 playbooks across 6 categories (labor, housing, consumer×3, traffic, family, public)
- Each playbook has 4-5 steps with deadlines, statutes, and action types
- Matched via `CATEGORY_PLAYBOOK_MAP` in `guidance.ts` — folder category → issue type
- Steps are JSONB for flexibility (can vary in length per playbook)
- Public read-only RLS — no user-specific data

### `document_templates`
- 5 templates: Widerspruch, Mahnung, Kündigung, Einspruch, Klageschrift
- Content_template uses `{{placeholder}}` syntax for variable substitution (name, court, case_number, etc.)
- Placeholders JSONB array lists required variables
- Generated via `POST /api/guidance/generate-doc` — fills template from folder properties

## Consequences

- Positive: Covers 80%+ of common German legal situations
- Positive: Templates are actual German legal documents, usable in court
- Positive: No AI needed for template filling — fast, deterministic, free
- Positive: Public read-only means no RLS complexity
- Negative: Static — new playbooks/templates require database inserts and code changes
