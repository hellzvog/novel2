import { useEffect, useState, useRef, useCallback } from "react";
import {
  ArrowLeft, ChevronLeft, ChevronRight, List, Maximize, Minimize, Settings,
  Loader2, AlertCircle, Play, Pause, X, Type, Heart, Sun, Moon,
} from "lucide-react";
import { getChapter, type Novel, type Chapter } from "../lib/api";
import { useRouter } from "../lib/router";
import { useTheme } from "../lib/theme";
import {
  saveReadingHistory, saveReadingProgress, getReadingProgress,
  getReaderSettings, updateReaderSetting, type ReaderSettings,
  isFavorite, toggleFavorite,
} from "../lib/reader-storage";

function renderParagraph(p: string, i: number) {
  if (/<\w+[^>]*>/.test(p)) {
    return <p key={i} className="indent-8" dangerouslySetInnerHTML={{ __html: p }} />;
  }
  return <p key={i} className="indent-8">{p}</p>;
}

const FONT_FAMILY_MAP: Record<ReaderSettings["fontFamily"], string> = {
  serif: "'Georgia', 'Cambria', 'Times New Roman', serif",
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'Courier New', Courier, monospace",
};

export default function ChapterReaderPage({ slug, chapter }: { slug: string; chapter: number }) {
  const { navigate } = useRouter();
  const { theme, toggle } = useTheme();
  const [settings, setSettings] = useState<ReaderSettings>(() => getReaderSettings());
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterList, setShowChapterList] = useState(false);
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapterData, setChapterData] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(() => getReaderSettings().autoScrollSpeed);
  const [progress, setProgress] = useState(0);

  const scrollTimerRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  // Load chapter
  useEffect(() => {
    let active = true;
    restoredRef.current = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getChapter(slug, chapter);
        if (!active) return;
        if (!data) {
          setError("Chapter not found");
          setNovel(null);
          setChapterData(null);
        } else {
          setNovel(data.novel);
          setChapterData(data.chapter);
          setFav(isFavorite(data.novel.id));
          saveReadingHistory(data.novel, data.chapter);
          setError(null);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load chapter");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug, chapter]);

  // Restore scroll position after content loads
  useEffect(() => {
    if (!chapterData || !novel || restoredRef.current) return;
    restoredRef.current = true;
    const saved = getReadingProgress(novel.id, chapter);
    if (saved > 0) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved, behavior: "instant" as ScrollBehavior });
      });
    }
  }, [chapterData, novel, chapter]);

  // Save scroll position on unmount / navigation
  useEffect(() => {
    return () => {
      if (novel && chapterData) {
        saveReadingProgress(novel.id, chapter, window.scrollY);
      }
    };
  }, [novel, chapterData, chapter]);

  // Track reading progress
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setProgress(Math.min(100, Math.round((scrollTop / docHeight) * 100)));
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto scroll
  useEffect(() => {
    if (autoScroll) {
      scrollTimerRef.current = window.setInterval(() => {
        window.scrollBy({ top: Math.max(1, Math.round(scrollSpeed / 10)), behavior: "smooth" });
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (window.scrollY >= docHeight - 5) {
          setAutoScroll(false);
        }
      }, 50);
      return () => {
        if (scrollTimerRef.current) clearInterval(scrollTimerRef.current);
      };
    }
    return undefined;
  }, [autoScroll, scrollSpeed]);

  // Save settings when changed
  const updateSetting = useCallback(<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      updateReaderSetting(key, value);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (error || !novel || !chapterData) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <AlertCircle className="mx-auto mb-4 text-rose-500" size={32} />
        <p className="text-slate-600 dark:text-slate-300">{error ?? "Chapter not found"}</p>
        <button onClick={() => navigate({ name: "novel", slug })} className="mt-4 text-amber-600 hover:underline">Back to novel</button>
      </div>
    );
  }

  const prev = novel.chapters.find((c) => c.number === chapter - 1);
  const next = novel.chapters.find((c) => c.number === chapter + 1);
  const widthClass = settings.width === "narrow" ? "max-w-xl" : settings.width === "wide" ? "max-w-4xl" : "max-w-2xl";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Reader top bar */}
      <header className={`sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur transition-transform dark:border-slate-800 dark:bg-slate-900/95 ${showControls ? "translate-y-0" : "-translate-y-full"}`}>
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <button
            onClick={() => navigate({ name: "novel", slug: novel.slug })}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400"
          >
            <ArrowLeft size={18} /> <span className="hidden sm:inline">Novel</span>
          </button>
          <div className="min-w-0 flex-1 px-4 text-center">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{novel.title}</p>
            <p className="truncate text-xs text-slate-400">{chapterData.title}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFav(toggleFavorite(novel))}
              aria-label="Toggle favorite"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Heart size={18} className={fav ? "fill-rose-500 text-rose-500" : ""} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Reader settings"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Settings size={18} />
            </button>
            <button onClick={toggle} aria-label="Toggle theme" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Reading area */}
      <main className="mx-auto px-4 py-10">
        <article ref={contentRef} className={`mx-auto ${widthClass}`}>
          <h1 className="mb-2 text-center font-serif text-2xl font-bold text-slate-900 dark:text-white">{chapterData.title}</h1>
          <p className="mb-8 text-center text-xs text-slate-400">Published {chapterData.publishedAt}</p>
          <div
            className="space-y-6 text-slate-700 dark:text-slate-200"
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              fontFamily: FONT_FAMILY_MAP[settings.fontFamily],
            }}
          >
            {chapterData.content.map((p, i) => renderParagraph(p, i))}
          </div>

          {/* Chapter nav */}
          <nav className="mt-12 flex items-center justify-between gap-4 border-t border-slate-200 pt-6 dark:border-slate-700">
            {prev ? (
              <button
                onClick={() => navigate({ name: "reader", slug: novel.slug, chapter: prev.number })}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={16} /> Previous
              </button>
            ) : <span />}
            <button
              onClick={() => setShowChapterList(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <List size={16} /> Chapters
            </button>
            {next ? (
              <button
                onClick={() => navigate({ name: "reader", slug: novel.slug, chapter: next.number })}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : <span />}
          </nav>

          {/* Back to novel */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => navigate({ name: "novel", slug: novel.slug })}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
            >
              <ArrowLeft size={16} /> Back to {novel.title}
            </button>
          </div>
        </article>
      </main>

      {/* Bottom progress bar */}
      <div className={`fixed bottom-0 left-0 z-40 w-full border-t border-slate-200 bg-white/95 px-4 py-2 backdrop-blur transition-transform dark:border-slate-800 dark:bg-slate-900/95 ${showControls ? "translate-y-0" : "translate-y-full"}`}>
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button
            onClick={() => setAutoScroll((v) => !v)}
            aria-label={autoScroll ? "Pause auto scroll" : "Start auto scroll"}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${autoScroll ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
          >
            {autoScroll ? <Pause size={14} /> : <Play size={14} />}
            <span className="hidden sm:inline">{autoScroll ? "Pause" : "Auto"}</span>
          </button>
          {autoScroll && (
            <input
              type="range"
              min={10}
              max={200}
              value={scrollSpeed}
              onChange={(e) => {
                const v = Number(e.target.value);
                setScrollSpeed(v);
                updateSetting("autoScrollSpeed", v);
              }}
              className="hidden w-20 accent-amber-500 sm:block"
              aria-label="Scroll speed"
            />
          )}
          <span className="text-xs text-slate-500 dark:text-slate-400">{chapterData.number} / {novel.chapters.length}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-slate-400">{progress}%</span>
          <button
            onClick={() => setShowControls((v) => !v)}
            className="text-xs text-slate-500 hover:text-amber-600 dark:text-slate-400"
          >
            {showControls ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={() => setShowSettings(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl dark:bg-slate-800 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">Reader Settings</h2>
              <button onClick={() => setShowSettings(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Theme */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Theme</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => theme !== "light" && toggle()}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${theme === "light" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"}`}
                  >
                    <Sun size={16} /> Light
                  </button>
                  <button
                    onClick={() => theme !== "dark" && toggle()}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${theme === "dark" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"}`}
                  >
                    <Moon size={16} /> Dark
                  </button>
                </div>
              </div>

              {/* Font size */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Font Size: <span className="text-amber-600 dark:text-amber-400">{settings.fontSize}px</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateSetting("fontSize", Math.max(14, settings.fontSize - 2))}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Type size={14} />
                  </button>
                  <input
                    type="range"
                    min={14}
                    max={28}
                    step={2}
                    value={settings.fontSize}
                    onChange={(e) => updateSetting("fontSize", Number(e.target.value))}
                    className="flex-1 accent-amber-500"
                  />
                  <button
                    onClick={() => updateSetting("fontSize", Math.min(28, settings.fontSize + 2))}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Type size={20} />
                  </button>
                </div>
              </div>

              {/* Line height */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Line Height: <span className="text-amber-600 dark:text-amber-400">{settings.lineHeight.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min={1.4}
                  max={2.4}
                  step={0.1}
                  value={settings.lineHeight}
                  onChange={(e) => updateSetting("lineHeight", Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Reading width */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Reading Width</label>
                <div className="flex gap-2">
                  {(["narrow", "normal", "wide"] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => updateSetting("width", w)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium capitalize transition-colors ${settings.width === w ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"}`}
                    >
                      {w === "narrow" && <Minimize size={14} />}
                      {w === "wide" && <Maximize size={14} />}
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font family */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Font Family</label>
                <div className="flex gap-2">
                  {([
                    { key: "serif" as const, label: "Serif", style: { fontFamily: FONT_FAMILY_MAP.serif } },
                    { key: "sans" as const, label: "Sans", style: { fontFamily: FONT_FAMILY_MAP.sans } },
                    { key: "mono" as const, label: "Mono", style: { fontFamily: FONT_FAMILY_MAP.mono } },
                  ]).map((f) => (
                    <button
                      key={f.key}
                      onClick={() => updateSetting("fontFamily", f.key)}
                      style={f.style}
                      className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${settings.fontFamily === f.key ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto scroll speed */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Auto Scroll Speed: <span className="text-amber-600 dark:text-amber-400">{settings.autoScrollSpeed}</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={10}
                  value={settings.autoScrollSpeed}
                  onChange={(e) => updateSetting("autoScrollSpeed", Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chapter list drawer */}
      {showChapterList && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowChapterList(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
              <h2 className="font-serif text-base font-bold text-slate-900 dark:text-white">Chapters</h2>
              <button onClick={() => setShowChapterList(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {novel.chapters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    navigate({ name: "reader", slug: novel.slug, chapter: c.number });
                    setShowChapterList(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${c.number === chapter ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"}`}
                >
                  <span className="w-8 shrink-0 text-xs font-bold text-slate-400">{c.number}</span>
                  <span className="flex-1 truncate">{c.title}</span>
                  {c.number === chapter && <span className="text-xs text-amber-500">Reading</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
