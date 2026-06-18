export interface Bookmark {
  law_key: string;
  law_title: string;
  category: string;
  norm_id?: string;
  norm_title?: string;
  snippet?: string;
  added_at: string;
}

const STORAGE_KEY = 'glv_bookmarks';

export function getBookmarks(): Bookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function addBookmark(b: Bookmark): void {
  const bookmarks = getBookmarks();
  const exists = bookmarks.some(
    (x) => x.law_key === b.law_key && (x.norm_id || '') === (b.norm_id || '')
  );
  if (exists) return;
  bookmarks.unshift(b);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function removeBookmark(lawKey: string, normId?: string): void {
  let bookmarks = getBookmarks();
  bookmarks = bookmarks.filter(
    (b) => !(b.law_key === lawKey && (b.norm_id || '') === (normId || ''))
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function isBookmarked(lawKey: string, normId?: string): boolean {
  return getBookmarks().some(
    (b) => b.law_key === lawKey && (b.norm_id || '') === (normId || '')
  );
}
