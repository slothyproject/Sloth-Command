import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Server, Users, Shield, Ticket, Settings,
  BarChart3, Crown, Save, Loader2, ShieldAlert, Hash,
  MessageSquare, AlertTriangle, RefreshCw, ToggleLeft, ToggleRight
} from 'lucide-react'
import { useGuildPermissions } from '@/lib/permissions'
import { getRoleLabel, getRoleBadgeClass } from '@/lib/permissions'
import { getJson, patchJson } from '@/lib/api'
import { cn } from '@/lib/cn'

// ── Types ──────────────────────────────────────────────────────

interface GuildDetail {
  id: number
  discord_id: string
  name: string
  icon_url: string | null
  member_count: number
  channel_count: number
  role_count: number
  is_active: boolean
  owner_discord_id: string | null
  bot_joined_at: string | null
  mod_case_count: number
  ticket_count: number
  settings: GuildSettings
}

interface GuildSettings {
  prefix: string | null
  language: string | null
  timezone: string | null
  mod_log_channel: string | null
  automod_enabled: boolean
  antinuke_enabled: boolean
  max_warns: number | null
  warn_action: string | null
  welcome_channel: string | null
  welcome_message: string | null
  farewell_channel: string | null
  ticket_channel: string | null
  ticket_role: string | null
  leveling_enabled: boolean
  level_channel: string | null
  xp_multiplier: number | null
  log_channel: string | null
  log_joins: boolean
  log_leaves: boolean
  log_moderation: boolean
  log_messages: boolean
}

interface ModCase {
  id: number
  action_type?: string
  action?: string
  target_discord_id?: string
  target_id?: string
  moderator_discord_id: string | null
  reason: string | null
  created_at: string
}

interface GuildCommand {
  id: number
  command_name: string
  cog: string | null
  is_enabled: boolean
  cooldown_seconds: number
}

interface TicketItem {
  id: number
  ticket_number: number
  subject: string | null
  status: string
  created_at: string
  opened_by_discord_id?: string | null
  opener_id?: string | null
}

function normalizeModCase(item: ModCase): ModCase {
  return {
    ...item,
    action_type: item.action_type ?? item.action ?? 'unknown',
    target_discord_id: item.target_discord_id ?? item.target_id ?? '—',
  }
}

function normalizeTicketItem(item: TicketItem): TicketItem {
  return {
    ...item,
    opened_by_discord_id: item.opened_by_discord_id ?? item.opener_id ?? null,
  }
}

// ── Tab definitions ─────────────────────────────────────────────

type Tab = 'overview' | 'moderation' | 'tickets' | 'commands' | 'settings' | 'members'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'moderation', label: 'Moderation', icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'tickets', label: 'Tickets', icon: <Ticket className="w-4 h-4" /> },
  { id: 'commands', label: 'Commands', icon: <Hash className="w-4 h-4" /> },
  { id: 'members', label: 'Members', icon: <Users className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
]

// ── Overview Tab ───────────────────────────────────────────────

