import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bookmarks",
}));

// Mock both contexts to simplify
vi.mock("../../components/chat-context", () => ({
  useChat: () => ({
    settings: { language: "en" },
    mode: "basic",
  }),
}));

vi.mock("../../components/auth-context", () => ({
  useAuth: () => ({
    user: null,
    signOut: vi.fn(),
  }),
}));

vi.mock("../../components/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
  ToastProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("../../lib/bookmarks", () => ({
    getBookmarks: vi.fn(),
    removeBookmark: vi.fn(),
}));

import { getBookmarks, removeBookmark } from "../../lib/bookmarks";
import BookmarksPage from "../bookmarks/page";

const mockBookmarks = [
  {
    law_key: "BGB",
    law_title: "Bürgerliches Gesetzbuch",
    category: "housing",
    added_at: "2025-01-15",
    norm_id: "§ 823",
    norm_title: "Schadensersatzpflicht",
    snippet: "Wer vorsätzlich oder fahrlässig...",
  },
  {
    law_key: "StGB",
    law_title: "Strafgesetzbuch",
    category: "criminal",
    added_at: "2025-01-16",
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("BookmarksPage", () => {
  it("empty state shows 'Archives Empty' message", () => {
    (getBookmarks as any).mockReturnValue([]);
    render(<BookmarksPage />);
    expect(screen.getByText(/Archives Empty/)).toBeInTheDocument();
  });

  it("populated list shows bookmarks with law key, title, category", async () => {
    (getBookmarks as any).mockReturnValue(mockBookmarks);
    render(<BookmarksPage />);

    await waitFor(() => {
        expect(screen.getAllByText(/BGB/).length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Bürgerliches Gesetzbuch/)).toBeInTheDocument();
    expect(screen.getByText("housing")).toBeInTheDocument();
  });

  it("remove button updates the list", async () => {
    const user = userEvent.setup();
    (getBookmarks as any).mockReturnValue(mockBookmarks);

    const { rerender } = render(<BookmarksPage />);

    await waitFor(() => {
        expect(screen.getAllByText(/BGB/).length).toBeGreaterThan(0);
    });

    const removeButtons = screen.getAllByTitle("Remove from Archives");

    // Simulate list update on next call
    (getBookmarks as any).mockReturnValue(mockBookmarks.slice(1));

    await user.click(removeButtons[0]);

    rerender(<BookmarksPage />);

    await waitFor(() => {
        expect(screen.queryAllByText(/BGB/).filter(el => el.closest('.premium-card')).length).toBe(0);
    });
  });

  it("law links navigate to /laws/{law_key}", async () => {
    (getBookmarks as any).mockReturnValue(mockBookmarks);
    render(<BookmarksPage />);

    await waitFor(() => {
        const link = screen.getByText(/Bürgerliches Gesetzbuch/).closest("a");
        expect(link).toHaveAttribute("href", "/laws/BGB");
    });
  });

  it("displays registration date for each bookmark", async () => {
    (getBookmarks as any).mockReturnValue(mockBookmarks);
    render(<BookmarksPage />);

    await waitFor(() => {
        expect(screen.getByText(/2025-01-15/)).toBeInTheDocument();
    });
    expect(screen.getByText(/2025-01-16/)).toBeInTheDocument();
  });
});
