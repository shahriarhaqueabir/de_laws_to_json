import { NextResponse } from "next/server";

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

/**
 * Standard error response builder for API routes.
 *
 * @param code - Machine-readable error code (e.g. "VALIDATION_ERROR", "RATE_LIMITED")
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param details - Optional field-level validation errors
 * @param headers - Optional extra response headers (e.g. rate-limit headers)
 */
export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Array<{ field: string; message: string }>,
  headers?: HeadersInit,
): NextResponse<ApiError> {
  return NextResponse.json(
    { error: { code, message, details } },
    { status, headers },
  );
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}
