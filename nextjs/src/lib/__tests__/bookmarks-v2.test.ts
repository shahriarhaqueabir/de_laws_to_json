/**
 * Tests for bookmarks-v2.ts — Dual-storage bookmark system
 *
 * Covers:
 * 1. Bookmark CRUD (localStorage)
 * 2. Folder CRUD (localStorage)
 * 3. Supabase sync (via mocked createClient)
 * 4. Edge cases (SSR guards, duplicates, empty states)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getBookmarks,
  addBookmark,
  removeBookmark,
  isBookmarked,
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  syncBookmarksToSupabase,
  type BookmarkV2,
  type CreateFolderInput,
} from "../bookmarks-v2";

// ── Mocks ─────────────────────────────────────────────────────────────────

// Mock localStorage with proper implementations (jsdom's is incomplete)
const mockStore: Record<string, string> = {};

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

// Mock createClient from supabase for async sync testing
const mockFrom = vi.fn();
const mockSupabaseAuth = {
  getUser: vi.fn(),
  getSession: vi.fn(),
};
const mockSupabase = {
  auth: mockSupabaseAuth,
  from: mockFrom,
};

vi.mock("../supabase", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// ── Sample Data ───────────────────────────────────────────────────────────

const sampleBookmark: Omit<BookmarkV2, "synced"> = {
  law_key: "BGB",
  law_title: "Bürgerliches Gesetzbuch",
  category: "civil",
  norm_id: "§ 433",
  norm_title: "Kaufvertrag",
  snippet: "Durch den Kaufvertrag wird...",
  added_at: "2025-01-01T00:00:00.000Z",
  folder_id: null,
};

const sampleFolderInput: CreateFolderInput = {
  name: "My Dismissal Case",
  description: "Documents for my wrongful dismissal case",
  category: "labor",
  incident_date: "2026-05-01",
  dispute_value: 15000,
  status: "pre_action",
  opposing_party: "Employer GmbH",
  deadline_date: "2026-06-15",
  court_name: "Arbeitsgericht Berlin",
  case_number: "5 Ca 1234/24",
  notes: "Wrongful dismissal after 5 years of employment",
};

// ── Helpers ───────────────────────────────────────────────────────────────

function mockSignedIn() {
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: { id: "user-123" } },
    error: null,
  });
}

function mockSignedOut() {
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
}

function makeQueryBuilder(options?: {
  /** Data returned when the chain is awaited (e.g., after .select().eq()) */
  result?: unknown;
  /** Method-level spy overrides (e.g., { insert: mySpy }) */
  overrides?: Record<string, unknown>;
}) {
  const result = options?.result ?? { data: null, error: null };
  const builder = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    /** Make the builder thenable so await resolves to result */
    then: vi.fn((resolve: (v: unknown) => unknown) => resolve(result)),
    ...(options?.overrides ?? {}),
  };
  return builder;
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Clean localStorage
  localStorage.clear();

  // Reset all mocks
  vi.clearAllMocks();

  // Default: user is signed out (local-only mode)
  mockSignedOut();

  // Default mock chain for supabase operations
  mockFrom.mockReturnValue(makeQueryBuilder());
});

// ── 1. Bookmark CRUD ─────────────────────────────────────────────────────

describe("getBookmarks", () => {
  it("returns empty array when nothing stored", () => {
    expect(getBookmarks()).toEqual([]);
  });

  it("returns stored bookmarks", async () => {
    await addBookmark(sampleBookmark);
    const bookmarks = getBookmarks();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].law_key).toBe("BGB");
    expect(bookmarks[0].synced).toBe(false);
  });
});

