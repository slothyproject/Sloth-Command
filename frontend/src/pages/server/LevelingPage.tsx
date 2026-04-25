import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Hash, Save, TrendingUp, Zap } from "lucide-react";
import { toast } from "sonner";

import { Toggle } from "@/components/ui/toggle";
import { getJson, patchJson } from "@/lib/api";
import type { GuildSettings } from "@/types";

type LevelingForm = Pick<
  GuildSettings,
  "leveling_enabled" | "level_channel" | "xp_multiplier"
>;

export function LevelingPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

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

  return (
    <div className="space-y-5">
      {/* Header + Save */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-text-0">Leveling System</h2>
          <p className="text-sm text-text-3 mt-0.5">
            Reward active members with XP and track progression.
          </p>
        </div>
        <button
          onClick={() => save(form)}
          disabled={!dirty || isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan text-void text-sm font-semibold disabled:opacity-40 hover:bg-cyan/90 transition-colors flex-shrink-0"
        >
          <Save className="w-4 h-4" />
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>

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
    </div>
  );
}
