import { useEffect, useState } from "react";
import { Search, BookOpen, Wand2, Shield, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";

interface CogSummary {
  name: string;
  emoji: string;
  command_count: number;
  commands: { name: string; description: string }[];
}

interface FeaturedGuide {
  title: string;
  href: string;
  icon: React.ElementType;
  description: string;
  accent: string;
}

const FEATURED: FeaturedGuide[] = [
  { title: "Getting Started", href: "/docs/getting-started/index", icon: BookOpen, description: "Invite the bot, configure basic settings, and test your first command in under 5 minutes.", accent: "#4ade80" },
  { title: "AI Operator", href: "/docs/dashboard/ai-operator", icon: Wand2, description: "Control your bot with natural language. Ban, mute, manage roles, and more without memorizing commands.", accent: "#c084fc" },
  { title: "Troubleshooting", href: "/docs/troubleshooting/common-issues", icon: AlertTriangle, description: "Bot offline? OAuth failing? Analytics not loading? Find fixes for the most common issues.", accent: "#fbbf24" },
];

function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-line bg-white/[0.02] px-6 py-4 hover:bg-white/[0.04] transition-colors">
      <span className="font-display text-3xl font-bold text-text-0">{value}</span>
      <span className="mt-1 text-xs font-medium uppercase tracking-wider text-text-3">{label}</span>
    </div>
  );
}

function CogCard({ cog, onClick }: { cog: CogSummary; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-2xl border border-line bg-white/[0.02] p-5 text-left transition-all hover:border-accent/30 hover:bg-white/[0.04] hover:shadow-[0_0_20px_rgba(136,192,208,0.08)]"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{cog.emoji}</span>
        <span className="font-display text-base font-semibold text-text-0 capitalize transition-colors group-hover:text-accent">
          {cog.name.replace(/-/g, " ")}
        </span>
      </div>
      <p className="line-clamp-2 text-sm text-text-2">
        {cog.commands.slice(0, 3).map((c) => `!${c.name}`).join(", ")}
        {cog.commands.length > 3 && " …"}
      </p>
      <div className="mt-auto flex items-center gap-2 text-xs text-text-3 transition-colors group-hover:text-accent">
        <Shield className="h-3.5 w-3.5" />
        {cog.command_count} command{cog.command_count !== 1 ? "s" : ""}
      </div>
    </button>
  );
}

export function WikiHomePage() {
  const [cogs, setCogs] = useState<CogSummary[]>([]);
  const [search, setSearch] = useState("");
  const navigate = (to: string) => (window.location.href = to);

  useEffect(() => {
    fetch("/api/docs/commands")
      .then((r) => r.json())
      .then((d) => setCogs(d.cogs || []))
      .catch(() => setCogs([]));
  }, []);

  const filtered = search.trim()
    ? cogs.map((c) => ({
        ...c,
        commands: c.commands.filter((cmd) =>
          `${cmd.name} ${cmd.description}`.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((c) => c.commands.length > 0 || c.name.toLowerCase().includes(search.toLowerCase()))
    : cogs;

  return (
    <div className="flex min-h-screen bg-void text-text-0">
      <div className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line px-8 pt-16 pb-12">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0d1520] via-[#0f1c2e] to-[#1a252f]"
 />
          <div className="pointer-events-none absolute -top-20 -right-20 h-96 w-96 rounded-full bg-accent/[0.03] blur-3xl" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-accent"
>Public docs</span>
              <span className="rounded-full border border-line bg-white/[0.03] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-text-3"
>2.12.0</span>
            </div>
            <h1 className="font-display text-5xl font-bold tracking-tight text-text-0 md:text-6xl">
              Dissident Docs
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-2">
              The complete user guide, manual, and command reference for the Dissident Discord bot. From first invite to advanced AI operator workflows
              — everything you need to run your community.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search commands, guides, or topics…"
                  className="w-full rounded-xl border border-line bg-white/[0.03] py-3 pl-10 pr-4 text-sm text-text-0 placeholder:text-text-3 outline-none transition-colors focus:border-accent/40 focus:bg-white/[0.05]"
                />
              </div>
              <a
                href="/docs/getting-started"
                className="inline-flex items-center gap-2 rounded-xl bg-accent/10 px-5 py-3 text-sm font-medium text-accent ring-1 ring-accent/20 transition-all hover:bg-accent/15 hover:ring-accent/30"
              >
                <Sparkles className="h-4 w-4" />
                Getting Started
              </a>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-b border-line px-8 py-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <StatBadge value={String(cogs.length)} label="Cogs" />
            <StatBadge value={String(cogs.reduce((s, c) => s + c.command_count, 0))} label="Commands" />
            <StatBadge value="12" label="Guides" />
            <StatBadge value="24/7" label="Support" />
          </div>
        </section>

        {/* Featured guides */}
        <section className="px-8 py-10">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-2xl font-semibold text-text-0">Featured Guides</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {FEATURED.map((g) => (
                <a
                  key={g.title}
                  href={g.href}
                  className="group flex flex-col gap-3 rounded-2xl border border-line bg-white/[0.02] p-5 transition-all hover:border-white/10 hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl border"
                      style={{ borderColor: `${g.accent}30`, color: g.accent, backgroundColor: `${g.accent}10` }}
                    >
                      <g.icon className="h-5 w-5" />
                    </div>
                    <span className="font-display text-lg font-semibold text-text-0">{g.title}</span>
                  </div>
                  <p className="text-sm text-text-2 leading-relaxed">{g.description}</p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-text-3 transition-colors group-hover:text-accent">
                    Read guide <ArrowRight className="h-3 w-3" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Cog bento grid */}
        <section className="border-t border-line px-8 py-10">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-text-0">Command Reference</h2>
              <a
                href="/docs/getting-started/index"
                className="text-sm text-text-3 hover:text-accent transition-colors"
              >
                View all guides →
              </a>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((cog) => (
                <CogCard
                  key={cog.name}
                  cog={cog}
                  onClick={() => navigate(`/docs/generated/${cog.name}`)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-line px-8 py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-text-3 md:flex-row">
            <div className="flex items-center gap-4">
              <a href="https://github.com/slothyproject" className="hover:text-accent transition-colors">GitHub</a>
              <span className="h-1 w-1 rounded-full bg-text-3" />
              <a href="/docs/changelog" className="hover:text-accent transition-colors">Changelog</a>
              <span className="h-1 w-1 rounded-full bg-text-3" />
              <a href="/dashboard" className="hover:text-accent transition-colors">Dashboard</a>
            </div>
            <span>© 2026 Dissident — Built by SirTibbles</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
