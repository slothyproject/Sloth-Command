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
  if (!layout || !sidebar) return;
  if (layout.classList.contains('sidebar-open') &&
      !sidebar.contains(e.target) &&
      !e.target.closest('.navbar__toggle')) {
    layout.classList.remove('sidebar-open');
  }
});
