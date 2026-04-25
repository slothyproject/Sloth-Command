import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Radio,
  Terminal,
  Timer,
  Zap,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { getJson } from "@/lib/api";

interface BotHealth {
  online: boolean;
  uptime: string;
  uptime_seconds: number;
  uptime_pct: number;
  latency_ms: number;
  commands_today: number;
  commands_yesterday: number;
  cog_count: number;
  version: string;
  guild_count: number;
  member_count: number;
  cpu_percent: number;
  memory_percent: number;
  memory_mb: number;
  last_seen: string | null;
  sparkline: { hour: number; events: number }[];
  event_breakdown: { type: string; count: number }[];
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="dashboard-chrome rounded-2xl p-5 flex items-start gap-4">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          accent ? "bg-cyan/15 text-cyan" : "bg-white/5 text-text-3"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-3 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-text-0 font-mono mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-text-3 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function GaugeBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-text-3">
        <span>{label}</span>
        <span className="font-mono">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function BotHealthPage() {
  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["bot-health-detail"],
    queryFn: () => getJson<BotHealth>("/api/bot/health-detail"),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const lastRefresh = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : "—";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-cyan/40 border-t-cyan rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-text-3 text-sm">
        Failed to load bot health data.
      </div>
    );
  }

  const cmdDelta = data.commands_yesterday > 0
    ? Math.round(((data.commands_today - data.commands_yesterday) / data.commands_yesterday) * 100)
    : null;

  const statusColor = data.online ? "bg-emerald-400" : "bg-red-400";
  const statusLabel = data.online ? "Online" : "Offline";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-text-0">Bot Health</h2>
          <p className="text-sm text-text-3 mt-0.5">
            Live status, resource usage, and 24-hour activity.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-3">
          <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
          <span className="font-medium text-text-1">{statusLabel}</span>
          <span>· refreshed {lastRefresh}</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Latency"
          value={`${data.latency_ms.toFixed(0)} ms`}
          sub={data.latency_ms < 100 ? "Excellent" : data.latency_ms < 250 ? "Good" : "Degraded"}
          icon={<Radio className="w-5 h-5" />}
          accent={data.online}
        />
        <StatCard
          label="Commands today"
          value={data.commands_today.toLocaleString()}
          sub={
            cmdDelta !== null
              ? `${cmdDelta >= 0 ? "+" : ""}${cmdDelta}% vs yesterday`
              : "No prior data"
          }
          icon={<Terminal className="w-5 h-5" />}
          accent
        />
        <StatCard
          label="Uptime"
          value={data.uptime || "offline"}
          sub={`${data.uptime_pct}% in last 24 h`}
          icon={<Timer className="w-5 h-5" />}
        />
        <StatCard
          label="Version"
          value={data.version}
          sub={`${data.cog_count} cogs loaded`}
          icon={<Zap className="w-5 h-5" />}
        />
      </div>

      {/* Charts + resource panels */}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {/* 24-hour sparkline */}
        <div className="dashboard-chrome rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan/60" />
            <span className="text-sm font-medium text-text-0">Events — last 24 hours</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.sparkline} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="10%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="90%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="hour"
                tickFormatter={(h) => `${h}h`}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#0d1117",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(h) => `Hour ${h}:00`}
                formatter={(v: number) => [v, "events"]}
              />
              <Area
                type="monotone"
                dataKey="events"
                stroke="#22d3ee"
                strokeWidth={2}
                fill="url(#evGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Right column: resources + event breakdown */}
        <div className="space-y-4">
          {/* Resource gauges */}
          <div className="dashboard-chrome rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan/60" />
              <span className="text-sm font-medium text-text-0">Resources</span>
            </div>
            <GaugeBar
              label="CPU"
              pct={data.cpu_percent}
              color={data.cpu_percent > 80 ? "bg-red-400" : "bg-cyan/70"}
            />
            <GaugeBar
              label="Memory"
              pct={data.memory_percent}
              color={data.memory_percent > 80 ? "bg-amber-400" : "bg-violet-400/70"}
            />
            <div className="flex items-center justify-between text-xs text-text-3 pt-1 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                <span>RAM used</span>
              </div>
              <span className="font-mono">{data.memory_mb.toFixed(0)} MB</span>
            </div>
            <div className="flex items-center justify-between text-xs text-text-3">
              <div className="flex items-center gap-1.5">
                <MemoryStick className="w-3.5 h-3.5" />
                <span>Guilds / Members</span>
              </div>
              <span className="font-mono">
                {data.guild_count.toLocaleString()} / {data.member_count.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Event type breakdown */}
          <div className="dashboard-chrome rounded-2xl p-5 space-y-3">
            <span className="text-sm font-medium text-text-0">Event types (24 h)</span>
            {data.event_breakdown.length === 0 ? (
              <p className="text-xs text-text-3">No events in the last 24 hours.</p>
            ) : (
              <div className="space-y-2">
                {data.event_breakdown.map((item) => {
                  const max = data.event_breakdown[0]?.count || 1;
                  const pct = (item.count / max) * 100;
                  return (
                    <div key={item.type} className="flex items-center gap-3 text-xs">
                      <span className="w-28 text-text-3 truncate font-mono">{item.type}</span>
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan/50 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-text-1">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
