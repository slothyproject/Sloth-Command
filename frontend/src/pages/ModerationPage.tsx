import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, AlertTriangle, Shield, Clock, Download, Ban, Plus, History } from 'lucide-react'

import { formatDate } from '../lib/format'
import { getJson, postJson, patchJson, deleteJson } from '../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { Select } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MemberHistorySlideOver } from '@/components/MemberHistorySlideOver'

interface GuildSummary {
  id: number;
  name: string;
}

interface ModerationCase {
  id: number;
  case_number: number;
  action: string;
  target_name?: string | null;
  target_id: string;
  moderator_name?: string | null;
  reason?: string | null;
  duration?: string | null;
  created_at: string;
}

interface ModerationResponse {
  total: number;
  page: number;
  per_page: number;
  cases: ModerationCase[];
}

interface RiskProfile {
  member_id: string;
  risk_score: number;
  risk_tier: "low" | "guarded" | "high" | "critical";
  case_count_total: number;
  case_count_recent_30d: number;
  open_case_count: number;
  open_appeal_count: number;
  action_breakdown: Array<{ action: string; count: number }>;
}

interface AppealTicket {
  id: number;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
}

interface AppealResponse {
  total: number;
  page: number;
  per_page: number;
  tickets: AppealTicket[];
}

interface GlobalBan {
  id: number;
  case_number: number;
  target_id: string;
  target_name?: string | null;
  moderator_name?: string | null;
  reason?: string | null;
  created_at: string;
}

