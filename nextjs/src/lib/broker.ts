/**
 * Shared broker URL validation utilities.
 *
 * Used across API routes to prevent SSRF attacks when accepting
 * a broker URL from the request body. Only loopback/localhost
 * addresses are permitted since the broker always runs on the
 * user's own machine.
 */

// Only allow localhost/loopback addresses to prevent SSRF attacks
const BROKER_URL_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function isValidBrokerUrl(url: string): boolean {
  return BROKER_URL_REGEX.test(url);
}

/**
 * Resolve a broker URL from a request body value, env var, or default.
 * Validates against SSRF rules and falls back to localhost:9000.
 */
export function resolveBrokerUrl(
  bodyUrl?: string | null,
): string {
  if (bodyUrl && isValidBrokerUrl(bodyUrl)) {
    return bodyUrl;
  }
  const envBrokerUrl = process.env.NEXT_PUBLIC_BROKER_URL;
  if (envBrokerUrl && isValidBrokerUrl(envBrokerUrl)) {
    return envBrokerUrl;
  }
  return "http://localhost:9000";
}
