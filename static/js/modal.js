/**
 * modal.js — Law Reader Modal: open, render norms (chunked), search, close.
 */
"use strict";

let modalNormsData = [];
let modalNormsIdx  = 0;
const CHUNK_SIZE   = 15;

async function openLawModal(key, targetSection = "") {
  currentLawKey = key;
  const modalOverlay = document.getElementById("modal-overlay");
  const modalBadge   = document.getElementById("modal-badge");
  const modalTitle   = document.getElementById("modal-title");
  const modalMeta    = document.getElementById("modal-meta");
  const modalBody    = document.getElementById("modal-body");
  const modalSearch  = document.getElementById("modal-search");
  const modalLangToggle = document.getElementById("modal-lang-toggle");

  if (modalOverlay.showModal) modalOverlay.showModal();
  modalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("modal-close").focus();

  modalBadge.textContent  = key;
  modalTitle.textContent  = "Lädt…";
  modalMeta.textContent   = "";
  modalSearch.value       = targetSection;
  modalBody.innerHTML     = '<div class="spinner"></div>';

  const insSummary    = document.getElementById("ins-summary");
  const insRisk       = document.getElementById("ins-risk");
  const insExclusions = document.getElementById("ins-exclusions");
  const insScenarios  = document.getElementById("ins-scenarios");
  document.getElementById("modal-insights").style.display = "flex";
  insSummary.textContent    = "Analysiere Gesetz...";
  insRisk.textContent       = "...";
  insExclusions.textContent = "...";
  insScenarios.textContent  = "...";

  try {
    if (modalAbortController) {
      try { modalAbortController.abort(); } catch (e) { /* ignore */ }
      modalAbortController = null;
    }
    modalAbortController = new AbortController();

    const [resp, insightResp] = await Promise.all([
      fetch(`/api/law/${encodeURIComponent(key)}`, { signal: modalAbortController.signal }),
      fetch(`/api/law-insights/${encodeURIComponent(key)}`, { signal: modalAbortController.signal }).catch(() => null)
    ]);

    if (!resp.ok) {
      if (resp.status === 429) {
        const d  = await resp.json().catch(() => ({}));
        const ra = resp.headers.get('Retry-After');
        const wait = ra ? ` Retry after ${ra}s.` : '';
        safeSetHTML(modalBody, `<div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">Rate Limited</div><div class="empty-sub">Too many requests.${escapeHTML(d.error || '')}${escapeHTML(wait)}</div></div>`);
        return;
      }
      throw new Error(`HTTP ${resp.status}`);
    }
    const law   = await resp.json();
    cachedLawData = law;

    if (insightResp && insightResp.ok) {
      const insights        = await insightResp.json();
      insSummary.textContent    = insights.summary    || "Keine Zusammenfassung verfügbar.";
      insRisk.textContent       = insights.risk       || "Keine spezifischen Risiken identifiziert.";
      insExclusions.textContent = insights.exclusions || "Keine spezifischen Ausschlüsse vermerkt.";
      insScenarios.textContent  = insights.scenarios  || "Keine Beispielszenarien verfügbar.";
    } else {
      insSummary.textContent = "Zusammenfassung konnte nicht geladen werden oder AI-Dienst ist offline.";
    }

    const meta = law.meta || {};
    modalTitle.textContent = meta.title || key;
    modalMeta.textContent  = [
      meta.last_changed ? `Gültig seit: ${formatDate(meta.last_changed)}` : "",
      meta.source       ? `Quelle: ${meta.source}` : "",
    ].filter(Boolean).join("  ·  ");

    modalTitle.dataset.originalDe = meta.title || key;
    
    modalLangToggle.style.display = "flex";
    const titleToggleGroup = document.getElementById("modal-lang-toggle");
    if (titleToggleGroup) {
      titleToggleGroup.querySelectorAll('.dict-toggle-btn').forEach(b => {
        b.classList.remove('active');
      });
      const deBtn = titleToggleGroup.querySelector('[data-lang="de"]');
      if (deBtn) deBtn.classList.add('active');
    }

    renderModalNorms(law.norms || [], currentGermanTerms, targetSection);
  } catch (e) {
    safeSetHTML(modalBody, `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Fehler beim Laden</div><div class="empty-sub">${escapeHTML(e.message)}</div></div>`);
  }
}

async function renderModalNorms(norms, terms, filterText = "") {
  const modalBody = document.getElementById("modal-body");
  modalNormsData = norms;
  modalNormsIdx  = 0;
  modalBody.innerHTML = "";

  const filterLower = filterText.toLowerCase().replace(/[\s§]+/g, '');
  if (filterLower) {
    modalNormsData = norms.filter(norm => {
      const nId    = String(norm.norm_id || norm.meta?.norm_id || "").toLowerCase().replace(/[\s§]+/g, '');
      const nTitle = String(norm.title   || norm.meta?.title   || "").toLowerCase();
      if (nId === filterLower || nId.includes(filterLower)) return true;
      const combined = (nTitle + " " + (norm.paragraphs || []).map(p => p.content || p.text || "").join(" ")).toLowerCase();
      return combined.includes(filterLower);
    });
  }

  if (!modalNormsData.length) {
    modalBody.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Keine passenden Normen</div></div>';
    return;
  }

  await renderNextChunk(terms, filterText);
}

