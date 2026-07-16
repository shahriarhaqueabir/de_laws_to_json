-- Migration 00011: Tighten norm_explanations RLS
-- Switch INSERT to service_role only; SELECT remains public.
-- The API route now uses createAdminClient() for inserts.

revoke insert on public.norm_explanations from anon, authenticated;

-- Drop the old INSERT policy created in 00003 (redundant after revoke)
DROP POLICY IF EXISTS "norm_explanations insert" ON public.norm_explanations;
