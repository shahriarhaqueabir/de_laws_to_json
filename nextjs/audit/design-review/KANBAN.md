# Frontend Design Review — Agent Kanban

> Multi-tiered design audit using parallel agents.
> Each card tracks a review lane with owner, evidence, and merge gate.

---

## Board Columns

| State | Meaning |
|-------|---------|
| Backlog | Shaped, not started |
| Running | Agent actively reviewing |
| Review | Findings aggregated, awaiting cross-check |
| Merged | Integrated into final report |
| Blocked | Needs input or data from another lane |

---

## Cards

### 1. Design System & Visual Consistency Audit

| Field | Value |
|-------|-------|
| **Owner** | agent-1 |
| **State** | Merged |
| **Scope** | `globals.css`, Tailwind tokens, component class patterns, color/spacing consistency |
| **Acceptance** | Token audit, component class audit, spacing/typography scale check |
| **Evidence** | `findings/01-design-system.md` |
| **Merge Gate** | ✅ 17 findings: 1 critical, 2 high, 9 medium, 4 low, 1 suggestion |

### 2. UI Component Polish Audit

| Field | Value |
|-------|-------|
| **Owner** | agent-2 |
| **State** | Merged |
| **Scope** | 10 components reviewed |
| **Acceptance** | Check interaction states, loading skeletons, empty states, edge-case rendering, responsive breakpoints |
| **Evidence** | `findings/02-component-polish.md` |
| **Merge Gate** | ✅ 18 findings: 2 high, 8 medium, 5 low, 3 suggestions |

### 3. Accessibility & UX Flow Audit

| Field | Value |
|-------|-------|
| **Owner** | agent-3 |
| **State** | Merged |
| **Scope** | 8 pages/files audited |
| **Acceptance** | a11y audit pass, form validation UX, navigation flows |
| **Evidence** | `findings/03-a11y-ux.md` |
| **Merge Gate** | ✅ 21 findings: 5 critical, 7 high, 5 medium, 2 suggestions |

### 4. Design Taste & Anti-Slop Review

| Field | Value |
|-------|-------|
| **Owner** | agent-4 |
| **State** | Merged |
| **Scope** | 7 pages + globals.css |
| **Acceptance** | Identify generic/templated patterns, suggest premium alternatives |
| **Evidence** | `findings/04-taste-review.md` |
| **Merge Gate** | ✅ 16 findings: 1 critical, 3 high, 8 medium, 2 low, 2 suggestions |

### 5. Aggregate Findings & Final Report

| Field | Value |
|-------|-------|
| **Owner** | conductor |
| **State** | Merged |
| **Scope** | Consolidate all findings, deduplicate, prioritize |
| **Acceptance** | Unified report with severity-ranked issues |
| **Evidence** | `FINDINGS.md` |
| **Merge Gate** | ✅ 58 unique issues (8C, 15H, 17M, 11L, 7S) — all lanes reconciled |

---

## Card Schema (Reference)

```json
{
  "id": "card-n",
  "title": "Lane name",
  "owner": "agent-n",
  "state": "backlog | running | review | merged | blocked",
  "scope": "files or concerns",
  "acceptance": "what proves it's done",
  "evidence": "path to findings file",
  "merge_gate": "exact condition to integrate"
}
```