export function ModerationPage() {
  const [tab, setTab] = useState<"cases" | "global-bans">("cases");
  const [selectedGuild, setSelectedGuild] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [query, setQuery] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("mute");
  const [bulkReason, setBulkReason] = useState("");
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [savingReason, setSavingReason] = useState(false);
  const [gbTargetId, setGbTargetId] = useState("");
  const [gbReason, setGbReason] = useState("");
  const [gbTargetName, setGbTargetName] = useState("");
  const [historyMemberId, setHistoryMemberId] = useState<string | null>(null);
  const [historyMemberName, setHistoryMemberName] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const guildsQuery = useQuery({
    queryKey: ["guilds"],
    queryFn: () => getJson<GuildSummary[]>("/api/guilds"),
    retry: false,
  });

  const moderationQuery = useQuery({
    queryKey: ["moderation", selectedGuild, page, action],
    queryFn: () => getJson<ModerationResponse>(`/api/guilds/${selectedGuild}/moderation?page=${page}&per_page=25${action ? `&action=${encodeURIComponent(action)}` : ""}`),
    enabled: selectedGuild != null,
    retry: false,
  });

  const filteredCases = useMemo(() => {
    const cases = moderationQuery.data?.cases ?? [];
    if (!query.trim()) {
      return cases;
    }

    const term = query.trim().toLowerCase();
    return cases.filter((item) => [item.case_number, item.action, item.target_name, item.target_id, item.moderator_name, item.reason].join(" ").toLowerCase().includes(term));
  }, [moderationQuery.data?.cases, query]);

  const visibleTargetIds = useMemo(() => Array.from(new Set(filteredCases.map((item) => item.target_id))), [filteredCases]);
  const selectedInView = useMemo(() => visibleTargetIds.filter((id) => selectedTargets.includes(id)).length, [selectedTargets, visibleTargetIds]);
  const allVisibleSelected = visibleTargetIds.length > 0 && selectedInView === visibleTargetIds.length;

  const totalPages = moderationQuery.data ? Math.max(1, Math.ceil(moderationQuery.data.total / moderationQuery.data.per_page)) : 1;
  const activeCase = filteredCases[activeCaseIndex] ?? null;

  const riskProfileQuery = useQuery({
    queryKey: ["member-risk-profile", selectedGuild, activeCase?.target_id],
    queryFn: () => getJson<RiskProfile>(`/api/guilds/${selectedGuild}/members/${encodeURIComponent(activeCase?.target_id ?? "")}/risk-profile`),
    enabled: selectedGuild != null && Boolean(activeCase?.target_id),
    retry: false,
  });

  const appealsQuery = useQuery({
    queryKey: ["member-appeals", selectedGuild, activeCase?.target_id],
    queryFn: () => getJson<AppealResponse>(`/api/guilds/${selectedGuild}/appeals?member_id=${encodeURIComponent(activeCase?.target_id ?? "")}&per_page=6`),
    enabled: selectedGuild != null && Boolean(activeCase?.target_id),
    retry: false,
  });

  const globalBansQuery = useQuery({
    queryKey: ["global-bans"],
    queryFn: () => getJson<{ cases: GlobalBan[]; total: number }>("/api/moderation/global-bans"),
    retry: false,
  });

  const addGlobalBanMutation = useMutation({
    mutationFn: (payload: { user_id: string; user_name?: string; reason?: string }) =>
      postJson("/api/moderation/global-bans", payload),
    onSuccess: () => {
      toast.success("Global ban added.");
      setGbTargetId(""); setGbReason(""); setGbTargetName("");
      void queryClient.invalidateQueries({ queryKey: ["global-bans"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add global ban."),
  });

  useEffect(() => {
    if (filteredCases.length === 0) {
      setActiveCaseIndex(0);
      return;
    }

    setActiveCaseIndex((current) => Math.min(current, filteredCases.length - 1));
  }, [filteredCases]);

  useEffect(() => {
    setSelectedTargets([]);
  }, [selectedGuild]);

  useEffect(() => {
    setEditReason(activeCase?.reason ?? "");
  }, [activeCase?.id]);

  async function saveReason() {
    if (!selectedGuild || !activeCase) return;
    setSavingReason(true);
    try {
      await patchJson(`/api/guilds/${selectedGuild}/moderation/${activeCase.id}`, { reason: editReason });
      toast.success("Case reason updated.");
      await moderationQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update reason.");
    } finally {
      setSavingReason(false);
    }
  }

  function actionClass(actionType: string) {
    switch (actionType.toLowerCase()) {
      case "ban":
      case "global_ban":
        return "border-rose-400/30 bg-rose-400/10 text-rose-200";
      case "kick":
        return "border-orange-300/30 bg-orange-300/10 text-orange-200";
      case "mute":
        return "border-amber-300/30 bg-amber-300/10 text-amber-200";
      case "warn":
        return "border-yellow-300/30 bg-yellow-300/10 text-yellow-200";
      case "unmute":
      case "unban":
        return "border-lime/30 bg-lime/10 text-lime";
      default:
        return "border-cyan/20 bg-cyan/10 text-cyan";
    }
  }

  async function runBulkAction() {
    if (selectedGuild == null) {
      toast.error("Select a guild first.");
      return;
    }

    if (selectedTargets.length === 0) {
      toast.error("Select at least one target.");
      return;
    }

    setConfirmBulkOpen(true);
  }

  async function executeBulkAction() {
    setConfirmBulkOpen(false);
    if (selectedGuild == null) return;

    try {
      await postJson(`/api/guilds/${selectedGuild}/moderation/bulk`, {
        action: bulkAction,
        user_ids: selectedTargets,
        reason: bulkReason || "Bulk action from dashboard",
      });
      toast.success(`Bulk ${bulkAction} queued for ${selectedTargets.length} target(s).`);
      setSelectedTargets([]);
      setBulkReason("");
      await moderationQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk moderation action failed.");
    }
  }

  function exportCasesToCsv() {
    if (filteredCases.length === 0) {
      toast.error("No cases to export.");
      return;
    }
    const headers = ["Case", "Action", "Target Name", "Target ID", "Moderator", "Reason / Duration", "Created"];
    const rows = filteredCases.map((c) => [
      `#${c.case_number}`,
      c.action,
      c.target_name ?? c.target_id,
      c.target_id,
      c.moderator_name ?? "",
      c.reason ?? c.duration ?? "",
      c.created_at,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moderation-cases-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredCases.length} case(s) to CSV.`);
  }

  async function copyCaseNumber(caseNumber: number) {    try {
      await navigator.clipboard.writeText(`case_#${caseNumber}`);
      toast.success(`Copied case #${caseNumber}.`);
    } catch {
      toast.error("Could not copy case number.");
    }
  }

  async function createAppealFromCase(item: ModerationCase) {
    if (selectedGuild == null) {
      return;
    }

    const reason = window.prompt("Appeal reason for this case", `Appeal request for case #${item.case_number}`);
    if (!reason) {
      return;
    }

    try {
      const response = await postJson<{ ok: boolean; ticket: AppealTicket }>(`/api/guilds/${selectedGuild}/appeals`, {
        member_id: item.target_id,
        member_name: item.target_name ?? item.target_id,
        case_number: item.case_number,
        reason,
        priority: "normal",
      });
      toast.success(`Appeal ticket #${response.ticket.ticket_number} opened.`);
      await appealsQuery.refetch();
      await riskProfileQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create appeal ticket.");
    }
  }

  function riskTierClass(tier?: RiskProfile["risk_tier"]) {
    if (tier === "critical") {
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    }
    if (tier === "high") {
      return "border-orange-300/30 bg-orange-300/10 text-orange-200";
    }
    if (tier === "guarded") {
      return "border-amber-300/30 bg-amber-300/10 text-amber-200";
    }
    return "border-lime/30 bg-lime/10 text-lime";
  }

  function toggleSelected(targetId: string) {
    setSelectedTargets((current) => (current.includes(targetId) ? current.filter((item) => item !== targetId) : [...current, targetId]));
  }

  function toggleSelectVisible() {
    setSelectedTargets((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleTargetIds.includes(id));
      }

      const merged = new Set([...current, ...visibleTargetIds]);
      return Array.from(merged);
    });
  }

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
        setActiveCaseIndex((current) => Math.min(current + 1, Math.max(0, filteredCases.length - 1)));
      }

      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCaseIndex((current) => Math.max(0, current - 1));
      }

      const activeCase = filteredCases[activeCaseIndex];
      if (!activeCase) {
        return;
      }

      if (event.key.toLowerCase() === "x") {
        event.preventDefault();
        toggleSelected(activeCase.target_id);
      }

      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        toggleSelectVisible();
      }

      if (event.key.toLowerCase() === "b" && selectedTargets.length > 0) {
        event.preventDefault();
        void runBulkAction();
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        setSelectedTargets([]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCaseIndex, filteredCases, selectedGuild, selectedTargets.length]);

  return (
    <div className="space-y-6">
      {historyMemberId && (
        <MemberHistorySlideOver
          discordId={historyMemberId}
          displayName={historyMemberName}
          onClose={() => { setHistoryMemberId(null); setHistoryMemberName(null); }}
        />
      )}
      <ConfirmDialog
        open={confirmBulkOpen}
        title={`Bulk ${bulkAction.toUpperCase()} — ${selectedTargets.length} target(s)`}
        message={`This will queue a ${bulkAction} action for ${selectedTargets.length} selected target(s)${bulkReason ? ` with reason: "${bulkReason}"` : ""}. This cannot be undone.`}
        confirmLabel={`Run ${bulkAction}`}
        variant="destructive"
        onConfirm={() => void executeBulkAction()}
        onCancel={() => setConfirmBulkOpen(false)}
      />
      <section className="rounded-[28px] border border-cyan/20 bg-surface/80 p-6 shadow-panel">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan">Moderation</p>
        <h2 className="mt-3 text-3xl font-semibold text-text-0">React moderation workspace</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-2">This view is already running against the live moderation API. Select a guild, filter by action, and search the current page while we layer in bulk actions and member deep-dive workflows next.</p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setTab("cases")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${tab === "cases" ? "border-cyan/40 bg-cyan/15 text-cyan" : "border-white/10 bg-white/5 text-text-2 hover:text-text-1"}`}
          >
            <Shield className="inline w-4 h-4 mr-1.5 -mt-0.5" />
            Cases
          </button>
          <button
            onClick={() => setTab("global-bans")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${tab === "global-bans" ? "border-rose-400/40 bg-rose-400/15 text-rose-200" : "border-white/10 bg-white/5 text-text-2 hover:text-text-1"}`}
          >
            <Ban className="inline w-4 h-4 mr-1.5 -mt-0.5" />
            Global Bans
            {(globalBansQuery.data?.total ?? 0) > 0 && (
              <span className="ml-2 rounded-full bg-rose-400/20 px-2 py-0.5 text-xs text-rose-200">{globalBansQuery.data?.total}</span>
            )}
          </button>
        </div>
      </section>

      {tab === "cases" && (
      <section className="grid gap-4 xl:grid-cols-[320px,1fr]">
        <aside className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Filters</p>
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
              <span>Action</span>
              <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-text-0 outline-none">
                <option value="">All actions</option>
                <option value="warn">Warn</option>
                <option value="mute">Mute</option>
                <option value="kick">Kick</option>
                <option value="ban">Ban</option>
                <option value="unmute">Unmute</option>
                <option value="unban">Unban</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm text-text-1">
              <span>Search current page</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Target, moderator, case, reason" className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-text-0 outline-none placeholder:text-text-3" />
            </label>
          </div>
        </aside>

        <div className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Live moderation log</p>
              <h3 className="mt-2 text-xl font-semibold text-text-0">Cases</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {moderationQuery.data ? <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-1">{moderationQuery.data.total} total</div> : null}
              <button
                disabled={filteredCases.length === 0}
                onClick={exportCasesToCsv}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-1 transition hover:border-cyan/30 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            </div>
          </div>

          {selectedGuild != null ? (
            <div className="mb-4 rounded-xl border border-cyan/30 bg-cyan/10 p-3">
              <div className="mb-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-text-2">
                Shortcuts: <span className="text-text-1">J/K</span> move, <span className="text-text-1">X</span> toggle row, <span className="text-text-1">A</span> select visible, <span className="text-text-1">B</span> run, <span className="text-text-1">R</span> clear
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-cyan">
                <span>Preview</span>
                <span className="rounded-md border border-cyan/25 bg-cyan/15 px-2 py-0.5">{selectedTargets.length} selected</span>
                <span>from</span>
                <span className="rounded-md border border-cyan/25 bg-cyan/15 px-2 py-0.5">{visibleTargetIds.length} visible targets</span>
                {selectedInView !== selectedTargets.length ? <span className="text-text-2">({selectedInView} selected on this page)</span> : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-text-0">
                  <option value="warn">Warn</option>
                  <option value="mute">Mute</option>
                  <option value="kick">Kick</option>
                  <option value="ban">Ban</option>
                </select>
                <input value={bulkReason} onChange={(event) => setBulkReason(event.target.value)} placeholder="Reason" className="min-w-[220px] rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-text-0 placeholder:text-text-3" />
                <button onClick={() => toggleSelectVisible()} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-1">{allVisibleSelected ? "Deselect visible" : "Select visible"}</button>
                <button disabled={selectedTargets.length === 0} onClick={() => void runBulkAction()} className="rounded-lg border border-cyan/30 bg-cyan/20 px-3 py-1 text-xs text-cyan disabled:cursor-not-allowed disabled:opacity-40">Run</button>
                <button onClick={() => setSelectedTargets([])} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-1">Clear</button>
              </div>
            </div>
          ) : null}

          {activeCase ? (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Member drill-down</p>
                  <p className="mt-1 text-sm text-text-1">{activeCase.target_name || activeCase.target_id}</p>
                </div>
                <button onClick={() => void createAppealFromCase(activeCase)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-1 transition hover:border-cyan/30 hover:text-cyan">Open appeal ticket</button>
                <button
                  onClick={() => { setHistoryMemberId(activeCase.target_id); setHistoryMemberName(activeCase.target_name ?? null); }}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-1 transition hover:border-cyan/30 hover:text-cyan"
                >
                  <History className="w-3.5 h-3.5" />
                  Cross-guild history
                </button>
              </div>

              <div className="grid gap-3 xl:grid-cols-[1.1fr,1fr]">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-2">Risk profile</p>
                    <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] ${riskTierClass(riskProfileQuery.data?.risk_tier)}`}>
                      {riskProfileQuery.data?.risk_tier ?? "--"}
                    </span>
                  </div>

                  {riskProfileQuery.isLoading ? <p className="text-sm text-text-2">Loading risk profile…</p> : null}
                  {riskProfileQuery.isError ? <p className="text-sm text-rose-200">Could not load risk profile.</p> : null}

                  {riskProfileQuery.data ? (
                    <div className="space-y-2 text-sm text-text-1">
                      <p>Risk score: <span className="text-text-0">{riskProfileQuery.data.risk_score}</span></p>
                      <p>Total cases: <span className="text-text-0">{riskProfileQuery.data.case_count_total}</span></p>
                      <p>Cases (30d): <span className="text-text-0">{riskProfileQuery.data.case_count_recent_30d}</span></p>
                      <p>Open cases: <span className="text-text-0">{riskProfileQuery.data.open_case_count}</span></p>
                      <p>Open appeals: <span className="text-text-0">{riskProfileQuery.data.open_appeal_count}</span></p>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-text-2">Appeal queue</p>
                  {appealsQuery.isLoading ? <p className="text-sm text-text-2">Loading appeals…</p> : null}
                  {appealsQuery.isError ? <p className="text-sm text-rose-200">Could not load appeals.</p> : null}

                  <div className="space-y-2">
                    {(appealsQuery.data?.tickets ?? []).map((ticket) => (
                      <div key={ticket.id} className="rounded-lg border border-white/10 bg-white/5 p-2">
                        <p className="text-sm text-text-0">#{ticket.ticket_number} · {ticket.subject}</p>
                        <p className="text-xs text-text-2">{ticket.status} · {ticket.priority} · {formatDate(ticket.created_at)}</p>
                      </div>
                    ))}
                    {!appealsQuery.isLoading && (appealsQuery.data?.tickets.length ?? 0) === 0 ? <p className="text-sm text-text-2">No appeal tickets for this member.</p> : null}
                  </div>
                </div>
              </div>

              {/* Case reason editor */}
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-text-2">
                  Case #{activeCase.case_number} — reason
                </p>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={2}
                  placeholder="Enter case reason…"
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0 outline-none placeholder:text-text-3 focus:border-cyan/40"
                />
                {editReason !== (activeCase.reason ?? "") && (
                  <button
                    onClick={() => void saveReason()}
                    disabled={savingReason}
                    className="mt-2 rounded-lg border border-cyan/30 bg-cyan/20 px-3 py-1 text-xs text-cyan disabled:opacity-40 transition hover:bg-cyan/30"
                  >
                    {savingReason ? "Saving…" : "Save reason"}
                  </button>
                )}
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm text-text-1">
              <thead className="text-xs uppercase tracking-[0.18em] text-text-2">
                <tr>
                  <th className="px-3 py-2">Select</th>
                  <th className="px-3 py-2">Case</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Moderator</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {moderationQuery.isLoading ? (
                  <tr>
                    <td colSpan={7} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-text-2">Loading moderation cases…</td>
                  </tr>
                ) : null}

                {filteredCases.map((item, index) => (
                  <tr key={item.id} className={`rounded-xl border bg-white/5 ${index === activeCaseIndex ? "border-cyan/35" : "border-white/10"}`} onMouseEnter={() => setActiveCaseIndex(index)}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selectedTargets.includes(item.target_id)} onChange={() => toggleSelected(item.target_id)} className="h-4 w-4 rounded border-white/20 bg-white/10" />
                    </td>
                    <td className="px-3 py-3 font-mono text-text-0">
                      <div className="flex items-center gap-2">
                        <span>#{item.case_number}</span>
                        <button onClick={() => void copyCaseNumber(item.case_number)} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-text-2 transition hover:border-cyan/30 hover:text-cyan">Copy</button>
                      </div>
                    </td>
                    <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-xs uppercase tracking-[0.12em] ${actionClass(item.action)}`}>{item.action}</span></td>
                    <td className="px-3 py-3 text-text-0">{item.target_name || item.target_id}</td>
                    <td className="px-3 py-3">{item.moderator_name || "—"}</td>
                    <td className="max-w-[320px] px-3 py-3 text-text-2">{item.reason || item.duration || "—"}</td>
                    <td className="px-3 py-3 text-text-2">{formatDate(item.created_at)}</td>
                  </tr>
                ))}

                {!moderationQuery.isLoading && selectedGuild != null && filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-text-2">No moderation cases match the current guild and filter set.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {selectedGuild == null ? <p className="mt-4 text-sm text-text-2">Select a guild to load moderation data.</p> : null}
          {moderationQuery.isError ? <p className="mt-4 text-sm text-rose-200">Could not load moderation data from the backend.</p> : null}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button disabled={page <= 1 || selectedGuild == null} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-text-1 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-text-2">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages || selectedGuild == null} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-text-1 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>
      )}

      {/* ── Global Bans Tab ──────────────────────────── */}
      {tab === "global-bans" && (
        <section className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rose-300">Global Ban List</p>
              <h3 className="mt-2 text-xl font-semibold text-text-0">Cross-server bans</h3>
            </div>
            <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs text-rose-200">{globalBansQuery.data?.total ?? 0} total</span>
          </div>

          {/* Add form */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-text-2">Add Global Ban</p>
            <div className="flex flex-wrap gap-2">
              <input
                value={gbTargetId}
                onChange={(e) => setGbTargetId(e.target.value)}
                placeholder="Discord user ID"
                className="w-48 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0 outline-none placeholder:text-text-3 focus:border-cyan/40"
              />
              <input
                value={gbTargetName}
                onChange={(e) => setGbTargetName(e.target.value)}
                placeholder="Username (optional)"
                className="w-44 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0 outline-none placeholder:text-text-3 focus:border-cyan/40"
              />
              <input
                value={gbReason}
                onChange={(e) => setGbReason(e.target.value)}
                placeholder="Reason"
                className="flex-1 min-w-[200px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0 outline-none placeholder:text-text-3 focus:border-cyan/40"
              />
              <button
                disabled={!gbTargetId.trim() || addGlobalBanMutation.isPending}
                onClick={() => addGlobalBanMutation.mutate({ user_id: gbTargetId.trim(), user_name: gbTargetName.trim() || undefined, reason: gbReason.trim() || undefined })}
                className="flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-400/15 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
                {addGlobalBanMutation.isPending ? "Banning…" : "Add Ban"}
              </button>
            </div>
          </div>

          {/* Table */}
          {globalBansQuery.isLoading ? (
            <p className="text-sm text-text-2">Loading global bans…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm text-text-1">
                <thead className="text-xs uppercase tracking-[0.18em] text-text-2">
                  <tr>
                    <th className="px-3 py-2">Case</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Discord ID</th>
                    <th className="px-3 py-2">Moderator</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(globalBansQuery.data?.cases ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-text-2">No global bans on record.</td>
                    </tr>
                  ) : null}
                  {(globalBansQuery.data?.cases ?? []).map((ban) => (
                    <tr key={ban.id} className="rounded-2xl">
                      <td className="rounded-l-2xl border-y border-l border-white/10 bg-white/5 px-3 py-3">
                        <span className="font-mono text-xs text-text-2">#{ban.case_number}</span>
                      </td>
                      <td className="border-y border-white/10 bg-white/5 px-3 py-3 text-text-0">{ban.target_name ?? "—"}</td>
                      <td className="border-y border-white/10 bg-white/5 px-3 py-3 font-mono text-xs text-text-2">{ban.target_id}</td>
                      <td className="border-y border-white/10 bg-white/5 px-3 py-3">{ban.moderator_name ?? "—"}</td>
                      <td className="border-y border-white/10 bg-white/5 px-3 py-3 max-w-[260px] truncate">{ban.reason ?? "—"}</td>
                      <td className="rounded-r-2xl border-y border-r border-white/10 bg-white/5 px-3 py-3 text-xs text-text-2">{formatDate(ban.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}