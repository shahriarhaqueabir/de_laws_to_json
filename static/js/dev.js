/**
 * dev.js — Developer Dashboard: health cards, AI kill switch, admin actions.
 */
"use strict";

async function refreshDevHealth() {
  const start = performance.now();
  try {
    const resp = await fetch('/api/dev/health');
    if (!resp.ok) throw new Error("API Offline");
    const data    = await resp.json();
    const latency = Math.round(performance.now() - start);

    const apiCard   = document.getElementById('health-api');
    const indexCard = document.getElementById('health-index');
    const aiCard    = document.getElementById('health-ai');

    if (apiCard) {
      apiCard.className = 'health-card online';
      const pingEl = document.getElementById('metrics-ping');
      if (pingEl) pingEl.textContent = latency;
    }

    if (indexCard) {
      const indexStatus = data.dependencies.search_index;
      indexCard.className = `health-card ${indexStatus === 'ready' ? 'online' : 'building'}`;
      const valIndex = document.getElementById('val-index');
      if (valIndex) valIndex.textContent = indexStatus === 'ready' ? 'Ready' : 'Building...';
      const metricsLaws = document.getElementById('metrics-laws');
      if (metricsLaws) metricsLaws.textContent = data.metrics.indexed_laws;
    }

    if (aiCard) {
      const aiStatus = data.dependencies.ai_service;
      aiCard.className = `health-card ${aiStatus === 'connected' ? 'online' : 'offline'}`;
      const valAi = document.getElementById('val-ai');
      if (valAi) valAi.textContent = aiStatus === 'connected' ? 'Connected' : 'Offline';
    }

    const uptimeSec = data.uptime;
    const h = Math.floor(uptimeSec / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    const uptimeEl = document.getElementById('dev-uptime');
    if (uptimeEl) uptimeEl.textContent = `Uptime: ${h}h ${m}m`;

    const toggle      = document.getElementById('ai-toggle');
    const statusBadge = document.getElementById('ai-kill-status');
    if (toggle) toggle.checked = data.ai_enabled;
    if (statusBadge) {
      statusBadge.textContent       = data.ai_enabled ? 'Active' : 'Disabled';
      statusBadge.style.background  = data.ai_enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
      statusBadge.style.color       = data.ai_enabled ? '#34d399' : '#f87171';
    }
  } catch (e) {
    const apiCard = document.getElementById('health-api');
    if (apiCard) apiCard.className = 'health-card offline';
  }
}

async function handleAIToggle(enabled) {
  try {
    const resp = await fetch('/api/dev/toggle', {
      method: 'POST',
      body: JSON.stringify({ feature: 'ai_enabled', value: enabled }),
      headers: { 'Content-Type': 'application/json' }
    });
    if (resp.ok) refreshDevHealth();
  } catch (e) {
    console.error("Failed to toggle AI state", e);
  }
}

async function sidebarAdminAction(action) {
  const btn = event?.target;
  if (btn) btn.disabled = true;

  const adminKey = '{{ admin_key }}';
  let url  = '/api/admin/info';
  let opts = { method: 'GET', headers: { 'X-Admin-Token': adminKey } };
  if (action === 'rebuild')       { url = '/api/admin/rebuild_index'; opts.method = 'POST'; }
  if (action === 'toggle_debug')  { url = '/api/admin/toggle_debug';  opts.method = 'POST'; }

  try {
    const output     = document.getElementById('admin-output-sidebar');
    output.textContent = 'Processing request...';
    const r          = await fetch(url, opts);
    const d          = await r.json();
    output.textContent = JSON.stringify(d, null, 2);
  } catch (e) {
    const output = document.getElementById('admin-output-sidebar');
    output.textContent = `Error: ${e.message}`;
  }
}

// Poll every 10s (light)
document.addEventListener('DOMContentLoaded', () => {
  setInterval(refreshDevHealth, 10000);
  refreshDevHealth();
});
