/**
 * search.js — Search query logic, history, keyword pills, and result rendering.
 */
"use strict";

// ── Search History ─────────────────────────────────────────────────────────
const HISTORY_KEY = 'glsd_search_history';
const HISTORY_MAX = 10;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveToHistory(query) {
  let history = loadHistory().filter(q => q !== query);
  history.unshift(query);
  if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }
  catch { /* silently ignore */ }
  renderHistory();
}

function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
  renderHistory();
}

function renderHistory() {
  const history        = loadHistory();
  const historySection = document.getElementById('history-section');
  const historyChips   = document.getElementById('history-chips');
  const examplesDiv    = document.getElementById('examples');

  if (!history.length) {
    historySection.style.display = 'none';
    examplesDiv.style.display    = 'flex';
    return;
  }

  historyChips.innerHTML = '';
  history.forEach(q => {
    const chip = document.createElement('span');
    chip.className = 'history-chip';
    chip.textContent = q;
    chip.dataset.query = q;
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-label', `Search again: ${q}`);
    chip.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); runQuery(q); }
    });
    historyChips.appendChild(chip);
  });

  historySection.style.display = 'block';
  examplesDiv.style.display    = 'none';
}

// ── Keyword Pills ──────────────────────────────────────────────────────────
function renderKeywords(original, german) {
  const keywordSection = document.getElementById("keyword-section");
  const keywordPills   = document.getElementById("keyword-pills");
  if (!original.length && !german.length) {
    keywordSection.style.display = "none";
    return;
  }
  keywordSection.style.display = "block";
  keywordPills.innerHTML = "";
  for (const k of original) {
    const el = document.createElement("span");
    el.className = "kw-pill original";
    el.textContent = k;
    keywordPills.appendChild(el);
  }
  for (const k of german) {
    const el = document.createElement("span");
    el.className = "kw-pill german";
    el.textContent = k;
    keywordPills.appendChild(el);
  }
}

// ── Entry Points ───────────────────────────────────────────────────────────
function runQuery(q) {
  if (!q || !q.trim()) return;
  document.getElementById("query-input").value = q.trim();
  doSearch();
}

