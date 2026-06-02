/**
 * translation.js — Unified AI-powered DE/EN toggle handler.
 * All translations flow through /api/translate endpoint.
 * The backend handles caching, dictionary hints, and AI translation.
 */
"use strict";

// ── Local Translation Cache Map ──────────────────────────────────────────────
window.translationMap = window.translationMap || {};

// ── Helper: Call unified translation endpoint with local cache check ─────────
async function translateText(text, isTitle) {
  if (window.translationMap && window.translationMap[text]) {
    return window.translationMap[text];
  }
  
  try {
    const resp = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, is_title: isTitle })
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    const translation = data.translation || null;
    if (translation) {
      window.translationMap[text] = translation;
    }
    return translation;
  } catch (err) {
    console.error("Translation error:", err);
    return null;
  }
}

// ── Batch Pre-warmer for Modal Load (Background Parallel Fetch) ──────────────
async function prewarmBatchTranslations(texts) {
  if (!texts || !texts.length) return;

  const misses = texts.filter(t => !window.translationMap[t]);
  if (!misses.length) return;

  try {
    const resp = await fetch("/api/translate/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: misses, is_title: true })
    });

    if (resp.ok) {
      const data = await resp.json();
      const translations = data.translations || [];
      translations.forEach(t => {
        if (t.translation && t.translation !== t.original) {
          window.translationMap[t.original] = t.translation;
        }
      });
      console.log(`Pre-warmed translation cache with ${translations.length} terms.`);
    }
  } catch (err) {
    console.error("Batch pre-warm translation error:", err);
  }
}

// ── Global Delegated Click Handler for DE/EN Toggles ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', async (e) => {
    const toggleBtn = e.target.closest('.dict-toggle-btn');
    if (!toggleBtn || toggleBtn.classList.contains('active')) return;

    const targetId   = toggleBtn.dataset.target;
    const targetLang = toggleBtn.dataset.lang; // 'en' or 'de'
    const textElement = document.getElementById(targetId);
    if (!textElement) return;

    // Store original German text on first toggle
    let sourceText = textElement.dataset.originalDe;
    if (!sourceText) {
      sourceText = textElement.textContent;
      textElement.dataset.originalDe = sourceText;
    }

    // Set the clicked button as active, clear others in the group
    const group = toggleBtn.closest('.dict-toggles');
    group.querySelectorAll('.dict-toggle-btn').forEach(b => b.classList.remove('active'));
    toggleBtn.classList.add('active');

    // ── DE: restore original text ─────────────────────────────────────────────
    if (targetLang === 'de') {
      textElement.textContent = sourceText;
      textElement.classList.remove('is-translating', 'is-translated');
      return;
    }

    // ── EN: unified AI translation ────────────────────────────────────────────
    textElement.classList.add('is-translating');

    try {
      const isTitle = targetId.includes('title');
      const translation = await translateText(sourceText, isTitle);

      if (translation && translation !== sourceText) {
        textElement.textContent = translation;
        textElement.classList.add('is-translated');
        console.log(`Translated: "${sourceText}" → "${translation}"`);
      } else {
        // No translation found; revert to DE
        textElement.textContent = sourceText;
        textElement.classList.remove('is-translated');
        group.querySelector('.dict-toggle-btn[data-lang="de"]')?.click();
      }
    } catch (err) {
      console.error("Translation error:", err);
      textElement.textContent = sourceText;
      group.querySelector('.dict-toggle-btn[data-lang="de"]')?.click();
    } finally {
      textElement.classList.remove('is-translating');
    }
  });
});
