import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLanguage } from "../useLanguage";

describe("useLanguage", () => {
  it("always returns English as the current language", () => {
    const { result } = renderHook(() => useLanguage());
    expect(result.current.language).toBe("en");
  });

  describe("t() — UI string lookup", () => {
    it("returns the English string for a known key", () => {
      const { result } = renderHook(() => useLanguage());
      expect(result.current.t("search.loading")).toBe("Searching...");
    });

    it("supports {n} variable interpolation", () => {
      const { result } = renderHook(() => useLanguage());
      expect(result.current.t("search.results_count", { n: 5 })).toBe(
        "5 Statutes Retrieved",
      );
    });

    it("returns the key itself for unknown strings", () => {
      const { result } = renderHook(() => useLanguage());
      expect(result.current.t("nonexistent.key")).toBe("nonexistent.key");
    });
  });
});
