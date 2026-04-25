import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Hash, Info, Save } from "lucide-react";
import { toast } from "sonner";

import { getJson, patchJson } from "@/lib/api";
import type { GuildSettings } from "@/types";

type WelcomeForm = Pick<
  GuildSettings,
  "welcome_channel" | "welcome_message" | "farewell_channel"
>;

const TEMPLATE_VARS = ["{user}", "{server}", "{member_count}"];

export function WelcomePage() {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["guild-settings", guildId],
    queryFn: () => getJson<GuildSettings>(`/api/guilds/${guildId}/settings`),
    enabled: !!guildId,
    staleTime: 30_000,
  });

  const [form, setForm] = useState<WelcomeForm>({
    welcome_channel: null,
    welcome_message: null,
    farewell_channel: null,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        welcome_channel: settings.welcome_channel,
        welcome_message: settings.welcome_message,
        farewell_channel: settings.farewell_channel,
      });
    }
  }, [settings]);

  const dirty =
    settings !== undefined &&
    (form.welcome_channel !== settings.welcome_channel ||
      form.welcome_message !== settings.welcome_message ||
      form.farewell_channel !== settings.farewell_channel);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (patch: Partial<GuildSettings>) =>
      patchJson(`/api/guilds/${guildId}/settings`, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["guild-settings", guildId] });
      toast.success("Welcome settings saved");
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
          <h2 className="font-display text-xl font-semibold text-text-0">Welcome & Farewell</h2>
          <p className="text-sm text-text-3 mt-0.5">
            Greet new members and say farewell when people leave.
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

      {/* Welcome section */}
      <div className="dashboard-chrome rounded-[1.6rem] p-5 space-y-5">
        <div className="flex items-center gap-2">
          <DoorOpen className="w-4 h-4 text-cyan/60" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">
            Welcome
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-1">Channel ID</label>
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-text-3 flex-shrink-0" />
            <input
              type="text"
              value={form.welcome_channel ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, welcome_channel: e.target.value || null }))
              }
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-0 font-mono focus:border-cyan/50 focus:outline-none"
              placeholder="Discord channel ID"
            />
          </div>
          <p className="text-xs text-text-3">
            Leave blank to disable welcome messages.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-1">Welcome Message</label>
          <textarea
            rows={4}
            value={form.welcome_message ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, welcome_message: e.target.value || null }))
            }
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-0 focus:border-cyan/50 focus:outline-none resize-y font-mono"
            placeholder="Welcome {user} to {server}! We now have {member_count} members."
          />
          <div className="flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan/50 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-text-3">
              Available variables:{" "}
              {TEMPLATE_VARS.map((v) => (
                <code key={v} className="font-mono text-cyan/70 text-[11px] mx-0.5">
                  {v}
                </code>
              ))}
            </p>
          </div>
        </div>
      </div>

      {/* Farewell section */}
      <div className="dashboard-chrome rounded-[1.6rem] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <DoorOpen className="w-4 h-4 text-cyan/60 rotate-180" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">
            Farewell
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-1">Channel ID</label>
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-text-3 flex-shrink-0" />
            <input
              type="text"
              value={form.farewell_channel ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, farewell_channel: e.target.value || null }))
              }
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-0 font-mono focus:border-cyan/50 focus:outline-none"
              placeholder="Discord channel ID"
            />
          </div>
          <p className="text-xs text-text-3">
            Leave blank to disable farewell messages.
          </p>
        </div>
      </div>
    </div>
  );
}
