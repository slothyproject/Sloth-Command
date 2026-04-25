import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Radiation, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Toggle } from "@/components/ui/toggle";
import { getJson, patchJson } from "@/lib/api";
import type { GuildSettings } from "@/types";

const PROTECTIONS = [
  {
    title: "Mass Ban Detection",
    description: "Detects and stops bots or admins banning many users in quick succession.",
  },
  {
    title: "Mass Channel Delete",
    description: "Reverts bulk channel deletions and alerts moderators immediately.",
  },
  {
    title: "Role Stripping Prevention",
    description: "Blocks attempts to remove roles from large numbers of members at once.",
  },
  {
    title: "Webhook Abuse Guard",
    description: "Monitors for rogue webhooks being created or used for mass messaging.",
  },
];

export function AntinukePage() {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["guild-settings", guildId],
    queryFn: () => getJson<GuildSettings>(`/api/guilds/${guildId}/settings`),
    enabled: !!guildId,
    staleTime: 30_000,
  });

  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (settings) setEnabled(settings.antinuke_enabled);
  }, [settings]);

  const dirty = settings !== undefined && enabled !== settings.antinuke_enabled;

  const { mutate: save, isPending } = useMutation({
    mutationFn: (patch: Partial<GuildSettings>) =>
      patchJson(`/api/guilds/${guildId}/settings`, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["guild-settings", guildId] });
      toast.success(enabled ? "Anti-Nuke protection enabled" : "Anti-Nuke protection disabled");
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
          <h2 className="font-display text-xl font-semibold text-text-0">Anti-Nuke Protection</h2>
          <p className="text-sm text-text-3 mt-0.5">
            Detect and halt server destruction attacks in real-time.
          </p>
        </div>
        <button
          onClick={() => save({ antinuke_enabled: enabled })}
          disabled={!dirty || isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan text-void text-sm font-semibold disabled:opacity-40 hover:bg-cyan/90 transition-colors flex-shrink-0"
        >
          <Save className="w-4 h-4" />
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Master toggle card */}
      <div className="dashboard-chrome rounded-[1.6rem] p-5 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Radiation className="w-6 h-6 text-cyan/70 flex-shrink-0" />
          <div>
            <p className="text-base font-semibold text-text-0">Anti-Nuke Shield</p>
            <p className="text-xs text-text-3 mt-0.5">
              {enabled
                ? "Active — your server is protected against nuke attacks."
                : "Disabled — your server is not protected."}
            </p>
          </div>
        </div>
        <Toggle value={enabled} onChange={setEnabled} />
      </div>

      {/* What's protected */}
      <div className="dashboard-chrome rounded-[1.6rem] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan/60" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">
            Protections Included
          </span>
        </div>
        <div className="divide-y divide-white/5">
          {PROTECTIONS.map((p) => (
            <div key={p.title} className="px-5 py-4 flex items-start gap-3">
              <ShieldCheck
                className={`w-4 h-4 flex-shrink-0 mt-0.5 ${enabled ? "text-cyan" : "text-text-3"}`}
              />
              <div>
                <p className={`text-sm font-medium ${enabled ? "text-text-0" : "text-text-3"}`}>
                  {p.title}
                </p>
                <p className="text-xs text-text-3 mt-0.5">{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warning when disabled */}
      {!enabled && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400/70 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-text-2 leading-relaxed">
            Anti-Nuke is currently{" "}
            <strong className="text-amber-400">disabled</strong>. Enable it to protect this
            server from coordinated destruction attacks such as mass bans, channel deletes, or
            role wipes.
          </p>
        </div>
      )}
    </div>
  );
}
