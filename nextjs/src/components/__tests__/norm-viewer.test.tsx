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

// Mock localStorage BEFORE importing the component
const mockLocalStorage = {
  getItem: vi.fn(() =>
    JSON.stringify({
      language: "en",
      mode: "cloud",
      provider: "openai",
      model: "gpt-4o-mini",
    }),
  ),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal("localStorage", mockLocalStorage);

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

const defaultProps = {
  normId: "§ 823",
  lawKey: "BGB",
  title: "Schadensersatzpflicht",
  content: "Wer vorsätzlich oder fahrlässig das Leben...",
};

beforeEach(() => {
  mockToast.mockClear();
  vi.restoreAllMocks();
});

describe("NormViewer", () => {
  it("shows norm ID and title", () => {
    render(<NormViewer {...defaultProps} />);
    expect(screen.getByText(/Section § 823/)).toBeInTheDocument();
    expect(screen.getByText("Schadensersatzpflicht")).toBeInTheDocument();
  });

  it("clicking expands content and auto-fetches translation", async () => {
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
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExplanation),
    });
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    // Expand — triggers auto-fetch
    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    // Wait for translation to appear
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

  it("loading state shows spinner text during explanation", async () => {
    const user = userEvent.setup();

    // Never-resolving fetch to keep explaining state
    const mockFetch = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    // Expand — triggers auto-fetch
    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    await waitFor(() => {
      expect(screen.getByText("Decrypting Dialect...")).toBeInTheDocument();
    });
  });

  it("shows error toast when explanation fetch fails", async () => {
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
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExplanation),
    });
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    const { unmount } = render(<NormViewer {...defaultProps} />);

    // Expand — triggers auto-fetch
    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    // Wait for explanation to load
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

    // fetch should have been called only once (from the first expand)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
