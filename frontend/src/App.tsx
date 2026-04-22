import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { useAuthStore } from "./store/authStore";
import type { CurrentUser } from "./store/authStore";
import { getJson } from "./lib/api";

const DashboardPage = lazy(async () => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const LoginPage = lazy(async () => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const ModerationPage = lazy(async () => import("./pages/ModerationPage").then((module) => ({ default: module.ModerationPage })));
const TicketsPage = lazy(async () => import("./pages/TicketsPage").then((module) => ({ default: module.TicketsPage })));
const AnalyticsPage = lazy(async () => import("./pages/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const TicketDetailPage = lazy(async () => import("./pages/TicketDetailPage").then((module) => ({ default: module.TicketDetailPage })));
const AiAdvisorPage = lazy(async () => import("./pages/AiAdvisorPage").then((module) => ({ default: module.AiAdvisorPage })));
const ServersPage = lazy(async () => import("./pages/ServersPage").then((module) => ({ default: module.ServersPage })));
const LogsPage = lazy(async () => import("./pages/LogsPage").then((module) => ({ default: module.LogsPage })));
const UsersPage = lazy(async () => import("./pages/UsersPage").then((module) => ({ default: module.UsersPage })));
const SettingsPage = lazy(async () => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

function SessionBootstrap() {
  const location = useLocation();
  const { status, setAnonymous, setAuthenticated, setLoading } = useAuthStore();

  useEffect(() => {
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
  }, [location.pathname, setAnonymous, setAuthenticated, setLoading]);

  if (status === "loading") {
    return <div className="grid min-h-screen place-items-center bg-void text-text-1 font-mono text-sm">Synchronising guardian access…</div>;
  }

  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-void text-text-1 font-mono text-sm">Loading command dojo…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Protected><AppShell><DashboardPage /></AppShell></Protected>} />
        <Route path="/servers" element={<Protected><AppShell><ServersPage /></AppShell></Protected>} />
        <Route path="/moderation" element={<Protected><AppShell><ModerationPage /></AppShell></Protected>} />
        <Route path="/tickets" element={<Protected><AppShell><TicketsPage /></AppShell></Protected>} />
        <Route path="/tickets/:ticketId" element={<Protected><AppShell><TicketDetailPage /></AppShell></Protected>} />
        <Route path="/analytics" element={<Protected><AppShell><AnalyticsPage /></AppShell></Protected>} />
        <Route path="/ai-advisor" element={<Protected><AppShell><AiAdvisorPage /></AppShell></Protected>} />
        <Route path="/settings" element={<Protected><AppShell><SettingsPage /></AppShell></Protected>} />
        <Route path="/logs" element={<Protected><AppShell><LogsPage /></AppShell></Protected>} />
        <Route path="/users" element={<Protected><AppShell><UsersPage /></AppShell></Protected>} />
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