describe("addBookmark", () => {
  it("stores a bookmark and adds to front of list", async () => {
    await addBookmark(sampleBookmark);
    const bookmarks = getBookmarks();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].law_key).toBe("BGB");
    expect(bookmarks[0].synced).toBe(false);
  });

  it("does not add duplicate (same law_key + norm_id)", async () => {
    await addBookmark(sampleBookmark);
    await addBookmark(sampleBookmark);
    expect(getBookmarks()).toHaveLength(1);
  });

  it("allows same law_key with different norm_id", async () => {
    await addBookmark(sampleBookmark);
    await addBookmark({ ...sampleBookmark, norm_id: "§ 434" });
    expect(getBookmarks()).toHaveLength(2);
  });

  it("handles undefined norm_id in uniqueness check", async () => {
    await addBookmark({ ...sampleBookmark, norm_id: undefined });
    await addBookmark({ ...sampleBookmark, norm_id: undefined });
    expect(getBookmarks()).toHaveLength(1);
  });

  it("tries to sync to Supabase when signed in", async () => {
    mockSignedIn();
    mockFrom.mockReturnValue(makeQueryBuilder());

    await addBookmark(sampleBookmark);
    expect(mockFrom).toHaveBeenCalledWith("bookmarks");
  });

  it("does not fail when Supabase sync errors", async () => {
    mockSignedIn();
    mockFrom.mockImplementation(() => {
      throw new Error("Network error");
    });

    await expect(addBookmark(sampleBookmark)).resolves.toBeUndefined();
    expect(getBookmarks()).toHaveLength(1);
  });
});

describe("removeBookmark", () => {
  it("removes specific bookmark by law_key + norm_id", async () => {
    await addBookmark(sampleBookmark);
    await addBookmark({ ...sampleBookmark, law_key: "StGB", norm_id: "§ 123" });

    // removeBookmark(lawKey, normId) — requires normId to match specific entry
    await removeBookmark("BGB", "§ 433");
    const bookmarks = getBookmarks();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].law_key).toBe("StGB");
  });

  it("removes bookmark with normId filters correctly", async () => {
    await addBookmark(sampleBookmark);
    await addBookmark({ ...sampleBookmark, norm_id: "§ 434" });

    await removeBookmark("BGB", "§ 433");
    expect(getBookmarks()).toHaveLength(1);
    expect(getBookmarks()[0].norm_id).toBe("§ 434");
  });

  it("removes bookmark without norm_id when normId omitted", async () => {
    await addBookmark({ ...sampleBookmark, norm_id: undefined });
    await addBookmark({
      ...sampleBookmark,
      law_key: "StGB",
      norm_id: undefined,
    });

    await removeBookmark("BGB");
    expect(getBookmarks()).toHaveLength(1);
    expect(getBookmarks()[0].law_key).toBe("StGB");
  });

  it("handles removing non-existent bookmark gracefully", async () => {
    await expect(removeBookmark("BGB")).resolves.toBeUndefined();
    expect(getBookmarks()).toHaveLength(0);
  });

  it("tries to delete from Supabase when signed in", async () => {
    mockSignedIn();
    mockFrom.mockReturnValue(makeQueryBuilder());

    await addBookmark({ ...sampleBookmark, norm_id: undefined });
    await removeBookmark("BGB");

    expect(mockFrom).toHaveBeenCalledWith("bookmarks");
  });
});

describe("isBookmarked", () => {
  it("returns true for a bookmarked item", async () => {
    await addBookmark(sampleBookmark);
    expect(isBookmarked("BGB", "§ 433")).toBe(true);
  });

  it("returns true when norm_id omitted and matches norm-less bookmark", async () => {
    await addBookmark({ ...sampleBookmark, norm_id: undefined });
    expect(isBookmarked("BGB")).toBe(true);
  });

  it("returns false for non-bookmarked item", () => {
    expect(isBookmarked("BGB", "§ 999")).toBe(false);
  });

  it("distinguishes between norm_ids on same law", async () => {
    await addBookmark({ ...sampleBookmark, norm_id: "§ 433" });
    expect(isBookmarked("BGB", "§ 433")).toBe(true);
    expect(isBookmarked("BGB", "§ 434")).toBe(false);
  });
});

// ── 2. Folder CRUD ────────────────────────────────────────────────────────

describe("getFolders", () => {
  it("returns empty array when nothing stored", () => {
    expect(getFolders()).toEqual([]);
  });

  it("returns created folders", async () => {
    await createFolder(sampleFolderInput);
    const folders = getFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toBe("My Dismissal Case");
  });
});

