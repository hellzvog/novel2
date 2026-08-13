import { useEffect, useState, useRef, useCallback } from "react";
import { ArrowRight, Clock, Flame, TrendingUp, Loader2, AlertCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { listNovels, listFeaturedNovels, listPopularNovels, getGenres, type Novel, formatViews, latestUpdateLabel } from "../lib/api";
import { useRouter } from "../lib/router";
import NovelCard from "../components/NovelCard";
import Section from "../components/Section";
import Cover from "../components/Cover";
import { getReadingHistory, pruneReadingHistory, type ReadingHistoryEntry } from "../lib/reader-storage";
import { useSeo } from "../lib/seo";
import { useJsonLd, buildWebsiteJsonLd } from "../lib/jsonld";
import AdBanner from "../components/AdBanner";
import { stripHtml } from "../lib/html-sanitize";

export default function HomePage() {
  const { navigate } = useRouter();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [featuredNovels, setFeaturedNovels] = useState<Novel[]>([]);
  const [popularNovels, setPopularNovels] = useState<Novel[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSeo({
    title: "AddNovel - Read Free English Web Novels Online",
    description: "Read thousands of English translated web novels for free on AddNovel.",
    path: "/",
  });
  useJsonLd("ld-website", buildWebsiteJsonLd());
  const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [n, f, p, g] = await Promise.all([listNovels(), listFeaturedNovels(6), listPopularNovels(12), getGenres()]);
        if (!active) return;
        setNovels(n);
        setFeaturedNovels(f);
        setPopularNovels(p);
        setGenres(g.map((x) => x.name));
        const validIds = new Set(n.map((nv) => nv.id));
        const stored = pruneReadingHistory(validIds);
        const byId = new Map(n.map((nv) => [nv.id, nv]));
        setHistory(
          stored.map((h) => {
            const match = byId.get(h.novelId);
            return match
              ? { ...h, novelCoverUrl: match.coverUrl, novelTitle: match.title, novelSlug: match.slug }
              : h;
          }),
        );
        setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Something went wrong while loading novels. Please try again.");
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

  const latest = [...novels]
    .filter((n) => n.chapters.length > 0)
    .sort((a, b) => {
      const al = effectivePubAt(a.chapters[a.chapters.length - 1]);
      const bl = effectivePubAt(b.chapters[b.chapters.length - 1]);
      return bl.localeCompare(al);
    })
    .slice(0, 12);
  const completed = novels.filter((n) => n.status === "Completed").slice(0, 6);
  const ongoing = novels.filter((n) => n.status === "Ongoing").slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Hero — only render if there are featured novels */}
      {featuredNovels.length > 0 && (
        <HeroSlider novels={featuredNovels} onNavigate={(slug) => navigate({ name: "novel", slug })} />
      )}

      {/* Continue Reading */}
      {history.length > 0 && (
        <Section title="Continue Reading">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {history.slice(0, 6).map((h) => (
              <button
                key={h.novelId}
                onClick={() => navigate({ name: "reader", slug: h.novelSlug, chapter: h.chapterNumber })}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-amber-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-amber-700"
              >
                <Cover title={h.novelTitle} hue={h.novelCoverHue} coverUrl={h.novelCoverUrl} className="h-16 w-12 shrink-0" />
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
          {featuredNovels.map((n) => <NovelCard key={n.id} novel={n} />)}
        </div>
      </Section>

      <AdBanner placement="home" className="my-8" />

      {/* Latest updates */}
      <Section title="Latest Updates" onMore={() => navigate({ name: "search" })}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {latest.map((n) => {
            const last = n.chapters[n.chapters.length - 1];
            return (
              <button
                key={n.id}
                onClick={() => navigate({ name: "novel", slug: n.slug })}
                className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-amber-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-amber-700"
              >
                <Cover title={n.title} hue={n.coverHue} coverUrl={n.coverUrl} className="h-16 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-amber-600 dark:text-slate-100 dark:group-hover:text-amber-400">{n.title}</h3>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{n.author}</p>
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{latestUpdateLabel(n)} · {timeAgoDate(effectivePubAt(last))}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{n.status}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Popular — from manually curated popular novels, fallback to views-based if empty */}
      <Section title="Popular Novels" onMore={() => navigate({ name: "search" })}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {(popularNovels.length > 0 ? popularNovels : [...novels].sort((a, b) => b.views - a.views).slice(0, 12)).map((n) => <NovelCard key={n.id} novel={n} />)}
        </div>
      </Section>

      <AdBanner placement="home" className="my-8" />

      {/* Completed + Ongoing */}
      <div className="grid gap-12 lg:grid-cols-2">
        <Section title="Completed Novels" onMore={() => navigate({ name: "search", status: "Completed" })}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {completed.map((n) => <NovelCard key={n.id} novel={n} />)}
          </div>
        </Section>
        <Section title="Ongoing Novels" onMore={() => navigate({ name: "search", status: "Ongoing" })}>
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
              onClick={() => navigate({ name: "search", genre: g })}
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

function HeroSlider({ novels, onNavigate }: { novels: Novel[]; onNavigate: (slug: string) => void }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % novels.length);
  }, [novels.length]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + novels.length) % novels.length);
  }, [novels.length]);

  const goTo = (index: number) => setCurrent(index);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) prev();
      else next();
    }
    touchStartX.current = null;
  };

  const hero = novels[current];

  return (
    <div
      className="relative mb-12 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="grid md:grid-cols-2">
        <div className="relative flex min-w-0 flex-col justify-center gap-3 px-14 py-6 md:px-20 md:py-10"
          style={{ background: "linear-gradient(135deg, #1e3a8a, #0ea5e9)", height: "400px" }}>
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.3) 0%, transparent 50%)",
          }} />
          <span className="relative w-fit rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-900">
            Featured
          </span>
          <h1 className="relative line-clamp-2 overflow-hidden pb-1 font-serif text-3xl font-black leading-[1.25] text-white md:text-4xl">
            {hero.title}
          </h1>
          <p className="relative text-sm text-white/80">by {hero.author}</p>
          <p className="relative line-clamp-3 overflow-hidden text-sm text-white/90">{stripHtml(hero.synopsis)}</p>
          <div className="relative flex flex-wrap gap-2">
            {hero.genres.slice(0, 3).map((g) => (
              <span key={g} className="block max-w-[130px] truncate rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm md:max-w-[160px]">{g}</span>
            ))}
            {hero.genres.slice(3, 4).map((g) => (
              <span key={g} className="hidden max-w-[160px] truncate rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm md:block">{g}</span>
            ))}
          </div>
          <button
            onClick={() => onNavigate(hero.slug)}
            className="relative mt-2 flex w-fit items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 transition-all hover:bg-amber-300 hover:shadow-lg"
          >
            Start Reading <ArrowRight size={16} />
          </button>
        </div>
        <div className="hidden items-center justify-center bg-slate-100 p-10 md:flex dark:bg-slate-800">
          <Cover title={hero.title} hue={hero.coverHue} coverUrl={hero.coverUrl} className="h-[300px] w-[240px] shadow-2xl" />
        </div>
      </div>

      {/* Navigation arrows — only show if more than 1 featured novel */}
      {novels.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
            aria-label="Previous"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
            aria-label="Next"
          >
            <ChevronRight size={20} />
          </button>

          {/* Indicator dots */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            {novels.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current ? "w-6 bg-amber-400" : "w-2 bg-white/50 hover:bg-white/70"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
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

function effectivePubAt(ch: { publishAt: string | null; publishedAt: string }): string {
  return ch.publishAt ?? ch.publishedAt;
}

function timeAgoDate(dateStr: string): string {
  if (!dateStr) return "—";
  const ts = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00").getTime();
  if (isNaN(ts)) return dateStr;
  return timeAgo(ts);
}
