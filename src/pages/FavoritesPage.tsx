import { useEffect, useState } from "react";
import { Heart, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "../lib/router";
import NovelCard from "../components/NovelCard";
import Section from "../components/Section";
import { getFavorites, removeFavorite } from "../lib/reader-storage";
import { listNovels, type Novel } from "../lib/api";
import { useSeo } from "../lib/seo";

export default function FavoritesPage() {
  const { navigate } = useRouter();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSeo({
    title: "Favorites - AddNovel",
    description: "Your favorite novels on AddNovel.",
    path: "/favorites",
    robots: "noindex",
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const favIds = new Set(getFavorites().map((f) => f.novelId));
        if (favIds.size === 0) {
          if (active) { setNovels([]); setError(null); }
          return;
        }
        const all = await listNovels();
        if (!active) return;
        const favOrder = getFavorites();
        const byId = new Map(all.map((n) => [n.id, n]));
        const result: Novel[] = [];
        for (const f of favOrder) {
          const match = byId.get(f.novelId);
          if (match) result.push(match);
        }
        setNovels(result);
        setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load favorites.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleRemove = (novelId: string) => {
    removeFavorite(novelId);
    setNovels((prev) => prev.filter((n) => n.id !== novelId));
  };

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
        <p className="text-slate-600 dark:text-slate-300">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-amber-600 hover:underline">Retry</button>
      </div>
    );
  }

  if (novels.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <Heart className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={48} />
        <h2 className="mb-2 font-serif text-xl font-bold text-slate-900 dark:text-white">No Favorites Yet</h2>
        <p className="text-slate-500 dark:text-slate-400">
          Tap the heart icon on any novel to add it to your favorites.
        </p>
        <button
          onClick={() => navigate({ name: "home" })}
          className="mt-4 text-amber-600 hover:underline"
        >
          Browse novels
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <Heart size={24} className="text-rose-500" />
        <h1 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">My Favorites</h1>
        <span className="text-sm text-slate-400">({novels.length})</span>
      </div>

      <Section title="Favorited Novels">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {novels.map((n) => (
            <div key={n.id} className="group relative">
              <NovelCard novel={n} />
              <button
                onClick={() => handleRemove(n.id)}
                aria-label="Remove from favorites"
                className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-rose-500 opacity-0 shadow-md transition-opacity hover:bg-rose-50 group-hover:opacity-100 dark:bg-slate-900/90"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Section>

      <div className="flex justify-center">
        <button
          onClick={() => navigate({ name: "home" })}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Browse more novels <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
