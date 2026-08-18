import { useEffect, useState, type MouseEvent } from "react";
import { Loader2, AlertCircle, Compass } from "lucide-react";
import { getGenres, searchNovels, type Novel, type Genre } from "../lib/api";
import { useRouter } from "../lib/router";
import NovelCard from "../components/NovelCard";
import NotFound from "../components/NotFound";
import { useSeo } from "../lib/seo";

const PAGE_SIZE = 12;

export default function GenrePage({ slug }: { slug: string }) {
  const { navigate } = useRouter();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genre, setGenre] = useState<Genre | null>(null);
  const [genresLoading, setGenresLoading] = useState(true);
  const [results, setResults] = useState<Novel[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"popular" | "latest">("popular");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getGenres();
        if (!active) return;
        setGenres(data);
        const match = data.find((g) => g.slug === slug) ?? null;
        setGenre(match);
      } catch {
        if (active) setGenre(null);
      } finally {
        if (active) setGenresLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    setPage(1);
  }, [slug]);

  const valid = !!genre;

  useSeo({
    title: valid ? `${genre!.name} Novels - Read Online | AddNovel` : "Genre — AddNovel",
    description: valid ? `Browse ${genre!.name} novels and discover stories to read online on AddNovel.` : undefined,
    path: valid ? `/genre/${genre!.slug}` : `/genre/${slug}`,
    robots: valid ? "index" : "noindex",
  });

  useEffect(() => {
    if (!valid) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const { novels, total: t } = await searchNovels({
          genre: genre!.slug,
          sort,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        });
        if (!active) return;
        setResults(novels);
        setTotal(t);
        setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Something went wrong while loading novels. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [valid, genre, sort, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (genresLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (!valid) {
    return (
      <NotFound
        icon={Compass}
        title="Genre Not Found"
        message="The genre you're looking for doesn't exist or may have been removed."
        backLabel="Browse Novels"
        backRoute={{ name: "search" }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">{genre!.name} Novels</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Browse {genre!.name} novels and discover stories to read online on AddNovel.
        </p>
      </div>

      <div className="mb-6 flex items-center justify-end gap-2">
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value as "popular" | "latest"); setPage(1); }}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="popular">Most Popular</option>
          <option value="latest">Latest</option>
        </select>
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
          No novels found in this genre yet.
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {total} {total === 1 ? "novel" : "novels"} found
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {results.map((n) => <NovelCard key={n.id} novel={n} />)}
          </div>
        </>
      )}

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

      {genres.length > 1 && (
        <section className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-700">
          <h2 className="mb-4 font-serif text-xl font-bold text-slate-900 dark:text-white">Other Genres</h2>
          <div className="flex flex-wrap gap-2">
            {genres.filter((g) => g.slug !== genre!.slug).map((g) => (
              <a
                key={g.id}
                href={`/genre/${g.slug}`}
                onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  navigate({ name: "genre", slug: g.slug });
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-amber-600 dark:hover:bg-slate-700 dark:hover:text-amber-400"
              >
                {g.name}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
