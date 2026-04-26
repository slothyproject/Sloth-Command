import { useState } from "react";
import { ChevronsRight, ChevronDown, BookOpen } from "lucide-react";

interface WikiSidebarProps {
  categories: { category: string; pages: { slug: string; title: string; order: number }[] }[];
  activePage?: string;
  onNavigate: (category: string, slug: string) => void;
}

export function WikiSidebar({ categories, activePage, onNavigate }: WikiSidebarProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (cat: string) => {
    setOpen((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <aside className="w-64 shrink-0 border-r border-line bg-void/80 px-4 py-6 overflow-y-auto">
      <div className="mb-6 flex items-center gap-2 px-2">
        <BookOpen className="h-5 w-5 text-accent" />
        <span className="font-display text-lg font-semibold text-text-0">Docs</span>
      </div>
      <nav className="space-y-1">
        {categories.map((cat) => {
          const isOpen = open[cat.category] ?? true;
          return (
            <div key={cat.category}>
              <button
                onClick={() => toggle(cat.category)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-text-1 hover:bg-white/5 transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-text-3" />
                ) : (
                  <ChevronsRight className="h-4 w-4 text-text-3" />
                )}
                {cat.category.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </button>
              {isOpen && (
                <div className="ml-5 space-y-0.5 border-l border-line pl-2">
                  {cat.pages.map((page) => {
                    const key = `${cat.category}/${page.slug}`;
                    const active = activePage === key;
                    return (
                      <button
                        key={page.slug}
                        onClick={() => onNavigate(cat.category, page.slug)}
                        className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                          active
                            ? "bg-accent/10 text-accent font-medium"
                            : "text-text-2 hover:bg-white/5 hover:text-text-1"
                        }`}
                      >
                        {page.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
