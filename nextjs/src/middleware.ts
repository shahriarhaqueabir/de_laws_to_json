/**
 * Middleware for Supabase auth session refresh.
 *
 * Uses createServerClient to refresh the auth session on every request
 * so that API routes and pages have a valid session without redirecting
 * to the auth page.
 *
 * IMPORTANT: Do NOT remove the `await supabase.auth.getUser()` call — it
 * is what triggers the session refresh via the cookie setAll handler.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Skip middleware if env vars aren't configured (e.g., during build)
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: This call refreshes the session. Do not remove.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Skip static files, images, and favicon.
     * Process all other paths including API routes and pages.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
