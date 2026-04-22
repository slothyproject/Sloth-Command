import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { getJson, postJson } from "../lib/api";

interface VersionResponse {
  dashboard: string;
  bot: string;
  bot_online: boolean;
}

interface BotStatsResponse {
  guilds: number;
  members: number;
  commands_today: number;
  uptime: string;
  version: string;
  online: boolean;
}

interface InviteResponse {
  url: string;
  client_id: string;
}

export function SettingsPage() {
  const [status, setStatus] = useState<string>("Ready");

  const versionQuery = useQuery({
    queryKey: ["version"],
    queryFn: () => getJson<VersionResponse>("/api/version"),
    retry: false,
  });

  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: () => getJson<BotStatsResponse>("/api/stats"),
    retry: false,
  });

  const inviteQuery = useQuery({
    queryKey: ["bot-invite"],
    queryFn: () => getJson<InviteResponse>("/api/bot/invite"),
    retry: false,
  });

  async function runAdminAction(action: "sync_guilds" | "clear_cache" | "reload_config") {
    try {
      await postJson(`/api/actions/${action}`);
      setStatus(`Ran action: ${action}`);
    } catch {
      setStatus(`Action failed: ${action}`);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-cyan/20 bg-surface/80 p-6 shadow-panel">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan">Settings</p>
        <h2 className="mt-3 text-3xl font-semibold text-text-0">System Configuration</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-2">Operational settings, version visibility, invite utilities, and admin controls for the React command center.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Runtime versioning</p>
          <div className="mt-4 space-y-2 text-sm text-text-1">
            <p>Dashboard: <span className="text-text-0">{versionQuery.data?.dashboard ?? "--"}</span></p>
            <p>Bot: <span className="text-text-0">{versionQuery.data?.bot ?? "--"}</span></p>
            <p>Bot online: <span className="text-text-0">{versionQuery.data?.bot_online ? "yes" : "no"}</span></p>
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Bot operations</p>
          <div className="mt-4 space-y-2 text-sm text-text-1">
            <p>Guilds: <span className="text-text-0">{statsQuery.data?.guilds ?? "--"}</span></p>
            <p>Members: <span className="text-text-0">{statsQuery.data?.members ?? "--"}</span></p>
            <p>Commands today: <span className="text-text-0">{statsQuery.data?.commands_today ?? "--"}</span></p>
            <p>Uptime: <span className="text-text-0">{statsQuery.data?.uptime ?? "--"}</span></p>
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Invite utility</p>
          <p className="mt-3 text-sm text-text-2">Generate bot install URL from current backend config.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={inviteQuery.data?.url ?? "#"} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan/30 bg-cyan/15 px-4 py-2 text-sm text-cyan transition hover:bg-cyan/20">Open invite URL</a>
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Admin actions</p>
          <p className="mt-3 text-sm text-text-2">Requires admin access. Executes existing backend maintenance actions.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => void runAdminAction("sync_guilds")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Sync guilds</button>
            <button onClick={() => void runAdminAction("clear_cache")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Clear cache</button>
            <button onClick={() => void runAdminAction("reload_config")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Reload config</button>
          </div>
          <p className="mt-3 text-xs text-text-2">{status}</p>
        </article>
      </section>
    </div>
  );
}
