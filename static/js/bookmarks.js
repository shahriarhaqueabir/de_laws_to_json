/**
 * bookmarks.js — Bookmark (saved laws) CRUD using localStorage.
 */
"use strict";

const BOOKMARKS_KEY = 'glsd_bookmarks';

function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]'); }
  catch { return []; }
}

function _persistBookmarks(list) {
  try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list)); }
  catch { /* quota exceeded — silent */ }
}

function isBookmarked(key) {
  return loadBookmarks().some(b => b.key === key);
}

function saveBookmark(entry) {
  // entry: {key, title, alt_title, last_changed, total_norms}
  const list = loadBookmarks().filter(b => b.key !== entry.key);
  list.unshift(entry);
  _persistBookmarks(list);
  _updateBookmarkBadge();
}

function removeBookmark(key) {
  _persistBookmarks(loadBookmarks().filter(b => b.key !== key));
  _updateBookmarkBadge();
}

function _updateBookmarkBadge() {
  const n = loadBookmarks().length;
  const el = document.getElementById('bookmark-count');
  if (el) el.textContent = n || '0';
}

// ── Set star visual state ────────────────────────────────────────────────────
function setStar(key, starred, btn) {
  btn.textContent  = starred ? '★' : '☆';
  btn.title        = starred ? 'Lesezeichen entfernen' : 'Dieses Gesetz speichern';
  btn.setAttribute('aria-label', starred ? 'Lesezeichen entfernen' : 'Dieses Gesetz speichern');
  btn.classList.toggle('starred', starred);
}

// ── Render the Saved tab ─────────────────────────────────────────────────────
function renderSaved() {
  const list       = loadBookmarks();
  const savedList  = document.getElementById('saved-list');
  const savedCount = document.getElementById('saved-count');

  if (list.length) {
    savedCount.innerHTML = `<strong>${list.length}</strong> gespeichert${list.length === 1 ? 'es' : 'e'} Gesetz${list.length === 1 ? '' : 'e'}`;
  } else {
    savedCount.innerHTML = '';
  }

  if (!list.length) {
    savedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">★</div>
        <div class="empty-title">Noch keine Gesetze gespeichert</div>
        <div class="empty-sub">Klicken Sie auf den ☆-Stern in einem Suchergebnis, um ihn hier anzupinnen.</div>
      </div>`;
    return;
  }

  savedList.innerHTML = '';
  list.forEach((law, i) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = `${i * 40}ms`;
    const titleTargetId = `saved-title-en-${law.key.replace(/[^\w]/g, '-')}`;

    card.innerHTML = `
      <div class="card-top">
        <div class="law-badge">${escapeHTML(law.key)}</div>
        <div class="law-info">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="law-title" id="${titleTargetId}" data-original-de="${escapeHTML(law.title || 'Unbenannt')}">${escapeHTML(law.title || 'Unbenannt')}</div>
            <div class="dict-toggles" style="display:inline-flex;">
              <button class="dict-toggle-btn active" data-target="${titleTargetId}" data-lang="de">DE</button>
              <button class="dict-toggle-btn" data-target="${titleTargetId}" data-lang="en">EN</button>
            </div>
          </div>
          <div class="law-meta">
            ${law.alt_title    ? `<span>${escapeHTML(law.alt_title)}</span>` : ''}
            ${law.last_changed ? `<span>Gültig: ${formatDate(law.last_changed)}</span>` : ''}
            <span>${law.total_norms} Normen</span>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="star-btn starred" data-key="${escapeHTML(law.key)}" aria-label="Lesezeichen entfernen" title="Lesezeichen entfernen">★</button>
        <button class="view-btn" data-key="${escapeHTML(law.key)}" aria-label="Ansicht ${escapeHTML(law.key)}">Normen anzeigen →</button>
      </div>`;
    savedList.appendChild(card);
  });
}
