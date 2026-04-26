import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Server, Users, Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { getJson } from "@/lib/api";
import type { GuildDetail } from "@/types";

interface Tab {
  label: string;
  path: string;
  /** Trailing segment — used for active detection */
  segment: string | null;
}

const TABS: Tab[] = [
  { label: "Overview", path: "", segment: null },
  { label: "Commands", path: "/commands", segment: "commands" },
  { label: "Automod", path: "/automod", segment: "automod" },
  { label: "Welcome", path: "/welcome", segment: "welcome" },
  { label: "Leveling", path: "/leveling", segment: "leveling" },
  { label: "Tickets", path: "/tickets-config", segment: "tickets-config" },
  { label: "Anti-Nuke", path: "/antinuke", segment: "antinuke" },
];

export function ServerLayout() {
  const { guildId } = useParams<{ guildId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [notFound, setNotFound] = useState(false);

  const { data: guild, isLoading } = useQuery<GuildDetail>({
    queryKey: ["guild-header", guildId],
    queryFn: async () => {
      try {
        return await getJson<GuildDetail>(`/api/guilds/${guildId}`);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("404")) {
          setNotFound(true);
        }
        throw err;
      }
    },
    enabled: !!guildId,
    retry: false,
    staleTime: 60_000,
  });

  // Redirect if not found
  useEffect(() => {
    if (notFound) navigate("/servers", { replace: true });
  }, [notFound, navigate]);

  /** Determine active tab from current pathname */
  function isTabActive(tab: Tab): boolean {
    const base = `/app/servers/${guildId}`;
    if (tab.segment === null) {
      // Overview = exact match or unknown sub-path
      const trailingSegments = TABS.filter((t) => t.segment !== null).map((t) => t.segment!);
      const lastSegment = location.pathname.split("/").pop();
      return !trailingSegments.includes(lastSegment ?? "");
    }
    return location.pathname.endsWith(`/${tab.segment}`);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 text-cyan animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/servers"
        className="inline-flex items-center gap-2 text-sm text-text-2 hover:text-cyan transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All servers
      </Link>

      {/* Guild header */}
      <div className="dashboard-chrome rounded-[1.6rem] p-5 flex items-center gap-4">
        {guild?.icon_url ? (
          <img
            src={guild.icon_url}
            alt={guild.name}
            className="w-14 h-14 rounded-2xl border border-cyan/20 object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center flex-shrink-0">
            <Server className="w-7 h-7 text-cyan/40" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-semibold text-text-0 truncate">
            {guild?.name ?? `Server ${guildId}`}
          </h1>
          {guild && (
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-3">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {guild.member_count.toLocaleString()} members
              </span>
              <span className={cn(
                "rounded-full px-2 py-0.5 border",
                guild.is_active
                  ? "border-lime/30 bg-lime/10 text-lime"
                  : "border-white/10 bg-white/5 text-text-3"
              )}>
                {guild.is_active ? "Active" : "Inactive"}
              </span>
              {!guild.is_active && (
                <span className="flex items-center gap-1 text-amber-300">
                  <AlertCircle className="w-3 h-3" />
                  Bot not in server
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-cyan/10">
        <nav className="-mb-px flex gap-1 overflow-x-auto scrollbar-none" aria-label="Server tabs">
          {TABS.map((tab) => {
            const active = isTabActive(tab);
            return (
              <Link
                key={tab.label}
                to={`/servers/${guildId}${tab.path}`}
                className={cn(
                  "flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  active
                    ? "border-cyan text-cyan"
                    : "border-transparent text-text-3 hover:text-text-1 hover:border-white/20"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Child page content */}
      <Outlet />
    </div>
  );
}
