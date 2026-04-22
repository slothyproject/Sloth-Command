import { useQuery } from "@tanstack/react-query";

import { formatDate } from "../lib/format";
import { getJson } from "../lib/api";

interface AuditEntry {
  id: number;
  action: string;
  actor?: string | null;
  guild?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  created_at: string;
}

export function LogsPage() {
  const logsQuery = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => getJson<AuditEntry[]>("/api/audit?limit=100"),
    retry: false,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-cyan/20 bg-surface/80 p-6 shadow-panel">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan">Logs</p>
        <h2 className="mt-3 text-3xl font-semibold text-text-0">Audit Timeline</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-2">Administrative action history streamed from the existing audit API.</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
        {logsQuery.isError ? (
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-text-2">Audit log requires admin access.</p>
        ) : (
          <div className="space-y-2">
            {(logsQuery.data ?? []).map((entry) => (
              <article key={entry.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-text-0">{entry.action}</p>
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-2">{formatDate(entry.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-text-2">Actor: {entry.actor || "system"} · Guild: {entry.guild || "n/a"} · Target: {entry.target_type || "n/a"}:{entry.target_id || "n/a"}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
