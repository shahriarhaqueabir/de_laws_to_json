import { describe, it, expect } from "vitest";
import { errorResponse, successResponse } from "../api-utils";

describe("errorResponse", () => {
  it("returns correct status code", async () => {
    const res = errorResponse("NOT_FOUND", "Resource not found", 404);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Resource not found");
  });

  it("has error.code, error.message, error.details shape", async () => {
    const details = [
      { field: "email", message: "Email is required" },
      { field: "name", message: "Name must be at least 2 characters" },
    ];
    const res = errorResponse(
      "VALIDATION_ERROR",
      "Invalid input",
      422,
      details,
    );

    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("code", "VALIDATION_ERROR");
    expect(body.error).toHaveProperty("message", "Invalid input");
    expect(body.error).toHaveProperty("details");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details).toHaveLength(2);
    expect(body.error.details[0]).toEqual({
      field: "email",
      message: "Email is required",
    });
  });

  it("works with and without details", async () => {
    const withDetails = errorResponse("ERR", "msg", 400, [
      { field: "f", message: "m" },
    ]);
    const bodyWith = await withDetails.json();
    expect(bodyWith.error.details).toHaveLength(1);

    const withoutDetails = errorResponse("ERR", "msg", 400);
    const bodyWithout = await withoutDetails.json();
    expect(bodyWithout.error.details).toBeUndefined();
  });
});

describe("successResponse", () => {
  it("wraps data in { data } envelope", async () => {
    const payload = { id: 1, name: "BGB" };
    const res = successResponse(payload);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: payload });
  });

  it("accepts custom status code", async () => {
    const res = successResponse(null, 201);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toEqual({ data: null });
  });
});
