import { memo, type MouseEvent } from "react";
import { Eye, BookOpen } from "lucide-react";
import type { Novel } from "../lib/api";
import { formatViews, latestUpdateLabel, decodeEntities } from "../lib/api";
import { useRouter } from "../lib/router";
import Cover from "./Cover";

const statusStyles: Record<string, string> = {
  Ongoing: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Hiatus: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function NovelCardImpl({ novel }: { novel: Novel }) {
  const { navigate } = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate({ name: "novel", slug: novel.slug });
  };

  return (
    <a
      href={`/novel/${novel.slug}`}
      onClick={handleClick}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <Cover title={novel.title} hue={novel.coverHue} coverUrl={novel.coverUrl} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
        <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyles[novel.status]}`}>
          {novel.status}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 font-serif text-sm font-bold text-slate-900 group-hover:text-amber-600 dark:text-slate-100 dark:group-hover:text-amber-400">
          {decodeEntities(novel.title)}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">by {novel.author}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Eye size={12} />
            {formatViews(novel.views)}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen size={12} />
            {latestUpdateLabel(novel)}
          </span>
        </div>
      </div>
    </a>
  );
}

export const NovelCard = memo(NovelCardImpl);
export default NovelCard;
