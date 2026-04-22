import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { formatDate } from "../lib/format";
import { getJson, postJson } from "../lib/api";

interface GuildSummary {
  id: number;
  name: string;
}

interface TicketRecord {
  id: number;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketResponse {
  total: number;
  tickets: TicketRecord[];
}

function getSlaBadge(createdAt: string, priority: string, status: string) {
  if (status === "closed" || status === "resolved") {
    return { label: "Closed", className: "border-white/10 bg-white/5 text-text-2" };
  }

  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  const thresholds: Record<string, number> = { urgent: 1, high: 4, normal: 12, low: 24 };
  const limit = thresholds[priority.toLowerCase()] ?? 12;

  if (ageHours >= limit) {
    return { label: `SLA breached · ${Math.round(ageHours)}h`, className: "border-rose-400/30 bg-rose-400/10 text-rose-200" };
  }

  if (ageHours >= limit * 0.7) {
    return { label: `At risk · ${Math.round(ageHours)}h`, className: "border-amber-300/30 bg-amber-300/10 text-amber-200" };
  }

  return { label: `On track · ${Math.round(ageHours)}h`, className: "border-lime/30 bg-lime/10 text-lime" };
}

export function TicketsPage() {
  const navigate = useNavigate();
  const [selectedGuild, setSelectedGuild] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [sortPreset, setSortPreset] = useState<"urgent" | "oldest" | "unassigned" | "newest">("urgent");
  const [activeTicketIndex, setActiveTicketIndex] = useState(0);

  const guildsQuery = useQuery({
    queryKey: ["guilds"],
    queryFn: () => getJson<GuildSummary[]>("/api/guilds"),
    retry: false,
  });

  const ticketsQuery = useQuery({
    queryKey: ["tickets", selectedGuild, page, statusFilter, assignedFilter],
    queryFn: () => getJson<TicketResponse>(`/api/guilds/${selectedGuild}/tickets?page=${page}&per_page=25${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}${assignedFilter ? `&assigned=${encodeURIComponent(assignedFilter)}` : ""}`),
    enabled: selectedGuild != null,
    retry: false,
  });

  const totalPages = ticketsQuery.data ? Math.max(1, Math.ceil(ticketsQuery.data.total / 25)) : 1;

  const sortedTickets = useMemo(() => {
    const items = [...(ticketsQuery.data?.tickets ?? [])];
    const priorityWeight: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };

    if (sortPreset === "oldest") {
      return items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    if (sortPreset === "newest") {
      return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    if (sortPreset === "unassigned") {
      return items.sort((a, b) => {
        const unassignedA = a.assigned_to ? 0 : 1;
        const unassignedB = b.assigned_to ? 0 : 1;
        if (unassignedA !== unassignedB) {
          return unassignedB - unassignedA;
        }

        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }

    return items.sort((a, b) => {
      const slaA = getSlaBadge(a.created_at, a.priority, a.status).label;
      const slaB = getSlaBadge(b.created_at, b.priority, b.status).label;
      const slaWeight = (label: string) => {
        if (label.startsWith("SLA breached")) {
          return 3;
        }

        if (label.startsWith("At risk")) {
          return 2;
        }

        return 1;
      };

      const slaDiff = slaWeight(slaB) - slaWeight(slaA);
      if (slaDiff !== 0) {
        return slaDiff;
      }

      const priorityDiff = (priorityWeight[b.priority.toLowerCase()] ?? 0) - (priorityWeight[a.priority.toLowerCase()] ?? 0);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [sortPreset, ticketsQuery.data?.tickets]);

  useEffect(() => {
    if (sortedTickets.length === 0) {
      setActiveTicketIndex(0);
      return;
    }

    setActiveTicketIndex((current) => Math.min(current, sortedTickets.length - 1));
  }, [sortedTickets]);

  useEffect(() => {
    if (selectedGuild == null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingTarget = Boolean(target?.isContentEditable || tag === "input" || tag === "textarea" || tag === "select");
      if (isTypingTarget) {
        return;
      }

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setActiveTicketIndex((current) => Math.min(current + 1, Math.max(0, sortedTickets.length - 1)));
      }

      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setActiveTicketIndex((current) => Math.max(0, current - 1));
      }

      if (event.key === "Enter") {
        const active = sortedTickets[activeTicketIndex];
        if (!active) {
          return;
        }

        event.preventDefault();
        navigate(`/tickets/${active.id}`);
      }

      if (event.key.toLowerCase() === "c") {
        const active = sortedTickets[activeTicketIndex];
        if (!active || active.status === "closed") {
          return;
        }

        event.preventDefault();
        void closeTicket(active.id);
      }

      if (event.key === "1") {
        setSortPreset("urgent");
      }
      if (event.key === "2") {
        setSortPreset("oldest");
      }
      if (event.key === "3") {
        setSortPreset("unassigned");
      }
      if (event.key === "4") {
        setSortPreset("newest");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTicketIndex, navigate, selectedGuild, sortedTickets]);

  async function closeTicket(ticketId: number) {
    const confirmed = window.confirm("Close this ticket? This will move it out of the active support queue.");
    if (!confirmed) {
      return;
    }

    try {
      await postJson(`/api/tickets/${ticketId}/close`);
      toast.success("Ticket closed.");
      await ticketsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not close ticket.");
    }
  }

  const activeTicket = sortedTickets[activeTicketIndex] ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-cyan/20 bg-surface/80 p-6 shadow-panel">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan">Tickets</p>
        <h2 className="mt-3 text-3xl font-semibold text-text-0">Unified support queue</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-2">This page is now loading real ticket data. The next layer will add transcript drill-down, assignment actions, and an SLA-oriented operations inbox.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px,1fr]">
        <aside className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Queue controls</p>
          <div className="space-y-4">
            <label className="grid gap-2 text-sm text-text-1">
              <span>Guild</span>
              <select
                value={selectedGuild ?? ""}
                onChange={(event) => {
                  setSelectedGuild(event.target.value ? Number(event.target.value) : null);
                  setPage(1);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-text-0 outline-none"
              >
                <option value="">Select guild</option>
                {(guildsQuery.data ?? []).map((guild) => (
                  <option key={guild.id} value={guild.id}>{guild.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-text-1">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-text-0 outline-none">
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm text-text-1">
              <span>Assignment</span>
              <select value={assignedFilter} onChange={(event) => { setAssignedFilter(event.target.value); setPage(1); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-text-0 outline-none">
                <option value="">All tickets</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
          </div>
        </aside>

        <div className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Ticket inbox</p>
              <h3 className="mt-2 text-xl font-semibold text-text-0">Support flow</h3>
            </div>
            {ticketsQuery.data ? <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-1">{ticketsQuery.data.total} tickets</div> : null}
          </div>

          {selectedGuild != null ? (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-text-2">
              Shortcuts: <span className="text-text-1">J/K</span> move, <span className="text-text-1">Enter</span> open, <span className="text-text-1">C</span> close, <span className="text-text-1">1-4</span> sort
            </div>
          ) : null}

          {activeTicket ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-cyan/25 bg-cyan/10 px-3 py-2 text-xs text-cyan">
              <span className="rounded-md border border-cyan/25 bg-cyan/15 px-2 py-0.5">Active #{activeTicket.ticket_number}</span>
              <button onClick={() => navigate(`/tickets/${activeTicket.id}`)} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-text-1">Open active</button>
              {activeTicket.status !== "closed" ? <button onClick={() => void closeTicket(activeTicket.id)} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-text-1">Close active</button> : null}
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em]">
            <span className="text-text-2">Sort</span>
            <button onClick={() => setSortPreset("urgent")} className={`rounded-full border px-3 py-1 ${sortPreset === "urgent" ? "border-cyan/25 bg-cyan/10 text-cyan" : "border-white/10 bg-white/5 text-text-1"}`}>most urgent</button>
            <button onClick={() => setSortPreset("oldest")} className={`rounded-full border px-3 py-1 ${sortPreset === "oldest" ? "border-cyan/25 bg-cyan/10 text-cyan" : "border-white/10 bg-white/5 text-text-1"}`}>oldest open</button>
            <button onClick={() => setSortPreset("unassigned")} className={`rounded-full border px-3 py-1 ${sortPreset === "unassigned" ? "border-cyan/25 bg-cyan/10 text-cyan" : "border-white/10 bg-white/5 text-text-1"}`}>unassigned first</button>
            <button onClick={() => setSortPreset("newest")} className={`rounded-full border px-3 py-1 ${sortPreset === "newest" ? "border-cyan/25 bg-cyan/10 text-cyan" : "border-white/10 bg-white/5 text-text-1"}`}>newest</button>
          </div>

          <div className="grid gap-3">
            {ticketsQuery.isLoading ? <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-text-2">Loading ticket queue…</p> : null}

            {sortedTickets.map((ticket, index) => (
              <article key={ticket.id} onMouseEnter={() => setActiveTicketIndex(index)} className={`rounded-2xl border bg-white/5 p-4 ${index === activeTicketIndex ? "border-cyan/35" : "border-white/10"}`}>
                {(() => {
                  const sla = getSlaBadge(ticket.created_at, ticket.priority, ticket.status);
                  return (
                    <div className="mb-2">
                      <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] ${sla.className}`}>{sla.label}</span>
                    </div>
                  );
                })()}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-cyan">#{ticket.ticket_number}</span>
                      <h4 className="text-base font-medium text-text-0">{ticket.subject}</h4>
                    </div>
                    <p className="mt-2 text-sm text-text-2">Created {formatDate(ticket.created_at)} · Updated {formatDate(ticket.updated_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.12em] text-text-1">{ticket.status}</span>
                    <span className="rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1 text-xs uppercase tracking-[0.12em] text-cyan">{ticket.priority}</span>
                    <Link to={`/tickets/${ticket.id}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Details</Link>
                    {ticket.status !== "closed" ? <button onClick={() => void closeTicket(ticket.id)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Close</button> : null}
                  </div>
                </div>
              </article>
            ))}

            {!ticketsQuery.isLoading && selectedGuild != null && sortedTickets.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-text-2">No tickets match the current queue filters.</p>
            ) : null}
          </div>

          {ticketsQuery.isError ? <p className="mt-4 text-sm text-rose-200">Could not load tickets from the backend.</p> : null}

          {selectedGuild == null ? <p className="mt-4 text-sm text-text-2">Select a guild to load ticket data.</p> : null}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button disabled={page <= 1 || selectedGuild == null} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-text-1 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-text-2">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages || selectedGuild == null} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-text-1 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}