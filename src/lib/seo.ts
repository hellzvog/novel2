import { useEffect } from "react";
import { stripHtml } from "./html-sanitize";

export const SITE_NAME = "AddNovel";
export const SITE_TAGLINE = "Read Free English Web Novels Online";
export const SITE_DESCRIPTION =
  "Read thousands of English translated web novels for free on AddNovel.";

/**
 * Returns the configured site URL, falling back to the current origin.
 * Set VITE_SITE_URL in .env to the canonical public URL (e.g. https://addnovel.com).
 */
export function getSiteUrl(): string {
  const envUrl = import.meta.env.VITE_SITE_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:5173";
}

/**
 * Builds a clean public URL for a given path.
 * @param path - path starting with "/" (e.g. "/novel/slug")
 * @returns full URL like "https://addnovel.com/novel/slug"
 */
export function buildUrl(path: string): string {
  const base = getSiteUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Default Open Graph image (1200x630 PNG). */
export const DEFAULT_OG_IMAGE = "/og-default.svg";

type RobotsMode = "index" | "noindex";

interface SeoOptions {
  title: string;
  description?: string;
  path: string;
  image?: string;
  type?: "website" | "article" | "book";
  publishedTime?: string;
  robots?: RobotsMode;
  skip?: boolean;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function removeMeta(attr: "name" | "property", key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function removeLink(rel: string) {
  document.head.querySelector(`link[rel="${rel}"]`)?.remove();
}

/**
 * Hook that sets document title, canonical URL, robots meta, and
 * Open Graph / Twitter meta tags. Cleans up on unmount.
 */
export function useSeo(opts: SeoOptions) {
  useEffect(() => {
    if (opts.skip) return;
    const url = buildUrl(opts.path);
    const image = opts.image ? (opts.image.startsWith("http") ? opts.image : buildUrl(opts.image)) : buildUrl(DEFAULT_OG_IMAGE);
    const title = opts.title;
    const description = opts.description || SITE_DESCRIPTION;
    const robots = opts.robots === "noindex" ? "noindex, nofollow" : "index, follow";

    document.title = title;

    upsertLink("canonical", url);

    upsertMeta("name", "robots", robots);

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:image", image);
    upsertMeta("property", "og:type", opts.type || "website");
    upsertMeta("property", "og:site_name", SITE_NAME);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);

    if (opts.type === "article" && opts.publishedTime) {
      upsertMeta("property", "article:published_time", opts.publishedTime);
    }

    return () => {
      removeLink("canonical");
      removeMeta("name", "robots");
      removeMeta("property", "og:title");
      removeMeta("property", "og:description");
      removeMeta("property", "og:url");
      removeMeta("property", "og:image");
      removeMeta("property", "og:type");
      removeMeta("property", "og:site_name");
      removeMeta("name", "twitter:card");
      removeMeta("name", "twitter:title");
      removeMeta("name", "twitter:description");
      removeMeta("name", "twitter:image");
      if (opts.type === "article") {
        removeMeta("property", "article:published_time");
      }
    };
  }, [opts.title, opts.description, opts.path, opts.image, opts.type, opts.publishedTime, opts.robots]);
}

/** Trim a synopsis to ~160 chars at a word boundary. Strips HTML first. */
export function trimDescription(text: string, max = 160): string {
  const plain = stripHtml(text);
  if (plain.length <= max) return plain;
  const slice = plain.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}
