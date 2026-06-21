# ADR-004: Remediation Playbooks and Document Templates

**Status**: Accepted (2026-06-21)
**Context**: The guidance engine needs structured reference data to produce accurate, actionable outcome paths. Users also need to generate German legal documents (Widerspruch, Mahnung, Kündigung, Einspruch, Klageschrift) from their case context.

## Decision

Use static SQL-seeded reference tables with a category→issue_type mapping:

### Remediation Playbooks (`remediation_playbooks`)

8 seed playbooks covering the most common German legal issue types:
- `labor/wrongful_dismissal` — KSchG-based termination defense
- `housing/rent_reduction` — § 536 BGB rent reduction
- `consumer/deposit_retention` — § 812 BGB deposit return
- `consumer/withdrawal` — § 355 BGB online purchase withdrawal
- `consumer/warranty` — §§ 437, 439 BGB warranty claims
- `traffic/fine_contest` — § 67 OWiG fine objection
- `family/custody` — § 1626 BGB custody proceedings
- `public/defense_strategy` — § 147 StPO criminal defense

Each playbook contains 4-5 JSON steps with: title, description, deadline_days, type (analysis, legal_action, hearing, etc.), and optional statute reference.

### Document Templates (`document_templates`)

5 seed templates with handlebars-style placeholders:
- `widerspruch` — Objection to administrative decision
- `mahnung` — Formal demand/dunning letter
- `kuendigung` — Termination notice
- `einspruch` — Objection to fine notice
- `klage` — Statement of claim

Placeholders map to folder properties: `{{name}}`, `{{incident_date}}`, `{{dispute_value}}`, `{{opposing_party}}`, `{{deadline_date}}`, `{{court_name}}`, `{{case_number}}`, `{{notes}}`.

### Integration with Guidance Engine

1. `CATEGORY_PLAYBOOK_MAP` in `guidance.ts` maps folder categories to playbook issue types
2. `loadPlaybooks()` queries the playbooks table when guidance runs
3. Playbook steps are injected into the AI prompt as structured reference data
4. AI system prompt instructs the model to use playbook steps to inform recommended actions
5. Document generation uses folder properties + AI to fill templates (AI mode) or direct string replacement (fallback)

### Consequences

- Playbooks are static — updates require new SQL migrations
- Category→playbook mapping is code-defined, not data-driven
- Document templates are stored as SQL seed data, not in a CMS
- AI must not hallucinate placeholders — only use the 8 folder properties
- Templates must eventually support localization (currently German only)

### See Also

- `guidance.ts::CATEGORY_PLAYBOOK_MAP`
- `guidance.ts::buildPlaybookContext()`
- `guidance.ts::generateDocument()`
- `guidance/generate-doc/route.ts`
- `seed_remediation_playbooks.sql`
- `seed_document_templates.sql`
