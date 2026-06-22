import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bookmarks",
}));

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
  ToastProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("../../lib/bookmarks", () => ({
  getBookmarks: vi.fn().mockReturnValue([]),
  removeBookmark: vi.fn(),
}));

vi.mock("../../lib/bookmarks-v2", () => ({
  getFolders: vi.fn().mockReturnValue([]),
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
  syncBookmarksToSupabase: vi.fn(),
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
    synced: true,
  },
  {
    law_key: "StGB",
    law_title: "Strafgesetzbuch",
    category: "criminal",
    added_at: "2025-01-16",
    synced: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookmarksPage", () => {
  it("empty state shows 'Archives Empty' message", async () => {
    vi.mocked(getBookmarks).mockReturnValue([]);
    render(<BookmarksPage />);

    await waitFor(() => {
      expect(screen.getByText(/No Saved Laws/)).toBeInTheDocument();
    });
  });

  it("populated list shows bookmarks with law key and title", async () => {
    vi.mocked(getBookmarks).mockReturnValue(mockBookmarks);
    render(<BookmarksPage />);

    // Wait for the Ungrouped section heading
    await waitFor(() => {
      expect(screen.getByText("Ungrouped")).toBeInTheDocument();
    });

    // Ungrouped is auto-expanded — law titles should be visible
    expect(screen.getAllByText(/BGB/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Bürgerliches Gesetzbuch/)).toBeInTheDocument();
    expect(screen.getByText(/Strafgesetzbuch/)).toBeInTheDocument();
  });

  it("displays bookmarks grouped under Ungrouped section", async () => {
    vi.mocked(getBookmarks).mockReturnValue(mockBookmarks);
    render(<BookmarksPage />);

    await waitFor(() => {
      expect(screen.getByText("Ungrouped")).toBeInTheDocument();
      expect(screen.getByText(/2 entries/)).toBeInTheDocument();
    });
  });

  it("remove button removes a bookmark from the list", async () => {
    const user = userEvent.setup();
    vi.mocked(getBookmarks).mockReturnValue(mockBookmarks);

    render(<BookmarksPage />);

    // Wait for bookmarks to load and expand
    await waitFor(() => {
      expect(screen.getByText(/Bürgerliches Gesetzbuch/)).toBeInTheDocument();
    });

    // Find the first remove button (aria-label based)
    const removeButtons = screen.getAllByLabelText("Remove bookmark");
    expect(removeButtons.length).toBe(2);

    // Click first one
    await user.click(removeButtons[0]);

    expect(removeBookmark).toHaveBeenCalledWith("BGB", "§ 823");
  });

  it("law links navigate to /laws/{law_key}", async () => {
    vi.mocked(getBookmarks).mockReturnValue(mockBookmarks);
    render(<BookmarksPage />);

    await waitFor(() => {
      const link = screen.getByText(/Bürgerliches Gesetzbuch/).closest("a");
      expect(link).toHaveAttribute("href", "/laws/BGB");
    });
  });

  it("shows New Folder button when empty", async () => {
    vi.mocked(getBookmarks).mockReturnValue([]);
    render(<BookmarksPage />);

    await waitFor(() => {
      expect(screen.getByText(/Create Your First Folder/)).toBeInTheDocument();
    });
  });

  it("shows entries and folders count", async () => {
    vi.mocked(getBookmarks).mockReturnValue(mockBookmarks);
    render(<BookmarksPage />);

    await waitFor(() => {
      expect(screen.getByText(/2 Entries/)).toBeInTheDocument();
      expect(screen.getByText(/0 Folders/)).toBeInTheDocument();
    });
  });
});
