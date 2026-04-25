import { Terminal } from "lucide-react";

export function CommandsPage() {
  return (
    <div className="dashboard-chrome rounded-[1.6rem] p-8 flex flex-col items-center gap-3 text-center">
      <Terminal className="w-10 h-10 text-cyan/40" />
      <h2 className="font-display text-lg font-semibold text-text-0">Commands Configuration</h2>
      <p className="text-sm text-text-3 max-w-xs">Enable, disable, and configure per-server slash commands. Coming soon.</p>
    </div>
  );
}
