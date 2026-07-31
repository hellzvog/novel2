import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Settings, X } from "lucide-react";
import { getChapter, incrementViews, type Novel, type Chapter } from "../lib/api";
import { useRouter } from "../lib/router";
import { useJsonLd, buildChapterJsonLd, buildBreadcrumbJsonLd } from "../lib/jsonld";
import { useSeo } from "../lib/seo";
import AdBanner from "../components/AdBanner";
import {
  getReaderSettings,
  saveReaderSettings,
  saveReadingProgress,
  saveReadingHistory,
} from "../lib/reader-storage";

const WIDTH_CLASSES: Record<string, string> = {
  narrow: "max-w-2xl",
  normal: "max-w-3xl",
  wide: "max-w-4xl",
};

const FONT_FAMILY: Record<string, string> = {
  serif: "font-serif",
  sans: "font-sans",
  mono: "font-mono",
};

export default function ChapterReaderPage({ slug, chapter }: { slug: string; chapter: number }) {
  const { navigate } = useRouter();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState(getReaderSettings());
  const [showSettings, setShowSettings] = useState(false);
  const progressTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getChapter(slug, chapter);
        if (!active) return;
        if (!result) {
          setError("Chapter not found");
          setNovel(null);
          setCurrentChapter(null);
        } else {
          setNovel(result.novel);
          setCurrentChapter(result.chapter);
          saveReadingHistory(result.novel, result.chapter);
          incrementViews(slug);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load chapter");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug, chapter]);

  useSeo({
    title: novel && currentChapter ? `${currentChapter.title} — ${novel.title} — LumenNovel` : "Reading — LumenNovel",
    description: novel && currentChapter ? `Read ${currentChapter.title} from ${novel.title} by ${novel.author} on LumenNovel.` : undefined,
    path: `/read/${slug}/${chapter}`,
    type: "article",
    publishedTime: currentChapter?.publishedAt,
  });
  useJsonLd("ld-chapter", novel && currentChapter ? buildChapterJsonLd(
    { title: novel.title, author: novel.author, slug: novel.slug },
    { number: currentChapter.number, title: currentChapter.title, publishedAt: currentChapter.publishedAt },
  ) : null);
  useJsonLd("ld-breadcrumb-reader", novel ? buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: novel.title, path: `/novel/${novel.slug}` },
    { name: currentChapter?.title ?? `Chapter ${chapter}`, path: `/read/${novel.slug}/${chapter}` },
  ]) : null);

  // Save scroll progress periodically.
  useEffect(() => {
    if (!novel || !currentChapter) return;
    progressTimer.current = window.setInterval(() => {
      saveReadingProgress(novel.id, currentChapter.number, window.scrollY);
    }, 3000);
    return () => {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
    };
  }, [novel, currentChapter]);

  // Restore scroll position.
  useEffect(() => {
    if (!novel || !currentChapter || loading) return;
    const saved = localStorage.getItem(`lumen-progress-${novel.id}-${currentChapter.number}`);
    if (saved) {
      const y = Number(saved);
      if (y > 0) window.scrollTo(0, y);
    } else {
      window.scrollTo(0, 0);
    }
  }, [novel, currentChapter, loading]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (error || !novel || !currentChapter) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <AlertCircle className="mx-auto mb-4 text-rose-500" size={32} />
        <p className="text-slate-600 dark:text-slate-300">{error ?? "Chapter not found"}</p>
        <button onClick={() => navigate({ name: "novel", slug })} className="mt-4 text-amber-600 hover:underline">
          Back to novel
        </button>
      </div>
    );
  }

  const chapterIndex = novel.chapters.findIndex((c) => c.number === currentChapter.number);
  const prevChapter = chapterIndex > 0 ? novel.chapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex < novel.chapters.length - 1 ? novel.chapters[chapterIndex + 1] : null;

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveReaderSettings(next);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav className="mb-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <button onClick={() => navigate({ name: "home" })} className="hover:text-amber-600 dark:hover:text-amber-400">Home</button>
        <span>/</span>
        <button onClick={() => navigate({ name: "novel", slug })} className="hover:text-amber-600 dark:hover:text-amber-400">{novel.title}</button>
        <span>/</span>
        <span className="text-slate-700 dark:text-slate-300">Chapter {currentChapter.number}</span>
      </nav>

      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-center">
          <button
            onClick={() => navigate({ name: "novel", slug })}
            className="text-sm text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
          >
            {novel.title}
          </button>
          <h1 className="mt-1 font-serif text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            {currentChapter.title}
          </h1>
          <p className="mt-1 text-sm text-slate-400">Chapter {currentChapter.number}</p>
        </div>

        {/* Reader settings toolbar */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {showSettings ? <X size={14} /> : <Settings size={14} />}
            {showSettings ? "Close" : "Reader Settings"}
          </button>
        </div>

        {showSettings && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Font Size: {settings.fontSize}px</label>
                <input
                  type="range" min={14} max={28} step={1} value={settings.fontSize}
                  onChange={(e) => updateSetting("fontSize", Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Line Height: {settings.lineHeight.toFixed(1)}</label>
                <input
                  type="range" min={1.4} max={2.2} step={0.1} value={settings.lineHeight}
                  onChange={(e) => updateSetting("lineHeight", Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Font Family</label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => updateSetting("fontFamily", e.target.value as typeof settings.fontFamily)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="serif">Serif</option>
                  <option value="sans">Sans Serif</option>
                  <option value="mono">Monospace</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Width</label>
                <select
                  value={settings.width}
                  onChange={(e) => updateSetting("width", e.target.value as typeof settings.width)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="narrow">Narrow</option>
                  <option value="normal">Normal</option>
                  <option value="wide">Wide</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Chapter content */}
        <div
          className={`${WIDTH_CLASSES[settings.width]} ${FONT_FAMILY[settings.fontFamily]} mx-auto`}
          style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
        >
          <div className="space-y-4 text-slate-700 dark:text-slate-200">
            {currentChapter.content.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>

        <AdBanner placement="reader" format="in-article" className="my-8" />

        {/* Chapter nav */}
        <div className="mt-10 flex items-center justify-between gap-4 border-t border-slate-200 pt-6 dark:border-slate-700">
          {prevChapter ? (
            <button
              onClick={() => navigate({ name: "reader", slug, chapter: prevChapter.number })}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={16} /> Previous
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={() => navigate({ name: "novel", slug })}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            All Chapters
          </button>
          {nextChapter ? (
            <button
              onClick={() => navigate({ name: "reader", slug, chapter: nextChapter.number })}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400"
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  );
}
