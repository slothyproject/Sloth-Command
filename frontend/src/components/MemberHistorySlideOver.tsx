import { useQuery } from "@tanstack/react-query";
import { X, ShieldAlert, Ticket, ExternalLink } from "lucide-react";
import { getJson } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface MemberCase {
  id: number;
  case_number: number;
  action: string;
  reason: string | null;
  moderator_name: string | null;
  guild_name: string | null;
  created_at: string;
}

interface MemberTicket {
  id: number;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
  guild_name: string | null;
  created_at: string;
}

interface MemberHistory {
  discord_id: string;
  case_count: number;
  ticket_count: number;
  action_tally: { action: string; count: number }[];
  first_seen: string | null;
  last_seen: string | null;
  cases: MemberCase[];
  tickets: MemberTicket[];
}

const ACTION_COLOR: Record<string, string> = {
  ban: "text-red-300 bg-red-500/10 border-red-500/20",
  global_ban: "text-red-300 bg-red-500/10 border-red-500/20",
  kick: "text-orange-300 bg-orange-500/10 border-orange-500/20",
  mute: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  warn: "text-yellow-300 bg-yellow-500/10 border-yellow-500/20",
  unban: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
};

function actionClass(action: string) {
  return (
    ACTION_COLOR[action.toLowerCase()] ??
    "text-text-2 bg-white/5 border-white/10"
  );
}

interface Props {
  discordId: string;
  displayName?: string | null;
  onClose: () => void;
}

export function MemberHistorySlideOver({ discordId, displayName, onClose }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["member-history", discordId],
    queryFn: () => getJson<MemberHistory>(`/api/members/${encodeURIComponent(discordId)}/history`),
    staleTime: 30_000,
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl flex flex-col bg-[#0d1117] border-l border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-cyan">Cross-guild history</p>
            <p className="text-base font-semibold text-text-0 mt-0.5">
              {displayName || discordId}
            </p>
            <p className="text-xs text-text-3 font-mono">{discordId}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-3 hover:text-text-0 hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-cyan/40 border-t-cyan rounded-full animate-spin" />
            </div>
          )}

          {isError && (
            <p className="text-sm text-rose-300 text-center py-10">
              Failed to load member history.
            </p>
          )}

          {data && (
            <>
              {/* Summary chips */}
              <div className="flex flex-wrap gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-text-1">
                  <span className="font-mono font-bold text-text-0">{data.case_count}</span> total cases
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-text-1">
                  <span className="font-mono font-bold text-text-0">{data.ticket_count}</span> tickets
                </div>
                {data.first_seen && (
                  <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-text-1">
                    First seen: <span className="text-text-0">{formatDate(data.first_seen)}</span>
                  </div>
                )}
                {data.last_seen && (
                  <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-text-1">
                    Last action: <span className="text-text-0">{formatDate(data.last_seen)}</span>
                  </div>
                )}
              </div>

              {/* Action tally */}
              {data.action_tally.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.action_tally.map((item) => (
                    <span
                      key={item.action}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium ${actionClass(item.action)}`}
                    >
                      {item.action} <span className="font-mono">×{item.count}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Cases */}
              {data.cases.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-text-3">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Moderation cases ({data.case_count})
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {data.cases.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-white/8 bg-white/[0.03] p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-text-3">#{c.case_number}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] border font-medium uppercase ${actionClass(c.action)}`}
                            >
                              {c.action}
                            </span>
                          </div>
                          <span className="text-xs text-text-3">{formatDate(c.created_at)}</span>
                        </div>
                        {c.reason && (
                          <p className="text-xs text-text-2 truncate">{c.reason}</p>
                        )}
                        <p className="text-xs text-text-3">
                          {c.guild_name ? `in ${c.guild_name}` : ""}{c.moderator_name ? ` · by ${c.moderator_name}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tickets */}
              {data.tickets.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-text-3">
                    <Ticket className="w-3.5 h-3.5" />
                    Tickets ({data.ticket_count})
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {data.tickets.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-xl border border-white/8 bg-white/[0.03] p-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text-0 truncate">{t.subject}</p>
                          <p className="text-xs text-text-3 mt-0.5">
                            #{t.ticket_number} · {t.status} · {t.guild_name ?? "—"} · {formatDate(t.created_at)}
                          </p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-text-3 flex-shrink-0 mt-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.case_count === 0 && data.ticket_count === 0 && (
                <p className="text-sm text-text-3 text-center py-10">
                  No history found for this member in your visible guilds.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