function OverviewTab({ guild }: { guild: GuildDetail }) {
  const stats = [
    { label: 'Members', value: guild.member_count?.toLocaleString() ?? '—', icon: <Users className="w-5 h-5" />, color: 'text-cyan' },
    { label: 'Channels', value: guild.channel_count?.toLocaleString() ?? '—', icon: <Hash className="w-5 h-5" />, color: 'text-lime' },
    { label: 'Roles', value: guild.role_count?.toLocaleString() ?? '—', icon: <Shield className="w-5 h-5" />, color: 'text-amber' },
    { label: 'Open Tickets', value: guild.ticket_count?.toLocaleString() ?? '0', icon: <Ticket className="w-5 h-5" />, color: 'text-cyan' },
    { label: 'Mod Cases', value: guild.mod_case_count?.toLocaleString() ?? '0', icon: <ShieldAlert className="w-5 h-5" />, color: 'text-danger' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface/50 border border-cyan/10 rounded-xl p-4 text-center">
            <div className={cn('flex justify-center mb-2', s.color)}>{s.icon}</div>
            <div className="text-2xl font-bold text-text-1">{s.value}</div>
            <div className="text-xs text-text-3 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface/50 border border-cyan/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-2 mb-3 uppercase tracking-wider">Bot Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-3">Status</span>
              <span className={cn('font-medium', guild.is_active ? 'text-lime' : 'text-danger')}>
                {guild.is_active ? '● Active' : '● Offline'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-3">Bot Joined</span>
              <span className="text-text-2">{guild.bot_joined_at ? new Date(guild.bot_joined_at).toLocaleDateString() : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-3">Server ID</span>
              <span className="text-text-2 font-mono text-xs">{guild.discord_id}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface/50 border border-cyan/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-2 mb-3 uppercase tracking-wider">Auto-mod</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-3">Automod</span>
              <span className={cn('font-medium', guild.settings?.automod_enabled ? 'text-lime' : 'text-text-3')}>
                {guild.settings?.automod_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-3">Antinuke</span>
              <span className={cn('font-medium', guild.settings?.antinuke_enabled ? 'text-lime' : 'text-text-3')}>
                {guild.settings?.antinuke_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-3">Max Warns</span>
              <span className="text-text-2">{guild.settings?.max_warns ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Moderation Tab ─────────────────────────────────────────────

function ModerationTab({ guildId }: { guildId: number }) {
  const [cases, setCases] = useState<ModCase[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setLoading(true)
    getJson<{ items?: ModCase[]; cases?: ModCase[]; total: number }>(`/api/guilds/${guildId}/moderation?page=${page}&per_page=20`)
      .then((d) => {
        setCases((d.items ?? d.cases ?? []).map(normalizeModCase))
        setTotal(d.total)
      })
      .catch(() => setCases([]))
      .finally(() => setLoading(false))
  }, [guildId, page])

  const ACTION_COLORS: Record<string, string> = {
    ban: 'text-danger bg-danger/10 border-danger/30',
    kick: 'text-amber bg-amber/10 border-amber/30',
    mute: 'text-amber bg-amber/10 border-amber/30',
    warn: 'text-cyan bg-cyan/10 border-cyan/30',
    timeout: 'text-amber bg-amber/10 border-amber/30',
    unban: 'text-lime bg-lime/10 border-lime/30',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-3">{total} total cases</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-cyan animate-spin" /></div>
      ) : cases.length === 0 ? (
        <div className="text-center py-12 text-text-3">No moderation cases found</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-cyan/10">
            <table className="w-full text-sm">
              <thead className="bg-surface/50">
                <tr className="text-left text-text-3 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">Case #</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan/5">
                {cases.map((c) => {
                  const actionType = c.action_type ?? 'unknown'
                  return (
                  <tr key={c.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-4 py-3 text-text-3 font-mono text-xs">#{c.id}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border capitalize', ACTION_COLORS[actionType] ?? 'text-text-2 bg-surface border-cyan/10')}>
                        {actionType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-2 truncate max-w-[120px]">{c.target_discord_id}</td>
                    <td className="px-4 py-3 text-text-2 truncate max-w-[200px]">{c.reason ?? '—'}</td>
                    <td className="px-4 py-3 text-text-3 whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs text-text-2 border border-cyan/10 rounded-lg disabled:opacity-40 hover:border-cyan/30 transition-colors">
                Previous
              </button>
              <span className="text-xs text-text-3">Page {page} of {Math.ceil(total / 20)}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1.5 text-xs text-text-2 border border-cyan/10 rounded-lg disabled:opacity-40 hover:border-cyan/30 transition-colors">
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Tickets Tab ────────────────────────────────────────────────

function TicketsTab({ guildId }: { guildId: number }) {
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setLoading(true)
    getJson<{ items?: TicketItem[]; tickets?: TicketItem[]; total: number }>(`/api/guilds/${guildId}/tickets?per_page=20`)
      .then((d) => {
        setTickets((d.items ?? d.tickets ?? []).map(normalizeTicketItem))
        setTotal(d.total)
      })
      .catch(() => setTickets([]))
      .finally(() => setLoading(false))
  }, [guildId])

  const STATUS_COLORS: Record<string, string> = {
    open: 'text-lime bg-lime/10 border-lime/30',
    closed: 'text-text-3 bg-surface border-cyan/10',
    pending: 'text-amber bg-amber/10 border-amber/30',
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-3">{total} total tickets</p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-cyan animate-spin" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-text-3">No tickets found</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cyan/10">
          <table className="w-full text-sm">
            <thead className="bg-surface/50">
              <tr className="text-left text-text-3 text-xs uppercase tracking-wider">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Opened By</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan/5">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-surface/30 transition-colors">
                  <td className="px-4 py-3 text-text-3 font-mono text-xs">#{t.ticket_number}</td>
                  <td className="px-4 py-3 text-text-1 truncate max-w-[200px]">{t.subject ?? 'No subject'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border capitalize', STATUS_COLORS[t.status] ?? 'text-text-2 bg-surface border-cyan/10')}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-2 truncate max-w-[120px]">{t.opened_by_discord_id ?? '—'}</td>
                  <td className="px-4 py-3 text-text-3 whitespace-nowrap">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Commands Tab ───────────────────────────────────────────────

function CommandsTab({ guildId }: { guildId: number }) {
  const [commands, setCommands] = useState<GuildCommand[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getJson<GuildCommand[]>(`/api/guilds/${guildId}/commands`)
      .then(setCommands)
      .catch(() => setCommands([]))
      .finally(() => setLoading(false))
  }, [guildId])

  async function toggleCommand(cmd: GuildCommand) {
    setSaving(cmd.command_name)
    try {
      await patchJson(`/api/guilds/${guildId}/commands/${cmd.command_name}`, { is_enabled: !cmd.is_enabled })
      setCommands((prev) => prev.map((c) => c.id === cmd.id ? { ...c, is_enabled: !c.is_enabled } : c))
    } catch {
      // ignore
    } finally {
      setSaving(null)
    }
  }

  const byCog = commands.reduce<Record<string, GuildCommand[]>>((acc, cmd) => {
    const cog = cmd.cog ?? 'General'
    if (!acc[cog]) acc[cog] = []
    acc[cog].push(cmd)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-cyan animate-spin" /></div>
      ) : commands.length === 0 ? (
        <div className="text-center py-12 text-text-3">No commands configured yet</div>
      ) : (
        Object.entries(byCog).sort(([a], [b]) => a.localeCompare(b)).map(([cog, cmds]) => (
          <section key={cog}>
            <h3 className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-2">{cog}</h3>
            <div className="bg-surface/30 border border-cyan/10 rounded-xl divide-y divide-cyan/5 overflow-hidden">
              {cmds.map((cmd) => (
                <div key={cmd.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface/50 transition-colors">
                  <div>
                    <span className="font-mono text-sm text-text-1">/{cmd.command_name}</span>
                    {cmd.cooldown_seconds > 0 && (
                      <span className="ml-2 text-xs text-text-3">{cmd.cooldown_seconds}s cooldown</span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleCommand(cmd)}
                    disabled={saving === cmd.command_name}
                    className="flex items-center gap-1.5 text-xs transition-colors"
                  >
                    {saving === cmd.command_name ? (
                      <Loader2 className="w-4 h-4 animate-spin text-cyan" />
                    ) : cmd.is_enabled ? (
                      <ToggleRight className="w-6 h-6 text-lime" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-text-3" />
                    )}
                    <span className={cmd.is_enabled ? 'text-lime' : 'text-text-3'}>
                      {cmd.is_enabled ? 'On' : 'Off'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

// ── Settings Tab ───────────────────────────────────────────────

function SettingsTab({ guildId, initialSettings, canEdit }: { guildId: number; initialSettings: GuildSettings; canEdit: boolean }) {
  const [settings, setSettings] = useState<GuildSettings>(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof GuildSettings>(key: K, value: GuildSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    try {
      await patchJson(`/api/guilds/${guildId}/settings`, settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const inputCls = cn(
    'w-full bg-surface border border-cyan/10 rounded-lg px-3 py-2 text-sm text-text-1 placeholder:text-text-3',
    'focus:outline-none focus:border-cyan/50 transition-colors',
    !canEdit && 'opacity-60 cursor-not-allowed'
  )

  const sectionTitle = (title: string) => (
    <h3 className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-3 mt-6 first:mt-0">{title}</h3>
  )

  const Toggle = ({ label, field }: { label: string; field: keyof GuildSettings }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-text-2">{label}</span>
      <button
        onClick={() => canEdit && set(field, !settings[field] as GuildSettings[typeof field])}
        disabled={!canEdit}
        className="flex items-center gap-2"
      >
        {settings[field] ? (
          <ToggleRight className="w-6 h-6 text-lime" />
        ) : (
          <ToggleLeft className="w-6 h-6 text-text-3" />
        )}
      </button>
    </div>
  )

  return (
    <div className="space-y-2 max-w-2xl">
      {!canEdit && (
        <div className="flex items-center gap-2 p-3 bg-amber/10 border border-amber/30 rounded-lg text-amber text-sm mb-4">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          You need Owner or Manager access to edit settings.
        </div>
      )}

      {sectionTitle('General')}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-3 mb-1 block">Prefix</label>
          <input className={inputCls} value={settings.prefix ?? ''} onChange={(e) => set('prefix', e.target.value)} placeholder="!" disabled={!canEdit} />
        </div>
        <div>
          <label className="text-xs text-text-3 mb-1 block">Language</label>
          <input className={inputCls} value={settings.language ?? ''} onChange={(e) => set('language', e.target.value)} placeholder="en" disabled={!canEdit} />
        </div>
        <div>
          <label className="text-xs text-text-3 mb-1 block">Timezone</label>
          <input className={inputCls} value={settings.timezone ?? ''} onChange={(e) => set('timezone', e.target.value)} placeholder="UTC" disabled={!canEdit} />
        </div>
        <div>
          <label className="text-xs text-text-3 mb-1 block">Mod Log Channel ID</label>
          <input className={inputCls} value={settings.mod_log_channel ?? ''} onChange={(e) => set('mod_log_channel', e.target.value)} placeholder="Channel ID" disabled={!canEdit} />
        </div>
      </div>

      {sectionTitle('Auto-moderation')}
      <div className="bg-surface/30 border border-cyan/10 rounded-xl px-4 divide-y divide-cyan/5">
        <Toggle label="Automod Enabled" field="automod_enabled" />
        <Toggle label="Antinuke Enabled" field="antinuke_enabled" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-xs text-text-3 mb-1 block">Max Warns before action</label>
          <input className={inputCls} type="number" min={1} value={settings.max_warns ?? ''} onChange={(e) => set('max_warns', Number(e.target.value))} placeholder="3" disabled={!canEdit} />
        </div>
        <div>
          <label className="text-xs text-text-3 mb-1 block">Warn Action</label>
          <select className={inputCls} value={settings.warn_action ?? ''} onChange={(e) => set('warn_action', e.target.value)} disabled={!canEdit}>
            <option value="">None</option>
            <option value="mute">Mute</option>
            <option value="kick">Kick</option>
            <option value="ban">Ban</option>
          </select>
        </div>
      </div>

      {sectionTitle('Welcome & Farewell')}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-3 mb-1 block">Welcome Channel ID</label>
          <input className={inputCls} value={settings.welcome_channel ?? ''} onChange={(e) => set('welcome_channel', e.target.value)} placeholder="Channel ID" disabled={!canEdit} />
        </div>
        <div>
          <label className="text-xs text-text-3 mb-1 block">Farewell Channel ID</label>
          <input className={inputCls} value={settings.farewell_channel ?? ''} onChange={(e) => set('farewell_channel', e.target.value)} placeholder="Channel ID" disabled={!canEdit} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-text-3 mb-1 block">Welcome Message</label>
          <textarea className={cn(inputCls, 'resize-none')} rows={2} value={settings.welcome_message ?? ''} onChange={(e) => set('welcome_message', e.target.value)} placeholder="Welcome {user} to {server}!" disabled={!canEdit} />
        </div>
      </div>

      {sectionTitle('Tickets')}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-3 mb-1 block">Ticket Channel ID</label>
          <input className={inputCls} value={settings.ticket_channel ?? ''} onChange={(e) => set('ticket_channel', e.target.value)} placeholder="Channel ID" disabled={!canEdit} />
        </div>
        <div>
          <label className="text-xs text-text-3 mb-1 block">Support Role ID</label>
          <input className={inputCls} value={settings.ticket_role ?? ''} onChange={(e) => set('ticket_role', e.target.value)} placeholder="Role ID" disabled={!canEdit} />
        </div>
      </div>

      {sectionTitle('Leveling')}
      <div className="bg-surface/30 border border-cyan/10 rounded-xl px-4 divide-y divide-cyan/5">
        <Toggle label="Leveling Enabled" field="leveling_enabled" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-xs text-text-3 mb-1 block">Level Channel ID</label>
          <input className={inputCls} value={settings.level_channel ?? ''} onChange={(e) => set('level_channel', e.target.value)} placeholder="Channel ID" disabled={!canEdit} />
        </div>
        <div>
          <label className="text-xs text-text-3 mb-1 block">XP Multiplier</label>
          <input className={inputCls} type="number" step={0.1} min={0.1} value={settings.xp_multiplier ?? ''} onChange={(e) => set('xp_multiplier', Number(e.target.value))} placeholder="1.0" disabled={!canEdit} />
        </div>
      </div>

      {sectionTitle('Logging')}
      <div className="mb-3">
        <label className="text-xs text-text-3 mb-1 block">Log Channel ID</label>
        <input className={cn(inputCls, 'max-w-sm')} value={settings.log_channel ?? ''} onChange={(e) => set('log_channel', e.target.value)} placeholder="Channel ID" disabled={!canEdit} />
      </div>
      <div className="bg-surface/30 border border-cyan/10 rounded-xl px-4 divide-y divide-cyan/5">
        <Toggle label="Log Joins" field="log_joins" />
        <Toggle label="Log Leaves" field="log_leaves" />
        <Toggle label="Log Moderation" field="log_moderation" />
        <Toggle label="Log Messages" field="log_messages" />
      </div>

      {canEdit && (
        <div className="pt-4">
          <button
            onClick={save}
            disabled={saving}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all',
              saved
                ? 'bg-lime/20 text-lime border border-lime/40'
                : 'bg-cyan/10 hover:bg-cyan/20 text-cyan border border-cyan/30 hover:border-cyan/60'
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Members Tab ────────────────────────────────────────────────

interface HubMember {
  id: number
  user_id: number
  username: string
  discord_id: string | null
  is_admin: boolean
  can_manage: boolean
  added_at: string | null
}

function MembersTab({ guildId }: { guildId: number }) {
  const [membersData, setMembersData] = React.useState<{ total: number; members: HubMember[] } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    setLoading(true)
    setError(false)
    getJson<{ total: number; members: HubMember[] }>(`/api/guilds/${guildId}/members`)
      .then((d) => { setMembersData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [guildId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-0">Hub Members</h3>
          <p className="text-sm text-text-2 mt-0.5">
            {membersData ? `${membersData.total} dashboard user${membersData.total !== 1 ? 's' : ''} with access to this server` : 'Loading…'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg border border-line bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load members. You may need admin access.
        </div>
      ) : (membersData?.members ?? []).length === 0 ? (
        <div className="py-10 text-center text-sm text-text-2">
          No dashboard users have been granted access to this server yet.
        </div>
      ) : (
        <div className="space-y-2">
          {(membersData?.members ?? []).map((member) => (
            <div key={member.id} className="flex items-center justify-between rounded-lg border border-line bg-surface-strong/40 px-4 py-3 hover:border-cyan/20 transition">
              <div className="flex items-center gap-3">
                <img
                  src={
                    member.discord_id
                      ? `https://cdn.discordapp.com/embed/avatars/${Number(member.discord_id) % 5}.png`
                      : '/sloth-lee-logo.png'
                  }
                  alt={member.username}
                  className="h-8 w-8 rounded-full border border-line bg-white/10 object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-text-0">{member.username}</p>
                  {member.discord_id && (
                    <p className="text-xs text-text-3 font-mono">#{member.discord_id}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {member.is_admin && (
                  <span className="rounded-full border border-cyan/25 bg-cyan/10 px-2 py-0.5 text-[11px] font-mono text-cyan">Admin</span>
                )}
                {member.can_manage && (
                  <span className="rounded-full border border-lime/25 bg-lime/10 px-2 py-0.5 text-[11px] font-mono text-lime">Can Manage</span>
                )}
                {member.added_at && (
                  <span className="text-xs text-text-3">Added {new Date(member.added_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────

export function ServerDetailPage() {
  const { guildId } = useParams<{ guildId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as Tab) ?? 'overview'

  const { canManage, isAdmin, isOwner, isManager, role } = useGuildPermissions(guildId ? Number(guildId) : null)
  const roleLabel = getRoleLabel(role)
  const roleClass = getRoleBadgeClass(role)

  const [guild, setGuild] = useState<GuildDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!guildId) return
    setLoading(true)
    setError(null)
    getJson<GuildDetail>(`/api/guilds/${guildId}`)
      .then(setGuild)
      .catch(() => setError('Could not load server details. You may not have access.'))
      .finally(() => setLoading(false))
  }, [guildId])

  function setTab(tab: Tab) {
    setSearchParams({ tab }, { replace: true })
  }

  const canEdit = isAdmin || isOwner || isManager

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-cyan animate-spin" />
      </div>
    )
  }

  if (error || !guild) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-danger/60" />
        <p className="text-text-2">{error ?? 'Server not found'}</p>
        <Link to="/servers" className="flex items-center gap-2 text-cyan text-sm hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Servers
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Breadcrumb + Header */}
      <div>
        <Link to="/servers" className="flex items-center gap-1.5 text-xs text-text-3 hover:text-cyan transition-colors mb-3">
          <ArrowLeft className="w-3.5 h-3.5" />
          All Servers
        </Link>

        <div className="flex items-center gap-4 flex-wrap">
          {guild.icon_url ? (
            <img src={guild.icon_url} alt={guild.name} className="w-16 h-16 rounded-2xl border border-cyan/20 object-cover flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center flex-shrink-0">
              <Server className="w-8 h-8 text-cyan/50" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-text-1 truncate">{guild.name}</h1>
              <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1', roleClass)}>
                {role === 'owner' && <Crown className="w-3 h-3" />}
                {role === 'manager' && <Shield className="w-3 h-3" />}
                {roleLabel}
              </span>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', guild.is_active ? 'text-lime bg-lime/10 border border-lime/30' : 'text-text-3 bg-surface border border-cyan/10')}>
                {guild.is_active ? '● Active' : '● Offline'}
              </span>
            </div>
            <p className="text-sm text-text-3 mt-0.5">
              {guild.member_count?.toLocaleString() ?? '—'} members · {guild.channel_count ?? '—'} channels
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-cyan/10">
        <div className="flex gap-1 overflow-x-auto pb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all -mb-px',
                activeTab === tab.id
                  ? 'border-cyan text-cyan'
                  : 'border-transparent text-text-3 hover:text-text-2 hover:border-cyan/30'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && <OverviewTab guild={guild} />}
        {activeTab === 'moderation' && <ModerationTab guildId={guild.id} />}
        {activeTab === 'tickets' && <TicketsTab guildId={guild.id} />}
        {activeTab === 'commands' && <CommandsTab guildId={guild.id} />}
        {activeTab === 'members' && <MembersTab guildId={guild.id} />}
        {activeTab === 'settings' && (
          <SettingsTab
            guildId={guild.id}
            initialSettings={guild.settings ?? {} as GuildSettings}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  )
}