describe("createFolder", () => {
  it("creates a folder with all properties", async () => {
    const folder = await createFolder(sampleFolderInput);
    expect(folder.name).toBe("My Dismissal Case");
    expect(folder.category).toBe("labor");
    expect(folder.incident_date).toBe("2026-05-01");
    expect(folder.dispute_value).toBe(15000);
    expect(folder.status).toBe("pre_action");
    expect(folder.opposing_party).toBe("Employer GmbH");
    expect(folder.deadline_date).toBe("2026-06-15");
    expect(folder.court_name).toBe("Arbeitsgericht Berlin");
    expect(folder.case_number).toBe("5 Ca 1234/24");
    expect(folder.notes).toBe("Wrongful dismissal after 5 years of employment");
    expect(folder.created_at).toBeDefined();
    expect(folder.updated_at).toBeDefined();
  });

  it("generates an id for the folder", async () => {
    const folder = await createFolder(sampleFolderInput);
    expect(folder.id).toBeDefined();
    expect(folder.id.length).toBeGreaterThan(0);
  });

  it("uses defaults for missing fields", async () => {
    const folder = await createFolder({ name: "Minimal" });
    expect(folder.name).toBe("Minimal");
    expect(folder.description).toBe("");
    expect(folder.category).toBe("other");
    expect(folder.incident_date).toBeNull();
    expect(folder.dispute_value).toBe(0);
    expect(folder.status).toBe("pre_action");
    expect(folder.opposing_party).toBe("");
    expect(folder.deadline_date).toBeNull();
    expect(folder.court_name).toBe("");
    expect(folder.case_number).toBe("");
    expect(folder.notes).toBe("");
  });

  it("persists folder to localStorage", async () => {
    await createFolder(sampleFolderInput);
    expect(getFolders()).toHaveLength(1);
  });

  it("appends to existing folders", async () => {
    await createFolder(sampleFolderInput);
    await createFolder({ name: "Second Folder" });
    expect(getFolders()).toHaveLength(2);
  });

  it("tries to sync to Supabase when signed in", async () => {
    mockSignedIn();
    mockFrom.mockReturnValue(
      makeQueryBuilder({
        result: { data: { id: "remote-id", user_id: "user-123" }, error: null },
      }),
    );

    await createFolder(sampleFolderInput);
    expect(mockFrom).toHaveBeenCalledWith("bookmark_folders");
  });
});

