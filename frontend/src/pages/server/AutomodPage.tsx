import { ShieldAlert } from "lucide-react";

export function AutomodPage() {
  return (
    <div className="dashboard-chrome rounded-[1.6rem] p-8 flex flex-col items-center gap-3 text-center">
      <ShieldAlert className="w-10 h-10 text-cyan/40" />
      <h2 className="font-display text-lg font-semibold text-text-0">Auto-Moderation</h2>
      <p className="text-sm text-text-3 max-w-xs">Configure automod rules, filters, and thresholds per server. Coming soon.</p>
    </div>
  );
}
