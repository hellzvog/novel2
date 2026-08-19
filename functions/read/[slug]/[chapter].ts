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
  cover_url: string | null;
}

interface ChapterRow {
  id: string;
  number: number;
  title: string;
  published_at: string;
}

const SITE_NAME = "AddNovel";
const DEFAULT_OG_IMAGE = "/og-default.svg";
const CANONICAL_ORIGIN = "https://addnovel.com";

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function safeJsonLd(obj: Record<string, unknown>): string {
  return JSON.stringify(obj)
    .replace(/</g, "\u003c")
    .replace(/>/g, "\u003e")
    .replace(/&/g, "\u0026");
}

function buildChapterJsonLd(
  novel: NovelRow,
  chapter: ChapterRow,
  origin: string,
): string {
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: chapter.title,
    author: { "@type": "Person", name: novel.author },
    datePublished: chapter.published_at || undefined,
    isPartOf: {
      "@type": "Book",
      name: novel.title,
      url: `${origin}/novel/${encodeURIComponent(novel.slug)}`,
    },
    url: `${origin}/read/${encodeURIComponent(novel.slug)}/${chapter.number}`,
  };
  return `<script type="application/ld+json">${safeJsonLd(obj)}</script>`;
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

function buildChapterMeta(
  novel: NovelRow,
  chapterNum: number,
  origin: string,
): string {
  const title = `${novel.title} Chapter ${chapterNum} - ${SITE_NAME}`;
  const description = `Read ${novel.title} Chapter ${chapterNum} online on ${SITE_NAME}.`;
  const canonical = `${origin}/read/${encodeURIComponent(novel.slug)}/${chapterNum}`;
  const image = resolveImage(novel.cover_url, origin);

  return [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
    `<meta property="og:type" content="article" />`,
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

function buildNoindexMeta(slug: string, chapterNum: number): string {
  const canonical = `${CANONICAL_ORIGIN}/read/${encodeURIComponent(slug)}/${chapterNum}`;
  return [
    `<title>Chapter Not Found — ${SITE_NAME}</title>`,
    `<meta name="robots" content="noindex, nofollow" />`,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
  ].join("\n    ");
}

function injectMeta(html: string, metaTags: string, jsonLd?: string): string {
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
  out = out.replace(
    /<meta\s+[^>]*?name\s*=\s*["']robots["'][^>]*>/gi,
    "",
  );
  if (jsonLd) {
    out = out.replace(
      /<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
      (m) => (/@type"\s*:\s*"Article"/.test(m) ? "" : m),
    );
  }
  const inject = jsonLd ? `${metaTags}\n    ${jsonLd}` : metaTags;
  return out.replace(/<\/head>/i, `    ${inject}\n  </head>`);
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const env = context.env;

  const assetResponse = await context.env.ASSETS.fetch(
    new Request(new URL("/", context.request.url)),
  );
  const html = await assetResponse.text();

  const buildResponse = (body: string): Response => {
    const headers = new Headers(assetResponse.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Frame-Options", "DENY");
    headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()",
    );
    headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.google-analytics.com https://*.googletagmanager.com; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com; frame-src 'self' https://googleads.g.doubleclick.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    );
    return new Response(body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  };
  const spaResponse = () => buildResponse(html);
  const notFoundResponse = (body: string) => {
    const r = buildResponse(body);
    return new Response(r.body, { status: 404, statusText: "Not Found", headers: r.headers });
  };

  const baseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";
  if (!baseUrl || !anonKey) return spaResponse();

  const slug = context.params.slug as string | undefined;
  const chapterParam = context.params.chapter as string | undefined;
  if (!slug || !chapterParam) return spaResponse();

  const chapterNum = Number(chapterParam);
  if (!Number.isInteger(chapterNum) || chapterNum < 1) return spaResponse();

  try {
    const novels = await supabaseFetch<NovelRow[]>(
      baseUrl,
      anonKey,
      `/rest/v1/novels?select=id,slug,title,author,cover_url&slug=eq.${encodeURIComponent(slug)}`,
    );
    const novel = novels?.[0];
    if (!novel) {
      const modified = injectMeta(html, buildNoindexMeta(slug, chapterNum));
      return notFoundResponse(modified);
    }

    const chapters = await supabaseFetch<ChapterRow[]>(
      baseUrl,
      anonKey,
      `/rest/v1/chapters?select=id,number,title,published_at&novel_id=eq.${encodeURIComponent(novel.id)}&number=eq.${chapterNum}&published=eq.true`,
    );
    if (!chapters || chapters.length === 0) {
      const modified = injectMeta(html, buildNoindexMeta(slug, chapterNum));
      return notFoundResponse(modified);
    }

    const metaTags = buildChapterMeta(novel, chapterNum, CANONICAL_ORIGIN);
    let jsonLd: string | undefined;
    try {
      jsonLd = buildChapterJsonLd(novel, { number: chapterNum, title: chapters[0].title, published_at: chapters[0].published_at }, CANONICAL_ORIGIN);
    } catch {
      // JSON-LD failure: return meta-only HTML
    }
    const modified = injectMeta(html, metaTags, jsonLd);
    return buildResponse(modified);
  } catch {
    return spaResponse();
  }
};
