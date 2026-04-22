import { useEffect, useMemo, useState } from "react";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { formatDate, formatNumber } from "../lib/format";
import { getJson, patchJson, postJson } from "../lib/api";

interface GuildSummary {
  id: number;
  name: string;
  discord_id?: string;
  member_count: number;
  channel_count?: number;
  role_count?: number;
  icon?: string | null;
}

interface GuildDetail extends GuildSummary {
  owner_discord_id?: string | null;
  bot_joined_at?: string | null;
  mod_case_count: number;
  ticket_count: number;
}

interface GuildSettings {
  prefix: string;
  timezone: string;
  automod_enabled: boolean;
  antinuke_enabled: boolean;
  max_warns: number;
  warn_action: string;
  ticket_channel?: string | null;
  log_channel?: string | null;
}

interface GuildCommand {
  id: number;
  command_name: string;
  cog?: string | null;
  is_enabled: boolean;
  cooldown_seconds: number;
}

interface GuildMemberRecord {
  id: string;
  username: string;
  avatar?: string | null;
  nickname?: string | null;
  displayName?: string | null;
  joinedAt?: string | null;
}

interface GuildMembersDirectoryResponse {
  members: GuildMemberRecord[];
  nextCursor: string | null;
  directoryAvailable?: boolean;
  source?: string;
  emptyReason?: string | null;
}

