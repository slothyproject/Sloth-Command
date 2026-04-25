import { DoorOpen } from "lucide-react";

export function WelcomePage() {
  return (
    <div className="dashboard-chrome rounded-[1.6rem] p-8 flex flex-col items-center gap-3 text-center">
      <DoorOpen className="w-10 h-10 text-cyan/40" />
      <h2 className="font-display text-lg font-semibold text-text-0">Welcome Settings</h2>
      <p className="text-sm text-text-3 max-w-xs">Customise welcome messages, channels, and auto-roles. Coming soon.</p>
    </div>
  );
}
