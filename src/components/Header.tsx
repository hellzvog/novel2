import { useEffect, useState } from "react";
import { BookOpen, Heart, Menu, Moon, Search, Sun, X } from "lucide-react";
import { useRouter } from "../lib/router";
import { useTheme } from "../lib/theme";
import { getGenres } from "../lib/api";

export default function Header() {
  const { navigate, route } = useRouter();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [genres, setGenres] = useState<string[]>([]);

  useEffect(() => {
    getGenres().then((g) => setGenres(g.map((x) => x.name))).catch(() => {});
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ name: "search", query: query.trim() || undefined });
    setMobileOpen(false);
  };

  const navItems = [
    { label: "Home", action: () => navigate({ name: "home" }) },
    { label: "Browse", action: () => navigate({ name: "search" }) },
    { label: "Favorites", action: () => navigate({ name: "favorites" }), icon: <Heart size={14} /> },
    { label: "Latest", action: () => navigate({ name: "home" }) },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <button
          onClick={() => navigate({ name: "home" })}
          className="flex shrink-0 items-center gap-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
            <BookOpen size={20} />
          </span>
          <span className="font-serif text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Lumen<span className="text-amber-500">Novel</span>
          </span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-amber-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-amber-400"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <div className="group relative">
            <button className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-amber-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-amber-400">
              Genres
            </button>
            <div className="invisible absolute left-0 top-full z-50 grid w-[28rem] grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-3 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-800">
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => navigate({ name: "search", query: g })}
                  className="rounded-lg px-2 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-amber-400"
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <form onSubmit={submitSearch} className="ml-auto hidden flex-1 max-w-xs lg:flex">
          <div className="relative w-full">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search novels, authors..."
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-700"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={submitSearch} className="mb-4">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search novels, authors..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </form>
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => { item.action(); setMobileOpen(false); }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1">
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => { navigate({ name: "search", query: g }); setMobileOpen(false); }}
                className="rounded-lg px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-amber-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
