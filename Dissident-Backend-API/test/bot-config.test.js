const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeServerSettings,
  calculateLevelFromXP,
  getXPForLevel,
  formatRelativeTime
} = require('../lib/bot-config');

test('normalizeServerSettings maps dashboard fields into canonical runtime settings', () => {
  const settings = normalizeServerSettings({
    automod_enabled: true,
    leveling_enabled: false,
    xp_multiplier: 2.5,
    level_channel: '123',
    max_warns: 5,
    warn_action: 'ban'
  });

  assert.equal(settings.modules.autoMod, true);
  assert.equal(settings.autoMod.enabled, true);
  assert.equal(settings.modules.xp, false);
  assert.equal(settings.xp.enabled, false);
  assert.equal(settings.xp.multiplier, 2.5);
  assert.equal(settings.xp.levelChannel, '123');
  assert.equal(settings.warnings.maxWarnings, 5);
  assert.equal(settings.warnings.action, 'ban');
});

test('normalizeServerSettings preserves explicit nested module settings', () => {
  const settings = normalizeServerSettings({
    modules: { economy: true, tickets: true },
    economy: { enabled: true },
    tickets: { enabled: true },
    xp: { enabled: true, min: 20, max: 40 }
  });

  assert.equal(settings.modules.economy, true);
  assert.equal(settings.modules.tickets, true);
  assert.equal(settings.economy.enabled, true);
  assert.equal(settings.tickets.enabled, true);
  assert.equal(settings.xp.min, 20);
  assert.equal(settings.xp.max, 40);
});

test('calculateLevelFromXP and getXPForLevel stay aligned around thresholds', () => {
  assert.equal(calculateLevelFromXP(0), 1);
  assert.equal(calculateLevelFromXP(99), 1);
  assert.equal(calculateLevelFromXP(100), 2);
  assert.equal(calculateLevelFromXP(399), 2);
  assert.equal(calculateLevelFromXP(400), 3);
  assert.equal(getXPForLevel(1), 100);
  assert.equal(getXPForLevel(3), 900);
});

test('formatRelativeTime returns readable relative values', () => {
  const now = new Date('2026-04-20T20:00:00.000Z');

  assert.equal(formatRelativeTime('2026-04-20T19:59:40.000Z', now), 'just now');
  assert.equal(formatRelativeTime('2026-04-20T19:30:00.000Z', now), '30m ago');
  assert.equal(formatRelativeTime('2026-04-20T18:00:00.000Z', now), '2h ago');
});