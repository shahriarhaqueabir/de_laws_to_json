# ADR-008: Hybrid Translation Support

**Date**: 2026-07-05
**Status**: accepted
**Deciders**: AI Assistant

## Context

German Law Vault serves a multilingual audience, but official English translations are only available for a subset of the 6,000+ laws from gesetze-im-internet.de. Users need high-quality legal text in their preferred language, but should also be informed when they are reading an AI-generated translation versus a verified official one to ensure legal accuracy and reliability.

## Decision

Implement a **hybrid translation storage and display strategy** that distinguishes between official government translations and machine-generated ones.

1. **Schema Extension**: 
   - Add `title_en` and `official_translation_url` to the `laws` table to store localized metadata and links to source documents.
   - Add an `is_official` boolean flag to the `norm_explanations` table (which serves as our translation cache).

2. **Source-First Retrieval**: 
   - Priority is given to official translations stored in the database.
   - If no official translation exists, the system falls back to machine translation (e.g., via Qwen, Ollama, or Transformers.js).

3. **UI Transparency**:
   - Explicitly badge translations as "Official" or "AI-Generated" in the Law Viewer.
   - Provide direct links to the official source when available.

## Alternatives Considered

### Alternative 1: AI-Only Translation
- **Pros**: Uniform implementation, no need for manual source linking.
- **Cons**: Risks legal inaccuracies for high-stakes laws (e.g., BGB, StGB) where official English versions exist.
- **Why not**: Compromises the project's goal of being a reliable legal resource.

## Consequences

### Positive
- Improves user trust by surfacing verified government translations.
- Provides immediate access to all 6,000+ laws via fallback machine translation.
- Enables localized search by indexing English titles.

### Negative
- Increases database schema complexity.
- Requires maintenance of `official_translation_url` links.

### Risks
- AI-generated translations may still be misinterpreted as legally binding (mitigated by persistent legal disclaimers in the UI).
