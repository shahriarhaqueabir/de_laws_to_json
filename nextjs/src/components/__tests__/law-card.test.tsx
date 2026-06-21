import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LawSearchResult } from "../../lib/types";

const mockToast = vi.fn();
let mockStore: Record<string, boolean> = {};

// Mock the auth context to return no user (anonymous)
vi.mock("../auth-context", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock("../../lib/bookmarks-v2", () => ({
  isBookmarked: vi.fn((lawKey: string) => mockStore[lawKey] ?? false),
  addBookmark: vi.fn(async ({ law_key }: { law_key: string }) => {
    mockStore[law_key] = true;
  }),
  removeBookmark: vi.fn(async (lawKey: string) => {
    delete mockStore[lawKey];
  }),
}));

vi.mock("../toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import LawCard from "../law-card";

const mockLaw: LawSearchResult = {
  key: "BGB",
  title: "Bürgerliches Gesetzbuch",
  category: "Zivilrecht",
  relevance: 92,
  normHits: 5,
  relevantNorms: [
    {
      normId: "§ 823",
      title: "Schadensersatzpflicht",
      content: "Wer vorsätzlich oder fahrlässig das Leben...",
    },
    {
      normId: "§ 249",
      title: "Art und Umfang des Schadensersatzes",
      content: "Wer zum Schadensersatz verpflichtet ist...",
    },
    {
      normId: "§ 433",
      title: "Vertragliche Pflichten beim Kauf",
      content: "Durch den Kaufvertrag wird der Verkäufer...",
    },
  ],
};

const mockLawFewNorms: LawSearchResult = {
  ...mockLaw,
  relevantNorms: [
    {
      normId: "§ 1",
      title: "Anwendungsbereich",
      content: "Dieses Gesetz gilt für...",
    },
  ],
};

beforeEach(() => {
  mockStore = {};
  mockToast.mockClear();
  // Provide a mock for localStorage
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
  });
});

describe("LawCard", () => {
  it("renders law key, title, category, and relevance percentage", () => {
    render(<LawCard law={mockLaw} />);
    expect(screen.getByText("BGB")).toBeInTheDocument();
    expect(screen.getByText("Bürgerliches Gesetzbuch")).toBeInTheDocument();
    expect(screen.getByText("Zivilrecht")).toBeInTheDocument();
    expect(screen.getByText(/92% Match/)).toBeInTheDocument();
  });

  it("shows norm hits count", () => {
    render(<LawCard law={mockLaw} />);
    expect(screen.getByText(/5 Relevant Sections/)).toBeInTheDocument();
  });

  it("renders relevant norms list", () => {
    render(<LawCard law={mockLaw} />);
    expect(screen.getByText(/Section § 823/)).toBeInTheDocument();
    expect(screen.getByText(/Section § 249/)).toBeInTheDocument();
    expect(screen.getByText(/Section § 433/)).toBeInTheDocument();
  });

  it("renders norm content text", () => {
    render(<LawCard law={mockLaw} />);
    expect(
      screen.getByText(/Wer vorsätzlich oder fahrlässig/),
    ).toBeInTheDocument();
  });

  it("handles empty norms gracefully", () => {
    const lawNoNorms: LawSearchResult = {
      ...mockLaw,
      relevantNorms: [],
      normHits: 0,
    };
    const { container } = render(<LawCard law={lawNoNorms} />);
    // Should not crash and should still render law info
    expect(screen.getByText("BGB")).toBeInTheDocument();
    expect(screen.getByText("0 Relevant Sections")).toBeInTheDocument();
  });

  it("bookmark button toggles from add to remove on click", async () => {
    const user = userEvent.setup();
    render(<LawCard law={mockLaw} />);

    // Initially not bookmarked — shows BookmarkPlus icon (add)
    const bookmarkBtn = screen.getByTitle("Add bookmark");
    expect(bookmarkBtn).toBeInTheDocument();

    // Click to add bookmark
    await user.click(bookmarkBtn);

    // Now should show BookmarkCheck (remove)
    expect(screen.getByTitle("Remove bookmark")).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      "Saved locally. Sign in to sync bookmarks.",
      "info",
    );
  });

  it("bookmark toggle calls removeBookmark and shows info toast", async () => {
    const user = userEvent.setup();
    // Pre-set bookmarked state
    mockStore["BGB"] = true;

    render(<LawCard law={mockLaw} />);

    const bookmarkBtn = screen.getByTitle("Remove bookmark");
    await user.click(bookmarkBtn);

    expect(screen.getByTitle("Add bookmark")).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith("Bookmark removed", "info");
  });

  it('"View full law" link points to /laws/{key}', () => {
    render(<LawCard law={mockLaw} />);
    const fullLawLink = screen.getByRole("link", {
      name: /Detailed Examination/i,
    });
    expect(fullLawLink).toHaveAttribute("href", "/laws/BGB");
  });

  it("law title links to /laws/{key}", () => {
    render(<LawCard law={mockLaw} />);
    const titleLink = screen.getByText("Bürgerliches Gesetzbuch").closest("a");
    expect(titleLink).toHaveAttribute("href", "/laws/BGB");
  });

  it("shows 'Source: Bundesamt für Justiz'", () => {
    render(<LawCard law={mockLaw} />);
    expect(screen.getByText(/Bundesamt für Justiz/)).toBeInTheDocument();
  });
});
