# Findings Schema

Each audit lane produces a findings file following this structure.

## Format

```markdown
# [Lane Name]

## Summary

One-paragraph overview.

## Findings

### F-001: [Short title]
- **Severity**: critical | high | medium | low | suggestion
- **File**: `path/to/file.ext` (line N)
- **Current**: What it looks like now
- **Issue**: Why it's a problem
- **Recommendation**: What to change
- **Category**: consistency | polish | a11y | taste | ux

### F-002: ...
```

## Severity Definitions

| Level | Meaning |
|-------|---------|
| **critical** | Bug, broken interaction, or accessibility blocker |
| **high** | Significant UX friction or visual inconsistency |
| **medium** | Polished product would not ship with this |
| **low** | Minor, would improve with targeted fix |
| **suggestion** | Personal taste or future enhancement |

## Categories

| Category | Scope |
|----------|-------|
| consistency | Token usage, spacing, color, typography scale violations |
| polish | Missing states (hover, focus, active, disabled, empty, loading, error) |
| a11y | Keyboard, screen reader, contrast, focus management |
| taste | Generic-AI patterns, layout rhythm, visual hierarchy, premium feel |
| ux | Flow, affordance, information architecture, feedback |