async function renderNextChunk(terms, filterText = "") {
  const modalBody       = document.getElementById("modal-body");
  const chunk           = modalNormsData.slice(modalNormsIdx, modalNormsIdx + CHUNK_SIZE);
  const container       = document.createElement('div');
  container.className   = 'norms-chunk';
  const currentBatchIdx = modalNormsIdx;
  let firstHighlightedOpened = false;

  const html = chunk.map((norm, i) => {
    const actualIdx  = currentBatchIdx + i;
    const normId     = norm.norm_id  || norm.meta?.norm_id || "";
    const normTitle  = norm.title    || norm.meta?.title   || "";
    const paras      = norm.paragraphs || [];

    const normText      = (normId + " " + normTitle).toLowerCase();
    const isHighlighted = terms.length > 0 && terms.some(t => normText.includes(t.toLowerCase().slice(0, 4)));
    const shouldOpen    = isHighlighted && !firstHighlightedOpened && currentBatchIdx === 0;
    if (shouldOpen) firstHighlightedOpened = true;

    const parasHTML = paras.map((p, pi) => {
      const contentText = p.content || p.text || "";
      const pid = `para-${actualIdx}-${pi}`;
      const displayContent = highlight(contentText, [...terms, filterText].filter(Boolean));
      return `
        <div class="paragraph-block">
          <div class="para-meta" style="display:flex; justify-content:space-between; align-items:center;">
            <span>Abs. ${escapeHTML(String(p.meta?.paragraph_id || pi))}</span>
            <div class="dict-toggles" style="display:inline-flex;">
              <button class="dict-toggle-btn active" data-target="${pid}" data-lang="de">DE</button>
              <button class="dict-toggle-btn" data-target="${pid}" data-lang="en">EN</button>
            </div>
          </div>
          <div class="para-content" id="${pid}" data-original-de="${escapeHTML(contentText)}">${displayContent}</div>
        </div>`;
    }).join('');

    const displayTitle = norm.title || normTitle;
    const titleId      = `norm-title-${actualIdx}`;
    const renderedTitle = displayTitle ? highlight(displayTitle, terms) : "";

    return `
      <div class="modal-norm${isHighlighted ? " highlighted" : ""}" data-norm-idx="${actualIdx}">
        <div class="norm-header" tabindex="0" role="button" aria-expanded="${shouldOpen}">
          <div style="flex: 1; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span class="norm-header-id">${escapeHTML(normId)}</span>
              <span class="norm-header-title" id="${titleId}" data-original-de="${escapeHTML(displayTitle)}">${renderedTitle}</span>
            </div>
            <div class="dict-toggles" style="display:inline-flex;">
              <button class="dict-toggle-btn active" data-target="${titleId}" data-lang="de">DE</button>
              <button class="dict-toggle-btn" data-target="${titleId}" data-lang="en">EN</button>
            </div>
          </div>
          <span class="norm-chevron${shouldOpen ? " open" : ""}">▼</span>
        </div>
        <div class="norm-content${shouldOpen ? " open" : ""}">${parasHTML}</div>
      </div>`;
  }).join('');

  safeSetHTML(container, html);
  modalBody.appendChild(container);
  modalNormsIdx += CHUNK_SIZE;

  const oldBtn = document.getElementById('load-more-norms');
  if (oldBtn) oldBtn.remove();

  if (modalNormsIdx < modalNormsData.length) {
    const btn       = document.createElement('button');
    btn.id          = 'load-more-norms';
    btn.className   = 'view-btn';
    btn.textContent = `Mehr anzeigen (${modalNormsData.length - modalNormsIdx} verbleibend)`;
    btn.onclick     = () => renderNextChunk(terms, filterText);
    modalBody.appendChild(btn);
  }

  rebindModalToggles();
}

function rebindModalToggles() {
  const modalBody = document.getElementById("modal-body");
  modalBody.querySelectorAll(".norm-header").forEach(hdr => {
    if (hdr.dataset.bound) return;
    hdr.dataset.bound = "true";

    hdr.addEventListener("click", async (e) => {
      // If clicking a toggle button, don't expand/collapse
      if (e.target.closest('.dict-toggle-btn')) return;

      const content = hdr.nextElementSibling;
      const chevron = hdr.querySelector(".norm-chevron");
      const isOpen  = content.classList.contains("open");
      content.classList.toggle("open", !isOpen);
      chevron.classList.toggle("open", !isOpen);
      hdr.setAttribute("aria-expanded", String(!isOpen));
    });
    hdr.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hdr.click(); }
    });
  });
}

function closeLawModal() {
  const modalOverlay = document.getElementById("modal-overlay");
  if (aiAbortController) { aiAbortController.abort(); aiAbortController = null; }
  const aiPanel = document.getElementById('ai-chat-panel');
  if (aiPanel) aiPanel.style.display = 'none';

  modalOverlay.classList.remove("open");
  setTimeout(() => {
    if (typeof modalOverlay.close === 'function') modalOverlay.close();
    document.body.style.overflow = "";
    currentLawKey = null;
  }, 300);
}

// ── Modal Event Listeners ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const modalOverlay = document.getElementById("modal-overlay");
  const modalClose   = document.getElementById("modal-close");
  const modalSearch  = document.getElementById("modal-search");

  if (modalClose) modalClose.addEventListener("click", closeLawModal);
  modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closeLawModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && currentLawKey) closeLawModal(); });

  let modalSearchTimeout = null;
  modalSearch.addEventListener("input", () => {
    clearTimeout(modalSearchTimeout);
    modalSearchTimeout = setTimeout(() => {
      if (!cachedLawData) return;
      renderModalNorms(cachedLawData.norms || [], currentGermanTerms, modalSearch.value.trim());
    }, 100);
  });
});
