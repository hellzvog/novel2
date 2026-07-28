import { useEffect, useState } from "react";
import { Heart, Trash2, ArrowRight, BookOpen } from "lucide-react";
import { useRouter } from "../lib/router";
import Cover from "../components/Cover";
import Section from "../components/Section";
import { getFavorites, removeFavorite, type FavoriteEntry } from "../lib/reader-storage";

export default function FavoritesPage() {
  const { navigate } = useRouter();
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);

  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  const handleRemove = (novelId: string) => {
    removeFavorite(novelId);
    setFavorites(getFavorites());
  };

  if (favorites.length === 0) {
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
        <span className="text-sm text-slate-400">({favorites.length})</span>
      </div>

      <Section title="Favorited Novels">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {favorites.map((f) => (
            <div
              key={f.novelId}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
            >
              <button
                onClick={() => navigate({ name: "novel", slug: f.novelSlug })}
                className="block text-left"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden">
                  <Cover title={f.novelTitle} hue={f.novelCoverHue} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <h3 className="line-clamp-2 font-serif text-sm font-bold text-slate-900 group-hover:text-amber-600 dark:text-slate-100 dark:group-hover:text-amber-400">
                    {f.novelTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">by {f.author}</p>
                  <div className="mt-auto flex items-center justify-between pt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} />
                      {f.status}
                    </span>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleRemove(f.novelId)}
                aria-label="Remove from favorites"
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-rose-500 opacity-0 shadow-md transition-opacity hover:bg-rose-50 group-hover:opacity-100 dark:bg-slate-900/90"
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
