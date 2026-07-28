import { BookOpen, Github, Twitter } from "lucide-react";
import { useRouter } from "../lib/router";

const FOOTER_GENRES = ["Fantasy", "Romance", "Sci-Fi", "Mystery", "Action", "Adventure", "Horror", "Drama"];

export default function Footer() {
  const { navigate } = useRouter();
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
                Lumen<span className="text-amber-500">Novel</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              A clean, modern home for serialized fiction. Read anywhere, anytime.
            </p>
            <div className="mt-4 flex gap-3">
              <a href="#/" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"><Twitter size={18} /></a>
              <a href="#/" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"><Github size={18} /></a>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Explore</h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><button onClick={() => navigate({ name: "home" })} className="hover:text-amber-600 dark:hover:text-amber-400">Home</button></li>
              <li><button onClick={() => navigate({ name: "search" })} className="hover:text-amber-600 dark:hover:text-amber-400">Browse</button></li>
              <li><button onClick={() => navigate({ name: "search", query: "Completed" })} className="hover:text-amber-600 dark:hover:text-amber-400">Completed</button></li>
              <li><button onClick={() => navigate({ name: "search", query: "Ongoing" })} className="hover:text-amber-600 dark:hover:text-amber-400">Ongoing</button></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Genres</h4>
            <ul className="grid grid-cols-2 gap-2 text-sm text-slate-500 dark:text-slate-400">
              {FOOTER_GENRES.map((g) => (
                <li key={g}>
                  <button onClick={() => navigate({ name: "search", query: g })} className="hover:text-amber-600 dark:hover:text-amber-400">{g}</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">About</h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><a href="#/" className="hover:text-amber-600 dark:hover:text-amber-400">About Us</a></li>
              <li><a href="#/" className="hover:text-amber-600 dark:hover:text-amber-400">Contact</a></li>
              <li><a href="#/" className="hover:text-amber-600 dark:hover:text-amber-400">Privacy</a></li>
              <li><a href="#/" className="hover:text-amber-600 dark:hover:text-amber-400">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-400 dark:border-slate-800">
          <p>© {new Date().getFullYear()} LumenNovel. A frontend prototype. All novel data is fictional mock content.</p>
        </div>
      </div>
    </footer>
  );
}
