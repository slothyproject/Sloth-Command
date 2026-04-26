import { useState, useEffect, Suspense } from "react";
import { Loader, ArrowLeft, ChevronRight, Home } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { WikiSidebar } from "../components/WikiSidebar";
import { WikiSearch } from "../components/WikiSearch";
import { WikiRenderer } from "../components/WikiRenderer";

function BreadCrumb({ category, title }: { category: string; title: string }) {
  const navigate = useNavigate();
  return (
    <nav className="mb-6 flex items-center gap-2 text-sm text-text-3">
      <button onClick={() => navigate("/docs")} className="flex items-center gap-1 hover:text-accent transition-colors">
        <Home className="h-3.5 w-3.5" /> Docs
      </button>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className="capitalize">{category.replace(/-/g, " ")}</span>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className="font-medium text-text-1">{title}</span>
    </nav>
  );
}

function PageNav({ sitemap, currentKey }: { sitemap: SitemapCategory[]; currentKey: string }) {
  const navigate = useNavigate();
  const pages = sitemap.flatMap((c) => c.pages.map((p) => ({ ...p, category: c.category })));
  const idx = pages.findIndex((p) => `${p.category}/${p.slug}` === currentKey);
  const prev = idx > 0 ? pages[idx - 1] : null;
  const next = idx >= 0 && idx < pages.length - 1 ? pages[idx + 1] : null;
  if (!prev && !next) return null;
  return (
    <div className="mt-12 flex items-center justify-between border-t border-line pt-6">
      {prev ? (
        <button onClick={() => navigate(`/docs/${prev.category}/${prev.slug}`)} className="flex flex-col items-start gap-1 rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/[0.03]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-3">← Previous</span>
          <span className="text-sm font-medium text-text-1">{prev.title}</span>
        </button>
      ) : <div />}
      {next ? (
        <button onClick={() => navigate(`/docs/${next.category}/${next.slug}`)} className="flex flex-col items-end gap-1 rounded-xl px-4 py-3 text-right transition-colors hover:bg-white/[0.03]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-3">Next →</span>
          <span className="text-sm font-medium text-text-1">{next.title}</span>
        </button>
      ) : <div />}
    </div>
  );
}

interface PageData {
  slug: string;
  category: string;
  title: string;
  description: string;
  content: string;
}

interface SitemapCategory {
  category: string;
  pages: { slug: string; title: string; order: number }[];
}

function WikiPageInner() {
  const { category, slug } = useParams<{ category?: string; slug?: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<PageData | null>(null);
  const [sitemap, setSitemap] = useState<SitemapCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Default to first page if no route params
  const activeCategory = category || (sitemap[0]?.category ?? "");
  const activeSlug = slug || (sitemap[0]?.pages[0]?.slug ?? "");
  const activeKey = `${activeCategory}/${activeSlug}`;

  useEffect(() => {
    fetch("/api/docs/sitemap")
      .then((r) => r.json())
      .then((d) => setSitemap(d.categories || []))
      .catch(() => setSitemap([]));
  }, []);

  useEffect(() => {
    if (!activeCategory || !activeSlug) return;
    setLoading(true);
    fetch(`/api/docs/${activeCategory}/${activeSlug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Page not found");
        return r.json();
      })
      .then((d) => setPage(d))
      .catch(() => setPage(null))
      .finally(() => setLoading(false));
  }, [activeCategory, activeSlug]);

  const handleNavigate = (cat: string, sl: string) => {
    navigate(`/docs/${cat}/${sl}`);
  };

  const firstPage = sitemap[0]?.pages[0];

  if (sitemap.length > 0 && !category && firstPage) {
    navigate(`/docs/${sitemap[0].category}/${firstPage.slug}`, { replace: true });
    return null;
  }

  return (
    <div className="flex min-h-screen bg-void text-text-0">
      <WikiSidebar
        categories={sitemap}
        activePage={activeKey}
        onNavigate={handleNavigate}
      />
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-void/90 backdrop-blur-chrome px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-text-2 hover:bg-white/5 hover:text-text-0 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="h-4 w-px bg-line" />
            {page ? (
              <div>
                <h1 className="font-display text-xl font-semibold">{page.title}</h1>
                <p className="text-xs text-text-2">{page.description}</p>
              </div>
            ) : (
              <div className="h-6 w-32 animate-pulse rounded bg-white/5" />
            )}
          </div>
          <WikiSearch onNavigate={handleNavigate} />
        </header>

        {/* Content */}
        <main className="flex-1 px-8 py-8 max-w-5xl">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : page ? (
            <>
              <BreadCrumb category={page.category} title={page.title} />
              <WikiRenderer content={page.content} />
              <PageNav sitemap={sitemap} currentKey={activeKey} />
            </>
          ) : (
            <div className="py-20 text-center">
              <p className="text-lg text-text-2">Page not found.</p>
              <p className="text-sm text-text-3 mt-2">
                Check URL or navigate using the sidebar.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export function WikiPage() {
  return (
    <Suspense fallback={
      <div className="grid min-h-screen place-items-center bg-void text-accent">
        <Loader className="h-10 w-10 animate-spin" />
      </div>
    }>
      <WikiPageInner />
    </Suspense>
  );
}
