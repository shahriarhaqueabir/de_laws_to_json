## Summary

<!--
  Briefly describe what this PR changes and why. Include the problem or
  motivation behind the change, and link the relevant issue if applicable.

  Ex: Fixes incorrect E5-small query prefix when searching norms, which caused
  semantically unrelated results to appear at the top. (Fixes #123)
-->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Refactor (no functional change)
- [ ] Performance improvement
- [ ] Infrastructure / CI / build
- [ ] Documentation update
- [ ] Breaking change (fix or feature that may break existing functionality)

## Areas Affected

- [ ] **Search** — Qdrant vector search, E5-small query logic
- [ ] **Law pages** — law metadata, norm viewer
- [ ] **AI Guidance** — `/api/guidance`, guidance paths, diagnosis
- [ ] **Chat** — `/api/chat`, chat modes, Transformers.js worker
- [ ] **Bookmarks** — folders, dual-storage sync (localStorage + Supabase)
- [ ] **Auth** — Supabase auth, RLS policies
- [ ] **Settings** — API key encryption / management
- [ ] **Document generation** — templates, PDF
- [ ] **Database** — Supabase migrations, seed data
- [ ] **Infrastructure** — CI/CD, dependencies, config
- [ ] **i18n / localization** — language strings, translation utilities
- [ ] **Other** — specify below

## Testing

Describe the testing you performed:

- [ ] `npm test` passes
- [ ] `npx tsc --noEmit` passes (strict mode)
- [ ] `npm run build` succeeds
- [ ] Manual testing steps:

## Checklist

- [ ] My code follows the project's TypeScript strict conventions (no `any`, no `@ts-ignore`)
- [ ] I have added Zod validation for any new API routes
- [ ] I have updated relevant tests
- [ ] I have checked for regressions in the E5-small `query:` prefix logic (if touching search)
- [ ] I have verified graceful degradation paths for external services
- [ ] No secrets or credentials are hardcoded in the codebase

## Notes for Reviewers

<!--
  Any migration steps, environment variable changes, or external API
  updates the reviewer should know about.
-->
