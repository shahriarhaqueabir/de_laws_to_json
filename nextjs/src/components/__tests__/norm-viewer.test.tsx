import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn() }),
  usePathname: () => "/",
}));

const mockToast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(mockToast, {
    info: mockToast,
    success: mockToast,
    error: mockToast,
    warning: mockToast,
  }),
  Toaster: ({ children }: { children: React.ReactNode }) => children ?? null,
}));

// Translate mock — used by "basic" mode
const mockTranslateText = vi.hoisted(() => vi.fn());
vi.mock("../../lib/translate", () => ({
  translateText: mockTranslateText,
}));

// Default localStorage mock — cloud/openai mode
function createLocalStorage(overrides: Record<string, string> = {}) {
  const store: Record<string, string> = {
    glv_chat_settings: JSON.stringify({
      language: "en",
      mode: "cloud",
      provider: "openai",
      model: "gpt-4o-mini",
    }),
    ...overrides,
  };
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

import NormViewer from "../norm-viewer";

const mockExplanation = {
  norm_id: "§ 823",
  law_key: "BGB",
  law_title: "Bürgerliches Gesetzbuch",
  lang: "en" as const,
  translation: "Whoever intentionally or negligently injures...",
  summary: "This section establishes tort liability.",
  implications: "Can be used to claim damages for personal injury.",
  next_steps: "File a complaint with the local court.",
  disclaimer: "Preliminary Non-Binding Report",
};

const mockExplanationOfficial = {
  ...mockExplanation,
  is_official: true,
  translation: "Official translation text...",
};

const defaultProps = {
  normId: "§ 823",
  lawKey: "BGB",
  title: "Schadensersatzpflicht",
  content: "Wer vorsätzlich oder fahrlässig das Leben...",
};

beforeEach(() => {
  mockToast.mockClear();
  mockTranslateText.mockReset();
  vi.restoreAllMocks();
});

describe("NormViewer", () => {
  it("shows norm ID and title", () => {
    vi.stubGlobal("localStorage", createLocalStorage());
    render(<NormViewer {...defaultProps} />);
    expect(screen.getByText(/Section § 823/)).toBeInTheDocument();
    expect(screen.getByText("Schadensersatzpflicht")).toBeInTheDocument();
  });

  it("clicking expands content and auto-fetches translation in cloud mode", async () => {
    vi.stubGlobal("localStorage", createLocalStorage());
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExplanation),
    });
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    // Content should not be visible initially
    expect(
      screen.queryByText("Wer vorsätzlich oder fahrlässig das Leben..."),
    ).not.toBeInTheDocument();

    // Click the header to expand
    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    // Content should now be visible
    expect(
      screen.getByText("Wer vorsätzlich oder fahrlässig das Leben..."),
    ).toBeInTheDocument();

    // Auto-fetch should fire POST to /api/explain with correct body
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      });
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.normId).toBe("§ 823");
    expect(body.lawKey).toBe("BGB");
    expect(body.content).toBe("Wer vorsätzlich oder fahrlässig das Leben...");
    expect(body.lang).toBe("en");
  });

  it("explanation renders translation, summary, implications, next_steps when loaded", async () => {
    vi.stubGlobal("localStorage", createLocalStorage());
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExplanation),
    });
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    await waitFor(() => {
      expect(
        screen.getByText("Whoever intentionally or negligently injures..."),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("This section establishes tort liability."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Can be used to claim damages for personal injury."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("File a complaint with the local court."),
    ).toBeInTheDocument();
  });

  it("shows official translation label when is_official is true", async () => {
    vi.stubGlobal("localStorage", createLocalStorage());
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExplanationOfficial),
    });
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    await waitFor(() => {
      expect(screen.getByText("Official Translation")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Vernacular Translation"),
    ).not.toBeInTheDocument();
  });

  it("shows vernacular translation label by default", async () => {
    vi.stubGlobal("localStorage", createLocalStorage());
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExplanation),
    });
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    await waitFor(() => {
      expect(screen.getByText("Vernacular Translation")).toBeInTheDocument();
    });
  });

  it("loading state shows spinner text during explanation", async () => {
    vi.stubGlobal("localStorage", createLocalStorage());
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    await waitFor(() => {
      expect(screen.getByText("Decrypting Dialect...")).toBeInTheDocument();
    });
  });

  it("shows error toast when explanation fetch fails in cloud mode", async () => {
    vi.stubGlobal("localStorage", createLocalStorage());
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
    });
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        "Explanation failed. Check settings.",
      );
    });
  });

  it("does not call fetch again if already explained", async () => {
    vi.stubGlobal("localStorage", createLocalStorage());
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExplanation),
    });
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    await waitFor(() => {
      expect(
        screen.getByText("Whoever intentionally or negligently injures..."),
      ).toBeInTheDocument();
    });

    // Collapse and re-expand
    await user.click(header);
    expect(
      screen.queryByText("Whoever intentionally or negligently injures..."),
    ).not.toBeInTheDocument();

    await user.click(header);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("shows retry button when no explanation and not explaining", async () => {
    vi.stubGlobal("localStorage", createLocalStorage());
    const user = userEvent.setup();

    // A fetch that fails so we end up in !explanation && !explaining
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
    });

    // After the failed fetch, the Retry Translation button should appear
    expect(screen.getByText("Retry Translation")).toBeInTheDocument();
  });

  it("shows disclaimer after explanation loads", async () => {
    vi.stubGlobal("localStorage", createLocalStorage());
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExplanation),
    });
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    await waitFor(() => {
      expect(
        screen.getByText("Vault Intelligence — Preliminary Non-Binding Report"),
      ).toBeInTheDocument();
    });
  });

  describe("basic mode", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "localStorage",
        createLocalStorage({
          glv_chat_settings: JSON.stringify({
            language: "en",
            mode: "basic",
          }),
        }),
      );
    });

    it("uses translateText for basic mode", async () => {
      const user = userEvent.setup();
      mockTranslateText.mockResolvedValue("Translated text from basic mode");

      render(<NormViewer {...defaultProps} />);

      const header = screen
        .getByText(/Schadensersatzpflicht/)
        .closest("button")!;
      await user.click(header);

      await waitFor(() => {
        expect(mockTranslateText).toHaveBeenCalledWith(
          "Wer vorsätzlich oder fahrlässig das Leben...",
          { sourceLang: "de", targetLang: "en" },
        );
      });

      expect(
        screen.getByText("Translated text from basic mode"),
      ).toBeInTheDocument();
    });

    it("falls back to raw content when translateText throws", async () => {
      const user = userEvent.setup();
      mockTranslateText.mockRejectedValue(new Error("Worker failed"));

      render(<NormViewer {...defaultProps} />);

      const header = screen
        .getByText(/Schadensersatzpflicht/)
        .closest("button")!;
      await user.click(header);

      // Content appears in both the original display and the fallback translation
      await waitFor(() => {
        expect(
          screen.getAllByText("Wer vorsätzlich oder fahrlässig das Leben..."),
        ).toHaveLength(2);
      });
    });

    it("shows correct summary, disclaimer for basic mode", async () => {
      const user = userEvent.setup();
      mockTranslateText.mockResolvedValue("Translated text");

      render(<NormViewer {...defaultProps} />);

      const header = screen
        .getByText(/Schadensersatzpflicht/)
        .closest("button")!;
      await user.click(header);

      await waitFor(() => {
        expect(
          screen.getByText("Browser AI translation — not legally binding."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("local mode", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "localStorage",
        createLocalStorage({
          glv_chat_settings: JSON.stringify({
            language: "en",
            mode: "local",
            brokerUrl: "http://localhost:8080",
            ollamaModel: "llama3",
          }),
        }),
      );
    });

    it("calls broker API for local mode", async () => {
      const user = userEvent.setup();

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            response: JSON.stringify({
              translation: "Local translation",
              summary: "Local summary",
              implications: "Local implications",
              next_steps: "Local steps",
            }),
          }),
      });
      vi.spyOn(global, "fetch").mockImplementation(mockFetch);

      render(<NormViewer {...defaultProps} />);

      const header = screen
        .getByText(/Schadensersatzpflicht/)
        .closest("button")!;
      await user.click(header);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:8080/api/chat",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }),
        );
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe("llama3");
      expect(body.temperature).toBe(0.3);

      await waitFor(() => {
        expect(screen.getByText("Local translation")).toBeInTheDocument();
      });
    });

    it("shows local error toast when broker is unavailable", async () => {
      const user = userEvent.setup();

      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      vi.spyOn(global, "fetch").mockImplementation(mockFetch);

      render(<NormViewer {...defaultProps} />);

      const header = screen
        .getByText(/Schadensersatzpflicht/)
        .closest("button")!;
      await user.click(header);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          "Local AI unavailable. Check if Ollama is running and the broker URL is correct.",
        );
      });
    });

    it("parses markdown code blocks from local response", async () => {
      const user = userEvent.setup();

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            response:
              '```json\n{"translation": "Extracted from code block", "summary": "S", "implications": "I", "next_steps": "N"}\n```',
          }),
      });
      vi.spyOn(global, "fetch").mockImplementation(mockFetch);

      render(<NormViewer {...defaultProps} />);

      const header = screen
        .getByText(/Schadensersatzpflicht/)
        .closest("button")!;
      await user.click(header);

      await waitFor(() => {
        expect(
          screen.getByText("Extracted from code block"),
        ).toBeInTheDocument();
      });
    });

    it("shows disclaimer after local explanation loads", async () => {
      const user = userEvent.setup();

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            response: JSON.stringify({
              translation: "T",
              summary: "S",
              implications: "I",
              next_steps: "N",
            }),
          }),
      });
      vi.spyOn(global, "fetch").mockImplementation(mockFetch);

      render(<NormViewer {...defaultProps} />);

      const header = screen
        .getByText(/Schadensersatzpflicht/)
        .closest("button")!;
      await user.click(header);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Vault Intelligence — Preliminary Non-Binding Report",
          ),
        ).toBeInTheDocument();
      });
    });

    it("handles non-JSON local response by using raw text", async () => {
      const user = userEvent.setup();

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            response: "I am not valid JSON at all",
          }),
      });
      vi.spyOn(global, "fetch").mockImplementation(mockFetch);

      render(<NormViewer {...defaultProps} />);

      const header = screen
        .getByText(/Schadensersatzpflicht/)
        .closest("button")!;
      await user.click(header);

      // Raw text fills all 4 fields when JSON.parse fails
      const els = await screen.findAllByText("I am not valid JSON at all");
      expect(els).toHaveLength(4);
    }, 10000);
  });

  describe("localStorage handling", () => {
    it("falls back to defaults when localStorage is corrupted", () => {
      vi.stubGlobal(
        "localStorage",
        createLocalStorage({
          glv_chat_settings: "invalid json{{{",
        }),
      );
      // Should not throw
      expect(() => render(<NormViewer {...defaultProps} />)).not.toThrow();
    });

    it("falls back when localStorage key is missing", () => {
      vi.stubGlobal("localStorage", createLocalStorage({}));
      const user = userEvent.setup();

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockExplanation),
      });
      vi.spyOn(global, "fetch").mockImplementation(mockFetch);

      render(<NormViewer {...defaultProps} />);

      const header = screen
        .getByText(/Schadensersatzpflicht/)
        .closest("button")!;
      expect(() => user.click(header)).not.toThrow();
    });
  });
});
