import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Toggle } from "@/components/ui/toggle";
import { getJson, patchJson } from "@/lib/api";
import type { GuildSettings } from "@/types";

type AutomodForm = Pick<
  GuildSettings,
  "automod_enabled" | "max_warns" | "warn_action" | "mod_log_channel"
>;

const WARN_ACTIONS = [
  { value: "", label: "No action" },
  { value: "mute", label: "Timeout (mute)" },
  { value: "kick", label: "Kick" },
  { value: "ban", label: "Ban" },
] as const;

export function AutomodPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["guild-settings", guildId],
    queryFn: () => getJson<GuildSettings>(`/api/guilds/${guildId}/settings`),
    enabled: !!guildId,
    staleTime: 30_000,
  });

  const [form, setForm] = useState<AutomodForm>({
    automod_enabled: false,
    max_warns: null,
    warn_action: null,
    mod_log_channel: null,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        automod_enabled: settings.automod_enabled,
        max_warns: settings.max_warns,
        warn_action: settings.warn_action,
        mod_log_channel: settings.mod_log_channel,
      });
    }
  }, [settings]);

  const dirty =
    settings !== undefined &&
    (form.automod_enabled !== settings.automod_enabled ||
      form.max_warns !== settings.max_warns ||
      form.warn_action !== settings.warn_action ||
      form.mod_log_channel !== settings.mod_log_channel);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (patch: Partial<GuildSettings>) =>
      patchJson(`/api/guilds/${guildId}/settings`, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["guild-settings", guildId] });
      toast.success("Automod settings saved");
    },
    onError: (err: Error) => toast.error(`Save failed: ${err.message}`),
  });

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
          <h2 className="font-display text-xl font-semibold text-text-0">Auto-Moderation</h2>
          <p className="text-sm text-text-3 mt-0.5">
            Automatic violation detection and punishment escalation rules.
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
        {/* Automod toggle */}
        <div className="p-5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-cyan/60 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-0">Enable Auto-Moderation</p>
              <p className="text-xs text-text-3 mt-0.5">
                Detect spam, banned words, and suspicious activity automatically.
              </p>
            </div>
          </div>
          <Toggle
            value={form.automod_enabled}
            onChange={(v) => setForm((f) => ({ ...f, automod_enabled: v }))}
          />
        </div>

        {/* Max warnings */}
        <div className="p-5 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-text-0">Warning Threshold</p>
            <p className="text-xs text-text-3 mt-0.5">
              Warnings before a punishment action fires (1–20).
            </p>
          </div>
          <input
            type="number"
            min={1}
            max={20}
            value={form.max_warns ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                max_warns: e.target.value ? Number(e.target.value) : null,
              }))
            }
            className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-0 text-right font-mono focus:border-cyan/50 focus:outline-none"
            placeholder="5"
          />
        </div>

        {/* Warn action */}
        <div className="p-5 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-text-0">Punishment Action</p>
            <p className="text-xs text-text-3 mt-0.5">
              Action taken when the warning threshold is reached.
            </p>
          </div>
          <select
            value={form.warn_action ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, warn_action: e.target.value || null }))
            }
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-0 focus:border-cyan/50 focus:outline-none cursor-pointer"
          >
            {WARN_ACTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Mod log channel */}
        <div className="p-5 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-text-0">Mod Log Channel</p>
            <p className="text-xs text-text-3 mt-0.5">
              Discord channel ID where moderation actions are logged.
            </p>
          </div>
          <input
            type="text"
            value={form.mod_log_channel ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, mod_log_channel: e.target.value || null }))
            }
            className="w-48 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-0 font-mono focus:border-cyan/50 focus:outline-none"
            placeholder="Channel ID"
          />
        </div>
      </div>
    </div>
  );
}
