import { Ticket } from "lucide-react";

export function TicketConfigPage() {
  return (
    <div className="dashboard-chrome rounded-[1.6rem] p-8 flex flex-col items-center gap-3 text-center">
      <Ticket className="w-10 h-10 text-cyan/40" />
      <h2 className="font-display text-lg font-semibold text-text-0">Ticket Configuration</h2>
      <p className="text-sm text-text-3 max-w-xs">Manage ticket categories, SLA rules, and staff roles. Coming soon.</p>
    </div>
  );
}
