# ADR-002: Guidance AI Prompt Design

**Status**: Accepted (2026-06-21)
**Context**: The guidance feature needs structured, parseable AI output (3-5 JSON paths) that can be enriched with local cost calculations.

## Decision

Use a **dual-prompt architecture** with output-first specification:

1. **System prompt** (`GUIDANCE_SYSTEM_PROMPT`): Tells the AI its role (German legal expert), the exact output JSON schema, and 10 rules including prohibition on fabricating section numbers.
2. **User prompt** (`buildGuidancePrompt()`): Assembles situation + folder context + bookmarked laws + Qdrant search results into structured markdown sections.

### Parsing Strategy

- Try naive JSON parse first
- Fallback: regex to extract JSON from markdown code fences
- Last resort: fallback regex for bare `{"paths":...}` object
- `parseGuidanceResponse()` normalizes all fields (risk levels, probabilities)
- `attachCostEstimates()` enriches with local RVG/GKG calculations (not AI-generated)

### Cost Estimation Separation

AI does NOT generate cost estimates. The `attachCostEstimates()` function uses the local `fees.ts` library with actual RVG/GKG tables. This prevents hallucinated numbers and keeps calculations deterministic.

### Document Generation

Separate system prompt (`DOCUMENT_SYSTEM_PROMPT`) with template-based generation. AI fills handlebars-style placeholders. For AI-less mode, a simple string replace fills placeholders directly from folder properties.

### Consequences

- AI must output valid JSON — any deviation degrades the experience
- Response parsing is the most fragile part; the fallback chain is critical
- Cost estimates are always labeled as approximate
- All guidance includes RDG disclaimer
