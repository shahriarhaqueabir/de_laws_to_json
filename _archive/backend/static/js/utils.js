/**
 * utils.js — Shared utility functions used across all modules.
 */
"use strict";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHTML(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractSectionNum(q) {
  if (!q) return "";
  const parts = q.trim().split(/[\s§]+/).filter(p => p.trim());
  if (parts.length >= 2) {
    if (/\d/.test(parts[1])) return parts[1];
  }
  if (parts.length === 1 && /\d/.test(parts[0])) return parts[0];
  return "";
}

function highlight(text, terms) {
  let result = escapeHTML(text);
  for (const term of terms) {
    if (!term || term.length < 3) continue;
    const regex = new RegExp(`(${escapeRegex(term)})`, "gi");
    result = result.replace(regex, "<mark>$1</mark>");
  }
  return result;
}

function formatDate(d) {
  if (!d) return "unknown";
  const [y, m, day] = (d + "").split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${day ? day + " " : ""}${months[parseInt(m, 10) - 1] || m} ${y}`;
}

/**
 * formatAIMarkdown — Converts a plain-text AI response into rich HTML.
 * Handles: headers (## / ###), **bold**, bullet lists, numbered lists,
 * inline code, horizontal rules, §-citations, and law key underlines.
 */
function formatAIMarkdown(text) {
  if (!text) return "";

  let html = text
    // Headers
    .replace(/^### (.*$)/gm, '<h3 style="color:#ffcc00; margin-top:16px; margin-bottom:8px; font-family:\'Cinzel\', serif; font-size:14px;">$1</h3>')
    .replace(/^## (.*$)/gm,  '<h2 style="color:#ffcc00; margin-top:20px; margin-bottom:10px; font-family:\'Cinzel\', serif; font-size:16px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">$1</h2>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#ffcc00; font-weight:600;">$1</strong>')
    // Unordered lists
    .replace(/^- (.*$)/gm, '<div style="display:flex; gap:8px; margin-left:8px; margin-bottom:4px;"><span style="color:#ffcc00;">•</span><span>$1</span></div>')
    // Ordered lists
    .replace(/^(\d+)\. (.*$)/gm, '<div style="display:flex; gap:8px; margin-left:8px; margin-bottom:4px;"><span style="color:#ffcc00; font-weight:600;">$1.</span><span>$2</span></div>')
    // Inline code
    .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.08); padding:2px 5px; border-radius:4px; font-family:\'Source Code Pro\', monospace; font-size:0.9em; border:1px solid rgba(255,255,255,0.05);">$1</code>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:16px 0;">')
    // §-citations
    .replace(/(§+ ?\d+[a-z]?)/gi, '<span style="color:#ffcc00; background:rgba(255,204,0,0.1); padding:1px 4px; border-radius:3px; font-weight:600;">$1</span>')
    // Law key highlights
    .replace(/\b(BGB|StGB|Grundgesetz|GG|ZPO|StPO|FamFG)\b/g, '<span style="border-bottom:1px solid rgba(255,204,0,0.4);">$1</span>');

  // Wrap double-newline separated blocks in <p>
  html = html.split('\n\n')
    .map(p => p.trim() ? `<p style="margin-bottom:12px; line-height:1.6;">${p.replace(/\n/g, '<br>')}</p>` : '')
    .join('');

  return html;
}

/**
 * safeSetHTML — Sanitises HTML via DOMPurify then writes to an element.
 * Pass append=true to append nodes instead of replacing innerHTML.
 */
function safeSetHTML(el, html, append = false) {
  if (!el) return;
  let clean = html;
  try {
    if (window.DOMPurify && typeof DOMPurify.sanitize === 'function') {
      clean = DOMPurify.sanitize(html);
    } else {
      clean = String(html).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  } catch (err) {
    clean = String(html).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  if (append) {
    const tmp = document.createElement('div');
    tmp.innerHTML = clean;
    while (tmp.firstChild) el.appendChild(tmp.firstChild);
  } else {
    el.innerHTML = clean;
  }
}
