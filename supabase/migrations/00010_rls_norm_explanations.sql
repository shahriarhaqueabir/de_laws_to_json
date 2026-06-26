-- Migration 00010: Tighten norm_explanations RLS
-- Switch INSERT to service_role only; SELECT remains public.
-- The API route now uses createAdminClient() for inserts.

revoke insert on public.norm_explanations from anon, authenticated;
