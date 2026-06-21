import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { LawSearchResult } from "../../lib/types";

const mockGet = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: mockGet }),
  usePathname: () => "/",
}));

import SearchPage from "../search/page";
import { ToastProvider } from "../../components/toast";
import { AuthProvider } from "../../components/auth-context";

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <AuthProvider>
      <ToastProvider>{ui}</ToastProvider>
    </AuthProvider>,
  );
};

const mockResults: LawSearchResult[] = [
  {
    key: "BGB",
    title: "Bürgerliches Gesetzbuch",
    category: "Zivilrecht",
    relevance: 95,
    normHits: 12,
    relevantNorms: [
      {
        normId: "§ 823",
        title: "Schadensersatzpflicht",
        content: "Wer vorsätzlich oder fahrlässig...",
      },
    ],
  },
  {
    key: "StGB",
    title: "Strafgesetzbuch",
    category: "Strafrecht",
    relevance: 87,
    normHits: 8,
    relevantNorms: [
      {
        normId: "§ 242",
        title: "Diebstahl",
        content: "Wer eine fremde bewegliche Sache...",
      },
    ],
  },
];

let fetchImpl: (url: string, options?: RequestInit) => Promise<Response>;

beforeEach(() => {
  mockGet.mockReturnValue(null); // No query params by default
  vi.restoreAllMocks();
  // Default fetch mock
  fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ results: mockResults }),
  });
  global.fetch = vi.fn().mockImplementation(fetchImpl);
});

describe("SearchPage", () => {
  it("renders SearchBar component", () => {
    renderWithProviders(<SearchPage />);
    expect(
      screen.getByPlaceholderText(/SEARCH STATUTE REPOSITORY/i),
    ).toBeInTheDocument();
  });

  it("shows loading spinner when fetching", async () => {
    mockGet.mockReturnValue("test");
    // Never-resolving fetch to keep loading state
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    renderWithProviders(<SearchPage />);

    await waitFor(() => {
      expect(screen.getByText("Scanning Archives...")).toBeInTheDocument();
    });
  });

  it("shows search results when data returned", async () => {
    mockGet.mockReturnValue("BGB");
    renderWithProviders(<SearchPage />);

    await waitFor(() => {
      expect(screen.getByText("2 Statutes Retrieved")).toBeInTheDocument();
    });

    expect(screen.getByText("BGB")).toBeInTheDocument();
    expect(screen.getByText("StGB")).toBeInTheDocument();
    expect(screen.getByText("Bürgerliches Gesetzbuch")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockGet.mockReturnValue("test");
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: "Failed to fetch search results" },
      }),
    });

    renderWithProviders(<SearchPage />);

    await waitFor(() => {
      expect(screen.getByText(/Operational Error/)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Failed to fetch search results/),
    ).toBeInTheDocument();
  });

  it("shows empty state for no results", async () => {
    mockGet.mockReturnValue("nonexistent");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    renderWithProviders(<SearchPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/No statutes found matching the inquiry parameters/),
      ).toBeInTheDocument();
    });
  });

  it("shows awaiting inquiry state when no query or category", () => {
    renderWithProviders(<SearchPage />);
    expect(screen.getByText("Awaiting Inquiry")).toBeInTheDocument();
  });

  it("fetches from correct API URL with query param", async () => {
    mockGet.mockReturnValue("BGB");

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    global.fetch = fetchSpy;

    renderWithProviders(<SearchPage />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/search?q=BGB"),
      );
    });
  });

  it("fetches from correct API URL with category param", async () => {
    mockGet.mockImplementation((key: string) =>
      key === "category" ? "housing" : null,
    );

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    global.fetch = fetchSpy;

    renderWithProviders(<SearchPage />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("category=housing"),
      );
    });
  });

  it("does not fetch when no query or category", () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    renderWithProviders(<SearchPage />);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
