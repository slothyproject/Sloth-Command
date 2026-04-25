import { Suspense, lazy, useEffect, useRef } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AppShell } from "./components/layout/app-shell";
import { useAuthStore } from "./store/authStore";
import type { CurrentUser } from "./store/authStore";
import { getJson } from "./lib/api";

// Lazy load pages
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
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
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));
const BotHealthPage = lazy(() => import("./pages/BotHealthPage").then((m) => ({ default: m.BotHealthPage })));
const ServerLayout = lazy(() => import("./components/layout/ServerLayout").then((m) => ({ default: m.ServerLayout })));
const CommandsPage = lazy(() => import("./pages/server/CommandsPage").then((m) => ({ default: m.CommandsPage })));
const AutomodPage = lazy(() => import("./pages/server/AutomodPage").then((m) => ({ default: m.AutomodPage })));
const WelcomePage = lazy(() => import("./pages/server/WelcomePage").then((m) => ({ default: m.WelcomePage })));
const LevelingPage = lazy(() => import("./pages/server/LevelingPage").then((m) => ({ default: m.LevelingPage })));
const TicketConfigPage = lazy(() => import("./pages/server/TicketConfigPage").then((m) => ({ default: m.TicketConfigPage })));
const AntinukePage = lazy(() => import("./pages/server/AntinukePage").then((m) => ({ default: m.AntinukePage })));

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
          <Route path="/servers/:guildId" element={<ServerLayout />}>
            <Route index element={<ServerDetailPage />} />
            <Route path="commands" element={<CommandsPage />} />
            <Route path="automod" element={<AutomodPage />} />
            <Route path="welcome" element={<WelcomePage />} />
            <Route path="leveling" element={<LevelingPage />} />
            <Route path="tickets-config" element={<TicketConfigPage />} />
            <Route path="antinuke" element={<AntinukePage />} />
          </Route>
          <Route path="/moderation" element={<ModerationPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/ai-advisor" element={<AiAdvisorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/bot-health" element={<BotHealthPage />} />
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
  return (
    <>
      <SessionBootstrap />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}