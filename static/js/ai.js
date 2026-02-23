/**
 * ai.js — AI Chat integration: main search panel + modal law guide.
 * Both use the /api/ai_chat streaming endpoint (Server-Sent deltas).
 */
"use strict";

// ── Main Search AI Panel ─────────────────────────────────────────────────────
async function triggerMainAIChat(query, results) {
  const panel  = document.getElementById('main-ai-chat-panel');
  const output = document.getElementById('main-ai-chat-output');
  const status = document.getElementById('main-ai-status');

  if (mainAbortController) {
    mainAbortController.abort();
    mainAbortController = null;
  }

  panel.style.display = 'block';
  safeSetHTML(output, '<span style="color: #ffcc00; opacity: 0.7;">Summarizing legal situation...</span>');
  status.textContent = "Processing search results through local AI...";

  const context = results.slice(0, 5).map(r => {
    let text = `Law: ${r.key} (${r.title || 'Unknown'})\nRelevance: ${r.relevance}%\n`;
    if (r.relevant_norms && r.relevant_norms.length) text += `Relevant Norms: ${r.relevant_norms.join(', ')}\n`;
    if (r.alt_title) text += `Description: ${r.alt_title}\n`;
    return text;
  }).join('\n\n');

  mainAbortController = new AbortController();
  try {
    const res = await fetch('/api/ai_chat', {
      method: 'POST',
      body: JSON.stringify({
        query: `In the context of the laws found, explain how they apply to this situation: ${query}`,
        context
      }),
      signal: mainAbortController.signal
    });
    if (!res.ok) {
      if (res.status === 429) {
        const d  = await res.json().catch(() => ({}));
        const ra = res.headers.get('Retry-After');
        const wait = ra ? ` Retry after ${ra}s.` : '';
        safeSetHTML(output, `<div style="color:coral;">AI rate limit: ${escapeHTML(d.error || 'rate_limited')}.${escapeHTML(wait)}</div>`);
        status.textContent = `Rate limited${ra ? ' — retry after ' + ra + 's' : ''}`;
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    }

    output.innerHTML = '';
    const reader   = res.body.getReader();
    const decoder  = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullResponse += decoder.decode(value, { stream: true });
      safeSetHTML(output, formatAIMarkdown(fullResponse));
      panel.scrollTop = panel.scrollHeight;
    }
    status.textContent = "Legal analysis complete.";
  } catch (e) {
    if (e.name !== 'AbortError') {
      safeSetHTML(output, `<span style="color: coral;">AI Connection Error: Ensure Ollama is running.</span>`);
      status.textContent = `Error: ${e.message}`;
    }
  } finally {
    mainAbortController = null;
  }
}

// ── Modal Law Guide AI ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('close-main-ai')?.addEventListener('click', () => {
    if (mainAbortController) mainAbortController.abort();
    document.getElementById('main-ai-chat-panel').style.display = 'none';
  });

  document.getElementById('btn-ask-ai')?.addEventListener('click', async () => {
    const query  = document.getElementById('modal-search').value.trim() || 'Please summarize the key points of this law focusing on its purpose and rights.';
    const panel  = document.getElementById('ai-chat-panel');
    const output = document.getElementById('ai-chat-output');

    if (panel.style.display === 'block' && aiAbortController) {
      aiAbortController.abort();
      aiAbortController = null;
      output.innerHTML += '<br><br><span style="color:coral;">[Analysis stopped]</span>';
      return;
    }

    panel.style.display = 'block';
    safeSetHTML(output, '<span style="color: #ffcc00; opacity: 0.8;">Analyzing with Local AI...</span>');

    const queryLower = query.toLowerCase();
    const relevantNorms = (cachedLawData?.norms || [])
      .filter(n => {
        const nId    = String(n.norm_id || '').toLowerCase();
        const nTitle = String(n.title    || '').toLowerCase();
        const nPrev  = String(n.preview  || '').toLowerCase();
        const qClean = queryLower.replace(/[§\s]+/g, '');
        return nId.replace(/\s+/g, '').includes(qClean) || nTitle.includes(queryLower) || nPrev.includes(queryLower);
      })
      .slice(0, 10);

    const baseNorms   = (cachedLawData?.norms || []).slice(0, 5);
    const uniqueNorms = Array.from(new Set([...relevantNorms, ...baseNorms]));

    const context = `Law Title: ${cachedLawData?.meta?.title || 'Unknown'}\n\n` +
      uniqueNorms.slice(0, 15).map(n =>
        (n.norm_id || '?') + ' ' + (n.title || '') + ': ' +
        (n.paragraphs?.[0]?.content || n.paragraphs?.[0]?.text || n.preview || '')
      ).join('\n\n');

    aiAbortController = new AbortController();
    try {
      const res = await fetch('/api/ai_chat', {
        method: 'POST',
        body: JSON.stringify({ query, context }),
        signal: aiAbortController.signal
      });

      output.innerHTML = '';
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let fullAiOutput = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullAiOutput += decoder.decode(value, { stream: true });
        safeSetHTML(output, formatAIMarkdown(fullAiOutput));
        panel.scrollTop = panel.scrollHeight;
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        safeSetHTML(output, `<span style="color: coral;">Connection Error: Ensure Ollama is running. (${escapeHTML(e.message)})</span>`);
      }
    } finally {
      aiAbortController = null;
    }
  });
});
