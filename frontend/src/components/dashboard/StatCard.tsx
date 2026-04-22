import type { ReactNode } from "react";

export function StatCard({ label, value, meta, icon }: { label: string; value: string; meta: string; icon: ReactNode }) {
  return (
    <div className="dashboard-chrome rounded-[1.6rem] p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-2">{label}</p>
        <div className="text-cyan">{icon}</div>
      </div>
      <div className="font-display text-3xl font-semibold text-text-0">{value}</div>
      <p className="mt-2 text-sm text-text-2">{meta}</p>
    </div>
  );
}