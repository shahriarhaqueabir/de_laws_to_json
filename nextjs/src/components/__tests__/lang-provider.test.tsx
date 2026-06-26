import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LangProvider } from "../lang-provider";

const mockStore: Record<string, string> = {};

beforeEach(() => {
  // Reset DOM attributes
  document.documentElement.lang = "";
  document.documentElement.dir = "";

  // Mock localStorage via defineProperty (works in jsdom)
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: vi.fn((key: string) => mockStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStore[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStore).forEach((k) => delete mockStore[k]);
      }),
      get length() {
        return Object.keys(mockStore).length;
      },
      key: vi.fn((index: number) => Object.keys(mockStore)[index] ?? null),
    },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  vi.restoreAllMocks();
});

describe("LangProvider", () => {
  it("renders children", () => {
    render(
      <LangProvider>
        <div data-testid="child">Hello</div>
      </LangProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("sets lang and dir from localStorage settings", () => {
    mockStore["glv_chat_settings"] = JSON.stringify({ language: "de" });

    render(
      <LangProvider>
        <div>test</div>
      </LangProvider>,
    );

    expect(document.documentElement.lang).toBe("de");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("sets dir to rtl for Arabic", () => {
    mockStore["glv_chat_settings"] = JSON.stringify({ language: "ar" });

    render(
      <LangProvider>
        <div>test</div>
      </LangProvider>,
    );

    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("does not override lang/dir when no settings stored", () => {
    document.documentElement.lang = "fr";

    render(
      <LangProvider>
        <div>test</div>
      </LangProvider>,
    );

    // Should not change because localStorage is empty
    expect(document.documentElement.lang).toBe("fr");
    expect(document.documentElement.dir).toBe("");
  });

  it("responds to glv_settings_updated event", () => {
    // Render with initial settings (English)
    mockStore["glv_chat_settings"] = JSON.stringify({ language: "en" });

    render(
      <LangProvider>
        <div>test</div>
      </LangProvider>,
    );

    expect(document.documentElement.lang).toBe("en");

    // Update settings and dispatch event
    mockStore["glv_chat_settings"] = JSON.stringify({ language: "fr" });

    act(() => {
      window.dispatchEvent(new Event("glv_settings_updated"));
    });

    expect(document.documentElement.lang).toBe("fr");
  });

  it("handles corrupted localStorage gracefully", () => {
    mockStore["glv_chat_settings"] = "not-valid-json";

    render(
      <LangProvider>
        <div>test</div>
      </LangProvider>,
    );

    // Should not change lang/dir when JSON is corrupted
    expect(document.documentElement.lang).toBe("");
  });

  it("cleans up event listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(
      <LangProvider>
        <div>test</div>
      </LangProvider>,
    );

    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      "glv_settings_updated",
      expect.any(Function),
    );

    removeSpy.mockRestore();
  });
});
