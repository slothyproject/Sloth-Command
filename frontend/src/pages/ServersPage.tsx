import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Server, Users, Crown, Shield, ExternalLink, ChevronRight } from 'lucide-react'
import { useAccessibleGuilds } from '@/lib/permissions'
import { getRoleLabel, getRoleBadgeClass } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'
import type { UserGuild } from '@/store/authStore'
import { cn } from '@/lib/cn'
import { getJson } from '@/lib/api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = ((import.meta as unknown) as Record<string, unknown>).env as Record<string, string> | undefined
const DEFAULT_BOT_INVITE_URL = `https://discord.com/api/oauth2/authorize?client_id=${_env?.VITE_DISCORD_CLIENT_ID ?? ''}&permissions=8&scope=bot%20applications.commands`

function GuildCard({ guild }: { guild: UserGuild }) {
  const iconUrl = guild.icon_url ?? null
  const roleLabel = getRoleLabel(guild.role)
  const roleClass = getRoleBadgeClass(guild.role)

  return (
    <Link
      to={`/servers/${guild.id}`}
      className="group block bg-gradient-to-br from-surface via-panel to-surface-strong border border-cyan/10 hover:border-cyan/40 rounded-xl p-5 transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,212,255,0.08)] hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-4">
        {/* Guild icon */}
        <div className="flex-shrink-0">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={guild.name}
              className="w-14 h-14 rounded-2xl border border-cyan/20 object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center">
              <Server className="w-7 h-7 text-cyan/50" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-text-1 group-hover:text-cyan transition-colors truncate text-base leading-tight">
              {guild.name}
            </h3>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1', roleClass)}>
              {guild.role === 'owner' && <Crown className="w-2.5 h-2.5" />}
              {guild.role === 'manager' && <Shield className="w-2.5 h-2.5" />}
              {roleLabel}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-4 text-xs text-text-3">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {guild.member_count?.toLocaleString() ?? '—'} members
            </span>
            <span className={cn('flex items-center gap-1 font-medium', guild.is_active ? 'text-lime' : 'text-text-3')}>
              <span className={cn('w-1.5 h-1.5 rounded-full', guild.is_active ? 'bg-lime' : 'bg-text-3')} />
              {guild.is_active ? 'Bot Active' : 'Bot Offline'}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-4 h-4 text-text-3 group-hover:text-cyan transition-colors flex-shrink-0 mt-1" />
      </div>

      {/* ID badge */}
      <div className="mt-3 pt-3 border-t border-cyan/5 flex items-center justify-between">
        <span className="text-[10px] text-text-3 font-mono">ID: {guild.discord_id}</span>
        <span className="text-[10px] text-cyan/50 font-medium group-hover:text-cyan transition-colors flex items-center gap-1">
          Manage <ExternalLink className="w-2.5 h-2.5" />
        </span>
      </div>
    </Link>
  )
}

export function ServersPage() {
  const user = useAuthStore((s) => s.user)
  const guilds = useAccessibleGuilds()
  const [query, setQuery] = useState('')
  const [botInviteUrl, setBotInviteUrl] = useState(DEFAULT_BOT_INVITE_URL)

  useEffect(() => {
    getJson<{ url?: string }>('/api/bot/invite')
      .then((payload) => {
        if (payload.url) {
          setBotInviteUrl(payload.url)
        }
      })
      .catch(() => {
        // Keep the frontend fallback when the API is unavailable.
      })
  }, [])

  const filtered = guilds.filter((g) =>
    g.name.toLowerCase().includes(query.toLowerCase())
  )

  const owned = filtered.filter((g) => g.role === 'owner')
  const managed = filtered.filter((g) => g.role === 'manager')
  const adminOverride = filtered.filter((g) => g.role === 'admin_override')

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-cyan font-display">Your Servers</h1>
          <p className="text-text-2 mt-1">
            {guilds.length} server{guilds.length !== 1 ? 's' : ''} accessible
            {user?.is_owner ? <span className="ml-2 text-amber text-xs font-bold border border-amber/30 bg-amber/10 px-2 py-0.5 rounded-full">Owner View</span> : user?.is_admin ? <span className="ml-2 text-lime text-xs font-bold border border-lime/30 bg-lime/10 px-2 py-0.5 rounded-full">Admin View</span> : null}
          </p>
        </div>
        <a
          href={botInviteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-cyan/10 hover:bg-cyan/20 border border-cyan/30 hover:border-cyan/60 text-cyan text-sm font-medium rounded-lg transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Add Server
        </a>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3 pointer-events-none" />
        <input
          type="text"
          placeholder="Search servers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-surface border border-cyan/10 hover:border-cyan/30 focus:border-cyan/50 focus:outline-none rounded-lg text-text-1 placeholder:text-text-3 text-sm transition-colors"
        />
      </div>

      {guilds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Server className="w-16 h-16 text-cyan/20 mb-4" />
          <h3 className="text-xl font-semibold text-text-2 mb-2">No servers yet</h3>
          <p className="text-text-3 text-sm mb-6 max-w-sm">
            Invite the Sloth Lee bot to your Discord server to start managing it from this dashboard.
          </p>
          <a
            href={botInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan text-void font-semibold rounded-lg hover:bg-cyan/90 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Sloth Lee to a Server
          </a>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="w-10 h-10 text-cyan/20 mb-3" />
          <p className="text-text-3">No servers match "{query}"</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Owned */}
          {owned.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-text-3 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber" />
                Owned by you ({owned.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {owned.map((g) => <GuildCard key={g.id} guild={g} />)}
              </div>
            </section>
          )}

          {/* Managed */}
          {managed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-text-3 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan" />
                Manager access ({managed.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {managed.map((g) => <GuildCard key={g.id} guild={g} />)}
              </div>
            </section>
          )}

          {/* Admin override */}
          {adminOverride.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-text-3 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-lime" />
                Admin override ({adminOverride.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {adminOverride.map((g) => <GuildCard key={g.id} guild={g} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

