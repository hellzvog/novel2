interface Env {
  ASSETS: Fetcher;
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_ANON_KEY?: string;
}

interface NovelRow {
  id: string;
  slug: string;
  title: string;
  author: string;
  synopsis: string;
  cover_url: string | null;
}

const SITE_NAME = "AddNovel";
const SITE_DESCRIPTION =
  "Read thousands of English translated web novels for free on AddNovel.";
const DEFAULT_OG_IMAGE = "/og-default.svg";

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimDescription(text: string, max = 160): string {
  const plain = stripHtml(text);
  if (plain.length <= max) return plain;
  const slice = plain.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max)}\u2026`;
}

function resolveImage(
  coverUrl: string | null | undefined,
  origin: string,
): string {
  if (coverUrl && coverUrl.trim()) {
    if (coverUrl.startsWith("http")) return coverUrl;
    return `${origin}${coverUrl.startsWith("/") ? "" : "/"}${coverUrl}`;
  }
  return `${origin}${DEFAULT_OG_IMAGE}`;
}

async function supabaseFetch<T>(
  baseUrl: string,
  anonKey: string,
  path: string,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) throw new Error(`Supabase returned ${res.status}`);
  return res.json() as Promise<T>;
}

function buildNovelMeta(novel: NovelRow, origin: string): string {
  const title = `${novel.title} - Read Online | ${SITE_NAME}`;
  const description = trimDescription(novel.synopsis) || SITE_DESCRIPTION;
  const canonical = `${origin}/novel/${encodeURIComponent(novel.slug)}`;
  const image = resolveImage(novel.cover_url, origin);

  return [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
    `<meta property="og:type" content="book" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
    `<meta property="og:image" content="${escapeAttr(image)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
  ].join("\n    ");
}

function injectMeta(html: string, metaTags: string): string {
  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/gi, "");
  out = out.replace(
    /<meta\s+[^>]*?name\s*=\s*["']description["'][^>]*>/gi,
    "",
  );
  out = out.replace(
    /<link\s+[^>]*?rel\s*=\s*["']canonical["'][^>]*>/gi,
    "",
  );
  out = out.replace(
    /<meta\s+[^>]*?property\s*=\s*["']og:(?:type|title|description|url|image|site_name)["'][^>]*>/gi,
    "",
  );
  out = out.replace(
    /<meta\s+[^>]*?name\s*=\s*["']twitter:(?:card|title|description|image)["'][^>]*>/gi,
    "",
  );
  return out.replace(/<\/head>/i, `    ${metaTags}\n  </head>`);
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const env = context.env;
  const origin = new URL(context.request.url).origin;

  const assetResponse = await context.env.ASSETS.fetch(
    new Request(new URL("/", context.request.url)),
  );
  const html = await assetResponse.text();

  const spaResponse = () =>
    new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

  const baseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";
  if (!baseUrl || !anonKey) return spaResponse();

  const slug = context.params.slug as string | undefined;
  if (!slug) return spaResponse();

  try {
    const rows = await supabaseFetch<NovelRow[]>(
      baseUrl,
      anonKey,
      `/rest/v1/novels?select=id,slug,title,author,synopsis,cover_url&slug=eq.${encodeURIComponent(slug)}`,
    );
    const novel = rows?.[0];
    if (!novel) return spaResponse();

    const modified = injectMeta(html, buildNovelMeta(novel, origin));
    return new Response(modified, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return spaResponse();
  }
};
