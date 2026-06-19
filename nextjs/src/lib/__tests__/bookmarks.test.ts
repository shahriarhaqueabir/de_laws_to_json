import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getBookmarks,
  addBookmark,
  removeBookmark,
  isBookmarked,
} from "../bookmarks";
import type { Bookmark } from "../bookmarks";

const sampleBookmark: Bookmark = {
  law_key: "BGB",
  law_title: "Bürgerliches Gesetzbuch",
  category: "civil",
  norm_id: "§ 433",
  norm_title: "Kaufvertrag",
  snippet:
    "Durch den Kaufvertrag wird der Verkäufer einer Sache verpflichtet...",
  added_at: "2025-01-01T00:00:00.000Z",
};

// Mock localStorage with proper implementations
const mockStore: Record<string, string> = {};

beforeEach(() => {
  // Clear the mock store
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);

  // Set up localStorage mock
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

describe("getBookmarks", () => {
  it("returns empty array when nothing stored", () => {
    expect(getBookmarks()).toEqual([]);
  });

  it("returns empty array when window is undefined (SSR guard)", () => {
    const origWindow = globalThis.window;
    // @ts-expect-error simulating server-side rendering where window is undefined
    delete globalThis.window;
    try {
      expect(getBookmarks()).toEqual([]);
    } finally {
      globalThis.window = origWindow;
    }
  });
});

describe("addBookmark", () => {
  it("stores a bookmark and adds to the front of the list", () => {
    addBookmark(sampleBookmark);

    const bookmarks = getBookmarks();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].law_key).toBe("BGB");
    expect(bookmarks[0].norm_id).toBe("§ 433");
  });

  it("does not add duplicate (same law_key + norm_id)", () => {
    addBookmark(sampleBookmark);
    addBookmark(sampleBookmark);

    expect(getBookmarks()).toHaveLength(1);
  });

  it("allows adding the same law_key with a different norm_id", () => {
    addBookmark(sampleBookmark);
    addBookmark({
      ...sampleBookmark,
      norm_id: "§ 434",
      norm_title: "Kaufvertrag 2",
    });

    expect(getBookmarks()).toHaveLength(2);
  });
});

describe("removeBookmark", () => {
  it("removes specific bookmark by law_key only", () => {
    // Bookmark without norm_id — only matches on law_key
    const noNormBGB: Bookmark = {
      law_key: "BGB",
      law_title: "Bürgerliches Gesetzbuch",
      category: "civil",
      added_at: "2025-01-01T00:00:00.000Z",
    };
    addBookmark(noNormBGB);
    addBookmark({ ...sampleBookmark, law_key: "StGB", norm_id: "§ 123" });

    removeBookmark("BGB");

    const bookmarks = getBookmarks();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].law_key).toBe("StGB");
  });

  it("removes with normId filters correctly", () => {
    addBookmark(sampleBookmark);
    addBookmark({ ...sampleBookmark, norm_id: "§ 434" });

    removeBookmark("BGB", "§ 433");

    const bookmarks = getBookmarks();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].norm_id).toBe("§ 434");
  });
});

describe("isBookmarked", () => {
  it("returns true for a bookmarked item", () => {
    addBookmark(sampleBookmark);
    expect(isBookmarked("BGB", "§ 433")).toBe(true);
  });

  it("returns true even without normId when law_key matches", () => {
    addBookmark({ ...sampleBookmark, norm_id: undefined });
    expect(isBookmarked("BGB")).toBe(true);
  });

  it("returns false for non-bookmarked item", () => {
    expect(isBookmarked("BGB", "§ 999")).toBe(false);
  });
});
