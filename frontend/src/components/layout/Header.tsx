import { useEffect, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Command, Compass, Menu, Shield, Sparkles } from "lucide-react";

import { cn } from "../../lib/cn";
import { formatRelativeDate } from "../../lib/format";
import { getJson, postJson } from "../../lib/api";
import { useShellOverviewQuery } from "../../lib/overview";
import { createEventStream } from "../../lib/sse";
import { useAuthStore } from "../../store/authStore";

interface NotificationItem {
  id: number;
  title: string;
  body?: string | null;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  unread: number;
  notifications: NotificationItem[];
}

export function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const user = useAuthStore((state) => state.user);
  const [isOpen, setIsOpen] = useState(false);
  const [eventTick, setEventTick] = useState(0);
  const overviewQuery = useShellOverviewQuery();

  const notificationsQuery = useQuery({
    queryKey: ["header-notifications", eventTick],
    queryFn: () => getJson<NotificationsResponse>("/api/notifications?limit=12"),
    retry: false,
    refetchInterval: 45000,
  });

  const markAllRead = useMutation({
    mutationFn: () => postJson<{ ok: boolean }>("/api/notifications/read-all"),
    onSuccess: async () => {
      await notificationsQuery.refetch();
    },
  });

  const markOneRead = useMutation({
    mutationFn: (id: number) => postJson<{ ok: boolean }>(`/api/notifications/${id}/read`),
    onSuccess: async () => {
      await notificationsQuery.refetch();
    },
  });

  useEffect(() => {
    const stream = createEventStream((payload) => {
      const event = payload as { type?: string };
      if (event.type && event.type !== "ping") {
        setEventTick((value) => value + 1);
      }
    });

    return () => stream.close();
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-[rgba(6,10,22,0.72)] backdrop-blur-chrome">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenMobileNav}
              className="grid h-8 w-8 place-items-center rounded-full border border-line bg-white/5 text-text-1 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="dashboard-chip rounded-full px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em]">dissident.mastertibbles.co.uk/app</span>
            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-amber-200">
              {overviewQuery.data?.stats.online ? `Bot online ${overviewQuery.data.stats.latency_ms} ms` : "Bot link syncing"}
            </span>
          </div>
          <div className="flex items-start gap-3">
            <img src="/sloth-lee-logo.png" alt="Sloth Lee" className="mt-0.5 hidden h-10 w-10 rounded-full border border-line bg-white/10 p-1 md:block" />
            <div>
              <h1 className="font-display text-xl font-semibold text-text-0 sm:text-2xl">Sloth Lee guardian dashboard</h1>
              <p className="text-sm text-text-2">Moderation, tickets, guild control, and notifications in one dojo-grade command surface.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-line bg-white/5 px-3 py-2 text-xs text-text-1 xl:flex">
            <Compass className="h-4 w-4 text-cyan" />
            <span>{overviewQuery.data?.stats.guilds ?? "--"} guilds</span>
            <span className="text-text-3">•</span>
            <span>{overviewQuery.data?.stats.members ?? "--"} members</span>
            <span className="text-text-3">•</span>
            <span>{overviewQuery.data?.stats.commands_today ?? "--"} commands today</span>
          </div>
          <div className="relative">
            <button onClick={() => setIsOpen((value) => !value)} className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-white/5 text-text-1 transition hover:border-cyan/40 hover:text-cyan">
              <Bell className="h-4 w-4" />
              {(notificationsQuery.data?.unread ?? 0) > 0 ? (
                <span className="absolute -right-1 -top-1 rounded-full border border-cyan/40 bg-cyan/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan">
                  {notificationsQuery.data?.unread}
                </span>
              ) : null}
            </button>

            {isOpen ? (
              <div className="absolute right-0 top-12 w-[340px] rounded-[1.6rem] border border-line bg-[rgba(12,18,36,0.94)] p-3 shadow-panel backdrop-blur-chrome">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Notifications</p>
                  <button onClick={() => void markAllRead.mutateAsync()} className="rounded-xl border border-line bg-white/5 px-2 py-1 text-xs text-text-1 transition hover:border-cyan/30 hover:text-cyan">Mark all read</button>
                </div>

                <div className="max-h-80 space-y-2 overflow-auto">
                  {notificationsQuery.isLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="dashboard-skeleton rounded-2xl border border-line px-3 py-4" />
                    ))
                  ) : null}

                  {(notificationsQuery.data?.notifications ?? []).map((item) => (
                    <button
                      key={item.id}
                      onClick={async () => {
                        if (!item.is_read) {
                          await markOneRead.mutateAsync(item.id);
                        }
                        if (item.link) {
                          window.location.assign(item.link);
                        }
                      }}
                      className={cn(
                        "w-full rounded-2xl border px-3 py-2 text-left transition",
                        item.is_read
                          ? "border-line bg-white/5"
                          : "border-cyan/25 bg-cyan/10 shadow-glow",
                      )}
                    >
                      <p className="text-sm font-medium text-text-0">{item.title}</p>
                      {item.body ? <p className="mt-1 text-xs leading-5 text-text-2">{item.body}</p> : null}
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-3">{formatRelativeDate(item.created_at)}</p>
                    </button>
                  ))}

                  {(notificationsQuery.data?.notifications.length ?? 0) === 0 ? (
                    <p className="rounded-2xl border border-line bg-white/5 px-3 py-4 text-center text-sm text-text-2">No notifications yet.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <a href="https://dissident.mastertibbles.co.uk/" className="hidden items-center gap-2 rounded-full border border-line bg-white/5 px-3 py-2 text-xs text-text-1 transition hover:border-cyan/30 hover:text-cyan lg:flex">
            <Sparkles className="h-4 w-4" />
            Public site
          </a>
          <div className="flex items-center gap-3 rounded-full border border-line bg-white/5 px-3 py-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-cyan/15 text-cyan">
              {user?.is_admin ? <Shield className="h-4 w-4" /> : <Command className="h-4 w-4" />}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-text-0">{user?.username ?? "Operator"}</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-2">{user?.is_admin ? "Admin access" : "Guild operator"}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}