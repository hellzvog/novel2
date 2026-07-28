import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X, Loader2, AlertCircle } from "lucide-react";
import { searchNovels, getGenres, type Novel, type NovelStatus } from "../lib/api";
import { useRouter } from "../lib/router";
import NovelCard from "../components/NovelCard";

const PAGE_SIZE = 12;
const STATUSES: (NovelStatus | "All")[] = ["All", "Ongoing", "Completed", "Hiatus"];

export default function SearchPage({ initialQuery }: { initialQuery?: string }) {
  const { navigate } = useRouter();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [genres, setGenres] = useState<string[]>([]);
  const [genre, setGenre] = useState<string>("All");
  const [status, setStatus] = useState<NovelStatus | "All">("All");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"popular" | "rating" | "latest">("popular");
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<Novel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGenres().then((g) => setGenres(g.map((x) => x.name))).catch(() => {});
  }, []);

  useEffect(() => {
    setQuery(initialQuery ?? "");
    setGenre("All");
    setStatus("All");
    setPage(1);
  }, [initialQuery]);

  const isGenreQuery = useMemo(() => genres.includes(initialQuery ?? ""), [initialQuery, genres]);
  const isStatusQuery = useMemo(() => (STATUSES as string[]).includes(initialQuery ?? ""), [initialQuery]);

  const activeGenre = genre !== "All" ? genre : isGenreQuery ? (initialQuery as string) : "All";
  const activeStatus = status !== "All" ? status : isStatusQuery ? (initialQuery as NovelStatus) : "All";

  useEffect(() => { setPage(1); }, [query, activeGenre, activeStatus, sort]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const { novels, total: t } = await searchNovels({
          query: query.trim() || undefined,
          genre: activeGenre === "All" ? undefined : activeGenre,
          status: activeStatus,
          sort,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        });
        if (!active) return;
        setResults(novels);
        setTotal(t);
        setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to search");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [query, activeGenre, activeStatus, sort, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ name: "search", query: query.trim() || undefined });
  };

  const activeFilterCount = (activeGenre !== "All" ? 1 : 0) + (activeStatus !== "All" ? 1 : 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-6 font-serif text-2xl font-bold text-slate-900 dark:text-white">Browse Novels</h1>

      {/* Search + sort bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <form onSubmit={submit} className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, author, or genre..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-10 text-sm text-slate-700 outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
              <X size={16} />
            </button>
          )}
        </form>
        <div className="flex gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Top Rated</option>
            <option value="latest">Latest</option>
          </select>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 lg:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <SlidersHorizontal size={16} /> Filters {activeFilterCount > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-xs text-white">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Filters sidebar */}
        <aside className={`${showFilters ? "block" : "hidden"} lg:block`}>
          <div className="sticky top-20 space-y-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Status</h3>
              <div className="flex flex-col gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                      activeStatus === s ? "bg-amber-500 font-semibold text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Genre</h3>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setGenre("All")}
                  className={`rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                    activeGenre === "All" ? "bg-amber-500 font-semibold text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  All Genres
                </button>
                {genres.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenre(g)}
                    className={`rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                      activeGenre === g ? "bg-amber-500 font-semibold text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {loading ? "Searching..." : `${total} ${total === 1 ? "novel" : "novels"} found`}
              {activeGenre !== "All" && <> · {activeGenre}</>}
              {activeStatus !== "All" && <> · {activeStatus}</>}
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Loader2 className="animate-spin text-amber-500" size={28} />
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400 dark:border-slate-700">
              No novels match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {results.map((n) => <NovelCard key={n.id} novel={n} />)}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${
                    p === page ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
