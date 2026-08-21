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
  status: string;
  views: number;
}

interface GenreRow {
  id: string;
  name: string;
  slug: string;
}

interface NovelGenreRow {
  genre_id: string;
}

interface ChapterSummaryRow {
  number: number;
  title: string;
  published_at: string;
  publish_at: string | null;
}

const SITE_NAME = "AddNovel";
const SITE_DESCRIPTION =
  "Read thousands of English translated web novels for free on AddNovel.";
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "\u2019",
  lsquo: "\u2018",
  ldquo: "\u201C",
  rdquo: "\u201D",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
  nbsp: "\u00A0",
  copy: "\u00A9",
  reg: "\u00AE",
  trade: "\u2122",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === "#") {
      const isHex = body[1] === "x" || body[1] === "X";
      const code = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (isNaN(code)) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

function stripHtmlToText(html: string): string {
  let s = html.replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote|br|hr|tr|table)>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]*>/g, "");
  s = decodeEntities(s);
  s = s.replace(/[ \t\f\r]+/g, " ");
  s = s.replace(/\n[ ]+/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function synopsisToParagraphs(synopsis: string): string[] {
  const text = stripHtmlToText(synopsis);
  if (!text) return [];
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

function paragraphsToHtml(paragraphs: string[]): string {
  return paragraphs
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n          ");
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

function buildNovelJsonLd(novel: NovelRow, origin: string): string {
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: novel.title,
    author: { "@type": "Person", name: novel.author },
    description: stripHtmlToText(novel.synopsis),
    url: `${origin}/novel/${encodeURIComponent(novel.slug)}`,
    inLanguage: "en",
  };
  obj.image = resolveImage(novel.cover_url, origin);
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

function trimDescription(text: string, max = 160): string {
  const plain = stripHtmlToText(text);
  if (plain.length <= max) return plain;
  const slice = plain.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max)}\u2026`;
}

function buildNoindexMeta(slug: string): string {
  const canonical = `${CANONICAL_ORIGIN}/novel/${encodeURIComponent(slug)}`;
  return [
    `<title>Novel Not Found — ${SITE_NAME}</title>`,
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
      (m) => (/@type"\s*:\s*"Book"/.test(m) ? "" : m),
    );
  }
  const inject = jsonLd ? `${metaTags}\n    ${jsonLd}` : metaTags;
  return out.replace(/<\/head>/i, `    ${inject}\n  </head>`);
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K`;
  return String(views);
}

function buildSsrMarkup(
  novel: NovelRow,
  genres: GenreRow[],
  chapters: ChapterSummaryRow[],
): string {
  const novelHref = `/novel/${encodeURIComponent(novel.slug)}`;
  const coverSrc = novel.cover_url && novel.cover_url.trim()
    ? (novel.cover_url.startsWith("http") ? novel.cover_url : `${CANONICAL_ORIGIN}${novel.cover_url.startsWith("/") ? "" : "/"}${novel.cover_url}`)
    : `${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE}`;

  const synopsisHtml = paragraphsToHtml(synopsisToParagraphs(novel.synopsis));

  const genreLinks = genres
    .map((g) => `<a href="/genre/${encodeURIComponent(g.slug)}" class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">${escapeHtml(g.name)}</a>`)
    .join("\n          ");

  const statusClass =
    novel.status === "Ongoing" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : novel.status === "Completed" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";

  const firstChapter = chapters.length > 0 ? chapters[0] : null;
  const lastChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;

  const readingLinks: string[] = [];
  if (firstChapter) {
    readingLinks.push(
      `<a href="/read/${encodeURIComponent(novel.slug)}/${firstChapter.number}" class="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-md">Start Reading</a>`,
    );
  }
  if (lastChapter && lastChapter.number !== firstChapter?.number) {
    readingLinks.push(
      `<a href="/read/${encodeURIComponent(novel.slug)}/${lastChapter.number}" class="flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200">Latest Chapter</a>`,
    );
  }

  const chapterListHtml = chapters
    .map((c) => {
      const href = `/read/${encodeURIComponent(novel.slug)}/${c.number}`;
      return `<a href="${href}" class="group flex min-w-0 flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-2"><span class="flex min-w-0 items-center gap-2"><span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">${c.number}</span><span class="line-clamp-1 text-sm text-slate-700 dark:text-slate-300">${escapeHtml(c.title)}</span></span><span class="shrink-0 pl-7 text-[10px] text-slate-400 sm:pl-0">${c.published_at}</span></a>`;
    })
    .join("\n          ");

  return [
    `<nav class="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">`,
    `<a href="/" class="hover:text-amber-600 dark:hover:text-amber-400">Home</a>`,
    `<span>/</span>`,
    `<span class="text-slate-700 dark:text-slate-300">${escapeHtml(novel.title)}</span>`,
    `</nav>`,
    `<main class="mx-auto max-w-7xl">`,
    `<section class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800 md:p-8">`,
    `<div class="grid gap-6 md:grid-cols-[200px_1fr]">`,
    `<div class="mx-auto w-48 md:mx-0 md:w-[200px]">`,
    `<img src="${escapeAttr(coverSrc)}" alt="${escapeAttr(novel.title)}" class="aspect-[3/4] w-full rounded-lg object-cover shadow-xl" />`,
    `</div>`,
    `<div class="flex flex-col gap-3">`,
    `<div class="flex flex-wrap items-center gap-2">`,
    `<span class="rounded-full px-3 py-1 text-xs font-semibold ${statusClass}">${escapeHtml(novel.status)}</span>`,
    genreLinks,
    `</div>`,
    `<h1 class="font-serif text-2xl font-black leading-tight text-slate-900 dark:text-white md:text-3xl">${escapeHtml(novel.title)}</h1>`,
    `<p class="text-sm text-slate-500 dark:text-slate-400">by <span class="font-medium text-slate-700 dark:text-slate-300">${escapeHtml(novel.author)}</span></p>`,
    `<div class="flex flex-wrap gap-x-4 gap-y-2 text-sm">`,
    `<span class="flex items-center gap-1.5"><span class="font-bold text-slate-900 dark:text-white">${formatViews(novel.views)}</span><span class="text-slate-400">views</span></span>`,
    `<span class="flex items-center gap-1.5"><span class="font-bold text-slate-900 dark:text-white">${chapters.length}</span><span class="text-slate-400">chapters</span></span>`,
    `</div>`,
    readingLinks.length > 0 ? `<div class="flex flex-wrap gap-2 pt-2">${readingLinks.join("\n          ")}</div>` : ``,
    `</div>`,
    `</div>`,
    `</section>`,
    `<section class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">`,
    `<h2 class="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-slate-900 dark:text-white"><span class="h-5 w-1.5 rounded-full bg-amber-500"></span> Synopsis</h2>`,
    `<div class="reader-html-content min-w-0 break-words leading-relaxed text-slate-600 dark:text-slate-300" style="overflow-wrap:anywhere">`,
    synopsisHtml,
    `</div>`,
    `</section>`,
    `<section class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">`,
    `<h2 class="mb-4 flex items-center gap-2 font-serif text-lg font-bold text-slate-900 dark:text-white"><span class="h-5 w-1.5 rounded-full bg-amber-500"></span> Chapter List <span class="text-sm font-normal text-slate-400">(${chapters.length})</span></h2>`,
    `<div class="grid gap-1 sm:grid-cols-2">`,
    chapterListHtml,
    `</div>`,
    `</section>`,
    `</main>`,
  ].join("\n      ");
}

function injectSsrRoot(html: string, markup: string): string {
  return html.replace(
    /<div\s+id=["']root["']\s*>\s*<\/div>/i,
    `<div id="root">\n      ${markup}\n    </div>`,
  );
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
  if (!slug) return spaResponse();

  try {
    const rows = await supabaseFetch<NovelRow[]>(
      baseUrl,
      anonKey,
      `/rest/v1/novels?select=id,slug,title,author,synopsis,cover_url,status,views&slug=eq.${encodeURIComponent(slug)}`,
    );
    const novel = rows?.[0];
    if (!novel) {
      const modified = injectMeta(html, buildNoindexMeta(slug));
      return notFoundResponse(modified);
    }

    // Fetch genres and published chapter summaries in parallel.
    // Secondary lookup failures degrade gracefully — they never turn a valid
    // novel into a 404.
    const [genreLinks, chapters] = await Promise.all([
      (async (): Promise<GenreRow[]> => {
        try {
          const links = await supabaseFetch<NovelGenreRow[]>(
            baseUrl,
            anonKey,
            `/rest/v1/novel_genres?select=genre_id&novel_id=eq.${encodeURIComponent(novel.id)}`,
          );
          const ids = (links ?? []).map((l) => l.genre_id);
          if (ids.length === 0) return [];
          const genreRows = await supabaseFetch<GenreRow[]>(
            baseUrl,
            anonKey,
            `/rest/v1/genres?select=id,name,slug&id=in.(${ids.join(",")})&order=name.asc`,
          );
          return genreRows ?? [];
        } catch {
          return [];
        }
      })(),
      (async (): Promise<ChapterSummaryRow[]> => {
        try {
          const ch = await supabaseFetch<ChapterSummaryRow[]>(
            baseUrl,
            anonKey,
            `/rest/v1/chapters?select=number,title,published_at,publish_at&novel_id=eq.${encodeURIComponent(novel.id)}&published=eq.true&order=number.asc`,
          );
          return ch ?? [];
        } catch {
          return [];
        }
      })(),
    ]);

    const metaTags = buildNovelMeta(novel, CANONICAL_ORIGIN);
    let jsonLd: string | undefined;
    try {
      jsonLd = buildNovelJsonLd(novel, CANONICAL_ORIGIN);
    } catch {
      // JSON-LD failure: return meta-only HTML
    }
    let modified = injectMeta(html, metaTags, jsonLd);
    try {
      const ssr = buildSsrMarkup(novel, genreLinks, chapters);
      modified = injectSsrRoot(modified, ssr);
    } catch {
      // SSR body failure: return meta-only HTML (SPA still mounts normally)
    }
    return buildResponse(modified);
  } catch {
    return spaResponse();
  }
};
