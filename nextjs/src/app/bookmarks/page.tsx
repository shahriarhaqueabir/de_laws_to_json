"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bookmark,
  Trash2,
  FolderPlus,
  FolderOpen,
  FolderClosed,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
} from "lucide-react";
import { getBookmarks, removeBookmark } from "../../lib/bookmarks";
import {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  syncBookmarksToSupabase,
  type BookmarkFolder,
  type BookmarkV2,
} from "../../lib/bookmarks-v2";
import FolderModal from "../../components/folder-modal";
import type { FolderFormData } from "../../components/folder-modal";

// ── Group Bookmarks into Folders ────────────────────────────────────────────

interface FolderGroup {
  folder: BookmarkFolder | null; // null = ungrouped
  bookmarks: BookmarkV2[];
}

function groupBookmarksByFolder(
  bookmarks: BookmarkV2[],
  folders: BookmarkFolder[],
): FolderGroup[] {
  const groups: FolderGroup[] = [];
  const folderMap = new Map(folders.map((f) => [f.id, f]));

  // Group bookmarks by folder
  const grouped = new Map<string | null, BookmarkV2[]>();
  for (const bm of bookmarks) {
    const key = bm.folder_id || null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(bm);
  }

  // Build groups in folder order
  for (const folder of folders) {
    const bms = grouped.get(folder.id) || [];
    if (bms.length > 0 || true) {
      // show folders even when empty
      groups.push({ folder, bookmarks: bms });
    }
  }

  // Ungrouped bookmarks (no folder)
  const ungrouped = grouped.get(null) || [];
  if (ungrouped.length > 0) {
    groups.push({ folder: null, bookmarks: ungrouped });
  }

  return groups;
}

