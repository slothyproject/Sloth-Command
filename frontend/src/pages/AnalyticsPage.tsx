import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getJson } from "../lib/api";

interface AnalyticsSummary {
  action_counts: Array<{ action: string; count: number }>;
  action_timeline: Array<{ date: string; count: number }>;
  ticket_status_counts: Array<{ status: string; count: number }>;
  ticket_priority_counts: Array<{ priority: string; count: number }>;
}

export function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: () => getJson<AnalyticsSummary>("/api/analytics/summary"),
    retry: false,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-cyan/20 bg-surface/80 p-6 shadow-panel">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan">Analytics</p>
        <h2 className="mt-3 text-3xl font-semibold text-text-0">Signal-first telemetry surfaces</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-2">The first chart layer is live against summary data from the current backend. This gives the React surface real trend visualization now, while we build deeper time-series collection later.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <h3 className="mb-4 text-lg font-semibold text-text-0">Moderation timeline</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.action_timeline ?? []}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#93A4BC" />
                <YAxis stroke="#93A4BC" />
                <Tooltip contentStyle={{ background: "#101826", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="count" stroke="#00D4FF" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <h3 className="mb-4 text-lg font-semibold text-text-0">Actions by type</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.action_counts ?? []}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="action" stroke="#93A4BC" />
                <YAxis stroke="#93A4BC" />
                <Tooltip contentStyle={{ background: "#101826", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Bar dataKey="count" fill="#00D4FF" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <h3 className="mb-4 text-lg font-semibold text-text-0">Ticket status distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.ticket_status_counts ?? []}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="status" stroke="#93A4BC" />
                <YAxis stroke="#93A4BC" />
                <Tooltip contentStyle={{ background: "#101826", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Bar dataKey="count" fill="#39FF14" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <h3 className="mb-4 text-lg font-semibold text-text-0">Ticket priority mix</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.ticket_priority_counts ?? []}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="priority" stroke="#93A4BC" />
                <YAxis stroke="#93A4BC" />
                <Tooltip contentStyle={{ background: "#101826", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Bar dataKey="count" fill="#FFB020" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </div>
  );
}