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
  Toaster: ({ children }: { children: any }) => children ?? null,
}));

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

  it("clicking expands content", async () => {
    const user = userEvent.setup();
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
  });

  it("clicking 'Translate Insight' fires POST to /api/explain", async () => {
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExplanation),
    });
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    // Expand first
    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    // Click the Translate Insight button
    const translateBtn = screen.getByText(/Translate Insight/);
    await user.click(translateBtn);

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
  });

  it("explanation renders translation, summary, implications, next_steps when loaded", async () => {
    const user = userEvent.setup();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExplanation),
    });
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    render(<NormViewer {...defaultProps} />);

    // Expand
    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    // Click Translate Insight
    const translateBtn = screen.getByText(/Translate Insight/);
    await user.click(translateBtn);

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

    // Expand
    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    // Click Translate Insight
    const translateBtn = screen.getByText(/Translate Insight/);
    await user.click(translateBtn);

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

    const translateBtn = screen.getByText(/Translate Insight/);
    await user.click(translateBtn);

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

    render(<NormViewer {...defaultProps} />);

    const header = screen.getByText(/Schadensersatzpflicht/).closest("button")!;
    await user.click(header);

    // Click translate once
    const translateBtn = screen.getByText(/Translate Insight/);
    await user.click(translateBtn);

    // Wait for explanation to load
    await waitFor(() => {
      expect(
        screen.getByText("Whoever intentionally or negligently injures..."),
      ).toBeInTheDocument();
    });

    // Try clicking translate again (should be no-op)
    const anyTranslateBtn = screen.queryByText(/Translate Insight/);
    if (anyTranslateBtn) {
      await user.click(anyTranslateBtn);
    }

    // fetch should have been called only once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
