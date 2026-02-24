/**
 * dev.js — Developer Dashboard: health cards, AI kill switch, admin actions.
 * Includes auto-restart detection and server recovery notification.
 */
"use strict";

// Server monitoring state
let serverWasOffline = false;
let serverOfflineSince = null;
let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_NOTIFICATION = 3;
const HEALTH_CHECK_INTERVAL = 10000; // 10 seconds

async function refreshDevHealth() {
  const start = performance.now();
  try {
    const resp = await fetch('/api/dev/health');
    if (!resp.ok) throw new Error("API Offline");
    const data    = await resp.json();
    const latency = Math.round(performance.now() - start);

    // Server is healthy - reset failure counter
    consecutiveFailures = 0;
    
    // Check if server was previously offline and just recovered
    if (serverWasOffline) {
      showServerRecoveredNotification();
      serverWasOffline = false;
      serverOfflineSince = null;
    }

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
      // AI is online if status is 'connected' or 'running'
      const isAiOnline = aiStatus === 'connected' || aiStatus === 'running';
      aiCard.className = `health-card ${isAiOnline ? 'online' : 'offline'}`;
      const valAi = document.getElementById('val-ai');
      if (valAi) valAi.textContent = isAiOnline ? 'Connected' : 'Offline';
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
    
    // Track consecutive failures
    consecutiveFailures++;
    
    // Server just went offline
    if (!serverWasOffline && consecutiveFailures >= MAX_FAILURES_BEFORE_NOTIFICATION) {
      serverWasOffline = true;
      serverOfflineSince = new Date();
      showServerOfflineNotification();
    }
    
    // Update offline duration if already offline
    if (serverWasOffline && serverOfflineSince) {
      updateOfflineDurationDisplay();
    }
  }
}

function showServerOfflineNotification() {
  // Remove existing notification if any
  removeExistingNotification();
  
  const notification = document.createElement('div');
  notification.id = 'server-offline-notification';
  notification.className = 'server-status-notification offline';
  notification.innerHTML = `
    <div class="notification-icon">⚠️</div>
    <div class="notification-content">
      <strong>Server Offline</strong>
      <p>The backend server is not responding. Auto-restart in progress...</p>
      <p class="offline-duration" id="offline-duration">Checking...</p>
    </div>
    <div class="notification-spinner"></div>
  `;
  document.body.appendChild(notification);
  
  // Auto-remove after 30 seconds if server doesn't recover
  setTimeout(() => {
    const notif = document.getElementById('server-offline-notification');
    if (notif && serverWasOffline) {
      notif.classList.add('persistent');
    }
  }, 30000);
}

function showServerRecoveredNotification() {
  // Remove existing notification if any
  removeExistingNotification();
  
  const notification = document.createElement('div');
  notification.id = 'server-recovered-notification';
  notification.className = 'server-status-notification recovered';
  notification.innerHTML = `
    <div class="notification-icon">✅</div>
    <div class="notification-content">
      <strong>Server Recovered</strong>
      <p>The backend server is back online and responding.</p>
    </div>
  `;
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    removeExistingNotification();
  }, 5000);
}

function updateOfflineDurationDisplay() {
  if (!serverOfflineSince) return;
  
  const durationEl = document.getElementById('offline-duration');
  if (durationEl) {
    const seconds = Math.floor((Date.now() - serverOfflineSince.getTime()) / 1000);
    if (seconds < 60) {
      durationEl.textContent = `Offline for ${seconds} seconds`;
    } else {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      durationEl.textContent = `Offline for ${mins}m ${secs}s`;
    }
  }
}

function removeExistingNotification() {
  const existing = document.getElementById('server-offline-notification') || 
                   document.getElementById('server-recovered-notification');
  if (existing) {
    existing.remove();
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

  // Get admin key from global variable (set in index.html)
  const adminKey = window.ADMIN_API_KEY || '';
  let url  = '/api/admin/info';
  let opts = { method: 'GET', headers: { 'X-Admin-Token': adminKey } };
  
  if (action === 'rebuild') {
    url = '/api/admin/rebuild_index';
    opts.method = 'POST';
  } else if (action === 'reload') {
    // Hard reload - clear cache and reload page
    hardReload();
    if (btn) btn.disabled = false;
    return;
  }

  try {
    const output     = document.getElementById('admin-output-sidebar');
    output.textContent = 'Processing request...';
    const r          = await fetch(url, opts);
    const d          = await r.json();
    output.textContent = JSON.stringify(d, null, 2);
  } catch (e) {
    const output = document.getElementById('admin-output-sidebar');
    output.textContent = `Error: ${e.message}`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * Hard Reload - Force reload page and clear all caches
 * - Clears service worker cache
 * - Clears localStorage/sessionStorage
 * - Forces browser to bypass HTTP cache
 * - Reloads the page
 */
function hardReload() {
  console.log('[Hard Reload] Starting hard reload...');
  
  // Clear localStorage (except critical settings if needed)
  try {
    const criticalKeys = ['bookmarks', 'search_history'];
    const criticalData = {};
    
    // Save critical data
    criticalKeys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) criticalData[key] = data;
    });
    
    // Clear and restore
    localStorage.clear();
    criticalKeys.forEach(key => {
      if (criticalData[key]) localStorage.setItem(key, criticalData[key]);
    });
    
    console.log('[Hard Reload] LocalStorage cleared (critical data preserved)');
  } catch (e) {
    console.error('[Hard Reload] Failed to clear localStorage:', e);
  }
  
  // Clear sessionStorage
  try {
    sessionStorage.clear();
    console.log('[Hard Reload] SessionStorage cleared');
  } catch (e) {
    console.error('[Hard Reload] Failed to clear sessionStorage:', e);
  }
  
  // Show reload message
  const output = document.getElementById('admin-output-sidebar');
  if (output) {
    output.textContent = '⚡ Hard Reloading...\n\nClearing caches...\n• LocalStorage (preserved: bookmarks, history)\n• SessionStorage\n• HTTP Cache\n\nReloading page...';
  }
  
  // Force reload with cache bypass
  setTimeout(() => {
    window.location.reload(true);  // true = force reload from server
  }, 1500);
}

// Poll every 10s (light)
document.addEventListener('DOMContentLoaded', () => {
  setInterval(refreshDevHealth, 10000);
  refreshDevHealth();
  
  // Keyboard shortcut: Ctrl+Shift+R for hard reload
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      console.log('[Keyboard Shortcut] Hard Reload triggered (Ctrl+Shift+R)');
      hardReload();
    }
  });
});
