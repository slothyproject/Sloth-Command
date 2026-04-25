import { Suspense, lazy, useEffect, useRef } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/app-shell";
import { useAuthStore } from "./store/authStore";
import type { CurrentUser } from "./store/authStore";
import { getJson } from "./lib/api";

// Lazy load pages
const DashboardPage = lazy(() => import("./pages/dashboard").then((m) => ({ default: m.default })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const ModerationPage = lazy(() => import("./pages/ModerationPage").then((m) => ({ default: m.ModerationPage })));
const TicketsPage = lazy(() => import("./pages/TicketsPage").then((m) => ({ default: m.TicketsPage })));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const TicketDetailPage = lazy(() => import("./pages/TicketDetailPage").then((m) => ({ default: m.TicketDetailPage })));
const AiAdvisorPage = lazy(() => import("./pages/AiAdvisorPage").then((m) => ({ default: m.AiAdvisorPage })));
const ServersPage = lazy(() => import("./pages/ServersPage").then((m) => ({ default: m.ServersPage })));
const LogsPage = lazy(() => import("./pages/LogsPage").then((m) => ({ default: m.LogsPage })));
const UsersPage = lazy(() => import("./pages/UsersPage").then((m) => ({ default: m.UsersPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const ServerDetailPage = lazy(() => import("./pages/ServerDetailPage").then((m) => ({ default: m.ServerDetailPage })));

function SessionBootstrap() {
  const { status, setAnonymous, setAuthenticated, setLoading } = useAuthStore();
  // Only bootstrap once — never re-fetch on navigation to avoid spinner flash.
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let active = true;

    async function loadSession() {
      setLoading();
      try {
        const user = await getJson<CurrentUser>("/auth/me");
        if (active) {
          setAuthenticated(user);
        }
      } catch {
        if (active) {
          setAnonymous();
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [setAnonymous, setAuthenticated, setLoading]);

  if (status === "loading") {
    return <div className="grid min-h-screen place-items-center bg-void text-text-1 font-mono text-sm">Synchronising guardian access…</div>;
  }

  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-void text-text-1 font-mono text-sm">Loading command dojo…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected routes with AppShell layout */}
        <Route element={<Protected><AppShell /></Protected>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/servers" element={<ServersPage />} />
                    <Route path="/servers/:guildId" element={<ServerDetailPage />} />
          <Route path="/moderation" element={<ModerationPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/ai-advisor" element={<AiAdvisorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/users" element={<UsersPage />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

function Protected({ children }: { children: JSX.Element }) {
  const status = useAuthStore((state) => state.status);

  if (status === "anonymous") {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function App() {
  return <SessionBootstrap />;
}