export function ServersPage() {
  const [selectedGuildId, setSelectedGuildId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberActionReason, setMemberActionReason] = useState("");
  const [muteMinutes, setMuteMinutes] = useState(10);
  const [memberActionBusy, setMemberActionBusy] = useState<string | null>(null);
  const [memberActionStatus, setMemberActionStatus] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<GuildSettings | null>(null);

  const guildsQuery = useQuery({
    queryKey: ["guilds"],
    queryFn: () => getJson<GuildSummary[]>("/api/guilds"),
    retry: false,
  });

  useEffect(() => {
    if (selectedGuildId == null && (guildsQuery.data?.length ?? 0) > 0) {
      setSelectedGuildId(guildsQuery.data?.[0].id ?? null);
    }
  }, [guildsQuery.data, selectedGuildId]);

  const guildDetailQuery = useQuery({
    queryKey: ["guild-detail", selectedGuildId],
    queryFn: () => getJson<GuildDetail>(`/api/guilds/${selectedGuildId}`),
    enabled: selectedGuildId != null,
    retry: false,
  });

  const settingsQuery = useQuery({
    queryKey: ["guild-settings", selectedGuildId],
    queryFn: () => getJson<GuildSettings>(`/api/guilds/${selectedGuildId}/settings`),
    enabled: selectedGuildId != null,
    retry: false,
  });

  const commandsQuery = useQuery({
    queryKey: ["guild-commands", selectedGuildId],
    queryFn: () => getJson<GuildCommand[]>(`/api/guilds/${selectedGuildId}/commands`),
    enabled: selectedGuildId != null,
    retry: false,
  });

  const membersQuery = useQuery({
    queryKey: ["guild-members", selectedGuildId, memberSearch],
    queryFn: () => getJson<GuildMemberRecord[]>(`/api/guilds/${selectedGuildId}/moderation/member-search?query=${encodeURIComponent(memberSearch.trim())}&limit=30`),
    enabled: selectedGuildId != null && memberSearch.trim().length >= 2,
    retry: false,
  });

  const membersDirectoryQuery = useInfiniteQuery({
    queryKey: ["guild-members-directory", selectedGuildId],
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${encodeURIComponent(String(pageParam))}` : "";
      return await getJson<GuildMembersDirectoryResponse>(`/api/guilds/${selectedGuildId}/members?limit=60${cursor}`);
    },
    enabled: selectedGuildId != null,
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });

  const directoryMembers = useMemo(
    () => membersDirectoryQuery.data?.pages.flatMap((page) => page.members) ?? [],
    [membersDirectoryQuery.data],
  );

  const selectedMember = useMemo(() => {
    if (!selectedMemberId) {
      return null;
    }
    const merged = [...directoryMembers, ...(membersQuery.data ?? [])];
    return merged.find((member) => member.id === selectedMemberId) ?? null;
  }, [directoryMembers, membersQuery.data, selectedMemberId]);

  const directoryMeta = useMemo(() => {
    if (!membersDirectoryQuery.data?.pages?.length) {
      return null;
    }
    return membersDirectoryQuery.data.pages[membersDirectoryQuery.data.pages.length - 1];
  }, [membersDirectoryQuery.data]);

  const emptyDirectoryReasonLabel = useMemo(() => {
    const reason = directoryMeta?.emptyReason;
    if (!reason) {
      return null;
    }

    const labels: Record<string, string> = {
      "missing-bot-token": "Bot token is not configured on the backend service.",
      "discord-api-forbidden": "Discord API denied member directory access (check bot intents/permissions).",
      "discord-api-rate-limited": "Discord API rate limit reached. Try again shortly.",
      "discord-api-unreachable": "Discord API could not be reached from the backend.",
      "discord-api-error": "Discord API returned an unexpected error.",
      "discord-payload-invalid": "Discord API payload was invalid.",
      "bridge-directory-missing": "Bridge directory endpoint is missing for this guild service.",
      "bridge-directory-unavailable": "Bridge directory service is currently unavailable.",
      "bridge-directory-error": "Bridge directory returned an error response.",
      "discord-rest-empty": "Discord REST directory returned no members for this guild.",
      "no-members-returned": "No member data source returned results for this guild.",
    };

    return labels[reason] ?? reason;
  }, [directoryMeta?.emptyReason]);

  useEffect(() => {
    setSelectedMemberId(null);
    setMemberSearch("");
    setMemberActionReason("");
    setMemberActionStatus(null);
  }, [selectedGuildId]);

  useEffect(() => {
    if (settingsQuery.data) {
      setSettingsDraft(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const filteredCommands = useMemo(() => {
    const cmds = commandsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return cmds;
    }
    return cmds.filter((item) => [item.command_name, item.cog ?? ""].join(" ").toLowerCase().includes(term));
  }, [commandsQuery.data, search]);

  async function saveSettings() {
    if (selectedGuildId == null || !settingsDraft) {
      return;
    }

    await patchJson(`/api/guilds/${selectedGuildId}/settings`, settingsDraft);
    await settingsQuery.refetch();
  }

  async function toggleCommand(item: GuildCommand) {
    if (selectedGuildId == null) {
      return;
    }

    await patchJson(`/api/guilds/${selectedGuildId}/commands/${encodeURIComponent(item.command_name)}`, {
      is_enabled: !item.is_enabled,
      cooldown_seconds: item.cooldown_seconds,
    });
    await commandsQuery.refetch();
  }

  function maybeLoadMoreOnScroll(event: React.UIEvent<HTMLDivElement>) {
    if (!membersDirectoryQuery.hasNextPage || membersDirectoryQuery.isFetchingNextPage) {
      return;
    }

    const container = event.currentTarget;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceToBottom < 180) {
      void membersDirectoryQuery.fetchNextPage();
    }
  }

  async function runMemberAction(action: "warn" | "mute" | "kick" | "ban") {
    if (selectedGuildId == null || !selectedMember) {
      return;
    }

    const fallbackReason = `${action.toUpperCase()} from guild member directory`;
    const payload: Record<string, unknown> = {
      action,
      user_id: selectedMember.id,
      target_name: selectedMember.username,
      reason: memberActionReason.trim() || fallbackReason,
    };

    if (action === "mute") {
      payload.duration = Math.max(1, Math.floor(muteMinutes)) * 60;
    }
    if (action === "ban") {
      payload.delete_messages = false;
    }

    try {
      setMemberActionBusy(action);
      setMemberActionStatus(null);
      await postJson(`/api/guilds/${selectedGuildId}/moderation/actions`, payload);
      setMemberActionStatus(`${action.toUpperCase()} sent for ${selectedMember.username}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setMemberActionStatus(message);
    } finally {
      setMemberActionBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-cyan/20 bg-surface/80 p-6 shadow-panel">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan">Servers</p>
        <h2 className="mt-3 text-3xl font-semibold text-text-0">Guild Management Surface</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-2">Manage guild metadata, settings, and command toggles directly from React.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[300px,1fr]">
        <aside className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Guilds</p>
          <div className="space-y-2">
            {(guildsQuery.data ?? []).map((guild) => (
              <button
                key={guild.id}
                onClick={() => setSelectedGuildId(guild.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${selectedGuildId === guild.id ? "border-cyan/30 bg-cyan/10" : "border-white/10 bg-white/5 hover:border-cyan/20"}`}
              >
                <p className="text-sm font-medium text-text-0">{guild.name}</p>
                <p className="mt-1 text-xs text-text-2">{formatNumber(guild.member_count)} members</p>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Guild detail</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-text-2">Members</p><p className="mt-1 font-semibold text-text-0">{formatNumber(guildDetailQuery.data?.member_count)}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-text-2">Channels</p><p className="mt-1 font-semibold text-text-0">{formatNumber(guildDetailQuery.data?.channel_count)}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-text-2">Open tickets</p><p className="mt-1 font-semibold text-text-0">{formatNumber(guildDetailQuery.data?.ticket_count)}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-text-2">Mod cases</p><p className="mt-1 font-semibold text-text-0">{formatNumber(guildDetailQuery.data?.mod_case_count)}</p></div>
            </div>
            <p className="mt-3 text-xs text-text-2">Bot joined: {formatDate(guildDetailQuery.data?.bot_joined_at ?? null)}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Member directory</p>
              <p className="text-xs text-text-2">Click a member card to focus it</p>
            </div>

            {membersDirectoryQuery.isLoading ? <p className="text-sm text-text-2">Loading members...</p> : null}
            {membersDirectoryQuery.isError ? <p className="text-sm text-rose-200">Could not load member directory data.</p> : null}

            {!membersDirectoryQuery.isLoading && !membersDirectoryQuery.isError ? (
              <>
                <div className="grid gap-3 xl:grid-cols-[2fr,1fr]">
                  <div className="max-h-[26rem] overflow-y-auto pr-1" onScroll={maybeLoadMoreOnScroll}>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-2">
                      {directoryMembers.map((member) => {
                        const avatarUrl = member.avatar
                          ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png?size=64`
                          : null;
                        const isSelected = selectedMemberId === member.id;

                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => setSelectedMemberId(member.id)}
                            className={`rounded-xl border p-3 text-left transition ${isSelected ? "border-cyan/40 bg-cyan/10" : "border-white/10 bg-white/5 hover:border-cyan/20"}`}
                          >
                            <div className="flex items-center gap-3">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={member.username} className="h-10 w-10 rounded-full border border-white/10" />
                              ) : (
                                <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-sm text-text-1">{member.username.slice(0, 1).toUpperCase()}</div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-text-0">{member.displayName || member.nickname || member.username}</p>
                                <p className="truncate text-xs text-text-2">@{member.username}</p>
                                <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">ID {member.id}</p>
                                <p className="truncate text-[11px] text-text-3">Joined {formatDate(member.joinedAt ?? null)}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {membersDirectoryQuery.isFetchingNextPage ? <p className="mt-2 text-xs text-text-2">Loading more members...</p> : null}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan">Selected member</p>
                    {selectedMember ? (
                      <div className="mt-3 space-y-3">
                        <p className="text-sm font-semibold text-text-0">{selectedMember.displayName || selectedMember.nickname || selectedMember.username}</p>
                        <p className="text-xs text-text-2">@{selectedMember.username}</p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">ID {selectedMember.id}</p>
                        <p className="text-xs text-text-2">Joined {formatDate(selectedMember.joinedAt ?? null)}</p>

                        <label className="grid gap-1 text-xs text-text-2">
                          <span>Reason</span>
                          <input
                            value={memberActionReason}
                            onChange={(event) => setMemberActionReason(event.target.value)}
                            placeholder="moderation reason"
                            className="rounded-lg border border-white/10 bg-panel/80 px-2 py-1.5 text-xs text-text-0 placeholder:text-text-3"
                          />
                        </label>

                        <label className="grid gap-1 text-xs text-text-2">
                          <span>Mute minutes</span>
                          <input
                            type="number"
                            min={1}
                            max={40320}
                            value={muteMinutes}
                            onChange={(event) => setMuteMinutes(Number(event.target.value) || 1)}
                            className="rounded-lg border border-white/10 bg-panel/80 px-2 py-1.5 text-xs text-text-0"
                          />
                        </label>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => void runMemberAction("warn")}
                            disabled={memberActionBusy != null}
                            className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1.5 text-xs text-amber-100 disabled:opacity-50"
                          >
                            {memberActionBusy === "warn" ? "Working..." : "Warn"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void runMemberAction("mute")}
                            disabled={memberActionBusy != null}
                            className="rounded-lg border border-violet-300/30 bg-violet-300/10 px-2 py-1.5 text-xs text-violet-100 disabled:opacity-50"
                          >
                            {memberActionBusy === "mute" ? "Working..." : "Mute"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void runMemberAction("kick")}
                            disabled={memberActionBusy != null}
                            className="rounded-lg border border-orange-300/30 bg-orange-300/10 px-2 py-1.5 text-xs text-orange-100 disabled:opacity-50"
                          >
                            {memberActionBusy === "kick" ? "Working..." : "Kick"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void runMemberAction("ban")}
                            disabled={memberActionBusy != null}
                            className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-2 py-1.5 text-xs text-rose-100 disabled:opacity-50"
                          >
                            {memberActionBusy === "ban" ? "Working..." : "Ban"}
                          </button>
                        </div>

                        {memberActionStatus ? <p className="text-xs text-text-2">{memberActionStatus}</p> : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-text-2">Click a member card to view details and run actions.</p>
                    )}
                  </div>
                </div>

                {directoryMembers.length === 0 ? (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-text-2">No members returned for this guild yet.</p>
                    {emptyDirectoryReasonLabel ? <p className="text-xs text-amber-100/90">{emptyDirectoryReasonLabel}</p> : null}
                    {directoryMeta?.source ? <p className="text-xs text-text-3">Source: {directoryMeta.source}</p> : null}
                  </div>
                ) : null}

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-text-2">Showing {formatNumber(directoryMembers.length)} members</p>
                  <p className="text-xs text-text-3">Scroll to load more</p>
                </div>
              </>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Guild members quick search</p>
              <input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="search member" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0 placeholder:text-text-3" />
            </div>

            {memberSearch.trim().length < 2 ? <p className="text-sm text-text-2">Type at least 2 characters to search by username, nickname, or ID.</p> : null}
            {membersQuery.isLoading ? <p className="text-sm text-text-2">Loading members...</p> : null}
            {membersQuery.isError ? <p className="text-sm text-rose-200">Could not load members for this guild.</p> : null}

            {memberSearch.trim().length >= 2 && !membersQuery.isLoading && !membersQuery.isError ? (
              <div className="grid gap-2 md:grid-cols-2">
                {(membersQuery.data ?? []).map((member) => {
                  const avatarUrl = member.avatar
                    ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png?size=64`
                    : null;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedMemberId(member.id)}
                      className={`w-full rounded-xl border p-3 text-left ${selectedMemberId === member.id ? "border-cyan/40 bg-cyan/10" : "border-white/10 bg-white/5"}`}
                    >
                      <div className="flex items-center gap-3">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={member.username} className="h-10 w-10 rounded-full border border-white/10" />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-sm text-text-1">{member.username.slice(0, 1).toUpperCase()}</div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-0">{member.nickname || member.username}</p>
                          <p className="truncate text-xs text-text-2">@{member.username}</p>
                          <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">ID {member.id}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {(membersQuery.data?.length ?? 0) === 0 ? <p className="text-sm text-text-2">No members found for that search.</p> : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Guild settings</p>
              <button onClick={() => void saveSettings()} className="rounded-xl border border-cyan/30 bg-cyan/15 px-3 py-2 text-sm text-cyan transition hover:bg-cyan/20">Save settings</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-text-1">
                <span>Prefix</span>
                <input value={settingsDraft?.prefix ?? "!"} onChange={(event) => setSettingsDraft((prev) => ({ ...(prev as GuildSettings), prefix: event.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-text-0" />
              </label>
              <label className="grid gap-2 text-sm text-text-1">
                <span>Timezone</span>
                <input value={settingsDraft?.timezone ?? "UTC"} onChange={(event) => setSettingsDraft((prev) => ({ ...(prev as GuildSettings), timezone: event.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-text-0" />
              </label>
              <label className="grid gap-2 text-sm text-text-1">
                <span>Max warns</span>
                <input type="number" value={settingsDraft?.max_warns ?? 3} onChange={(event) => setSettingsDraft((prev) => ({ ...(prev as GuildSettings), max_warns: Number(event.target.value) }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-text-0" />
              </label>
              <label className="grid gap-2 text-sm text-text-1">
                <span>Warn action</span>
                <select value={settingsDraft?.warn_action ?? "mute"} onChange={(event) => setSettingsDraft((prev) => ({ ...(prev as GuildSettings), warn_action: event.target.value }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-text-0">
                  <option value="mute">mute</option>
                  <option value="kick">kick</option>
                  <option value="ban">ban</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1">
                <input type="checkbox" checked={settingsDraft?.automod_enabled ?? false} onChange={(event) => setSettingsDraft((prev) => ({ ...(prev as GuildSettings), automod_enabled: event.target.checked }))} />
                Enable automod
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1">
                <input type="checkbox" checked={settingsDraft?.antinuke_enabled ?? false} onChange={(event) => setSettingsDraft((prev) => ({ ...(prev as GuildSettings), antinuke_enabled: event.target.checked }))} />
                Enable antinuke
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Guild commands</p>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="search command" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0 placeholder:text-text-3" />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {filteredCommands.map((item) => (
                <div key={item.id || item.command_name} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-text-0">/{item.command_name}</p>
                    <button onClick={() => void toggleCommand(item)} className={`rounded-lg border px-2 py-1 text-xs ${item.is_enabled ? "border-lime/30 bg-lime/10 text-lime" : "border-white/10 bg-white/5 text-text-2"}`}>
                      {item.is_enabled ? "enabled" : "disabled"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-text-2">{item.cog || "uncategorized"} · cooldown {item.cooldown_seconds}s</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
