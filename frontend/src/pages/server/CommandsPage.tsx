import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Terminal } from "lucide-react";
import { toast } from "sonner";

import { Toggle } from "@/components/ui/toggle";
import { getJson, patchJson } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { GuildCommand } from "@/types";

export function CommandsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const { data: commands, isLoading } = useQuery({
    queryKey: ["guild-commands", guildId],
    queryFn: () => getJson<GuildCommand[]>(`/api/guilds/${guildId}/commands`),
    enabled: !!guildId,
  });

  const { mutate: updateCmd, isPending } = useMutation({
    mutationFn: ({
      name,
      patch,
    }: {
      name: string;
      patch: { is_enabled?: boolean; cooldown_seconds?: number };
    }) => patchJson(`/api/guilds/${guildId}/commands/${name}`, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["guild-commands", guildId] });
      toast.success("Command updated");
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  // Group commands by cog
  const grouped = commands?.reduce<Record<string, GuildCommand[]>>((acc, cmd) => {
    const cog = cmd.cog ?? "Uncategorised";
    (acc[cog] ??= []).push(cmd);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-cyan/40 border-t-cyan rounded-full animate-spin" />
      </div>
    );
  }

  if (!grouped || Object.keys(grouped).length === 0) {
    return (
      <div className="dashboard-chrome rounded-[1.6rem] p-10 flex flex-col items-center gap-3 text-center">
        <Terminal className="w-10 h-10 text-cyan/30" />
        <p className="text-sm text-text-3">No commands found for this server.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-text-0">Commands</h2>
        <p className="text-sm text-text-3 mt-0.5">
          Toggle commands on/off and adjust per-command cooldowns.
        </p>
      </div>

      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cog, cmds]) => (
        <div key={cog} className="dashboard-chrome rounded-[1.6rem] overflow-hidden">
          {/* Cog header */}
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan/60" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">{cog}</span>
            <span className="ml-auto text-xs text-text-3">{cmds.length} command{cmds.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="divide-y divide-white/5">
            {cmds.sort((a, b) => a.command_name.localeCompare(b.command_name)).map((cmd) => (
              <CommandRow
                key={cmd.id}
                cmd={cmd}
                isPending={isPending}
                onToggle={(enabled) =>
                  updateCmd({ name: cmd.command_name, patch: { is_enabled: enabled } })
                }
                onCooldown={(secs) =>
                  updateCmd({ name: cmd.command_name, patch: { cooldown_seconds: secs } })
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CommandRow({
  cmd,
  isPending,
  onToggle,
  onCooldown,
}: {
  cmd: GuildCommand;
  isPending: boolean;
  onToggle: (v: boolean) => void;
  onCooldown: (s: number) => void;
}) {
  const [cooldown, setCooldown] = useState(String(cmd.cooldown_seconds));
  const cooldownDirty = cooldown !== String(cmd.cooldown_seconds);

  function commitCooldown() {
    const secs = Math.max(0, Math.min(3600, Number(cooldown) || 0));
    setCooldown(String(secs));
    if (cooldownDirty) onCooldown(secs);
  }

  return (
    <div className="px-5 py-3.5 flex items-center gap-4">
      <Toggle value={cmd.is_enabled} onChange={onToggle} disabled={isPending} />

      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm font-mono font-medium",
            cmd.is_enabled ? "text-text-0" : "text-text-3 opacity-50"
          )}
        >
          /{cmd.command_name}
        </span>
      </div>

      {/* Cooldown input */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Clock className="w-3.5 h-3.5 text-text-3" />
        <input
          type="number"
          min={0}
          max={3600}
          value={cooldown}
          onChange={(e) => setCooldown(e.target.value)}
          onBlur={commitCooldown}
          onKeyDown={(e) => e.key === "Enter" && commitCooldown()}
          className="w-16 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-text-0 text-right font-mono focus:border-cyan/50 focus:outline-none"
        />
        <span className="text-xs text-text-3 w-3">s</span>
      </div>
    </div>
  );
}
