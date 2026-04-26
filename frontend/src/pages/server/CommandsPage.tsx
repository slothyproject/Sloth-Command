import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Clock, Hash, Shield, Terminal, X } from "lucide-react";
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
      patch: { is_enabled?: boolean; cooldown_seconds?: number; allowed_roles?: string[]; disabled_channels?: string[] };
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
                onRoles={(roles) =>
                  updateCmd({ name: cmd.command_name, patch: { allowed_roles: roles } })
                }
                onChannels={(channels) =>
                  updateCmd({ name: cmd.command_name, patch: { disabled_channels: channels } })
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
  onRoles,
  onChannels,
}: {
  cmd: GuildCommand;
  isPending: boolean;
  onToggle: (v: boolean) => void;
  onCooldown: (s: number) => void;
  onRoles: (roles: string[]) => void;
  onChannels: (channels: string[]) => void;
}) {
  const [cooldown, setCooldown] = useState(String(cmd.cooldown_seconds));
  const cooldownDirty = cooldown !== String(cmd.cooldown_seconds);
  const [expanded, setExpanded] = useState(false);
  const [roleInput, setRoleInput] = useState("");
  const [channelInput, setChannelInput] = useState("");

  function commitCooldown() {
    const secs = Math.max(0, Math.min(3600, Number(cooldown) || 0));
    setCooldown(String(secs));
    if (cooldownDirty) onCooldown(secs);
  }

  function addRole() {
    const val = roleInput.trim();
    if (!val || cmd.allowed_roles.includes(val)) return;
    onRoles([...cmd.allowed_roles, val]);
    setRoleInput("");
  }

  function removeRole(role: string) {
    onRoles(cmd.allowed_roles.filter((r) => r !== role));
  }

  function addChannel() {
    const val = channelInput.trim();
    if (!val || cmd.disabled_channels.includes(val)) return;
    onChannels([...cmd.disabled_channels, val]);
    setChannelInput("");
  }

  function removeChannel(ch: string) {
    onChannels(cmd.disabled_channels.filter((c) => c !== ch));
  }

  return (
    <div className="border-b border-white/5 last:border-0">
      {/* Main row */}
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
          {(cmd.allowed_roles.length > 0 || cmd.disabled_channels.length > 0) && (
            <span className="ml-2 text-[11px] text-text-3">
              {cmd.allowed_roles.length > 0 && `${cmd.allowed_roles.length} role${cmd.allowed_roles.length !== 1 ? "s" : ""}`}
              {cmd.allowed_roles.length > 0 && cmd.disabled_channels.length > 0 && " · "}
              {cmd.disabled_channels.length > 0 && `${cmd.disabled_channels.length} blocked ch.`}
            </span>
          )}
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

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-text-3 hover:text-text-1 hover:bg-white/5 transition-colors flex-shrink-0"
          title="Permissions"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded permission panel */}
      {expanded && (
        <div className="px-5 pb-4 grid sm:grid-cols-2 gap-4 bg-white/[0.015]">
          {/* Allowed roles */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-text-3">
              <Shield className="w-3.5 h-3.5" />
              Allowed roles
            </div>
            <p className="text-[11px] text-text-3">Leave empty to allow all roles.</p>
            <div className="flex gap-1.5">
              <input
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRole()}
                placeholder="Role ID or name"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-text-0 font-mono focus:border-cyan/50 focus:outline-none"
              />
              <button
                onClick={addRole}
                className="px-3 py-1.5 rounded-lg bg-cyan/20 text-cyan text-xs font-medium hover:bg-cyan/30 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cmd.allowed_roles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-mono"
                >
                  {role}
                  <button onClick={() => removeRole(role)} className="hover:text-white ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Disabled channels */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-text-3">
              <Hash className="w-3.5 h-3.5" />
              Blocked channels
            </div>
            <p className="text-[11px] text-text-3">Command disabled in these channels.</p>
            <div className="flex gap-1.5">
              <input
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addChannel()}
                placeholder="Channel ID"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-text-0 font-mono focus:border-cyan/50 focus:outline-none"
              />
              <button
                onClick={addChannel}
                className="px-3 py-1.5 rounded-lg bg-cyan/20 text-cyan text-xs font-medium hover:bg-cyan/30 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cmd.disabled_channels.map((ch) => (
                <span
                  key={ch}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-mono"
                >
                  {ch}
                  <button onClick={() => removeChannel(ch)} className="hover:text-white ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
