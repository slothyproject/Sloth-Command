import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Search, Ticket, CheckCircle, AlertCircle, Clock } from "lucide-react"

import { formatDate } from "../lib/format"
import { getJson, postJson } from "../lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/ui/stat-card"
import { Select } from "@/components/ui/select"

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

  const activeTicket = sortedTickets[activeTicketIndex] ?? null

  // Calculate stats
  const totalTickets = ticketsQuery.data?.total ?? 0
  const openTickets = sortedTickets.filter((t) => t.status !== "closed").length
  const assignedTickets = sortedTickets.filter((t) => t.assigned_to).length

  const getPriorityBadgeVariant = (priority: string) => {
    const normalized = priority.toLowerCase()
    if (normalized === "urgent") return "danger"
    if (normalized === "high") return "warning"
    if (normalized === "normal") return "default"
    return "info"
  }

  const getStatusBadgeVariant = (status: string) => {
    const normalized = status.toLowerCase()
    if (normalized === "closed" || normalized === "resolved") return "success"
    if (normalized === "open") return "default"
    return "warning"
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-cyan font-display mb-2">Support Tickets</h1>
        <p className="text-text-2">Manage and track all support requests</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={<Ticket className="w-5 h-5 text-cyan" />}
          label="Total Tickets"
          value={totalTickets}
          size="md"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber" />}
          label="Open Tickets"
          value={openTickets}
          size="md"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5 text-lime" />}
          label="Assigned"
          value={assignedTickets}
          size="md"
        />
      </div>

      {/* Filters */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Queue Controls</CardTitle>
          <CardDescription>Filter and search tickets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-1 mb-2">Guild</label>
              <Select
                options={[
                  { label: "All Guilds", value: "" },
                  ...(guildsQuery.data ?? []).map((guild) => ({
                    label: guild.name,
                    value: String(guild.id),
                  })),
                ]}
                value={selectedGuild?.toString() ?? ""}
                onChange={(e) => {
                  const value = (e.target as HTMLSelectElement).value
                  setSelectedGuild(value ? Number(value) : null)
                  setPage(1)
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-1 mb-2">Status</label>
              <Select
                options={[
                  { label: "All Statuses", value: "" },
                  { label: "Open", value: "open" },
                  { label: "Resolved", value: "resolved" },
                  { label: "Closed", value: "closed" },
                ]}
                value={statusFilter}
                onChange={(e) => {
                  const value = (e.target as HTMLSelectElement).value
                  setStatusFilter(value)
                  setPage(1)
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-1 mb-2">Assignment</label>
              <Select
                options={[
                  { label: "All Tickets", value: "" },
                  { label: "Assigned", value: "assigned" },
                  { label: "Unassigned", value: "unassigned" },
                ]}
                value={assignedFilter}
                onChange={(e) => {
                  const value = (e.target as HTMLSelectElement).value
                  setAssignedFilter(value)
                  setPage(1)
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sort Presets */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-sm text-text-2 self-center">Sort:</span>
        <Button
          variant={sortPreset === "urgent" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSortPreset("urgent")}
        >
          Most Urgent
        </Button>
        <Button
          variant={sortPreset === "oldest" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSortPreset("oldest")}
        >
          Oldest
        </Button>
        <Button
          variant={sortPreset === "unassigned" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSortPreset("unassigned")}
        >
          Unassigned
        </Button>
        <Button
          variant={sortPreset === "newest" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSortPreset("newest")}
        >
          Newest
        </Button>
      </div>

      {/* Active Ticket Info */}
      {activeTicket && (
        <Card variant="outline" className="border-cyan/40 bg-cyan/5">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-text-2">Active Ticket</p>
              <p className="font-semibold text-cyan">
                #{activeTicket.ticket_number} - {activeTicket.subject}
              </p>
            </div>
            <div className="flex gap-2">
              <Link to={`/tickets/${activeTicket.id}`}>
                <Button variant="secondary" size="sm">
                  Open Details
                </Button>
              </Link>
              {activeTicket.status !== "closed" && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void closeTicket(activeTicket.id)}
                >
                  Close Ticket
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tickets List */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Ticket List</CardTitle>
          <CardDescription>
            {selectedGuild == null
              ? "Select a guild to view tickets"
              : `Showing ${sortedTickets.length} ticket${sortedTickets.length !== 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedGuild ? (
            <p className="text-sm text-text-2 text-center py-8">
              Select a guild to load ticket data
            </p>
          ) : ticketsQuery.isLoading ? (
            <p className="text-sm text-text-2 text-center py-8">Loading tickets...</p>
          ) : sortedTickets.length === 0 ? (
            <p className="text-sm text-text-2 text-center py-8">
              No tickets match the current filters
            </p>
          ) : (
            <div className="space-y-3">
              {sortedTickets.map((ticket, index) => (
                <div
                  key={ticket.id}
                  onMouseEnter={() => setActiveTicketIndex(index)}
                  className={`p-4 rounded-lg border transition cursor-pointer ${
                    index === activeTicketIndex
                      ? "border-cyan/40 bg-cyan/5"
                      : "border-surface-strong hover:border-cyan/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm text-cyan font-semibold">
                          #{ticket.ticket_number}
                        </span>
                        <h4 className="font-semibold text-text-0 truncate">
                          {ticket.subject}
                        </h4>
                      </div>
                      <p className="text-xs text-text-2">
                        Created {formatDate(ticket.created_at)} • Updated{" "}
                        {formatDate(ticket.updated_at)}
                        {ticket.assigned_to && ` • Assigned to ${ticket.assigned_to}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(ticket.status)} size="sm">
                        {ticket.status}
                      </Badge>
                      <Badge variant={getPriorityBadgeVariant(ticket.priority)} size="sm">
                        {ticket.priority}
                      </Badge>
                      <Link to={`/tickets/${ticket.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {selectedGuild && !ticketsQuery.isLoading && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-surface-strong">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || !selectedGuild}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-text-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || !selectedGuild}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      {selectedGuild && (
        <Card variant="outline">
          <CardContent className="pt-6">
            <p className="text-xs text-text-2">
              <span className="font-semibold">Keyboard Shortcuts:</span> <span className="font-mono">J/K</span> navigate •{" "}
              <span className="font-mono">Enter</span> open • <span className="font-mono">C</span> close •{" "}
              <span className="font-mono">1-4</span> sort
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}