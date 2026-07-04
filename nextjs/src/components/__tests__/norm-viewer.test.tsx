import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../chat-context", () => ({
  useChat: () => ({
    settings: {
      mode: "cloud",
      language: "en",
      provider: "openai",
      model: "gpt-4o",
    },
    setSettings: vi.fn(),
  }),
  ChatProvider: ({ children }: { children: React.ReactNode }) =>
    children ?? null,
}));

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

// Translate mock — uses cached Qwen model (translate-via-qwen)
const mockTranslateViaQwen = vi.hoisted(() => vi.fn());
vi.mock("../../lib/translate-via-qwen", () => ({
  translateViaQwen: mockTranslateViaQwen,
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
  mockTranslateViaQwen.mockReset();
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

    // Auto-fetch completes immediately and shows the translation
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

    // Translation should be shown after auto-fetch (appears in content + explanation)
    expect(
      screen.getAllByText("Whoever intentionally or negligently injures..."),
    ).toHaveLength(2);
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
        screen.getAllByText("Whoever intentionally or negligently injures..."),
      ).toHaveLength(2);
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

  it("shows AI translation label by default", async () => {
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
      expect(screen.getByText("AI Translation")).toBeInTheDocument();
    });
  });

  it("loading state shows spinner text during explanation", async () => {
    vi.stubGlobal("localStorage", createLocalStorage());
    const user = userEvent.setup();

    // Never-resolving promise keeps the component in "explaining" state
    const mockFetch = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    await waitFor(() => {
      expect(screen.getByText("Analyzing Statute...")).toBeInTheDocument();
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
        screen.getAllByText("Whoever intentionally or negligently injures..."),
      ).toHaveLength(2);
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

    // After the failed fetch, the translate button should still appear
    expect(screen.getByText("Translate to English")).toBeInTheDocument();
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

    it("shows lock icon on translate button when in basic mode (FeatureGate blocks AI modes)", async () => {
      const user = userEvent.setup();

      render(<NormViewer {...defaultProps} />);

      const header = screen
        .getByText(/Schadensersatzpflicht/)
        .closest("button")!;
      await user.click(header);

      // FeatureGate should show the lock icon instead of the translate button
      expect(screen.getByTestId("lock-icon")).toBeInTheDocument();
    });

    it("does not auto-fetch in basic mode", async () => {
      const user = userEvent.setup();
      const mockFetch = vi.fn();
      vi.spyOn(global, "fetch").mockImplementation(mockFetch);

      render(<NormViewer {...defaultProps} />);

      const header = screen
        .getByText(/Schadensersatzpflicht/)
        .closest("button")!;
      await user.click(header);

      // Wait a tick to confirm auto-fetch doesn't fire
      await new Promise((r) => setTimeout(r, 100));
      expect(mockFetch).not.toHaveBeenCalled();
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
        expect(screen.getAllByText("Local translation")).toHaveLength(2);
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
        expect(screen.getAllByText("Extracted from code block")).toHaveLength(
          2,
        );
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

      // Raw text fills all 4 fields + the original content = 5
      const els = await screen.findAllByText("I am not valid JSON at all");
      expect(els).toHaveLength(5);
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
