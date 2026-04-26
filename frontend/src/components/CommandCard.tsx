import { Shield, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { useState } from "react";

interface Command {
  name: string;
  args: string;
  permissions: string;
  description: string;
  example: string;
}

interface CommandCardProps {
  command: Command;
  cogName: string;
}

function PermPill({ perms }: { perms: string }) {
  if (!perms || perms === "—" || perms === "Any member")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
        <Shield className="h-3 w-3" /> Anyone
      </span>
    );
  const p = perms.toLowerCase();
  const color = p.includes("admin")
    ? "red"
    : p.includes("mod") || p.includes("ban") || p.includes("kick") || p.includes("manage")
    ? "amber"
    : "emerald";
  const border = `border-${color}-500/20`;
  const bg = `bg-${color}-500/10`;
  const text = `text-${color}-400`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${border} ${bg} px-2 py-0.5 text-[10px] font-medium ${text}`}>
      <Shield className="h-3 w-3" />
      {perms.length > 40 ? perms.slice(0, 38) + "…" : perms}
    </span>
  );
}

export function CommandCard({ command, cogName }: CommandCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] transition-all hover:border-accent/20 hover:bg-white/[0.04]">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">{cogName}</span>
          <div className="h-4 w-px bg-line" />
          <span className="font-mono text-sm font-semibold text-text-0">!{command.name}</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-text-3" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-3" />
          )}
        </div>
        <PermPill perms={command.permissions} />
      </button>

      {expanded && (
        <div className="border-t border-line px-5 pb-5 pt-3">
          <p className="text-sm text-text-1 leading-relaxed">{command.description || "No description available."}</p>

          {command.args && command.args !== "None" && (
            <div className="mt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-3">Arguments</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {command.args.split(",").map((a) => {
                  const [name, type] = a.trim().split(":");
                  return (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-xs text-text-0 border border-line"
                    >
                      <span className="text-text-2">{name?.trim()}</span>
                      {type && <span className="text-text-3">{type.trim()}</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {command.example && (
            <div className="mt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-3">Example</span>
              <div className="mt-1 flex items-center gap-2 rounded-lg bg-[#0d1520] border border-line px-3 py-2">
                <Terminal className="h-3.5 w-3.5 text-accent" />
                <code className="text-sm font-mono text-text-0">{command.example}</code>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
