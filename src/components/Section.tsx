import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface SectionProps {
  title: string;
  children: ReactNode;
  onMore?: () => void;
}

export default function Section({ title, children, onMore }: SectionProps) {
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-slate-900 dark:text-white">
          <span className="h-5 w-1.5 rounded-full bg-amber-500" />
          {title}
        </h2>
        {onMore && (
          <button
            onClick={onMore}
            className="flex items-center gap-1 text-sm font-medium text-amber-600 transition-colors hover:text-amber-700 dark:text-amber-400"
          >
            View more <ChevronRight size={14} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
