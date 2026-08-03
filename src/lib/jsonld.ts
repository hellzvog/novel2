import { useEffect } from "react";
import { buildUrl, SITE_NAME, SITE_DESCRIPTION } from "./seo";

type JsonLdObject = Record<string, unknown>;

function upsertScript(id: string, content: string) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = content;
}

function removeScript(id: string) {
  document.getElementById(id)?.remove();
}

/**
 * Injects a JSON-LD structured data script tag into <head>.
 * Pass `null` to remove it on unmount.
 */
export function useJsonLd(id: string, data: JsonLdObject | null) {
  useEffect(() => {
    if (data) {
      upsertScript(id, JSON.stringify(data));
    } else {
      removeScript(id);
    }
    return () => removeScript(id);
  }, [id, data]);
}

/** Build a WebSite JSON-LD object with SearchAction for the homepage. */
export function buildWebsiteJsonLd(): JsonLdObject {
  const origin = buildUrl("/");
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: origin,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/search?query={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Build a BreadcrumbList JSON-LD object from an ordered list of {name, path} items. */
export function buildBreadcrumbJsonLd(
  items: { name: string; path: string }[]
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: buildUrl(item.path),
    })),
  };
}

/** Build a Book JSON-LD object for a novel detail page. */
export function buildBookJsonLd(novel: {
  title: string;
  author: string;
  synopsis: string;
  genres: string[];
  slug: string;
  coverUrl?: string | null;
}): JsonLdObject {
  const obj: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: novel.title,
    author: {
      "@type": "Person",
      name: novel.author,
    },
    description: novel.synopsis,
    genre: novel.genres,
    url: buildUrl(`/novel/${novel.slug}`),
    inLanguage: "en",
  };
  if (novel.coverUrl) {
    obj.image = novel.coverUrl.startsWith("http")
      ? novel.coverUrl
      : buildUrl(novel.coverUrl);
  }
  return obj;
}

/** Build an Article JSON-LD object for a chapter reader page. */
export function buildChapterJsonLd(novel: {
  title: string;
  author: string;
  slug: string;
}, chapter: {
  number: number;
  title: string;
  publishedAt: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: chapter.title,
    author: {
      "@type": "Person",
      name: novel.author,
    },
    datePublished: chapter.publishedAt || undefined,
    isPartOf: {
      "@type": "Book",
      name: novel.title,
      url: buildUrl(`/novel/${novel.slug}`),
    },
    url: buildUrl(`/read/${novel.slug}/${chapter.number}`),
  };
}