async function doSearch() {
  const queryInput  = document.getElementById("query-input");
  const searchBtn   = document.getElementById("search-btn");
  const resultsList = document.getElementById("results-list");
  const resultsHeader = document.getElementById("results-header");
  const keywordSection = document.getElementById("keyword-section");

  let q = queryInput.value.trim();
  if (!q) return;
  if (!indexReady) return;

  let targetCategory = '';
  if (q.startsWith('#')) {
    const spaceIdx = q.indexOf(' ');
    if (spaceIdx > 0) {
      targetCategory = q.substring(1, spaceIdx).toLowerCase();
      q = q.substring(spaceIdx + 1).trim();
    } else {
      targetCategory = q.substring(1).toLowerCase();
      q = '';
    }
  }

  saveToHistory(queryInput.value.trim());
  searchBtn.disabled = true;
  const originalBtnHTML = searchBtn.innerHTML;
  searchBtn.innerHTML = '<div class="spinner-small"></div>';

  // Skeleton
  resultsList.innerHTML = new Array(3).fill(`
    <div class="sk-card">
      <div class="skeleton sk-row wide"></div>
      <div class="skeleton sk-row mid"></div>
      <div class="skeleton sk-row" style="width:80%;margin-top:16px"></div>
      <div class="skeleton sk-row short" style="margin-top:6px"></div>
    </div>`).join("");
  resultsHeader.style.display  = "none";
  keywordSection.style.display = "none";

  try {
    if (searchAbortController) {
      try { searchAbortController.abort(); } catch (e) { /* ignore */ }
      searchAbortController = null;
    }
    searchAbortController = new AbortController();

    const resp = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, category: targetCategory }),
      signal: searchAbortController.signal,
    });
    if (resp.status === 0) throw new Error('Request aborted');
    if (resp.status === 429) {
      const d  = await resp.json().catch(() => ({}));
      const ra = resp.headers.get('Retry-After');
      const wait = ra ? ` Retry after ${ra}s.` : '';
      safeSetHTML(resultsList, `<div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">Zu viele Anfragen</div><div class="empty-sub">Sie werden vorübergehend rate-limited.${escapeHTML(d.error || '')}${escapeHTML(wait)}</div></div>`);
      return;
    }
    const data = await resp.json();

    currentKeywords    = data.keywords || [];
    currentGermanTerms = data.german_terms || [];

    renderKeywords(currentKeywords, currentGermanTerms);
    setActiveTab('search');
    await renderResults(data.results || [], currentGermanTerms);
    triggerMainAIChat(q, data.results || []);

  } catch (e) {
    console.error("Search Error:", e);
    resultsList.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Search failed</div><div class="empty-sub">Could not reach the server or index error.</div></div>`;
  } finally {
    searchBtn.disabled  = false;
    searchBtn.innerHTML = originalBtnHTML;
  }
}

// ── Render Results ──────────────────────────────────────────────────────────
async function renderResults(results, terms) {
  const resultsList   = document.getElementById("results-list");
  const resultsHeader = document.getElementById("results-header");
  const resultsCount  = document.getElementById("results-count");
  const queryInput    = document.getElementById("query-input");

  if (!results.length) {
    resultsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Keine Gesetze gefunden</div>
        <div class="empty-sub">Versuchen Sie andere Suchbegriffe oder formulieren Sie Ihre Situation neu.</div>
      </div>`;
    resultsHeader.style.display = 'none';
    return;
  }

  resultsHeader.style.display = 'flex';
  resultsCount.innerHTML = `Gefunden <strong>${results.length}</strong> relevantes Gesetz${results.length !== 1 ? 'e' : ''}`;
  resultsList.innerHTML  = '';
  const sectionNum = extractSectionNum(queryInput.value);

  for (let i = 0; i < results.length; i++) {
    const law    = results[i];
    const card   = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = `${i * 50}ms`;

    const starred          = isBookmarked(law.key);
    const hasCitationMatch = sectionNum && law.relevance >= 80;
    const titleTargetId    = `title-en-${law.key.replace(/[^\w]/g, '-')}`;

    card.innerHTML = `
  <div class="card-top">
    <div class="law-badge">
      ${escapeHTML(law.key)}
      ${hasCitationMatch ? `<span class="citation-mode-badge" style="display:inline-block">§ ${sectionNum}</span>` : ''}
    </div>
    <div class="law-info">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div class="law-title" id="${titleTargetId}" data-original-de="${escapeHTML(law.title || 'Unbenannt')}">${escapeHTML(law.title || 'Unbenannt')}</div>
        <div class="dict-toggles" style="display:inline-flex;">
          <button class="dict-toggle-btn active" data-target="${titleTargetId}" data-lang="de">DE</button>
          <button class="dict-toggle-btn" data-target="${titleTargetId}" data-lang="en">EN</button>
        </div>
      </div>
      <div class="cyborg-badges" style="display:flex; gap:6px; margin: 6px 0;">
        <span class="badge-juris" title="Gerichtsbarkeit">${escapeHTML(law.jurisdiction)}</span>
        <span class="badge-auth" title="Rechtsebene">${escapeHTML(law.authority)}</span>
        <span class="badge-status" data-status="${law.status.toLowerCase()}">${escapeHTML(law.status)}</span>
      </div>
      <div class="law-meta">
        ${law.alt_title    ? `<span>${escapeHTML(law.alt_title)}</span>` : ''}
        ${law.last_changed ? `<span>Gültig: ${formatDate(law.last_changed)}</span>` : ''}
        <span>${law.total_norms} Normen</span>
      </div>
    </div>
    <div class="relevance-wrap">
      <div class="relevance-pct">${law.relevance}%</div>
      <div class="relevance-bar"><div class="relevance-fill" style="width:${law.relevance}%"></div></div>
    </div>
  </div>
  ${law.matched_terms && law.matched_terms.length > 0 ? `
  <div class="matched-terms-box">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
    Matches: ${law.matched_terms.map(t => `<span class="term-tag">${escapeHTML(t)}</span>`).join(' ')}
  </div>` : ''}
  <div class="card-footer">
    <div style="display:flex;gap:8px;align-items:center">
      <button class="star-btn${starred ? ' starred' : ''}" data-key="${escapeHTML(law.key)}"
        data-title="${escapeHTML(law.title || '')}"
        data-title-en=""
        data-alt="${escapeHTML(law.alt_title || '')}"
        data-changed="${escapeHTML(law.last_changed || '')}"
        data-norms="${law.total_norms}"
        aria-label="${starred ? 'Lesezeichen entfernen' : 'Dieses Gesetz speichern'}"
        title="${starred ? 'Lesezeichen entfernen' : 'Dieses Gesetz speichern'}">${starred ? '★' : '☆'}</button>
      <button class="view-btn" data-key="${escapeHTML(law.key)}" aria-label="Ansicht ${escapeHTML(law.key)}">
        Normen anzeigen →
      </button>
    </div>
  </div>`;
    resultsList.appendChild(card);
  }
}
