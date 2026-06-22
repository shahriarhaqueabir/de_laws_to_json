/**
 * app.js — Boot sequence, tab switching, status polling, and event wiring.
 * This is the entry point that is loaded last. All other modules must be
 * loaded before this file.
 */
"use strict";

// ── Tab Switching ────────────────────────────────────────────────────────────
function setActiveTab(name) {
  activeTab = name;
  const isSearch   = name === 'search';
  const isBrowse   = name === 'browse';
  const isSaved    = name === 'saved';
  const isSettings = name === 'settings';

  const keywordSection = document.getElementById("keyword-section");

  ['search', 'browse', 'saved', 'settings'].forEach(tab => {
    const panel  = document.getElementById(`tab-${tab}`);
    const btn    = document.getElementById(`tab-btn-${tab}`);
    const active = name === tab;
    if (panel) panel.classList.toggle('active', active);
    if (btn)   {
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    }
  });

  if (keywordSection) keywordSection.style.display = isSearch ? '' : 'none';
  if (isSaved)  renderSaved();
  if (isBrowse) {
    vaultPage = 1;
    fetchVaultLaws();
  }
  if (!isBrowse && vaultAbortController) {
    try { vaultAbortController.abort(); } catch (e) { /* ignore */ }
    vaultAbortController = null;
  }
}

// ── Status Polling ────────────────────────────────────────────────────────────
async function pollStatus() {
  const searchBtn   = document.getElementById("search-btn");
  const statusPill  = document.getElementById("status-pill");
  const statusText  = document.getElementById("status-text");
  const indexBanner = document.getElementById("index-banner");
  const progressFill = document.getElementById("progress-fill");
  const indexProgText = document.getElementById("index-progress-text");

  try {
    const r = await fetch("/api/status");
    const d = await r.json();

    if (d.ready) {
      clearInterval(statusInterval);
      indexReady = true;
      indexBanner.style.display  = "none";
      searchBtn.disabled         = false;
      statusPill.className       = "status-pill ready";
      statusText.textContent     = `${d.laws.toLocaleString()} laws indexed`;

      document.getElementById('stats-panel').style.display  = 'block';
      document.getElementById('stat-laws').textContent       = d.laws.toLocaleString();
      document.getElementById('stat-norms').textContent      = d.total_norms.toLocaleString();

      if (d.largest_law) {
        const safeKey = escapeHTML(d.largest_law.key);
        document.getElementById('stat-largest-norms').textContent = d.largest_law.norms.toLocaleString();
        document.getElementById('stat-largest-desc').innerHTML = `
          The <strong>${safeKey}</strong> contains the highest volume of norms.<br>
          <span class="stat-link" onclick='openLawModal(${JSON.stringify(d.largest_law.key)})'>Details anzeigen →</span>
        `;
      }

      renderVaultCategories(d.categories || {});
    } else {
      statusPill.className   = "status-pill building";
      statusText.textContent = "Index wird erstellt…";
      searchBtn.disabled     = true;

      if (d.total > 0) {
        indexBanner.style.display = "block";
        const pct = Math.round((d.indexed / d.total) * 100);
        progressFill.style.width    = pct + "%";
        indexProgText.textContent   = `Indexing ${d.indexed.toLocaleString()} / ${d.total.toLocaleString()} laws…`;
      }

      if (d.total === 0 && d.indexed === 0) {
        clearInterval(statusInterval);
        statusPill.className   = "status-pill error";
        statusText.textContent = "Server nicht erreichbar";
        showNoDataState();
      }
    }
  } catch (e) {
    document.getElementById("status-pill").className       = "status-pill error";
    document.getElementById("status-text").textContent     = "Server nicht erreichbar";
  }
}

