# Issue: Investigate `authdbsupabase` Connection Error in Postgres Logs

**Priority:** Medium
**Area:** Infrastructure
**Labels:** bug, infrastructure, database

## Description
Supabase Postgres logs contain repeated FATAL errors:
```
database "authdbsupabase" does not exist
```

This error appears regularly but has no corresponding reference in the codebase (zero grep matches in any source file, config, migration, or environment variable).

## Investigation
- **Not in codebase**: No matches in migrations, source files, env vars, or configs
- **Not in .env.local**: No reference
- **Likely cause**: Supabase Cloud internal health probe, misconfigured cron job, or integration from a different project

## Needed Actions
1. Check if this correlates with any dashboard-managed components (cron jobs, background workers)
2. Check if the Supabase project was forked or migrated from another project
3. Contact Supabase support if the error persists and produces log volume

## Impact Assessment
- **Current**: Appears to be harmless — app functions normally
- **Risk**: If the error creates log bloat, it could fill the free plan's 500MB log limit
- **Worst case**: Connection attempts from a misconfigured external service that could eventually hit connection pool limits

## Acceptance Criteria
- [ ] Identify the component making these connection attempts
- [ ] If actionable, fix the misconfiguration
- [ ] If Supabase-internal, document as known non-issue
- [ ] Monitor log volume
