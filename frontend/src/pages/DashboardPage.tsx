import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Activity, Bell, Bot, Shield, Ticket, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { StatCard } from "../components/dashboard/StatCard";
import { formatDate, formatNumber, formatRelativeDate } from "../lib/format";
import { getJson } from "../lib/api";
import { createEventStream } from "../lib/sse";

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
}

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
  const isLoading = !data;

  return (
    <div className="space-y-6">
      <section className="dashboard-chrome rounded-[1.8rem] p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan">Guardian dojo</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-line bg-white/5 px-3 py-2">
              <img src="/sloth-lee-logo.png" alt="Sloth Lee" className="h-7 w-7 rounded-full border border-line bg-white/10 p-1" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-2">Defender of Discord. Keeper of chill.</span>
            </div>
            <h2 className="font-display text-3xl font-semibold text-text-0">Realm operations overview</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-2">Your live moderation, ticketing, notifications, and server operations in a unified Sloth Lee command experience.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-1">
              <span className="rounded-full border border-line bg-white/5 px-3 py-1">Role-aware workflows</span>
              <span className="rounded-full border border-line bg-white/5 px-3 py-1">Live guild telemetry</span>
              <span className="rounded-full border border-line bg-white/5 px-3 py-1">Moderation confidence</span>
            </div>
          </div>
          <div className="rounded-2xl border border-lime/20 bg-lime/10 px-4 py-3 text-sm text-lime shadow-cyan" role="status" aria-live="polite">
            {data?.stats.online ? `Bot online · ${data.stats.latency_ms} ms` : "Awaiting live bot state"}
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="dashboard-chrome rounded-[1.6rem] p-4" aria-live="polite">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan">Loading live dashboard data...</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="dashboard-skeleton rounded-2xl border border-line px-3 py-4" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Guilds" value={formatNumber(data?.stats.guilds)} meta="Connected servers in scope" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Members" value={formatNumber(data?.stats.members)} meta="Tracked member footprint" icon={<Shield className="h-5 w-5" />} />
        <StatCard label="Latency" value={data?.stats.latency_ms ? `${data.stats.latency_ms} ms` : "--"} meta="Live gateway response" icon={<Activity className="h-5 w-5" />} />
        <StatCard label="Uptime" value={data?.stats.uptime ?? "--"} meta={`Version ${data?.stats.version ?? "--"}`} icon={<Bot className="h-5 w-5" />} />
      </section>

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
                  {(data?.recent_cases.length ?? 0) === 0 ? (
                    <p className="rounded-2xl border border-line bg-white/5 px-3 py-4 text-sm text-text-2">No moderation cases yet. New actions will appear here in real time.</p>
                  ) : null}
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
                  {(data?.recent_tickets.length ?? 0) === 0 ? (
                    <p className="rounded-2xl border border-line bg-white/5 px-3 py-4 text-sm text-text-2">No recent tickets yet. Incoming support load will appear here.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-chrome rounded-[1.6rem] p-5">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Guild focus</p>
            <div className="grid gap-3 md:grid-cols-2">
              {topGuilds.map((guild) => (
                <div key={guild.id} className="rounded-2xl border border-line bg-white/5 p-4">
                  <p className="text-sm font-medium text-text-0">{guild.name}</p>
                  <p className="mt-1 text-xs text-text-2">{formatNumber(guild.member_count)} members</p>
                </div>
              ))}
              {topGuilds.length === 0 ? (
                <p className="rounded-2xl border border-line bg-white/5 p-4 text-sm text-text-2 md:col-span-2">Guild summary appears once server telemetry is available.</p>
              ) : null}
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
            {(data?.notifications.items.length ?? 0) === 0 ? (
              <p className="rounded-2xl border border-line bg-white/5 p-4 text-sm text-text-2">No notifications yet. Alerts and updates will stream in here.</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}