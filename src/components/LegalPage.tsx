import type { ReactNode } from "react";
import { useSeo } from "../lib/seo";
import { useJsonLd, buildBreadcrumbJsonLd } from "../lib/jsonld";

interface LegalPageProps {
  title: string;
  description: string;
  path: string;
  children: ReactNode;
}

export default function LegalPage({ title, description, path, children }: LegalPageProps) {
  useSeo({ title: `${title} - AddNovel`, description, path });
  useJsonLd("ld-breadcrumb-legal", buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: title, path },
  ]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl font-black text-slate-900 dark:text-white">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">Last updated: July 30, 2026</p>
      <div className="mt-8 space-y-6 leading-relaxed text-slate-600 dark:text-slate-300 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 dark:[&_h2]:text-white [&_a]:text-amber-600 dark:[&_a]:text-amber-400 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1">
        {children}
      </div>
    </div>
  );
}
