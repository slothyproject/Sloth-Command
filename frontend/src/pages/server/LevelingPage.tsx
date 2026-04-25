import { TrendingUp } from "lucide-react";

export function LevelingPage() {
  return (
    <div className="dashboard-chrome rounded-[1.6rem] p-8 flex flex-col items-center gap-3 text-center">
      <TrendingUp className="w-10 h-10 text-cyan/40" />
      <h2 className="font-display text-lg font-semibold text-text-0">Leveling System</h2>
      <p className="text-sm text-text-3 max-w-xs">Set XP multipliers, level-up messages, and role rewards. Coming soon.</p>
    </div>
  );
}
