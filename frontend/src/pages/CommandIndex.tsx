import { useEffect, useState, useMemo } from "react";
import { Search, ArrowLeft, Filter, X } from "lucide-react";
import { CommandCard } from "../components/CommandCard";

interface CogData {
  name: string;
  emoji: string;
  command_count: number;
  commands: {
    name: string;
    args: string;
    permissions: string;
    description: string;
    example: string;
  }[];
}

export function CommandIndex() {
  const [cogs, setCogs] = useState<CogData[]>([]);
  const [search, setSearch] = useState("");
  const [activeCog, setActiveCog] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/docs/commands")
      .then((r) => r.json())
      .then((d) => {
        setCogs(d.cogs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = [...cogs];
    if (activeCog) {
      list = list.filter((c) => c.name === activeCog);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.map((c) => ({
        ...c,
        commands: c.commands.filter(
          (cmd) =>
            cmd.name.toLowerCase().includes(q) ||
            cmd.description.toLowerCase().includes(q) ||
            cmd.permissions.toLowerCase().includes(q)
        ),
      })).filter((c) => c.commands.length > 0);
    }
    return list;
  }, [cogs, activeCog, search]);

  const totalCommands = cogs.reduce((s, c) => s + c.commands.length, 0);

  return (
    <div className="flex min-h-screen bg-void text-text-0">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex flex-col gap-4 border-b border-line bg-void/90 backdrop-blur-chrome px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a
                href="/docs"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-text-2 hover:bg-white/5 hover:text-text-0 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </a>
              <div className="h-4 w-px bg-line" />
              <h1 className="font-display text-2xl font-semibold">Command Reference</h1>
            </div>
            <span className="text-sm text-text-2">
              {activeCog && cogs.find((c) => c.name === activeCog)?.emoji} {filtered.reduce((s, c) => s + c.commands.length, 0)} of {totalCommands} commands
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search commands by name, description, or permission…"
                className="w-full rounded-xl border border-line bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-text-0 placeholder:text-text-3 outline-none transition-colors focus:border-accent/40 focus:bg-white/[0.05]"
              />
            </div>

            {/* Cog filter pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCog(null)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeCog === null
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-line bg-white/[0.03] text-text-2 hover:bg-white/[0.06]"
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                All cogs
              </button>
              {cogs.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setActiveCog((prev) => (prev === c.name ? null : c.name))}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeCog === c.name
                      ? "border-accent/30 bg-accent/10 text-accent"
                      : "border-line bg-white/[0.03] text-text-2 hover:bg-white/[0.06]"
                  }`}
                >
                  <span>{c.emoji}</span>
                  {c.name.replace(/-/g, " ")}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-8">
          {loading && <p className="text-center text-text-2 py-20">Loading commands…</p>}

          {filtered.map((cog) => (
            <section key={cog.name} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold uppercase tracking-wider text-text-3">
                  {cog.emoji} {cog.name.replace(/-/g, " ")}
                </span>
                <span className="text-xs text-text-3">({cog.commands.length} command{cog.commands.length !== 1 ? "s" : ""})</span>
              </div>
              <div className="flex flex-col gap-3">
                {cog.commands.map((cmd) => (
                  <CommandCard key={`${cog.name}-${cmd.name}`} command={cmd} cogName={cog.name} />
                ))}
              </div>
            </section>
          ))}

          {!loading && filtered.length === 0 && (
            <div className="py-20 text-center">
              <X className="mx-auto h-8 w-8 text-text-3" />
              <p className="mt-2 text-lg text-text-2">No commands match your filters.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
