/**
 * Bookmarks v2 — Dual-storage bookmark system
 *
 * Architecture:
 * - Anonymous users: localStorage only (existing behavior preserved)
 * - Signed-in users: localStorage + Supabase (bi-directional merge)
 * - Server API routes use Supabase directly
 * - Client components use this service for transparent sync
 */

import type { AppLanguage } from "./types";
import { createClient } from "./supabase";

// ── Types ──────────────────────────────────────────────────────────────────

export interface BookmarkV2 {
  id?: string; // Supabase ID (undefined for local-only)
  law_key: string;
  law_title: string;
  category: string;
  norm_id?: string;
  norm_title?: string;
  snippet?: string;
  added_at: string;
  folder_id?: string | null;
  synced: boolean; // true if saved to Supabase
}

export interface BookmarkFolder {
  id: string;
  user_id: string;
  name: string;
  description: string;
  category: string;
  incident_date: string | null;
  dispute_value: number;
  status: "pre_action" | "consulting" | "filed" | "in_progress" | "resolved";
  opposing_party: string;
  deadline_date: string | null;
  court_name: string;
  case_number: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFolderInput {
  name: string;
  description?: string;
  category?: string;
  incident_date?: string;
  dispute_value?: number;
  status?: BookmarkFolder["status"];
  opposing_party?: string;
  deadline_date?: string;
  court_name?: string;
  case_number?: string;
  notes?: string;
}

export type UpdateFolderInput = Partial<CreateFolderInput>;

// ── localStorage Keys ──────────────────────────────────────────────────────

const BOOKMARKS_KEY = "glv_bookmarks_v2";
const FOLDERS_KEY = "glv_folders";

// ── localStorage Helpers ───────────────────────────────────────────────────

function getLocalBookmarks(): BookmarkV2[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalBookmarks(bookmarks: BookmarkV2[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

function getLocalFolders(): BookmarkFolder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalFolders(folders: BookmarkFolder[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

// ── Bookmark CRUD ──────────────────────────────────────────────────────────

export function getBookmarks(): BookmarkV2[] {
  return getLocalBookmarks();
}

export async function addBookmark(
  b: Omit<BookmarkV2, "synced">,
): Promise<void> {
  const bookmarks = getLocalBookmarks();
  const exists = bookmarks.some(
    (x) =>
      x.law_key === b.law_key && (x.norm_id || "") === (b.norm_id || ""),
  );
  if (exists) return;

  const newBm: BookmarkV2 = { ...b, synced: false };
  bookmarks.unshift(newBm);
  setLocalBookmarks(bookmarks);

  // Try to sync to Supabase if user is signed in
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("bookmarks").insert({
        user_id: user.id,
        law_key: b.law_key,
        norm_id: b.norm_id || "",
        note: b.snippet || "",
      });
      newBm.synced = true;
      newBm.id = crypto.randomUUID(); // placeholder
      setLocalBookmarks(bookmarks);
    }
  } catch {
    // Silently fail — data is safe in localStorage
  }
}

export async function removeBookmark(
  lawKey: string,
  normId?: string,
): Promise<void> {
  let bookmarks = getLocalBookmarks();
  bookmarks = bookmarks.filter(
    (b) => !(b.law_key === lawKey && (b.norm_id || "") === (normId || "")),
  );
  setLocalBookmarks(bookmarks);

  // Remove from Supabase if signed in
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("law_key", lawKey)
        .eq("norm_id", normId || "");
    }
  } catch {
    // Silent
  }
}

export function isBookmarked(lawKey: string, normId?: string): boolean {
  return getLocalBookmarks().some(
    (b) => b.law_key === lawKey && (b.norm_id || "") === (normId || ""),
  );
}

// ── Folder CRUD (local-first) ──────────────────────────────────────────────

export function getFolders(): BookmarkFolder[] {
  return getLocalFolders();
}

export async function createFolder(
  input: CreateFolderInput,
): Promise<BookmarkFolder> {
  const folder: BookmarkFolder = {
    id: crypto.randomUUID(),
    user_id: "",
    name: input.name,
    description: input.description || "",
    category: input.category || "other",
    incident_date: input.incident_date || null,
    dispute_value: input.dispute_value || 0,
    status: input.status || "pre_action",
    opposing_party: input.opposing_party || "",
    deadline_date: input.deadline_date || null,
    court_name: input.court_name || "",
    case_number: input.case_number || "",
    notes: input.notes || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const folders = getLocalFolders();
  folders.push(folder);
  setLocalFolders(folders);

  // Try to sync to Supabase
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from("bookmark_folders")
        .insert({
          user_id: user.id,
          name: folder.name,
          description: folder.description,
          category: folder.category,
          incident_date: folder.incident_date,
          dispute_value: folder.dispute_value,
          status: folder.status,
          opposing_party: folder.opposing_party,
          deadline_date: folder.deadline_date,
          court_name: folder.court_name,
          case_number: folder.case_number,
          notes: folder.notes,
        })
        .select()
        .single();

      if (!error && data) {
        folder.id = data.id;
        folder.user_id = data.user_id;
        // Update local cache with real ID
        const updated = getLocalFolders();
        const idx = updated.findIndex((f) => f.id === folder.id);
        if (idx >= 0) updated[idx] = folder;
        setLocalFolders(updated);
      }
    }
  } catch {
    // Silent — data is safe in localStorage
  }

  return folder;
}

export async function updateFolder(
  id: string,
  input: UpdateFolderInput,
): Promise<BookmarkFolder | null> {
  const folders = getLocalFolders();
  const idx = folders.findIndex((f) => f.id === id);
  if (idx < 0) return null;

  folders[idx] = {
    ...folders[idx],
    ...input,
    updated_at: new Date().toISOString(),
  };
  setLocalFolders(folders);

  // Try to sync to Supabase
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("bookmark_folders")
        .update(input)
        .eq("id", id)
        .eq("user_id", user.id);
    }
  } catch {
    // Silent
  }

  return folders[idx];
}

export async function deleteFolder(id: string): Promise<void> {
  const folders = getLocalFolders().filter((f) => f.id !== id);
  setLocalFolders(folders);

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("bookmark_folders")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
    }
  } catch {
    // Silent
  }
}

// ── Sync ───────────────────────────────────────────────────────────────────

export async function syncBookmarksToSupabase(): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const local = getLocalBookmarks();
    const unsynced = local.filter((b) => !b.synced);

    if (unsynced.length === 0) return;

    // Push unsynced bookmarks to Supabase
    for (const bm of unsynced) {
      const { error } = await supabase.from("bookmarks").insert({
        user_id: user.id,
        law_key: bm.law_key,
        norm_id: bm.norm_id || "",
        note: bm.snippet || "",
      });
      if (!error) {
        bm.synced = true;
      }
    }
    setLocalBookmarks(local);

    // Pull bookmarks from Supabase (merge)
    const { data: remote } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", user.id);

    if (remote) {
      const merged = [...local];
      for (const r of remote) {
        const exists = merged.some(
          (l) => l.law_key === r.law_key && (l.norm_id || "") === (r.norm_id || ""),
        );
        if (!exists) {
          merged.push({
            id: r.id,
            law_key: r.law_key,
            law_title: r.note || "",
            category: "other",
            norm_id: r.norm_id || undefined,
            added_at: r.created_at,
            synced: true,
          });
        }
      }
      setLocalBookmarks(merged);
    }
  } catch {
    // Silent
  }
}
