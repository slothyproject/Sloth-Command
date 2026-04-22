/* Dissident Central Hub — main.js */

// ── Bot status pill ──────────────────────────────────────────────
async function updateBotPill() {
  const pill = document.getElementById('bot-pill');
  const text = document.getElementById('bot-pill-text');
  if (!pill) return;
  try {
    const d = await fetch('/api/bot').then(r => r.json());
    pill.className = 'bot-pill bot-pill--' + (d.online ? 'online' : 'offline');
    if (text) text.textContent = d.online
      ? `online · ${d.latency_ms}ms · up ${d.uptime}`
      : 'offline';
  } catch {
    if (text) text.textContent = 'unreachable';
  }
}

updateBotPill();
setInterval(updateBotPill, 15000);

// ── Alert dismiss ────────────────────────────────────────────────
document.querySelectorAll('.alert').forEach(el => {
  setTimeout(() => {
    el.style.transition = 'opacity 0.5s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  }, 5000);
});

// ── Sidebar mobile ───────────────────────────────────────────────
document.addEventListener('click', e => {
  const layout = document.getElementById('layout');
  const sidebar = document.getElementById('sidebar');
  const panel = document.getElementById('notif-panel');
  if (!layout) return;
  if (layout.classList.contains('sidebar-open') &&
      sidebar && !sidebar.contains(e.target) &&
      !e.target.closest('.navbar__toggle')) {
    layout.classList.remove('sidebar-open');
  }
  if (panel && panel.style.display !== 'none' &&
      !panel.contains(e.target) &&
      !e.target.closest('.notif-bell')) {
    panel.style.display = 'none';
  }
});

// ── Notifications ────────────────────────────────────────────────
let notifPanelOpen = false;

async function loadNotifications() {
  try {
    const d = await fetch('/api/notifications').then(r => r.json());
    const count = d.unread;
    const countEl = document.getElementById('notif-count');
    if (countEl) {
      countEl.style.display = count > 0 ? 'flex' : 'none';
      countEl.textContent = count > 99 ? '99+' : count;
    }
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (!d.notifications.length) {
      list.innerHTML = '<div class="notif-panel__empty">No notifications</div>';
      return;
    }
    list.innerHTML = d.notifications.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="readNotif(${n.id}, '${n.link||''}')">
        <div class="notif-item__title">${n.title}</div>
        ${n.body ? `<div class="notif-item__body">${n.body}</div>` : ''}
        <div class="notif-item__time">${new Date(n.created_at).toLocaleString()}</div>
      </div>`).join('');

    // Update ticket sidebar badge
    const openTickets = d.notifications.filter(n => n.type === 'ticket_open' && !n.is_read).length;
    const ticketBadge = document.getElementById('sidebar-ticket-count');
    if (ticketBadge) {
      ticketBadge.style.display = openTickets > 0 ? 'inline' : 'none';
      ticketBadge.textContent = openTickets;
    }
  } catch {}
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  notifPanelOpen = !notifPanelOpen;
  panel.style.display = notifPanelOpen ? 'block' : 'none';
  if (notifPanelOpen) {
    // Silently deduplicate then load
    fetch('/api/notifications/clear-duplicates', { method: 'POST' }).finally(() => loadNotifications());
  }
}

async function readNotif(id, link) {
  await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  if (link) window.location.href = link;
  else loadNotifications();
}

async function markAllRead() {
  const csrf = document.cookie.match(/csrf_token=([^;]+)/)?.[1] || '';
  // Deduplicate first, then mark all read
  await fetch('/api/notifications/clear-duplicates', { method: 'POST' });
  await fetch('/api/notifications/read-all', {
    method: 'POST',
    headers: { 'X-CSRFToken': csrf, 'Content-Type': 'application/json' }
  });
  loadNotifications();
}

loadNotifications();
setInterval(loadNotifications, 30000);

// ── SSE real-time updates ────────────────────────────────────────
function connectSSE() {
  if (typeof EventSource === 'undefined') return;
  const es = new EventSource('/api/events');
  es.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'ping') return;
      if (msg.type === 'bot_state') {
        // Update pill
        const pill = document.getElementById('bot-pill');
        const text = document.getElementById('bot-pill-text');
        if (pill && msg.data) {
          const online = msg.data.online;
          pill.className = 'bot-pill bot-pill--' + (online ? 'online' : 'offline');
          if (text) text.textContent = online
            ? `online · ${msg.data.latency_ms}ms · up ${msg.data.uptime}`
            : 'offline';
        }
      }
      if (['guild_join','guild_leave','ticket_open','mod_action'].includes(msg.type)) {
        loadNotifications();
      }
    } catch {}
  };
  es.onerror = () => {
    es.close();
    setTimeout(connectSSE, 10000); // Reconnect after 10s
  };
}

connectSSE();
