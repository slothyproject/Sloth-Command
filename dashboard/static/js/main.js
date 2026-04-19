/* Dissident Central Hub — dashboard JS */

// ── Bot status indicator ─────────────────────────────────────────
async function updateBotStatus() {
  const dot = document.querySelector('.bot-status__dot');
  const label = document.querySelector('.bot-status__label');
  if (!dot) return;
  try {
    const r = await fetch('/api/bot');
    const d = await r.json();
    dot.className = 'bot-status__dot bot-status__dot--' + (d.online ? 'online' : 'offline');
    if (label) label.textContent = 'Bot · ' + (d.latency_ms ? d.latency_ms + 'ms' : (d.online ? 'online' : 'offline'));
  } catch {
    dot.className = 'bot-status__dot bot-status__dot--unknown';
  }
}

updateBotStatus();
setInterval(updateBotStatus, 15000);

// ── Flash message auto-dismiss ───────────────────────────────────
document.querySelectorAll('.alert').forEach(el => {
  setTimeout(() => {
    el.style.transition = 'opacity 0.3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 4000);
});