describe("updateFolder", () => {
  it("updates folder properties", async () => {
    const folder = await createFolder(sampleFolderInput);
    const updated = await updateFolder(folder.id, {
      name: "Updated Case Name",
      dispute_value: 20000,
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("Updated Case Name");
    expect(updated!.dispute_value).toBe(20000);
    expect(updated!.category).toBe("labor");
  });

  it("updates updated_at timestamp", async () => {
    const folder = await createFolder(sampleFolderInput);
    // Small delay so the second timestamp differs
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateFolder(folder.id, { name: "Renamed" });
    expect(updated!.updated_at).not.toBe(folder.updated_at);
  });

  it("returns null for non-existent folder", async () => {
    const result = await updateFolder("non-existent-id", { name: "Nope" });
    expect(result).toBeNull();
  });
});

describe("deleteFolder", () => {
  it("removes folder from storage", async () => {
    const folder = await createFolder(sampleFolderInput);
    expect(getFolders()).toHaveLength(1);

    await deleteFolder(folder.id);
    expect(getFolders()).toHaveLength(0);
  });

  it("does not affect other folders", async () => {
    await createFolder(sampleFolderInput);
    const f2 = await createFolder({ name: "Second" });

    await deleteFolder(f2.id);
    const remaining = getFolders();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe("My Dismissal Case");
  });

  it("handles deleting non-existent folder", async () => {
    await expect(deleteFolder("ghost-id")).resolves.toBeUndefined();
  });
});

// ── 3. Sync Logic ─────────────────────────────────────────────────────────

describe("syncBookmarksToSupabase", () => {
  it("does nothing when user is signed out", async () => {
    await addBookmark(sampleBookmark);

    await syncBookmarksToSupabase();
    expect(getBookmarks()[0].synced).toBe(false);
  });

  it("does nothing when all bookmarks are already synced", async () => {
    mockSignedIn();
    localStorage.setItem(
      "glv_bookmarks_v2",
      JSON.stringify([{ ...sampleBookmark, synced: true }]),
    );

    await syncBookmarksToSupabase();
    expect(mockFrom).not.toHaveBeenCalledWith("bookmarks");
  });

  it("pushes unsynced bookmarks to Supabase", async () => {
    // Add bookmark while signed out so it stays unsynced
    await addBookmark(sampleBookmark);
    mockSignedIn();

    const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(
      makeQueryBuilder({
        result: { data: [], error: null },
        overrides: { insert: insertSpy },
      }),
    );

    await syncBookmarksToSupabase();
    expect(insertSpy).toHaveBeenCalled();
  });

  it("marks pushed bookmarks as synced", async () => {
    mockSignedIn();
    await addBookmark({ ...sampleBookmark, law_key: "BGB" });
    await addBookmark({ ...sampleBookmark, law_key: "StGB" });

    mockFrom.mockReturnValue(
      makeQueryBuilder({
        result: { data: [], error: null },
      }),
    );

    await syncBookmarksToSupabase();
    const bookmarks = getBookmarks();
    expect(bookmarks.every((b) => b.synced)).toBe(true);
  });

  it("merges remote bookmarks not found locally", async () => {
    // Add bookmark while signed out so it stays unsynced
    await addBookmark({ ...sampleBookmark, law_key: "BGB" });
    mockSignedIn();

    mockFrom.mockReturnValue(
      makeQueryBuilder({
        result: {
          data: [
            {
              id: "r1",
              law_key: "StGB",
              norm_id: "§ 123",
              note: "Remote StGB",
              created_at: "2025-06-01T00:00:00Z",
            },
          ],
          error: null,
        },
      }),
    );

    await syncBookmarksToSupabase();
    const merged = getBookmarks();
    expect(merged).toHaveLength(2);
    expect(merged.some((b) => b.law_key === "StGB")).toBe(true);
  });

  it("does not duplicate existing local bookmarks from remote pull", async () => {
    mockSignedIn();
    await addBookmark({ ...sampleBookmark, law_key: "BGB", norm_id: "§ 433" });

    mockFrom.mockReturnValue(
      makeQueryBuilder({
        result: {
          data: [
            {
              id: "r1",
              law_key: "BGB",
              norm_id: "§ 433",
              note: "exists",
              created_at: "2025-01-01T00:00:00Z",
            },
          ],
          error: null,
        },
      }),
    );

    await syncBookmarksToSupabase();
    expect(getBookmarks()).toHaveLength(1);
  });

  it("handles sync error gracefully", async () => {
    mockSignedIn();
    await addBookmark(sampleBookmark);

    mockFrom.mockImplementation(() => {
      throw new Error("Network error");
    });

    await expect(syncBookmarksToSupabase()).resolves.toBeUndefined();
    expect(getBookmarks()).toHaveLength(1);
  });
});

// ── 4. Edge Cases ─────────────────────────────────────────────────────────

describe("bookmarks-v2 edge cases", () => {
  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("glv_bookmarks_v2", "not-valid-json");
    localStorage.setItem("glv_folders", "also-not-json");

    expect(getBookmarks()).toEqual([]);
    expect(getFolders()).toEqual([]);
  });

  it("maintains insertion order (newest first)", async () => {
    await addBookmark({
      ...sampleBookmark,
      law_key: "A",
      added_at: "2025-01-01T00:00:00Z",
    });
    await addBookmark({
      ...sampleBookmark,
      law_key: "B",
      added_at: "2025-06-01T00:00:00Z",
    });
    await addBookmark({
      ...sampleBookmark,
      law_key: "C",
      added_at: "2025-12-01T00:00:00Z",
    });

    const bookmarks = getBookmarks();
    expect(bookmarks[0].law_key).toBe("C");
    expect(bookmarks[1].law_key).toBe("B");
    expect(bookmarks[2].law_key).toBe("A");
  });
});