function showNoDataState() {
  document.getElementById("results-list").innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📂</div>
      <div class="empty-title">No law data found</div>
      <div class="empty-sub">Run <strong>run_dashboard.bat</strong> first to download and process the laws,<br>then restart this app.</div>
    </div>`;
}

// ── Controller Cleanup ────────────────────────────────────────────────────────
function _cleanupControllers() {
  [['mainAbortController', mainAbortController],
   ['aiAbortController', aiAbortController],
   ['modalAbortController', modalAbortController],
   ['searchAbortController', searchAbortController]
  ].forEach(([, ctrl]) => {
    if (ctrl) { try { ctrl.abort(); } catch (e) { /* ignore */ } }
  });
  mainAbortController = aiAbortController = modalAbortController = searchAbortController = null;
}

// ── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const searchBtn  = document.getElementById("search-btn");
  const queryInput = document.getElementById("query-input");

  // Initial state
  searchBtn.disabled = true;
  if (searchBtn) searchBtn.setAttribute('aria-label', 'Suche starten');

  // Start polling
  statusInterval = setInterval(pollStatus, 1200);
  pollStatus();
  renderHistory();

  // Tab buttons
  document.getElementById('tab-btn-search').addEventListener('click',   () => setActiveTab('search'));
  document.getElementById('tab-btn-browse').addEventListener('click',   () => setActiveTab('browse'));
  document.getElementById('tab-btn-saved').addEventListener('click',    () => setActiveTab('saved'));
  document.getElementById('tab-btn-settings').addEventListener('click', () => setActiveTab('settings'));

  // Search triggers
  searchBtn.addEventListener('click', doSearch);
  queryInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // Shortcut chips
  document.querySelectorAll('.shortcut-chip').forEach(chip => {
    chip.addEventListener('click', () => runQuery(chip.dataset.query));
  });

  // Example & history chips (delegated)
  document.querySelector('.search-wrap')?.addEventListener('click', e => {
    const hChip = e.target.closest('.history-chip');
    if (hChip && hChip.dataset.query) { runQuery(hChip.dataset.query); return; }
    const eChip = e.target.closest('.example-chip');
    if (eChip && eChip.dataset.query) { runQuery(eChip.dataset.query); return; }
    if (e.target.id === 'history-clear-btn') clearHistory();
  });

  // Results list delegated click handler
  const resultsList = document.getElementById("results-list");
  resultsList.addEventListener('click', e => {
    const viewBtn = e.target.closest('.view-btn');
    if (viewBtn) {
      const sectionNum = extractSectionNum(queryInput.value);
      openLawModal(viewBtn.dataset.key, sectionNum);
      return;
    }
    const starBtn = e.target.closest('.star-btn');
    if (starBtn) {
      const key     = starBtn.dataset.key;
      const already = isBookmarked(key);
      if (already) {
        removeBookmark(key);
        setStar(key, false, starBtn);
      } else {
        saveBookmark({
          key,
          title:        starBtn.dataset.title,
          title_en:     starBtn.dataset.titleEn,
          alt_title:    starBtn.dataset.alt,
          last_changed: starBtn.dataset.changed,
          total_norms:  Number(starBtn.dataset.norms),
        });
        setStar(key, true, starBtn);
      }
    }
  });

  // Saved list delegated click handler
  document.getElementById('saved-list').addEventListener('click', e => {
    const viewBtn = e.target.closest('.view-btn');
    if (viewBtn) { openLawModal(viewBtn.dataset.key); return; }

    const starBtn = e.target.closest('.star-btn');
    if (starBtn) {
      removeBookmark(starBtn.dataset.key);
      renderSaved();
      const searchStar = resultsList.querySelector(`.star-btn[data-key="${CSS.escape(starBtn.dataset.key)}"]`);
      if (searchStar) setStar(starBtn.dataset.key, false, searchStar);
    }
  });

  // Clear all bookmarks
  document.getElementById('clear-bookmarks-btn').addEventListener('click', () => {
    _persistBookmarks([]);
    _updateBookmarkBadge();
    resultsList.querySelectorAll('.star-btn.starred').forEach(btn => setStar(btn.dataset.key, false, btn));
    renderSaved();
  });

  // Rebuild Index button
  document.getElementById('btn-rebuild-index')?.addEventListener('click', () => sidebarAdminAction('rebuild'));

  // Cleanup on unload
  window.addEventListener('beforeunload', _cleanupControllers);
});
