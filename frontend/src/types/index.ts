// ─── Auth ────────────────────────────────────────────────────────────────────

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type GuildRole = "owner" | "manager" | "admin_override";

export interface UserGuild {
  id: number;
  discord_id: string;
  name: string;
  icon_url: string | null;
  member_count: number;
  is_active: boolean;
  role: GuildRole;
}

export interface CurrentUser {
  id: number;
  username: string;
  avatar: string | null;
  is_owner?: boolean;
  is_admin: boolean;
  discord_id?: string | null;
  guilds: UserGuild[];
}

// ─── Bot ─────────────────────────────────────────────────────────────────────

export interface BotState {
  online: boolean;
  stale: boolean;
  latency_ms: number | null;
  version: string | null;
}

// ─── Guild ───────────────────────────────────────────────────────────────────

export interface GuildSummary {
  id: number;
  name: string;
  icon_url?: string | null;
  member_count?: number;
}

export interface GuildDetail {
  id: number;
  discord_id: string;
  name: string;
  icon_url: string | null;
  member_count: number;
  channel_count: number;
  role_count: number;
  is_active: boolean;
  owner_discord_id: string | null;
  bot_joined_at: string | null;
  mod_case_count: number;
  ticket_count: number;
  settings: GuildSettings;
}

export interface GuildSettings {
  prefix: string | null;
  language: string | null;
  timezone: string | null;
  mod_log_channel: string | null;
  automod_enabled: boolean;
  antinuke_enabled: boolean;
  max_warns: number | null;
  warn_action: string | null;
  welcome_channel: string | null;
  welcome_message: string | null;
  farewell_channel: string | null;
  ticket_channel: string | null;
  ticket_role: string | null;
  leveling_enabled: boolean;
  level_channel: string | null;
  xp_multiplier: number | null;
  log_channel: string | null;
  log_joins: boolean;
  log_leaves: boolean;
  log_moderation: boolean;
  log_messages: boolean;
}

export interface GuildCommand {
  id: number;
  command_name: string;
  cog: string | null;
  is_enabled: boolean;
  cooldown_seconds: number;
  allowed_roles: string[];
  disabled_channels: string[];
}

// ─── Moderation ──────────────────────────────────────────────────────────────

export interface ModerationCase {
  id: number;
  case_number: number;
  action: string;
  target_name?: string | null;
  target_id: string;
  moderator_name?: string | null;
  reason?: string | null;
  duration?: string | null;
  created_at: string;
}

export interface RiskProfile {
  member_id: string;
  risk_score: number;
  risk_tier: "low" | "guarded" | "high" | "critical";
  case_count_total: number;
  case_count_recent_30d: number;
  open_case_count: number;
  open_appeal_count: number;
  action_breakdown: Array<{ action: string; count: number }>;
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

export interface TicketRecord {
  id: number;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
  guild_name?: string | null;
}

export interface TicketMessage {
  id: number;
  author_name: string;
  author_discord_id: string;
  content: string;
  created_at: string;
  is_staff: boolean;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface UserRecord {
  id: number;
  username: string;
  discord_id?: string | null;
  is_owner?: boolean;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_login?: string | null;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: number;
  title: string;
  body?: string | null;
  created_at: string;
  is_read: boolean;
  type?: string | null;
}

// ─── Dashboard / Overview ────────────────────────────────────────────────────

export interface OverviewStats {
  guilds: number;
  members: number;
  channels: number;
  commands_today: number;
  uptime: string;
  latency_ms: number;
  version: string;
  online: boolean;
}

export interface OverviewResponse {
  // Flat headline counts (DB-scoped, backward-compat)
  servers: number;
  members: number;
  tickets: number;
  cases: number;
  // Enriched fields
  stats: OverviewStats;
  guilds: GuildSummary[];
  trend: Array<{ date: string; tickets: number; cases: number }>;
  recent_events: Array<{
    id: string;
    type: string;
    message: string;
    severity: "info" | "warning";
    timestamp: string;
  }>;
  recent_cases: Array<{
    id: number;
    case_number: number;
    action: string;
    target_name?: string | null;
    target_id: string;
    reason?: string | null;
    created_at: string;
    guild_name?: string | null;
  }>;
  recent_tickets: Array<{
    id: number;
    ticket_number: number;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
    assigned_to?: string | null;
    guild_name?: string | null;
  }>;
  notifications: {
    unread: number;
    items: Notification[];
  };
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  range: string;
  days: number;
  totals: {
    servers: number;
    members: number;
    mod_cases_all_time: number;
    tickets_all_time: number;
    tickets_open: number;
  };
  bot_health: {
    online: boolean;
    uptime: string;
    uptime_seconds: number;
    latency_ms: number;
    commands_today: number;
    cog_count: number;
    version: string;
    guild_count: number;
    member_count: number;
    cpu_percent: number;
    memory_percent: number;
    memory_mb: number;
  };
  guilds_by_members: Array<{ id: number; name: string; members: number }>;
  action_counts: Array<{ action: string; count: number }>;
  action_timeline: Array<{ date: string; count: number }>;
  ticket_timeline: Array<{ date: string; count: number }>;
  server_timeline: Array<{ date: string; joins: number; leaves: number }>;
  ticket_status_counts: Array<{ status: string; count: number }>;
  ticket_priority_counts: Array<{ priority: string; count: number }>;
  top_guilds: Array<{ id: number; name: string; count: number }>;
}
