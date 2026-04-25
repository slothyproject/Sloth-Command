import { useEffect, useRef, useState } from "react";

import { Activity, Bell, Shield, Ticket, UserMinus, UserPlus } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatRelativeDate } from "@/lib/format";
import { createEventStream } from "@/lib/sse";

interface LiveEvent {
  id: string;
  event_type: string;
  title: string;
  body?: string;
  severity: "info" | "warning";
  ts: string;
}

const MAX_EVENTS = 50;

function EventIcon({ event_type }: { event_type: string }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (event_type) {
    case "guild_join":
      return <UserPlus className={cls} />;
    case "guild_leave":
      return <UserMinus className={cls} />;
    case "mod_action":
      return <Shield className={cls} />;
    case "ticket_open":
    case "ticket_close":
      return <Ticket className={cls} />;
    default:
      return <Activity className={cls} />;
  }
}

export function LiveFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const pausedRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep ref in sync so the SSE closure always sees the latest paused state.
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const stream = createEventStream(
      (payload) => {
        const ev = payload as {
          type?: string;
          event_type?: string;
          title?: string;
          body?: string;
          severity?: string;
          ts?: string;
        };

        if (ev.type === "ping") {
          setConnected(true);
          return;
        }

        if (ev.type === "bot_state") {
          setConnected(true);
          return;
        }

        if (ev.type === "live_event" && ev.event_type) {
          setConnected(true);
          if (!pausedRef.current) {
            const liveEvent: LiveEvent = {
              id: `${Date.now()}-${Math.random()}`,
              event_type: ev.event_type,
              title: ev.title ?? ev.event_type.replace(/_/g, " "),
              body: ev.body,
              severity: (ev.severity as "info" | "warning") ?? "info",
              ts: ev.ts ?? new Date().toISOString(),
            };
            setEvents((prev) => [liveEvent, ...prev].slice(0, MAX_EVENTS));
          }
        }
      },
      () => setConnected(false),
    );

    return () => stream.close();
  }, []);

  return (
    <div className="dashboard-chrome rounded-[1.6rem] p-5 flex flex-col h-full min-h-[300px]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-cyan">
          <Bell className="h-4 w-4" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Live feed</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected ? "bg-sloth-green" : "bg-red-400/60",
            )}
            title={connected ? "Connected" : "Reconnecting…"}
          />
          <button
            onClick={() => setPaused((p) => !p)}
            className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-2 hover:text-cyan transition-colors"
          >
            {paused ? "resume" : "pause"}
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
        {events.length === 0 ? (
          <div className="flex h-20 flex-col items-center justify-center gap-1 text-text-3 text-xs">
            <span className="animate-pulse">Awaiting live events…</span>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className={cn(
                "rounded-xl border bg-white/5 px-3 py-2",
                event.severity === "warning" ? "border-amber-400/20" : "border-line",
              )}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5",
                    event.severity === "warning" ? "text-amber-400" : "text-cyan",
                  )}
                >
                  <EventIcon event_type={event.event_type} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-medium text-text-0">{event.title}</p>
                    <span className="shrink-0 font-mono text-[10px] text-text-3">
                      {formatRelativeDate(event.ts)}
                    </span>
                  </div>
                  {event.body && (
                    <p className="mt-0.5 text-[11px] leading-4 text-text-2">{event.body}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
