import { useEffect, useState } from "react";
import { BookOpen, Eye, Play, Star, ChevronDown, ChevronUp, Loader2, AlertCircle, Heart, History } from "lucide-react";
import { getNovel, relatedNovels, formatViews, type Novel } from "../lib/api";
import { useRouter } from "../lib/router";
import Cover from "../components/Cover";
import NovelCard from "../components/NovelCard";
import Section from "../components/Section";
import { isFavorite, toggleFavorite, getLastReadChapter } from "../lib/reader-storage";

export default function NovelDetailPage({ slug }: { slug: string }) {
  const { navigate } = useRouter();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [related, setRelated] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [fav, setFav] = useState(false);
  const [lastChapter, setLastChapter] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setShowAllChapters(false);
    (async () => {
      try {
        setLoading(true);
        const n = await getNovel(slug);
        if (!active) return;
        if (!n) {
          setError("Novel not found");
          setNovel(null);
        } else {
          setNovel(n);
          setFav(isFavorite(n.id));
          const last = getLastReadChapter(n.id);
          setLastChapter(last ? last.chapterNumber : null);
          const r = await relatedNovels(n);
          if (active) setRelated(r);
          setError(null);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load novel");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (error || !novel) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <AlertCircle className="mx-auto mb-4 text-rose-500" size={32} />
        <p className="text-slate-600 dark:text-slate-300">{error ?? "Novel not found"}</p>
        <button onClick={() => navigate({ name: "home" })} className="mt-4 text-amber-600 hover:underline">Back home</button>
      </div>
    );
  }

  const chapters = showAllChapters ? novel.chapters : novel.chapters.slice(0, 12);
  const firstChapter = novel.chapters[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav className="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <button onClick={() => navigate({ name: "home" })} className="hover:text-amber-600 dark:hover:text-amber-400">Home</button>
        <span>/</span>
        <span className="text-slate-700 dark:text-slate-300">{novel.title}</span>
      </nav>

      {/* Hero block */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800 md:p-8">
        <div className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div className="mx-auto w-48 md:mx-0 md:w-[200px]">
            <Cover title={novel.title} hue={novel.coverHue} className="aspect-[3/4] w-full shadow-xl" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                novel.status === "Ongoing" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                novel.status === "Completed" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              }`}>{novel.status}</span>
              {novel.genres.map((g) => (
                <button key={g} onClick={() => navigate({ name: "search", query: g })} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-amber-100 hover:text-amber-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">{g}</button>
              ))}
            </div>
            <h1 className="font-serif text-3xl font-black text-slate-900 dark:text-white">{novel.title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">by <span className="font-medium text-slate-700 dark:text-slate-300">{novel.author}</span></p>
            <div className="flex flex-wrap gap-5 text-sm">
              <span className="flex items-center gap-1.5">
                <Star size={16} className="fill-amber-400 text-amber-400" />
                <span className="font-bold text-slate-900 dark:text-white">{novel.rating.toFixed(1)}</span>
                <span className="text-slate-400">rating</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Eye size={16} className="text-slate-400" />
                <span className="font-bold text-slate-900 dark:text-white">{formatViews(novel.views)}</span>
                <span className="text-slate-400">views</span>
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen size={16} className="text-slate-400" />
                <span className="font-bold text-slate-900 dark:text-white">{novel.chapters.length}</span>
                <span className="text-slate-400">chapters</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              {lastChapter !== null && (
                <button
                  onClick={() => navigate({ name: "reader", slug: novel.slug, chapter: lastChapter })}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-amber-400 hover:shadow-lg"
                >
                  <History size={16} /> Continue Reading
                </button>
              )}
              <button
                onClick={() => firstChapter && navigate({ name: "reader", slug: novel.slug, chapter: firstChapter.number })}
                className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold shadow-md transition-all ${lastChapter === null ? "bg-amber-500 text-white hover:bg-amber-400 hover:shadow-lg" : "border border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"}`}
              >
                <Play size={16} fill="currentColor" /> {lastChapter !== null ? "Start Over" : "Start Reading"}
              </button>
              {novel.chapters.length > 1 && (
                <button
                  onClick={() => navigate({ name: "reader", slug: novel.slug, chapter: novel.chapters[novel.chapters.length - 1].number })}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Latest Chapter
                </button>
              )}
              <button
                onClick={() => setFav(toggleFavorite(novel))}
                aria-label={fav ? "Remove from favorites" : "Add to favorites"}
                className={`flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-bold transition-all ${fav ? "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-400" : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"}`}
              >
                <Heart size={16} className={fav ? "fill-rose-500 text-rose-500" : ""} />
                {fav ? "Favorited" : "Favorite"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Synopsis */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-slate-900 dark:text-white">
          <span className="h-5 w-1.5 rounded-full bg-amber-500" /> Synopsis
        </h2>
        <p className="leading-relaxed text-slate-600 dark:text-slate-300">{novel.synopsis}</p>
      </div>

      {/* Chapter list */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-slate-900 dark:text-white">
            <span className="h-5 w-1.5 rounded-full bg-amber-500" /> Chapter List
            <span className="text-sm font-normal text-slate-400">({novel.chapters.length})</span>
          </h2>
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          {chapters.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate({ name: "reader", slug: novel.slug, chapter: c.number })}
              className="group flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-amber-50 dark:hover:bg-slate-700"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">{c.number}</span>
                <span className="truncate text-sm text-slate-700 group-hover:text-amber-600 dark:text-slate-300 dark:group-hover:text-amber-400">{c.title}</span>
              </span>
              <span className="shrink-0 text-[10px] text-slate-400">{c.publishedAt}</span>
            </button>
          ))}
        </div>
        {novel.chapters.length > 12 && (
          <button
            onClick={() => setShowAllChapters((v) => !v)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {showAllChapters ? <>Show less <ChevronUp size={16} /></> : <>Show all {novel.chapters.length} chapters <ChevronDown size={16} /></>}
          </button>
        )}
      </div>

      {/* Related */}
      {related.length > 0 && (
        <Section title="Related Novels">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {related.map((n) => <NovelCard key={n.id} novel={n} />)}
          </div>
        </Section>
      )}
    </div>
  );
}
