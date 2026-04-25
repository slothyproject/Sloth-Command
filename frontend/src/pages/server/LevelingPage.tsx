import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Hash, Save, TrendingUp, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";

import { Toggle } from "@/components/ui/toggle";
import { getJson, patchJson } from "@/lib/api";
import type { GuildSettings } from "@/types";

interface LeaderboardEntry {
  rank: number;
  member_id: string;
  username: string;
  total_xp: number;
  level: number;
}

type LevelingForm = Pick<
  GuildSettings,
  "leveling_enabled" | "level_channel" | "xp_multiplier"
>;

export function LevelingPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"settings" | "leaderboard">("settings");

  const leaderboardQuery = useQuery({
    queryKey: ["xp-leaderboard", guildId],
    queryFn: () => getJson<{ total: number; leaderboard: LeaderboardEntry[] }>(
      `/api/guilds/${guildId}/leveling/leaderboard?limit=50`
    ),
    enabled: !!guildId && tab === "leaderboard",
    staleTime: 60_000,
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["guild-settings", guildId],
    queryFn: () => getJson<GuildSettings>(`/api/guilds/${guildId}/settings`),
    enabled: !!guildId,
    staleTime: 30_000,
  });

  const [form, setForm] = useState<LevelingForm>({
    leveling_enabled: false,
    level_channel: null,
    xp_multiplier: null,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        leveling_enabled: settings.leveling_enabled,
        level_channel: settings.level_channel,
        xp_multiplier: settings.xp_multiplier,
      });
    }
  }, [settings]);

  const dirty =
    settings !== undefined &&
    (form.leveling_enabled !== settings.leveling_enabled ||
      form.level_channel !== settings.level_channel ||
      form.xp_multiplier !== settings.xp_multiplier);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (patch: Partial<GuildSettings>) =>
      patchJson(`/api/guilds/${guildId}/settings`, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["guild-settings", guildId] });
      toast.success("Leveling settings saved");
    },
    onError: (err: Error) => toast.error(`Save failed: ${err.message}`),
  });

  const multiplierDisplay = form.xp_multiplier ?? 1.0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-cyan/40 border-t-cyan rounded-full animate-spin" />
      </div>
    );
  }

  const leaderboard = leaderboardQuery.data?.leaderboard ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-text-0">Leveling System</h2>
          <p className="text-sm text-text-3 mt-0.5">
            Reward active members with XP and track progression.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex rounded-xl overflow-hidden border border-white/10 text-sm">
            <button
              onClick={() => setTab("settings")}
              className={`px-4 py-2 flex items-center gap-1.5 transition-colors ${
                tab === "settings"
                  ? "bg-cyan text-void font-semibold"
                  : "text-text-2 hover:bg-white/5"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Settings
            </button>
            <button
              onClick={() => setTab("leaderboard")}
              className={`px-4 py-2 flex items-center gap-1.5 transition-colors ${
                tab === "leaderboard"
                  ? "bg-cyan text-void font-semibold"
                  : "text-text-2 hover:bg-white/5"
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Leaderboard
            </button>
          </div>
          {tab === "settings" && (
            <button
              onClick={() => save(form)}
              disabled={!dirty || isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan text-void text-sm font-semibold disabled:opacity-40 hover:bg-cyan/90 transition-colors flex-shrink-0"
            >
              <Save className="w-4 h-4" />
              {isPending ? "Saving…" : "Save changes"}
            </button>
          )}
        </div>
      </div>

      {/* ── Settings tab ─────────────────────────────────────── */}
      {tab === "settings" && (
      <div className="dashboard-chrome rounded-[1.6rem] divide-y divide-white/5">
        {/* Enable leveling */}
        <div className="p-5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-cyan/60 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-0">Enable Leveling</p>
              <p className="text-xs text-text-3 mt-0.5">
                Members earn XP for messages and activity in this server.
              </p>
            </div>
          </div>
          <Toggle
            value={form.leveling_enabled}
            onChange={(v) => setForm((f) => ({ ...f, leveling_enabled: v }))}
          />
        </div>

        {/* Level-up channel */}
        <div className="p-5 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-text-0">Level-Up Channel</p>
            <p className="text-xs text-text-3 mt-0.5">
              Where level-up announcements are posted. Leave blank to use the message channel.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-text-3 flex-shrink-0" />
            <input
              type="text"
              value={form.level_channel ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, level_channel: e.target.value || null }))
              }
              className="w-44 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-0 font-mono focus:border-cyan/50 focus:outline-none"
              placeholder="Channel ID"
            />
          </div>
        </div>

        {/* XP multiplier */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-cyan/60 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-text-0">XP Multiplier</p>
                <p className="text-xs text-text-3 mt-0.5">
                  Boost or reduce XP gain for all members in this server.
                </p>
              </div>
            </div>
            <span className="font-mono text-lg font-semibold text-cyan min-w-[4ch] text-right">
              {multiplierDisplay.toFixed(1)}×
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={5}
            step={0.5}
            value={multiplierDisplay}
            onChange={(e) =>
              setForm((f) => ({ ...f, xp_multiplier: Number(e.target.value) }))
            }
            className="w-full accent-cyan cursor-pointer"
          />
          <div className="flex justify-between text-xs text-text-3 font-mono">
            <span>0.5×</span>
            <span>1×</span>
            <span>2×</span>
            <span>3×</span>
            <span>4×</span>
            <span>5×</span>
          </div>
        </div>
      </div>
      )}

      {/* ── Leaderboard tab ──────────────────────────────────── */}
      {tab === "leaderboard" && (
        <div className="dashboard-chrome rounded-[1.6rem] overflow-hidden">
          {leaderboardQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-cyan/40 border-t-cyan rounded-full animate-spin" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-3">
              <Trophy className="w-8 h-8 opacity-30" />
              <p className="text-sm">No XP data yet. Members need to earn XP first.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-text-3 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 text-left w-12">Rank</th>
                  <th className="px-5 py-3 text-left">Member</th>
                  <th className="px-5 py-3 text-right">Level</th>
                  <th className="px-5 py-3 text-right">Total XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((entry) => {
                  const medal =
                    entry.rank === 1 ? "🥇" :
                    entry.rank === 2 ? "🥈" :
                    entry.rank === 3 ? "🥉" : null;
                  const xpForNextLevel = (entry.level + 1) * (entry.level + 1) * 100;
                  const progress = Math.min((entry.total_xp / xpForNextLevel) * 100, 100);
                  return (
                    <tr key={entry.member_id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 text-center">
                        {medal ? (
                          <span className="text-base">{medal}</span>
                        ) : (
                          <span className="font-mono text-text-3">#{entry.rank}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-text-0">{entry.username}</span>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 max-w-[160px] bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-cyan/70 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-text-3">{Math.round(progress)}%</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan/10 text-cyan font-semibold font-mono text-xs">
                          Lv {entry.level}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-text-1">
                        {entry.total_xp.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
