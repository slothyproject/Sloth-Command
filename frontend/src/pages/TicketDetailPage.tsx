import { useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { formatDate } from "../lib/format";
import { getJson, postJson } from "../lib/api";

interface TicketDetail {
  id: number;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
  assigned_to?: string | null;
  opener_id: string;
  opener_name?: string | null;
  guild_name?: string | null;
  guild_id: number;
  message_count: number;
  created_at: string;
  updated_at: string;
  closed_by?: string | null;
  closed_reason?: string | null;
  closed_at?: string | null;
}

interface TicketOpenerRisk {
  risk_score: number;
  risk_tier: "low" | "guarded" | "high" | "critical";
  case_count_total: number;
  case_count_recent_30d: number;
  open_case_count: number;
  open_appeal_count: number;
}

interface TicketMessage {
  id: number;
  author_name?: string | null;
  content: string;
  is_staff: boolean;
  created_at: string;
}

export function TicketDetailPage() {
  const { ticketId } = useParams();
  const [assignedTo, setAssignedTo] = useState("");

  const ticketQuery = useQuery({
    queryKey: ["ticket-detail", ticketId],
    queryFn: () => getJson<TicketDetail>(`/api/tickets/${ticketId}`),
    enabled: Boolean(ticketId),
    retry: false,
  });

  const messagesQuery = useQuery({
    queryKey: ["ticket-messages", ticketId],
    queryFn: () => getJson<TicketMessage[]>(`/api/tickets/${ticketId}/messages`),
    enabled: Boolean(ticketId),
    retry: false,
  });

  const openerRiskQuery = useQuery({
    queryKey: ["ticket-opener-risk", ticketId, ticketQuery.data?.guild_id, ticketQuery.data?.opener_id],
    queryFn: () => getJson<TicketOpenerRisk>(`/api/guilds/${ticketQuery.data?.guild_id}/members/${encodeURIComponent(ticketQuery.data?.opener_id ?? "")}/risk-profile`),
    enabled: Boolean(ticketQuery.data?.guild_id && ticketQuery.data?.opener_id),
    retry: false,
  });

  useEffect(() => {
    setAssignedTo(ticketQuery.data?.assigned_to ?? "");
  }, [ticketQuery.data?.assigned_to]);

  async function setStatus(status: "open" | "resolved" | "closed") {
    if (status === "closed") {
      const confirmed = window.confirm("Close this ticket? This will remove it from the active queue.");
      if (!confirmed) {
        return;
      }
    }

    try {
      await postJson(`/api/tickets/${ticketId}/status`, { status });
      toast.success(`Ticket marked ${status}.`);
      await Promise.all([ticketQuery.refetch(), messagesQuery.refetch()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update ticket status.");
    }
  }

  async function saveAssignment() {
    try {
      await postJson(`/api/tickets/${ticketId}/assign`, {
        assigned_to: assignedTo.trim() || null,
      });
      toast.success("Assignment updated.");
      await ticketQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update assignment.");
    }
  }

  const ticket = ticketQuery.data;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-cyan/20 bg-surface/80 p-6 shadow-panel">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-text-2">
          <Link to="/dashboard" className="transition hover:text-cyan">Dashboard</Link>
          <span>/</span>
          <Link to="/tickets" className="transition hover:text-cyan">Tickets</Link>
          <span>/</span>
          <span className="text-text-1">#{ticket?.ticket_number ?? ticketId ?? "--"}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan">Ticket Detail</p>
            <h2 className="mt-3 text-3xl font-semibold text-text-0">#{ticket?.ticket_number ?? "--"} · {ticket?.subject ?? "Loading"}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-2">Transcript and workflow controls for this support ticket.</p>
          </div>
          <Link to="/tickets" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Back to queue</Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px,1fr]">
        <aside className="space-y-4 rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          {ticketQuery.isLoading ? <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-text-2">Loading ticket metadata…</p> : null}
          {ticketQuery.isError ? <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-4 text-sm text-rose-200">Could not load ticket metadata from the backend.</p> : null}

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Metadata</p>
            <div className="mt-3 space-y-2 text-sm text-text-1">
              <p>Opener ID: <span className="text-text-0">{ticket?.opener_id ?? "--"}</span></p>
              <p>Guild: <span className="text-text-0">{ticket?.guild_name ?? "--"}</span></p>
              <p>Opener: <span className="text-text-0">{ticket?.opener_name ?? "--"}</span></p>
              <p>Created: <span className="text-text-0">{ticket ? formatDate(ticket.created_at) : "--"}</span></p>
              <p>Updated: <span className="text-text-0">{ticket ? formatDate(ticket.updated_at) : "--"}</span></p>
              <p>Messages: <span className="text-text-0">{ticket?.message_count ?? 0}</span></p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">Opener risk</p>
            {openerRiskQuery.isLoading ? <p className="mt-2 text-sm text-text-2">Loading risk profile…</p> : null}
            {openerRiskQuery.isError ? <p className="mt-2 text-sm text-rose-200">Could not load opener risk profile.</p> : null}
            {openerRiskQuery.data ? (
              <div className="mt-2 space-y-1 text-sm text-text-1">
                <p>Tier: <span className="text-text-0">{openerRiskQuery.data.risk_tier}</span></p>
                <p>Score: <span className="text-text-0">{openerRiskQuery.data.risk_score}</span></p>
                <p>Total cases: <span className="text-text-0">{openerRiskQuery.data.case_count_total}</span></p>
                <p>Cases (30d): <span className="text-text-0">{openerRiskQuery.data.case_count_recent_30d}</span></p>
                <p>Open appeals: <span className="text-text-0">{openerRiskQuery.data.open_appeal_count}</span></p>
              </div>
            ) : null}
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Status</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => void setStatus("open")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Open</button>
              <button onClick={() => void setStatus("resolved")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Resolve</button>
              <button onClick={() => void setStatus("closed")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Close</button>
            </div>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Assignment</p>
            <div className="mt-3 flex gap-2">
              <input
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
                placeholder="staff username"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0 outline-none placeholder:text-text-3"
              />
              <button onClick={() => void saveAssignment()} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Save</button>
            </div>
          </div>
        </aside>

        <div className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Transcript</p>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-1">{ticket?.status ?? "--"}</span>
          </div>

          <div className="space-y-3">
            {messagesQuery.isLoading ? <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-text-2">Loading transcript…</p> : null}

            {(messagesQuery.data ?? []).map((message) => (
              <article key={message.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-text-0">{message.author_name || "Unknown"}</p>
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-2">{formatDate(message.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-1">{message.content}</p>
              </article>
            ))}
          </div>

          {messagesQuery.data && messagesQuery.data.length === 0 ? (
            <p className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-sm text-text-2">No ticket messages recorded yet.</p>
          ) : null}
          {messagesQuery.isError ? <p className="mt-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-4 text-center text-sm text-rose-200">Could not load ticket transcript.</p> : null}
        </div>
      </section>
    </div>
  );
}
