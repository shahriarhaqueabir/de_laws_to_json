import { NextResponse } from "next/server";

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Array<{ field: string; message: string }>,
): NextResponse<ApiError> {
  return NextResponse.json(
    { error: { code, message, details } },
    { status },
  );
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}
