/**
 * translation.js — Dictionary-based DE/EN toggle handler.
 * AI (Ollama) is NOT used here. Translations are instant via /api/fast_translate.
 * AI is only used in the chatbox (/api/ai_chat).
 */
"use strict";

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

    // ── EN: instant dictionary translation only (no AI) ───────────────────────
    textElement.classList.add('is-translating');

    try {
      const resp = await fetch("/api/fast_translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, is_title: targetId.includes('title') })
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      const translation = data.translation;

      if (translation && translation !== sourceText) {
        textElement.textContent = translation;
        textElement.classList.add('is-translated');
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
