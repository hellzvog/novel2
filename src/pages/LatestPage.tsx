import { useEffect, useState } from "react";
import { Clock, Loader2, AlertCircle } from "lucide-react";
import { listNovels, latestUpdateLabel, type Novel } from "../lib/api";
import { useRouter } from "../lib/router";
import Cover from "../components/Cover";
import { useSeo } from "../lib/seo";

const LATEST_LIMIT = 24;

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

function timeAgoDate(dateStr: string): string {
  if (!dateStr) return "—";
  const ts = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00").getTime();
  if (isNaN(ts)) return dateStr;
  return timeAgo(ts);
}

export default function LatestPage() {
  const { navigate } = useRouter();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSeo({
    title: "Latest Novel Updates - AddNovel",
    description: "Discover the latest updated novels and newly published chapters on AddNovel.",
    path: "/latest",
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const all = await listNovels();
        if (!active) return;
        const latest = [...all]
          .filter((n) => n.chapters.length > 0)
          .sort((a, b) => {
            const al = a.chapters[a.chapters.length - 1]?.publishedAt ?? "";
            const bl = b.chapters[b.chapters.length - 1]?.publishedAt ?? "";
            return bl.localeCompare(al);
          })
          .slice(0, LATEST_LIMIT);
        setNovels(latest);
        setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Something went wrong while loading latest updates. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">Latest Novel Updates</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Discover the latest updated novels on AddNovel.
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
      ) : novels.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400 dark:border-slate-700">
          No novel updates yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {novels.map((n) => {
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
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <Clock size={11} />
                    {latestUpdateLabel(n)} · {timeAgoDate(last.publishedAt)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{n.status}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
