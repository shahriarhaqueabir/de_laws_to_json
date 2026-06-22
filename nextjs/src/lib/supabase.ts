import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client (public anon key, SSR-compatible cookie handling)
export const createClient = () => createBrowserClient(supabaseUrl, supabaseKey);
