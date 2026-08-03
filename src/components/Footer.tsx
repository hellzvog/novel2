import { useEffect, useState } from "react";
import { BookOpen, Github, Twitter } from "lucide-react";
import { useRouter } from "../lib/router";
import { getGenres, type Genre } from "../lib/api";

export default function Footer() {
  const { navigate } = useRouter();
  const [genres, setGenres] = useState<Genre[]>([]);

  useEffect(() => {
    getGenres()
      .then(setGenres)
      .catch(() => {});
  }, []);

  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                <BookOpen size={18} />
              </span>
              <span className="font-serif text-lg font-bold text-slate-900 dark:text-white">
                Add<span className="text-amber-500">Novel</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              A clean, modern home for serialized fiction. Read anywhere, anytime.
            </p>
            <div className="mt-4 flex gap-3">
              <a href="#/" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"><Twitter size={18} /></a>
              <a href="#/" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-200 hover:text-slate-200"><Github size={18} /></a>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Explore</h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><button onClick={() => navigate({ name: "home" })} className="hover:text-amber-600 dark:hover:text-amber-400">Home</button></li>
              <li><button onClick={() => navigate({ name: "search" })} className="hover:text-amber-600 dark:hover:text-amber-400">Browse</button></li>
              <li><button onClick={() => navigate({ name: "search", status: "Completed" })} className="hover:text-amber-600 dark:hover:text-amber-400">Completed</button></li>
              <li><button onClick={() => navigate({ name: "search", status: "Ongoing" })} className="hover:text-amber-600 dark:hover:text-amber-400">Ongoing</button></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Genres</h4>
            {genres.length === 0 ? (
              <p className="text-sm text-slate-400">No genres available.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 text-sm text-slate-500 dark:text-slate-400">
                {genres.map((g) => (
                  <li key={g.id}>
                    <button onClick={() => navigate({ name: "search", genre: g.name })} className="hover:text-amber-600 dark:hover:text-amber-400">{g.name}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Company</h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><button onClick={() => navigate({ name: "about" })} className="hover:text-amber-600 dark:hover:text-amber-400">About Us</button></li>
              <li><button onClick={() => navigate({ name: "contact" })} className="hover:text-amber-600 dark:hover:text-amber-400">Contact</button></li>
              <li><button onClick={() => navigate({ name: "privacy" })} className="hover:text-amber-600 dark:hover:text-amber-400">Privacy Policy</button></li>
              <li><button onClick={() => navigate({ name: "terms" })} className="hover:text-amber-600 dark:hover:text-amber-400">Terms of Service</button></li>
              <li><button onClick={() => navigate({ name: "dmca" })} className="hover:text-amber-600 dark:hover:text-amber-400">DMCA / Copyright</button></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-400 dark:border-slate-800">
          <p>© {new Date().getFullYear()} AddNovel. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
