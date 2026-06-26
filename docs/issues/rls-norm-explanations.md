# Issue: RLS Tightening — Restrict norm_explanations INSERT

**Priority:** Low
**Area:** Auth / Security
**Labels:** security, database

## Description
The `norm_explanations` table has an RLS policy with `WITH CHECK (true)` for INSERT operations. While the table is cache-only (no PII), the permissive policy could allow abuse.

## Current Protection
- Rate limited to 10 requests/minute
- Zod-validated input
- No sensitive data in table
- Max payload size enforced by API route

## Proposed Fix
Switch `/api/explain/route.ts` to use `createAdminClient()` from `supabase-admin.ts` (service_role), then revoke INSERT privilege from anon/authenticated roles.

## Migration
```sql
-- Revoke INSERT from public
REVOKE INSERT ON public.norm_explanations FROM anon, authenticated;
```

Then update `explain/route.ts`:
```typescript
import { createAdminClient } from "../../../lib/supabase-admin";
// Use createAdminClient() instead of getServerClient(cookieStore)
```

## Risk
- Low: table has no user data, no foreign key relationships
- Change is revertible: `GRANT INSERT ON ... TO anon, authenticated;`

## Acceptance Criteria
- [ ] `norm_explanations` INSERT restricted to service_role
- [ ] `/api/explain` still works (uses admin client)
- [ ] Rate limiting still applied
- [ ] No regression for cached explanations
