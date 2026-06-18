/**
 * vault.js — Law Vault (browse tab): categories, fetching, rendering, pagination.
 */
"use strict";

// ── Category Pills ────────────────────────────────────────────────────────────
function renderVaultCategories(counts) {
  const wrap = document.getElementById('vault-categories');
  if (!wrap) return;

  let html = `
    <button class="cat-filter-btn ${!vaultCategory ? 'active' : ''}" onclick="filterVaultCat('')">
      <span class="cat-dot" style="background: #ffcc00"></span>
      <span style="flex: 1">All Laws</span>
      <span class="tab-badge">${Object.values(counts).reduce((a,b) => a+b, 0)}</span>
    </button>
  `;

  Object.entries(CATEGORY_MAP).forEach(([id, meta]) => {
    const count = counts[id] || 0;
    if (count === 0 && id !== 'other') return;
    html += `
      <button class="cat-filter-btn ${vaultCategory === id ? 'active' : ''}" onclick="filterVaultCat('${id}')">
        <span class="cat-dot" style="background: ${meta.color}"></span>
        <span class="cat-icon" style="margin-right: 8px; display: inline-flex; color: ${meta.color}; opacity: 0.8;">${meta.icon}</span>
        <span style="flex: 1">${meta.title}</span>
        <span class="tab-badge">${count}</span>
      </button>
    `;
  });
  wrap.innerHTML = html;
}

// ── Fetch Laws ────────────────────────────────────────────────────────────────
async function fetchVaultLaws() {
  const grid = document.getElementById('laws-grid');
  grid.innerHTML = '<div class="spinner"></div>';

  const mySeq = ++vaultRequestSeq;
  if (vaultAbortController) {
    try { vaultAbortController.abort(); } catch (e) { /* ignore */ }
  }
  vaultAbortController = new AbortController();

  try {
    const params = new URLSearchParams({ page: vaultPage, category: vaultCategory, q: vaultQ });
    const r = await fetch(`/api/laws?${params.toString()}`, { signal: vaultAbortController.signal });
    if (mySeq !== vaultRequestSeq) return;

    const d = await r.json();

    if (!r.ok) {
      if (r.status === 503) {
        safeSetHTML(grid, '<div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">Building Index</div><div class="empty-sub">The database is currently organizing. Please wait a moment...</div></div>');
        return;
      }
      if (r.status === 429) {
        const ra = r.headers.get('Retry-After');
        const wait = ra ? ` Retry after ${ra}s.` : '';
        safeSetHTML(grid, `<div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">Zu viele Anfragen</div><div class="empty-sub">Bitte warten Sie einen Moment.${escapeHTML(wait)}</div></div>`);
        return;
      }
      throw new Error(d.error || 'Server error');
    }

    if (mySeq !== vaultRequestSeq) return;

    vaultTotal   = d.total;
    vaultHasMore = d.has_more;
    renderVault(d.laws);
    updateVaultPagination();
  } catch (e) {
    if (e.name === 'AbortError') return;
    safeSetHTML(grid, `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Error Loading Laws</div><div class="empty-sub">${escapeHTML(e.message || String(e))}</div></div>`);
  } finally {
    if (mySeq === vaultRequestSeq) {
      try { vaultAbortController = null; } catch (e) { /* ignore */ }
    }
  }
}

// ── Render Grid ───────────────────────────────────────────────────────────────
function renderVault(laws) {
  const grid = document.getElementById('laws-grid');
  if (!laws.length) {
    grid.innerHTML = '<div class="empty-state">No laws match your filters.</div>';
    return;
  }

  const sectionNum = extractSectionNum(vaultQ);

  grid.innerHTML = laws.map((l, i) => {
    const safeKeyAttr     = JSON.stringify(l.key);
    const safeSectionAttr = JSON.stringify(sectionNum || '');
    return `
      <div class="law-card" style="border-left-color: ${CATEGORY_MAP[l.category]?.color || '#94a3b8'}; animation: fadeInUp 0.4s ease forwards ${i * 0.02}s" onclick='openLawModal(${safeKeyAttr}, ${safeSectionAttr})'>
        <div class="law-card-key">${escapeHTML(l.key)}</div>
        <div class="law-card-title">${escapeHTML(l.title)}</div>
        <div class="law-card-meta">
          <span>${l.total_norms} Normen</span>
          <span>${l.last_changed ? formatDate(l.last_changed) : ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── Pagination ────────────────────────────────────────────────────────────────
function updateVaultPagination() {
  document.getElementById('vault-prev').disabled = vaultPage <= 1;
  document.getElementById('vault-next').disabled = !vaultHasMore;
  document.getElementById('vault-page-info').textContent = `Page ${vaultPage} of ${Math.ceil(vaultTotal / VAULT_PAGE_SIZE) || 1}`;
}

function filterVaultCat(cat) {
  vaultCategory = cat;
  vaultPage = 1;
  fetchVaultLaws();
  fetch("/api/status").then(res => res.json()).then(d => renderVaultCategories(d.categories));
}

// ── Vault Search (debounced) ──────────────────────────────────────────────────
let vaultSearchTimeout;
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('vault-q')?.addEventListener('input', (e) => {
    clearTimeout(vaultSearchTimeout);
    vaultSearchTimeout = setTimeout(() => {
      vaultQ    = e.target.value.trim();
      vaultPage = 1;
      fetchVaultLaws();
    }, 300);
  });

  document.getElementById('vault-prev')?.addEventListener('click', () => {
    if (vaultPage > 1) { vaultPage--; fetchVaultLaws(); }
  });
  document.getElementById('vault-next')?.addEventListener('click', () => {
    if (vaultHasMore) { vaultPage++; fetchVaultLaws(); }
  });
});
