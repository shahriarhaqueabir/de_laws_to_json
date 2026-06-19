import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Simple Edge-compatible rate limiter
// Note: In a multi-region deployment, this is per-region.
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

function isRateLimited(ip: string) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;

  const limit = rateLimitMap.get(ip) || { count: 0, lastReset: now };

  if (now - limit.lastReset > windowMs) {
    limit.count = 1;
    limit.lastReset = now;
  } else {
    limit.count++;
  }

  rateLimitMap.set(ip, limit);
  return limit.count > maxRequests;
}

export async function proxy(request: NextRequest) {
  // Use header for IP as request.ip might not be available in all Next.js builds/runtimes
  const ip = request.headers.get("x-forwarded-for") || "anonymous";

  // Rate limit API chat and explain routes
  if (
    request.nextUrl.pathname.startsWith("/api/chat") ||
    request.nextUrl.pathname.startsWith("/api/explain")
  ) {
    if (isRateLimited(ip)) {
      return new NextResponse(
        JSON.stringify({
          error: "Rate limit exceeded. Maximum 10 messages per minute.",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase env vars not configured in proxy");
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
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake can make it very hard to debug
  // auth issues.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
