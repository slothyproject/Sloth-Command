import { useEffect, useRef } from "react";

import { BarChart3, LayoutDashboard, ScrollText, Server, Settings, ShieldAlert, Ticket, Users, WandSparkles, X } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "../../lib/cn";
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

export function MobileNav({
  isOpen,
  onClose,
  restoreFocusTo,
}: {
  isOpen: boolean;
  onClose: () => void;
  restoreFocusTo: HTMLElement | null;
}) {
  const user = useAuthStore((state) => state.user);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const links = user?.is_admin
    ? [...baseLinks, { to: "/logs", label: "Logs", icon: ScrollText }, { to: "/users", label: "Users", icon: Users }]
    : baseLinks;

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
      return;
    }

    restoreFocusTo?.focus();
  }, [isOpen, restoreFocusTo]);

  return (
    <>
      <button
        aria-label="Close mobile navigation"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-[rgba(4,7,16,0.76)] backdrop-blur-[2px] transition-opacity lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!isOpen}
      />

      <aside
        id="mobile-dashboard-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard navigation"
        aria-hidden={!isOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[360px] border-r border-line bg-[rgba(7,12,24,0.95)] p-4 shadow-panel backdrop-blur-chrome transition-transform duration-300 lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="dashboard-chrome mb-4 rounded-[1.4rem] p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src="/sloth-lee-logo.png" alt="Sloth Lee" className="h-10 w-10 rounded-full border border-line bg-white/10 p-1" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">Sloth Lee</p>
                <h2 className="font-display text-lg font-semibold text-text-0">Command dojo</h2>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white/5 text-text-1"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm leading-6 text-text-2">Move between moderation, tickets, analytics, and settings while keeping the same Sloth Lee visual flow.</p>
        </div>

        <nav className="space-y-2">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onClose}
                className={({ isActive }) => cn(
                  "group flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition",
                  isActive
                    ? "border-cyan/25 bg-[linear-gradient(135deg,rgba(135,243,201,0.14),rgba(97,213,170,0.12))] text-cyan"
                    : "border-transparent text-text-1 hover:border-line hover:bg-white/5 hover:text-text-0",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
