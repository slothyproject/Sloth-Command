import { useEffect, useRef, useState } from "react";
import { Search, X, ArrowRight } from "lucide-react";

interface SearchResult {
  slug: string;
  category: string;
  title: string;
  description: string;
}

interface WikiSearchProps {
  onNavigate: (category: string, slug: string) => void;
}

export function WikiSearch({ onNavigate }: WikiSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/docs/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 rounded-xl border border-line bg-white/5 px-3 py-2 text-sm text-text-2 hover:bg-white/10 hover:text-text-0 transition-colors"
    >
      <Search className="h-4 w-4" />
      <span>Search docs…</span>
      <kbd className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-text-3">Ctrl+K</kbd>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 pt-32" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-xl rounded-2xl border border-line bg-void shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Search className="h-5 w-5 text-text-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation…"
            className="flex-1 bg-transparent text-text-0 placeholder:text-text-3 outline-none"
          />
          {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-text-3 border-t-accent" />}
          <button onClick={() => setOpen(false)} className="text-text-3 hover:text-text-0">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 && query.trim() && !loading && (
            <div className="p-4 text-sm text-text-2">No results found.</div>
          )}
          {results.map((r) => (
            <button
              key={`${r.category}/${r.slug}`}
              onClick={() => {
                onNavigate(r.category, r.slug);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-line last:border-0"
            >
              <div className="min-w-0 flex-1 text-left">
                <div className="text-sm font-medium text-text-0 truncate">{r.title}</div>
                <div className="text-xs text-text-2 truncate">{r.description}</div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-text-3" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