// ── Format dispute value as EUR ─────────────────────────────────────────────

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkV2[]>([]);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<
    (FolderFormData & { id: string }) | null
  >(null);
  const [loading, setLoading] = useState(true);

  // Load data from localStorage and sync Supabase
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try to sync from Supabase if signed in
        await syncBookmarksToSupabase();

        if (cancelled) return;
        const bms = getBookmarks() as BookmarkV2[];
        const flds = getFolders();
        setBookmarks(bms);
        setFolders(flds);

        // Auto-expand folders that have bookmarks + ungrouped section
        const folderIds = flds.map((f) => f.id);
        const hasBookmarks = new Set(
          bms.filter((b) => b.folder_id).map((b) => b.folder_id),
        );
        const toExpand = new Set(
          folderIds.filter((id) => hasBookmarks.has(id)),
        );
        // Auto-expand ungroupped if there are bookmarks without folders
        const hasUngrouped = bms.some((b) => !b.folder_id);
        if (hasUngrouped) toExpand.add("ungrouped");
        setExpandedFolders(toExpand);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRemoveBookmark = async (bm: BookmarkV2) => {
    await removeBookmark(bm.law_key, bm.norm_id);
    // Optimistic update
    setBookmarks((prev) =>
      prev.filter(
        (b) =>
          !(
            b.law_key === bm.law_key && (b.norm_id || "") === (bm.norm_id || "")
          ),
      ),
    );
  };

  const handleCreateFolder = async (data: FolderFormData) => {
    await createFolder({
      name: data.name,
      description: data.description,
      category: data.category,
      incident_date: data.incident_date || undefined,
      dispute_value: data.dispute_value,
      status: data.status,
      opposing_party: data.opposing_party || undefined,
      deadline_date: data.deadline_date || undefined,
      court_name: data.court_name || undefined,
      case_number: data.case_number || undefined,
      notes: data.notes || undefined,
    });
    setFolders(getFolders());
  };

  const handleUpdateFolder = async (data: FolderFormData) => {
    if (!editingFolder) return;
    await updateFolder(editingFolder.id, {
      name: data.name,
      description: data.description || undefined,
      category: data.category || undefined,
      incident_date: data.incident_date || undefined,
      dispute_value: data.dispute_value || undefined,
      status: data.status || undefined,
      opposing_party: data.opposing_party || undefined,
      deadline_date: data.deadline_date || undefined,
      court_name: data.court_name || undefined,
      case_number: data.case_number || undefined,
      notes: data.notes || undefined,
    });
    setFolders(getFolders());
    setEditingFolder(null);
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("Delete this folder and remove all bookmarks from it?"))
      return;
    await deleteFolder(id);
    setFolders(getFolders());
    // Refresh bookmarks (they lose folder_id)
    setBookmarks(getBookmarks() as BookmarkV2[]);
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Group Data ────────────────────────────────────────────────────────────

  const groups = groupBookmarksByFolder(bookmarks, folders);
  const totalBookmarks = bookmarks.length;
  const totalFolders = folders.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent max-w-5xl mx-auto px-6 py-40 text-center">
        <div className="animate-pulse">
          <div className="w-20 h-20 mx-auto mb-10 bg-white/5" />
          <div className="h-4 w-48 mx-auto bg-white/5 mb-4" />
          <div className="h-8 w-64 mx-auto bg-white/5 mb-8" />
        </div>
      </div>
    );
  }

  if (totalBookmarks === 0 && totalFolders === 0) {
    return (
      <div className="min-h-screen bg-transparent max-w-4xl mx-auto px-6 py-40 text-center">
        <div className="w-20 h-20 border border-white/5 bg-white/[0.02] flex items-center justify-center mx-auto mb-10 group">
          <Bookmark className="w-8 h-8 text-zinc-600 group-hover:text-accent-gold transition-colors duration-500" />
        </div>
        <p className="monumental-type opacity-40 mb-4">No Bookmarks</p>
        <h1 className="text-5xl font-serif font-bold text-white mb-8 tracking-tight">
          No Saved Laws
        </h1>
        <p className="text-xl text-zinc-500 mb-16 max-w-xl mx-auto legal-text italic font-serif">
          Bookmark laws to save them here.
        </p>

        <div className="glass-panel p-16 border-white/5 max-w-2xl mx-auto">
          <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px] mb-6">
            Browse laws and bookmark them to save them here. Create folders to
            organize your research.
          </p>
          <button
            onClick={() => setShowFolderModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30 transition-colors border border-accent-gold/20"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Create Your First Folder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent max-w-5xl mx-auto px-6 py-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-16 pb-8 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="p-3 border border-accent-gold/20 bg-accent-gold/5">
            <Bookmark className="w-6 h-6 text-accent-gold" />
          </div>
          <div>
            <p className="monumental-type opacity-40 mb-1">Saved Statutes</p>
            <h1 className="text-4xl font-serif font-bold text-white tracking-tight">
              My Bookmarks
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setEditingFolder(null);
              setShowFolderModal(true);
            }}
            className="flex items-center gap-2 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30 transition-colors border border-accent-gold/20"
          >
            <Plus className="w-3.5 h-3.5" />
            New Folder
          </button>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">
            {totalBookmarks} Entries · {totalFolders} Folders
          </span>
        </div>
      </div>

      {/* Folder List */}
      {groups.length === 0 && bookmarks.length > 0 && (
        <div className="text-center py-16">
          <p className="text-zinc-500">
            All bookmarks are organized into folders. Create a folder to get
            started.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group) => {
          const isFolder = group.folder !== null;
          const folderId = group.folder?.id || "ungrouped";
          const isExpanded = expandedFolders.has(folderId);

          return (
            <div
              key={folderId}
              className="glass-panel border border-white/5 overflow-hidden"
            >
              {/* Folder Header */}
              <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <button
                  onClick={() => toggleFolder(folderId)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  {isFolder ? (
                    isExpanded ? (
                      <FolderOpen className="w-5 h-5 text-accent-gold flex-shrink-0" />
                    ) : (
                      <FolderClosed className="w-5 h-5 text-accent-gold/60 flex-shrink-0" />
                    )
                  ) : (
                    <Bookmark className="w-5 h-5 text-zinc-600 flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <span className="font-serif font-bold text-white text-lg">
                      {isFolder ? group.folder!.name : "Ungrouped"}
                    </span>
                    <span className="ml-3 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                      {group.bookmarks.length} entries
                    </span>

                    {isFolder && group.folder!.description && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">
                        {group.folder!.description}
                      </p>
                    )}
                  </div>

                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-zinc-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-600" />
                  )}
                </button>

                {/* Folder Actions */}
                {isFolder && (
                  <div className="relative flex items-center gap-1 ml-4">
                    {group.folder!.dispute_value > 0 && (
                      <span className="text-[9px] font-bold px-2 py-1 bg-white/5 text-zinc-400">
                        {formatEur(group.folder!.dispute_value)}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        const f = group.folder!;
                        setEditingFolder({
                          id: f.id,
                          name: f.name,
                          description: f.description,
                          category: f.category,
                          incident_date: f.incident_date || "",
                          dispute_value: f.dispute_value,
                          status: f.status,
                          opposing_party: f.opposing_party,
                          deadline_date: f.deadline_date || "",
                          court_name: f.court_name,
                          case_number: f.case_number,
                          notes: f.notes,
                        });
                        setShowFolderModal(true);
                      }}
                      className="p-2 text-zinc-600 hover:text-accent-gold transition-colors"
                      title="Edit folder"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(group.folder!.id)}
                      className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                      title="Delete folder"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded Bookmark List */}
              {isExpanded && group.bookmarks.length > 0 && (
                <div className="border-t border-white/5">
                  {group.bookmarks.map((bm, idx) => (
                    <div
                      key={`${bm.law_key}-${bm.norm_id || ""}-${idx}`}
                      className="flex items-start justify-between gap-6 px-6 py-5 border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors group/item"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-accent-gold/60">
                            {bm.category}
                          </span>
                          {bm.norm_id && (
                            <span className="text-[9px] font-mono font-black bg-white/5 text-zinc-400 border border-white/10 px-2 py-0.5">
                              Section {bm.norm_id}
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/laws/${bm.law_key}`}
                          className="text-lg font-serif font-bold text-white hover:text-accent-gold-bright transition-colors duration-500 block leading-tight"
                        >
                          <span className="text-accent-gold/40 mr-2">
                            {bm.law_key}
                          </span>
                          {bm.law_title}
                        </Link>

                        {bm.norm_title && (
                          <p className="text-sm text-zinc-500 font-serif italic mt-1.5 opacity-60">
                            {bm.norm_title}
                          </p>
                        )}

                        {bm.snippet && (
                          <p className="legal-text text-zinc-400 mt-3 line-clamp-2 italic bg-white/[0.02] p-3 border-l border-accent-gold/20 text-xs">
                            {bm.snippet}
                          </p>
                        )}

                        <p className="text-[7px] font-black uppercase tracking-[0.4em] text-zinc-700 mt-4">
                          Archived {bm.added_at}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRemoveBookmark(bm)}
                        className="p-2 text-zinc-800 hover:text-red-900 transition-all duration-500 active:scale-90 group-hover/item:text-zinc-600 flex-shrink-0"
                        aria-label="Remove bookmark"
                        title="Remove bookmark"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty folder state */}
              {isExpanded && group.bookmarks.length === 0 && isFolder && (
                <div className="px-6 py-10 text-center border-t border-white/5">
                  <p className="text-zinc-600 text-sm italic">
                    Bookmark laws from the vault and they will appear here.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Folder Modal — Create or Edit */}
      <FolderModal
        isOpen={showFolderModal}
        onClose={() => {
          setShowFolderModal(false);
          setEditingFolder(null);
        }}
        onSave={editingFolder ? handleUpdateFolder : handleCreateFolder}
        initialData={editingFolder || undefined}
        title={editingFolder ? "Edit Folder" : "New Case Folder"}
      />
    </div>
  );
}
