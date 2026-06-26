import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client (service_role key, bypasses RLS entirely).
// Used only for server-side operations like rate limiting where
// we want to avoid granting EXECUTE to anon/authenticated roles.
export const createAdminClient = () => createClient(supabaseUrl, serviceRoleKey);
