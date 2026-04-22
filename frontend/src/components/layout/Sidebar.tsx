import { BarChart3, LayoutDashboard, ScrollText, Server, Settings, ShieldAlert, Ticket, Users, WandSparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "../../lib/cn";
import { formatNumber } from "../../lib/format";
import { useShellOverviewQuery } from "../../lib/overview";
import { useAuthStore } from "../../store/authStore";

const baseLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/servers", label: "Servers", icon: Server },
  { to: "/moderation", label: "Moderation", icon: ShieldAlert },
  { to: "/tickets", label: "Tickets", icon: Ticket },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/ai-advisor", label: "AI Advisor", icon: WandSparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const overviewQuery = useShellOverviewQuery();
  const links = user?.is_admin
    ? [...baseLinks, { to: "/logs", label: "Logs", icon: ScrollText }, { to: "/users", label: "Users", icon: Users }]
    : baseLinks;

  return (
    <aside className="dashboard-sidebar relative z-1 hidden h-screen w-80 shrink-0 overflow-y-auto border-r border-line bg-[rgba(6,10,22,0.72)] px-5 py-6 pb-10 backdrop-blur-chrome lg:sticky lg:top-0 lg:block">
      <div className="dashboard-chrome mb-6 rounded-[1.9rem] p-5">
        <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.2rem] border border-cyan/30 bg-[linear-gradient(135deg,rgba(113,231,255,0.16),rgba(78,161,255,0.22))] text-lg font-semibold text-cyan shadow-cyan">
          <img src="/sloth-lee-logo.png" alt="Sloth Lee" className="h-10 w-10 object-contain" />
        </div>
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan">Dissident Hub</p>
          <h2 className="font-display text-xl font-semibold text-text-0">Sloth Lee command dojo</h2>
          <p className="text-sm leading-6 text-text-2">The same live tooling with a unified Sloth Lee experience from homepage to operator workflows.</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white/5 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-3">Guild footprint</p>
            <p className="mt-2 text-xl font-semibold text-text-0">{formatNumber(overviewQuery.data?.stats.guilds)}</p>
            <p className="text-xs text-text-2">Active servers in scope</p>
          </div>
          <div className="rounded-2xl border border-line bg-white/5 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-3">Member reach</p>
            <p className="mt-2 text-xl font-semibold text-text-0">{formatNumber(overviewQuery.data?.stats.members)}</p>
            <p className="text-xs text-text-2">Tracked across connected guilds</p>
          </div>
        </div>
      </div>

      <div className="mb-3 px-2 font-mono text-[10px] uppercase tracking-[0.24em] text-text-3">Dojo routes</div>
      <nav className="space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => cn(
                "group flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition duration-200",
                isActive
                  ? "border-cyan/25 bg-[linear-gradient(135deg,rgba(113,231,255,0.14),rgba(78,161,255,0.14))] text-cyan shadow-glow"
                  : "border-transparent bg-transparent text-text-1 hover:border-line hover:bg-white/5 hover:text-text-0",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="dashboard-chrome mt-6 rounded-[1.9rem] p-4">
        <div className="mb-2 flex items-center gap-2 text-cyan">
          <WandSparkles className="h-4 w-4" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Live status</span>
        </div>
        <p className="text-sm leading-6 text-text-1">Servers, moderation, tickets, analytics, advisor, and admin tools remain intact while the shell aligns with Sloth Lee branding.</p>
        <div className="mt-4 space-y-2 text-xs text-text-2">
          <div className="flex items-center justify-between rounded-xl border border-line bg-white/5 px-3 py-2">
            <span>Gateway</span>
            <span className={overviewQuery.data?.stats.online ? "text-lime" : "text-amber-200"}>{overviewQuery.data?.stats.online ? "Connected" : "Syncing"}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line bg-white/5 px-3 py-2">
            <span>Latency</span>
            <span className="text-text-1">{overviewQuery.data?.stats.latency_ms ? `${overviewQuery.data.stats.latency_ms} ms` : "--"}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line bg-white/5 px-3 py-2">
            <span>Version</span>
            <span className="text-text-1">{overviewQuery.data?.stats.version ?? "--"}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-chrome mt-6 rounded-[1.9rem] p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Quick links</p>
        <div className="mt-3 grid gap-2 text-sm text-text-1">
          <a href="https://dissident.mastertibbles.co.uk/" className="rounded-xl border border-line bg-white/5 px-3 py-2 transition hover:border-cyan/30 hover:text-cyan">Open Sloth Lee site</a>
          <a href="https://discord.com/oauth2/authorize?client_id=1493639167526174830&scope=bot+applications.commands&permissions=8" className="rounded-xl border border-line bg-white/5 px-3 py-2 transition hover:border-cyan/30 hover:text-cyan">Summon bot to Discord</a>
        </div>
      </div>
    </aside>
  );
}