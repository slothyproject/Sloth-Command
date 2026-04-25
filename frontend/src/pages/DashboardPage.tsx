import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Activity, Bell, Bot, ChevronRight, Server, Shield, Ticket, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

import { StatCard } from "../components/dashboard/StatCard";
import { formatDate, formatNumber, formatRelativeDate } from "../lib/format";
import { getJson } from "../lib/api";
import { createEventStream } from "../lib/sse";
import { useAccessibleGuilds, getRoleLabel, getRoleBadgeClass } from "@/lib/permissions";
import { cn } from "@/lib/cn";

interface GuildSummary {
  id: number;
  name: string;
  member_count: number;
}

interface CaseSummary {
  id: number;
  case_number: number;
  action: string;
  target_name?: string | null;
  target_id: string;
  reason?: string | null;
  created_at: string;
  guild_name?: string | null;
}

interface TicketSummary {
  id: number;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  assigned_to?: string | null;
  guild_name?: string | null;
}

interface NotificationSummary {
  id: number;
  title: string;
  body?: string | null;
  created_at: string;
  is_read: boolean;
}

interface OverviewResponse {
  stats: {
    guilds: number;
    members: number;
    channels: number;
    commands_today: number;
    uptime: string;
    latency_ms: number;
    version: string;
    online: boolean;
  };
  guilds: GuildSummary[];
  recent_cases: CaseSummary[];
  recent_tickets: TicketSummary[];
  notifications: {
    unread: number;
    items: NotificationSummary[];
  };
  trend?: Array<{ date: string; tickets: number; cases: number }>;
}

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(13, 18, 30, 0.97)",
  border: "1px solid rgba(136, 192, 208, 0.2)",
  borderRadius: "8px",
  color: "#d8dee9",
  fontSize: 12,
} as const;

function getTicketSlaState(createdAt: string, priority: string, status: string) {
  if (status === "closed" || status === "resolved") {
    return "closed";
  }

  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  const thresholds: Record<string, number> = { urgent: 1, high: 4, normal: 12, low: 24 };
  const limit = thresholds[priority.toLowerCase()] ?? 12;

  if (ageHours >= limit) {
    return "breached";
  }

  if (ageHours >= limit * 0.7) {
    return "risk";
  }

  return "ok";
}

