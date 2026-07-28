import { useEffect, useState } from "react";
import { ArrowRight, Clock, Flame, TrendingUp, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { listNovels, getGenres, type Novel, formatViews, latestUpdateLabel } from "../lib/api";
import { useRouter } from "../lib/router";
import NovelCard from "../components/NovelCard";
import Section from "../components/Section";
import Cover from "../components/Cover";
import { getReadingHistory, type ReadingHistoryEntry } from "../lib/reader-storage";

export default function HomePage() {
  const { navigate } = useRouter();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [n, g] = await Promise.all([listNovels(), getGenres()]);
        if (!active) return;
        setNovels(n);
        setGenres(g.map((x) => x.name));
        setHistory(getReadingHistory());
        setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load novels");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <AlertCircle className="mx-auto mb-4 text-rose-500" size={32} />
        <p className="text-slate-600 dark:text-slate-300">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-amber-600 hover:underline">Retry</button>
      </div>
    );
  }

  if (novels.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center text-slate-500 dark:text-slate-400">
        No novels found in the database yet.
      </div>
    );
  }

  const featured = [...novels].sort((a, b) => b.rating - a.rating).slice(0, 6);
  const latest = [...novels].sort((a, b) => {
    const al = a.chapters[a.chapters.length - 1]?.publishedAt ?? "";
    const bl = b.chapters[b.chapters.length - 1]?.publishedAt ?? "";
    return bl.localeCompare(al);
  }).slice(0, 12);
  const popular = [...novels].sort((a, b) => b.views - a.views).slice(0, 12);
  const completed = novels.filter((n) => n.status === "Completed").slice(0, 6);
  const ongoing = novels.filter((n) => n.status === "Ongoing").slice(0, 6);
  const hero = featured[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Hero */}
      <div className="relative mb-12 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="grid md:grid-cols-2">
          <div className="relative flex flex-col justify-center gap-4 p-8 md:p-12"
            style={{ background: "linear-gradient(135deg, #1e3a8a, #0ea5e9)" }}>
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.3) 0%, transparent 50%)",
            }} />
            <span className="relative w-fit rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-900">
              Featured
            </span>
            <h1 className="relative font-serif text-3xl font-black leading-tight text-white md:text-4xl">
              {hero.title}
            </h1>
            <p className="relative text-sm text-white/80">by {hero.author}</p>
            <p className="relative line-clamp-3 text-sm text-white/90">{hero.synopsis}</p>
            <div className="relative flex flex-wrap gap-2">
              {hero.genres.map((g) => (
                <span key={g} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">{g}</span>
              ))}
            </div>
            <button
              onClick={() => navigate({ name: "novel", slug: hero.slug })}
              className="relative mt-2 flex w-fit items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 transition-all hover:bg-amber-300 hover:shadow-lg"
            >
              Start Reading <ArrowRight size={16} />
            </button>
          </div>
          <div className="hidden items-center justify-center bg-slate-100 p-12 md:flex dark:bg-slate-800">
            <Cover title={hero.title} hue={hero.coverHue} className="h-80 w-60 shadow-2xl" />
          </div>
        </div>
      </div>

      {/* Continue Reading */}
      {history.length > 0 && (
        <Section title="Continue Reading">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {history.slice(0, 6).map((h) => (
              <button
                key={h.novelId}
                onClick={() => navigate({ name: "reader", slug: h.novelSlug, chapter: h.chapterNumber })}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-amber-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-amber-700"
              >
                <Cover title={h.novelTitle} hue={h.novelCoverHue} className="h-16 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-amber-600 dark:text-slate-100 dark:group-hover:text-amber-400">{h.novelTitle}</h3>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">Ch. {h.chapterNumber}: {h.chapterTitle}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock size={11} />
                    {timeAgo(h.lastReadAt)}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-amber-500" />
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Featured carousel */}
      <Section title="Featured Novels" onMore={() => navigate({ name: "search" })}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {featured.map((n) => <NovelCard key={n.id} novel={n} />)}
        </div>
      </Section>

      {/* Latest updates */}
      <Section title="Latest Updates" onMore={() => navigate({ name: "search" })}>
        <div className="grid gap-2 sm:grid-cols-2">
          {latest.map((n) => {
            const last = n.chapters[n.chapters.length - 1];
            return (
              <button
                key={n.id}
                onClick={() => navigate({ name: "novel", slug: n.slug })}
                className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-amber-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-amber-700"
              >
                <Cover title={n.title} hue={n.coverHue} className="h-16 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-amber-600 dark:text-slate-100 dark:group-hover:text-amber-400">{n.title}</h3>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{n.author}</p>
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{latestUpdateLabel(n)} · {last?.publishedAt}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{n.status}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Popular */}
      <Section title="Popular Novels" onMore={() => navigate({ name: "search" })}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {popular.map((n) => <NovelCard key={n.id} novel={n} />)}
        </div>
      </Section>

      {/* Completed + Ongoing */}
      <div className="grid gap-12 lg:grid-cols-2">
        <Section title="Completed Novels" onMore={() => navigate({ name: "search", query: "Completed" })}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {completed.map((n) => <NovelCard key={n.id} novel={n} />)}
          </div>
        </Section>
        <Section title="Ongoing Novels" onMore={() => navigate({ name: "search", query: "Ongoing" })}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {ongoing.map((n) => <NovelCard key={n.id} novel={n} />)}
          </div>
        </Section>
      </div>

      {/* Genre list */}
      <Section title="Browse by Genre">
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => navigate({ name: "search", query: g })}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-amber-600 dark:hover:bg-slate-700 dark:hover:text-amber-400"
            >
              <TrendingUp size={14} className="text-amber-500" />
              {g}
            </button>
          ))}
        </div>
      </Section>

      {/* Stats strip */}
      <div className="mb-4 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-4 dark:border-slate-700 dark:bg-slate-800">
        {[
          { icon: <Flame size={20} className="text-amber-500" />, label: "Novels", value: novels.length },
          { icon: <TrendingUp size={20} className="text-emerald-500" />, label: "Chapters", value: novels.reduce((s, n) => s + n.chapters.length, 0) },
          { icon: <Flame size={20} className="text-rose-500" />, label: "Ongoing", value: novels.filter((n) => n.status === "Ongoing").length },
          { icon: <TrendingUp size={20} className="text-blue-500" />, label: "Completed", value: novels.filter((n) => n.status === "Completed").length },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">{s.icon}</span>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
