import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Bot,
  Command,
  LayoutDashboard,
  ScrollText,
  Server,
  Settings,
  ShieldAlert,
  Sparkles,
  Ticket,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/cn";

interface PaletteItem {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  path: string;
  keywords: string[];
}

const STATIC_ITEMS: PaletteItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    subtitle: "Overview, stats and live feed",
    icon: <LayoutDashboard className="w-4 h-4" />,
    path: "/dashboard",
    keywords: ["home", "overview", "stats", "main", "feed"],
  },
  {
    id: "moderation",
    label: "Moderation",
    subtitle: "Cases, bulk actions and risk profiles",
    icon: <ShieldAlert className="w-4 h-4" />,
    path: "/moderation",
    keywords: ["mod", "ban", "mute", "kick", "cases", "appeal"],
  },
  {
    id: "tickets",
    label: "Tickets",
    subtitle: "Support ticket queue and SLA tracking",
    icon: <Ticket className="w-4 h-4" />,
    path: "/tickets",
    keywords: ["support", "help", "queue", "sla"],
  },
  {
    id: "servers",
    label: "Servers",
    subtitle: "Guild management and configuration",
    icon: <Server className="w-4 h-4" />,
    path: "/servers",
    keywords: ["guild", "server", "discord", "config"],
  },
  {
    id: "analytics",
    label: "Analytics",
    subtitle: "Charts, trends and leaderboards",
    icon: <BarChart3 className="w-4 h-4" />,
    path: "/analytics",
    keywords: ["charts", "data", "reports", "stats", "graphs"],
  },
  {
    id: "ai-advisor",
    label: "AI Advisor",
    subtitle: "AI-powered moderation insights",
    icon: <Bot className="w-4 h-4" />,
    path: "/ai-advisor",
    keywords: ["ai", "advisor", "llm", "suggestions", "ollama"],
  },
  {
    id: "notifications",
    label: "Notifications",
    subtitle: "Alerts and activity events",
    icon: <Bell className="w-4 h-4" />,
    path: "/notifications",
    keywords: ["alerts", "events", "unread"],
  },
  {
    id: "logs",
    label: "Audit Logs",
    subtitle: "Full activity and audit history",
    icon: <ScrollText className="w-4 h-4" />,
    path: "/logs",
    keywords: ["audit", "history", "activity", "log"],
  },
  {
    id: "users",
    label: "User Management",
    subtitle: "Roles, access control and permissions",
    icon: <Users className="w-4 h-4" />,
    path: "/users",
    keywords: ["user", "admin", "roles", "access", "permissions"],
  },
  {
    id: "settings",
    label: "Settings",
    subtitle: "Bot configuration and AI provider",
    icon: <Settings className="w-4 h-4" />,
    path: "/settings",
    keywords: ["config", "bot", "token", "setup", "provider"],
  },
  {
    id: "public-site",
    label: "Public Site",
    subtitle: "slothlee.xyz — the public-facing website",
    icon: <Sparkles className="w-4 h-4" />,
    path: "https://slothlee.xyz",
    keywords: ["public", "website", "site", "slothlee"],
  },
];

function fuzzyMatch(item: PaletteItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.label.toLowerCase().includes(q) ||
    item.subtitle.toLowerCase().includes(q) ||
    item.keywords.some((k) => k.includes(q))
  );
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = STATIC_ITEMS.filter((item) => fuzzyMatch(item, query));

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function go(item: PaletteItem) {
    onClose();
    if (item.path.startsWith("http")) {
      window.open(item.path, "_blank", "noopener,noreferrer");
    } else {
      navigate(item.path);
    }
  }

  useEffect(() => {
    if (!open) return;

    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) go(item);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered, activeIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[1.6rem] border border-cyan/25 bg-[rgba(12,18,36,0.97)] shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Command className="w-4 h-4 text-cyan flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages…"
            className="flex-1 bg-transparent text-sm text-text-0 outline-none placeholder:text-text-3"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="text-text-3 hover:text-text-1 transition"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
          <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-text-3 sm:block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-3">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.id}
                onClick={() => go(item)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  index === activeIndex
                    ? "bg-cyan/10 text-cyan"
                    : "text-text-1 hover:bg-white/5"
                )}
              >
                <span
                  className={cn(
                    "flex-shrink-0",
                    index === activeIndex ? "text-cyan" : "text-text-3"
                  )}
                >
                  {item.icon}
                </span>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-text-3">{item.subtitle}</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-white/5 px-4 py-2 font-mono text-[11px] text-text-3">
          <span>↑↓ navigate</span>
          <span>↵ go</span>
          <span>esc close</span>
          <span className="ml-auto opacity-60">ctrl+k</span>
        </div>
      </div>
    </div>
  );
}
