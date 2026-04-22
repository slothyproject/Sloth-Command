import { useEffect, useRef, useState } from "react";
import type { PropsWithChildren } from "react";

import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: PropsWithChildren) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobileNavOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onEscape);
    };
  }, [mobileNavOpen]);

  return (
    <div className="dashboard-shell bg-void text-text-0">
      <a href="#dashboard-main-content" className="dashboard-skip-link">
        Skip to main content
      </a>
      <div className="dashboard-orb dashboard-orb-a" aria-hidden="true" />
      <div className="dashboard-orb dashboard-orb-b" aria-hidden="true" />
      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        restoreFocusTo={restoreFocusTo.current}
      />
      <div className="dashboard-grid flex min-h-screen">
        <Sidebar />
        <div className="dashboard-main relative z-1 flex min-h-screen min-w-0 flex-1 flex-col">
          <Header
            onOpenMobileNav={() => {
              restoreFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              setMobileNavOpen(true);
            }}
          />
          <main id="dashboard-main-content" className="dashboard-main-panel flex-1 px-4 py-5 sm:px-6 lg:px-8" tabIndex={-1}>
            <div className="dashboard-content mx-auto w-full max-w-[1500px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}