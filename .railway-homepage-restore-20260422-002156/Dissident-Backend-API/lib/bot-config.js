const DEFAULT_SETTINGS = Object.freeze({
  modules: {
    autoMod: false,
    economy: false,
    tickets: false,
    xp: true
  },
  welcomeMessage: true,
  welcomeChannel: null,
  autoMod: {
    enabled: false,
    spamThreshold: 5,
    allowInvites: false
  },
  xp: {
    enabled: true,
    min: 15,
    max: 25,
    multiplier: 1,
    levelChannel: null
  },
  warnings: {
    maxWarnings: 3,
    action: 'mute',
    muteDurationMinutes: 60
  },
  economy: {
    enabled: false
  },
  tickets: {
    enabled: false
  }
});

function toPositiveNumber(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function normalizeWarnAction(value) {
  return ['mute', 'kick', 'ban'].includes(value) ? value : DEFAULT_SETTINGS.warnings.action;
}

function normalizeServerSettings(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const defaults = cloneDefaults();

  const normalized = {
    ...source,
    modules: {
      ...defaults.modules,
      ...(source.modules || {})
    },
    autoMod: {
      ...defaults.autoMod,
      ...(source.autoMod || {})
    },
    xp: {
      ...defaults.xp,
      ...(source.xp || {})
    },
    warnings: {
      ...defaults.warnings,
      ...(source.warnings || {})
    },
    economy: {
      ...defaults.economy,
      ...(source.economy || {})
    },
    tickets: {
      ...defaults.tickets,
      ...(source.tickets || {})
    }
  };

  if (typeof source.welcomeMessage === 'boolean') {
    normalized.welcomeMessage = source.welcomeMessage;
  } else {
    normalized.welcomeMessage = defaults.welcomeMessage;
  }

  normalized.welcomeChannel = source.welcomeChannel || source.welcome_channel || defaults.welcomeChannel;

  if (typeof source.automod_enabled === 'boolean') {
    normalized.modules.autoMod = source.automod_enabled;
    normalized.autoMod.enabled = source.automod_enabled;
  } else {
    normalized.autoMod.enabled = normalized.modules.autoMod && normalized.autoMod.enabled !== false;
    normalized.modules.autoMod = normalized.autoMod.enabled;
  }

  if (typeof source.leveling_enabled === 'boolean') {
    normalized.modules.xp = source.leveling_enabled;
    normalized.xp.enabled = source.leveling_enabled;
  } else {
    normalized.xp.enabled = normalized.modules.xp && normalized.xp.enabled !== false;
    normalized.modules.xp = normalized.xp.enabled;
  }

  normalized.modules.economy = Boolean(normalized.modules.economy || normalized.economy.enabled);
  normalized.modules.tickets = Boolean(normalized.modules.tickets || normalized.tickets.enabled);
  normalized.economy.enabled = normalized.modules.economy;
  normalized.tickets.enabled = normalized.modules.tickets;

  normalized.autoMod.spamThreshold = toPositiveNumber(normalized.autoMod.spamThreshold, defaults.autoMod.spamThreshold, { min: 2, max: 25 });
  normalized.autoMod.allowInvites = Boolean(normalized.autoMod.allowInvites);

  normalized.xp.min = toPositiveNumber(normalized.xp.min, defaults.xp.min, { min: 1, max: 1000 });
  normalized.xp.max = toPositiveNumber(normalized.xp.max, defaults.xp.max, { min: normalized.xp.min, max: 1000 });
  normalized.xp.multiplier = toPositiveNumber(source.xp_multiplier ?? normalized.xp.multiplier, defaults.xp.multiplier, { min: 0.1, max: 10 });
  normalized.xp.levelChannel = source.level_channel || normalized.xp.levelChannel || null;

  normalized.warnings.maxWarnings = toPositiveNumber(source.max_warns ?? normalized.warnings.maxWarnings, defaults.warnings.maxWarnings, { min: 1, max: 20 });
  normalized.warnings.action = normalizeWarnAction(source.warn_action || normalized.warnings.action);
  normalized.warnings.muteDurationMinutes = toPositiveNumber(normalized.warnings.muteDurationMinutes, defaults.warnings.muteDurationMinutes, { min: 1, max: 40320 });

  normalized.automod_enabled = normalized.autoMod.enabled;
  normalized.leveling_enabled = normalized.xp.enabled;
  normalized.level_channel = normalized.xp.levelChannel;
  normalized.xp_multiplier = normalized.xp.multiplier;
  normalized.max_warns = normalized.warnings.maxWarnings;
  normalized.warn_action = normalized.warnings.action;

  return normalized;
}

function getXPForLevel(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  return 100 * safeLevel * safeLevel;
}

function calculateLevelFromXP(xp) {
  const safeXP = Math.max(0, Number(xp) || 0);
  return Math.max(1, Math.floor(Math.sqrt(safeXP / 100)) + 1);
}

function formatRelativeTime(input, now = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return 'recent';

  const diffMs = now.getTime() - date.getTime();
  const tense = diffMs >= 0 ? 'ago' : 'from now';
  const diff = Math.abs(diffMs);

  if (diff < 60 * 1000) return `just now`;
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ${tense}`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ${tense}`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d ${tense}`;
  return date.toLocaleDateString();
}

module.exports = {
  DEFAULT_SETTINGS,
  normalizeServerSettings,
  calculateLevelFromXP,
  getXPForLevel,
  formatRelativeTime
};