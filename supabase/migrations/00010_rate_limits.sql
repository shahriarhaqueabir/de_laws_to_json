-- Migration 00009: Supabase-backed rate limiting table
--
-- Replaces the per-instance in-memory rate limiter with a shared
-- Postgres-backed implementation that works across serverless instances.
--
-- Uses ip_hash (SHA-256 truncated) instead of raw IP to reduce PII
-- exposure in application-layer logs while still uniquely identifying
-- clients for rate limiting purposes.

-- ═══════════════════════════════════════════════════════════════
-- 1. Create rate_limits table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint per IP + endpoint + window (enables upsert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_window
  ON public.rate_limits (ip_hash, endpoint, window_start);

-- Index for fast cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start
  ON public.rate_limits (window_start);

-- ═══════════════════════════════════════════════════════════════
-- 2. Auto-update updated_at trigger
-- ═══════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_rate_limits_updated_at ON public.rate_limits;
CREATE TRIGGER trg_rate_limits_updated_at
  BEFORE UPDATE ON public.rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 3. Row-Level Security: No public access
--    Rate limits are managed server-side only (service_role key).
--    Block all direct user access.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Deny all operations for anon and authenticated roles
DROP POLICY IF EXISTS "rate_limits_no_anon_select" ON public.rate_limits;
CREATE POLICY "rate_limits_no_anon_select" ON public.rate_limits
  FOR SELECT USING (false);
DROP POLICY IF EXISTS "rate_limits_no_anon_insert" ON public.rate_limits;
CREATE POLICY "rate_limits_no_anon_insert" ON public.rate_limits
  FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "rate_limits_no_anon_update" ON public.rate_limits;
CREATE POLICY "rate_limits_no_anon_update" ON public.rate_limits
  FOR UPDATE USING (false);
DROP POLICY IF EXISTS "rate_limits_no_anon_delete" ON public.rate_limits;
CREATE POLICY "rate_limits_no_anon_delete" ON public.rate_limits
  FOR DELETE USING (false);

-- ═══════════════════════════════════════════════════════════════
-- 4. Cleanup function: Delete expired windows
--    Configurable retention via window_minutes parameter.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits(window_minutes INTEGER DEFAULT 5)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - make_interval(mins => window_minutes);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. SECURITY DEFINER function for rate limit checks
--    Bypasses RLS so the app can use the anon key.
--    Returns JSON: { allowed: boolean, remaining: int, reset_at: float }
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_ip_hash TEXT,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 10,
  p_window_ms INTEGER DEFAULT 60000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_now TIMESTAMPTZ := now();
  v_reset_at TIMESTAMPTZ;
  result JSONB;
BEGIN
  -- Calculate current window start
  v_window_start := date_trunc('milliseconds', v_now) - make_interval(secs => p_window_ms::double precision / 1000);

  -- Try to insert a new row (first request in window)
  INSERT INTO public.rate_limits (ip_hash, endpoint, count, window_start)
  VALUES (p_ip_hash, p_endpoint, 1, v_window_start)
  ON CONFLICT (ip_hash, endpoint, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING public.rate_limits.count, public.rate_limits.window_start
  INTO v_count, v_reset_at;

  -- Calculate reset time
  v_reset_at := v_reset_at + make_interval(secs => p_window_ms::double precision / 1000);

  IF v_count > p_max_requests THEN
    -- Rate limited
    result := jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', extract(epoch from v_reset_at)
    );
  ELSE
    result := jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - v_count,
      'reset_at', extract(epoch from v_reset_at)
    );
  END IF;

  RETURN result;
END;
$$;
