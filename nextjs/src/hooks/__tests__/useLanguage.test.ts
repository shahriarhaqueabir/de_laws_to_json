import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock useChat before importing the hook
const mockUpdateSettings = vi.fn();
let mockLanguage = "en";

vi.mock("../../components/chat-context", () => ({
  useChat: () => ({
    settings: { language: mockLanguage },
    updateSettings: mockUpdateSettings,
  }),
}));

// Import after mock
const { useLanguage } = await import("../useLanguage");

describe("useLanguage", () => {
  beforeEach(() => {
    mockLanguage = "en";
    mockUpdateSettings.mockClear();
  });

  it("returns the current language from ChatContext", () => {
    const { result } = renderHook(() => useLanguage());
    expect(result.current.language).toBe("en");
  });

  it("returns German when ChatContext language is de", () => {
    mockLanguage = "de";
    const { result } = renderHook(() => useLanguage());
    expect(result.current.language).toBe("de");
  });

  it("setLanguage updates global context", () => {
    const { result } = renderHook(() => useLanguage());
    result.current.setLanguage("de");
    expect(mockUpdateSettings).toHaveBeenCalledWith({ language: "de" });
  });

  describe("t() — UI string translation", () => {
    it("returns English string for en", () => {
      const { result } = renderHook(() => useLanguage());
      expect(result.current.t("search.loading")).toBe("Scanning Archives...");
    });

    it("returns German string for de", () => {
      mockLanguage = "de";
      const { result } = renderHook(() => useLanguage());
      expect(result.current.t("search.loading")).toBe("Durchsuche Archiv...");
    });

    it("returns Turkish for tr", () => {
      mockLanguage = "tr";
      const { result } = renderHook(() => useLanguage());
      expect(result.current.t("search.loading")).toBe("Arşiv taranıyor...");
    });

    it("supports {n} variable interpolation", () => {
      const { result } = renderHook(() => useLanguage());
      expect(result.current.t("search.results_count", { n: 5 })).toBe(
        "5 Statutes Retrieved",
      );
    });

    it("falls back to English for missing language", () => {
      mockLanguage = "ja" as never;
      const { result } = renderHook(() => useLanguage());
      expect(result.current.t("search.loading")).toBe("Scanning Archives...");
    });

    it("returns the key itself for unknown strings", () => {
      const { result } = renderHook(() => useLanguage());
      expect(result.current.t("nonexistent.key")).toBe("nonexistent.key");
    });
  });
});