export function DashboardPage() {
  const [eventTick, setEventTick] = useState(0);
  const guilds = useAccessibleGuilds();

  const quickGuilds = useMemo(() =>
    [...guilds]
      .sort((a, b) => {
        const order: Record<string, number> = { owner: 0, manager: 1, admin_override: 2 };
        return (order[a.role] ?? 9) - (order[b.role] ?? 9);
      })
      .slice(0, 6),
    [guilds]
  );

  const { data } = useQuery({
    queryKey: ["overview", eventTick],
    queryFn: () => getJson<OverviewResponse>("/api/overview"),
    retry: false,
    refetchInterval: 30000,
  });

  useEffect(() => {
    const stream = createEventStream((payload) => {
      const event = payload as { type?: string };
      if (["bot_state", "ticket_open", "mod_action", "guild_join", "guild_leave"].includes(event.type ?? "")) {
        setEventTick((value) => value + 1);
      }
    }, () => {
      window.setTimeout(() => setEventTick((value) => value + 1), 3000);
    });

    return () => stream.close();
  }, []);

  const topGuilds = useMemo(() => data?.guilds.slice(0, 4) ?? [], [data?.guilds]);
  const ticketOps = useMemo(() => {
    const recentTickets = data?.recent_tickets ?? [];
    const openTickets = recentTickets.filter((ticket) => !["closed", "resolved"].includes(ticket.status.toLowerCase()));

    const awaitingAck = openTickets.filter((ticket) => !ticket.assigned_to).length;
    const atRisk = openTickets.filter((ticket) => getTicketSlaState(ticket.created_at, ticket.priority, ticket.status) === "risk").length;
    const breached = openTickets.filter((ticket) => getTicketSlaState(ticket.created_at, ticket.priority, ticket.status) === "breached").length;

    const avgOpenAgeHours = openTickets.length > 0
      ? Math.round(openTickets.reduce((sum, ticket) => sum + ((Date.now() - new Date(ticket.created_at).getTime()) / 3_600_000), 0) / openTickets.length)
      : 0;

    return {
      awaitingAck,
      atRisk,
      breached,
      avgOpenAgeHours,
      openCount: openTickets.length,
    };
  }, [data?.recent_tickets]);

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <section className="dashboard-chrome rounded-[1.8rem] p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">Sloth Dojo</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-line bg-white/5 px-3 py-2">
              <img src="/sloth-lee-logo.png" alt="Sloth Lee" className="h-7 w-7 rounded-full border border-line bg-white/10 p-1" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-2">Defender of Discord. Keeper of chill.</span>
            </div>
            <h2 className="font-display text-3xl font-semibold text-text-0">Sloth Dojo Dashboard</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-2">Your peaceful command center for moderation, tickets, and server operations. Stay calm, stay focused, protect your realm with ease.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-1">
              <span className="rounded-full border border-line bg-white/5 px-3 py-1">Zen workflows</span>
              <span className="rounded-full border border-line bg-white/5 px-3 py-1">Live guild telemetry</span>
              <span className="rounded-full border border-line bg-white/5 px-3 py-1">Peaceful protection</span>
            </div>
          </div>
          <div className="rounded-2xl border border-sloth-green/20 bg-sloth-green/10 px-4 py-3 text-sm text-sloth-green shadow-accent">
            {data?.stats.online ? `Bot online · ${data.stats.latency_ms} ms` : "Awaiting live bot state"}
          </div>
        </div>
      </section>

      {/* Your Servers quick-access */}
      {quickGuilds.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-3 uppercase tracking-wider">Your Servers</h2>
            <Link to="/servers" className="text-xs text-cyan hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickGuilds.map((g) => {
              const roleClass = getRoleBadgeClass(g.role);
              return (
                <Link
                  key={g.id}
                  to={`/servers/${g.id}`}
                  className="group flex flex-col items-center gap-2 p-3 bg-surface/50 border border-cyan/10 hover:border-cyan/40 rounded-xl transition-all hover:-translate-y-0.5 text-center"
                >
                  {g.icon_url ? (
                    <img src={g.icon_url} alt={g.name} className="w-10 h-10 rounded-xl border border-cyan/20 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center">
                      <Server className="w-5 h-5 text-cyan/50" />
                    </div>
                  )}
                  <p className="text-xs font-medium text-text-2 group-hover:text-cyan transition-colors truncate w-full">{g.name}</p>
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full w-full text-center", roleClass)}>
                    {getRoleLabel(g.role)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Stat cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Guilds" value={formatNumber(data?.stats.guilds)} meta="Connected servers in scope" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Members" value={formatNumber(data?.stats.members)} meta="Tracked member footprint" icon={<Shield className="h-5 w-5" />} />
        <StatCard label="Latency" value={data?.stats.latency_ms ? `${data.stats.latency_ms} ms` : "--"} meta="Live gateway response" icon={<Activity className="h-5 w-5" />} />
        <StatCard label="Uptime" value={data?.stats.uptime ?? "--"} meta={`Version ${data?.stats.version ?? "--"}`} icon={<Bot className="h-5 w-5" />} />
      </section>

      {/* Ticket SLA */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="dashboard-chrome rounded-[1.6rem] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-200">Awaiting ack</p>
          <p className="mt-3 text-3xl font-semibold text-text-0">{ticketOps.awaitingAck}</p>
          <p className="mt-2 text-sm text-text-2">Open tickets without assignee</p>
        </div>
        <div className="dashboard-chrome rounded-[1.6rem] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-orange-200">At risk</p>
          <p className="mt-3 text-3xl font-semibold text-text-0">{ticketOps.atRisk}</p>
          <p className="mt-2 text-sm text-text-2">Tickets approaching SLA limit</p>
        </div>
        <div className="dashboard-chrome rounded-[1.6rem] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rose-200">Breached</p>
          <p className="mt-3 text-3xl font-semibold text-text-0">{ticketOps.breached}</p>
          <p className="mt-2 text-sm text-text-2">Open tickets beyond SLA window</p>
        </div>
        <div className="dashboard-chrome rounded-[1.6rem] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Avg open age</p>
          <p className="mt-3 text-3xl font-semibold text-text-0">{ticketOps.openCount > 0 ? `${ticketOps.avgOpenAgeHours}h` : "--"}</p>
          <p className="mt-2 text-sm text-text-2">Across {ticketOps.openCount} active tickets</p>
        </div>
      </section>

      {/* Trend charts */}
      {(data?.trend ?? []).length > 0 && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="dashboard-chrome rounded-[1.6rem] p-5">
            <div className="mb-4 flex items-center gap-2 text-cyan">
              <TrendingUp className="h-4 w-4" />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Ticket trend · 7d</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data?.trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,192,208,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="tickets" stroke="#88c0d0" strokeWidth={2} dot={{ fill: "#a3be8c", r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="dashboard-chrome rounded-[1.6rem] p-5">
            <div className="mb-4 flex items-center gap-2 text-cyan">
              <Activity className="h-4 w-4" />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Mod activity · 7d</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,192,208,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="cases" fill="#b48ead" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Operational inbox + notifications */}
      <section className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
        <div className="grid gap-4">
          <div className="dashboard-chrome rounded-[1.6rem] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Operational inbox</p>
                <h3 className="mt-2 font-display text-xl font-semibold text-text-0">Recent moderation and tickets</h3>
              </div>
              <div className="rounded-full border border-line bg-white/5 px-3 py-1 text-xs text-text-1">Unread {data?.notifications.unread ?? 0}</div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.12em]">
              <Link to="/moderation" className="dashboard-chip rounded-full px-3 py-1">moderation queue</Link>
              <Link to="/tickets" className="dashboard-chip rounded-full px-3 py-1">ticket queue</Link>
              <Link to="/analytics" className="dashboard-chip rounded-full px-3 py-1">analytics board</Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center gap-2 text-text-1"><Shield className="h-4 w-4 text-cyan" /> Moderation feed</div>
                <div className="space-y-3">
                  {(data?.recent_cases ?? []).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-line bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-text-0">#{item.case_number} · {item.action}</p>
                        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-2">{formatRelativeDate(item.created_at)}</span>
                      </div>
                      <p className="mt-2 text-sm text-text-1">{item.target_name || item.target_id}</p>
                      <p className="mt-1 text-xs text-text-2">{item.guild_name ?? "Unknown guild"}</p>
                      <Link to="/moderation" className="mt-2 inline-flex rounded-xl border border-line bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-text-1">view queue</Link>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2 text-text-1"><Ticket className="h-4 w-4 text-cyan" /> Ticket queue</div>
                <div className="space-y-3">
                  {(data?.recent_tickets ?? []).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-line bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-text-0">#{item.ticket_number} · {item.subject}</p>
                        <span className="rounded-full border border-line bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-text-1">{item.status}</span>
                      </div>
                      <p className="mt-2 text-xs text-text-2">{item.guild_name ?? "Unknown guild"} · {formatDate(item.created_at)}</p>
                      <Link to={`/tickets/${item.id}`} className="mt-2 inline-flex rounded-xl border border-line bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-text-1">open ticket</Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-chrome rounded-[1.6rem] p-5">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Guild focus</p>
            <div className="grid gap-3 md:grid-cols-2">
              {topGuilds.map((guild) => (
                <Link key={guild.id} to={`/servers/${guild.id}`} className="rounded-2xl border border-line bg-white/5 p-4 hover:border-cyan/30 transition-colors">
                  <p className="text-sm font-medium text-text-0">{guild.name}</p>
                  <p className="mt-1 text-xs text-text-2">{formatNumber(guild.member_count)} members</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="dashboard-chrome rounded-[1.6rem] p-5">
          <div className="mb-4 flex items-center gap-2 text-cyan"><Bell className="h-4 w-4" /> <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Notification stream</span></div>
          <div className="space-y-3">
            {(data?.notifications.items ?? []).map((item) => (
              <div key={item.id} className="rounded-2xl border border-line bg-white/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-text-0">{item.title}</p>
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-2">{formatRelativeDate(item.created_at)}</span>
                </div>
                {item.body ? <p className="mt-2 text-sm leading-6 text-text-2">{item.body}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
