interface Env {
  ASSETS: Fetcher;
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_ANON_KEY?: string;
}

interface NovelSummaryRow {
  id: string;
  slug: string;
  title: string;
  author: string;
  status: string;
  views: number;
  cover_url: string | null;
}

interface FeaturedNovelRow extends NovelSummaryRow {
  synopsis: string;
  featured_at: string | null;
}

interface ChapterSummaryRow {
  novel_id: string;
  number: number;
  title: string;
  published_at: string;
  publish_at: string | null;
}

interface GenreRow {
  id: string;
  name: string;
  slug: string;
}

interface LatestEntry {
  novel: NovelSummaryRow;
  chapter: ChapterSummaryRow;
}

const SITE_NAME = "AddNovel";
const SITE_DESCRIPTION =
  "Read thousands of English translated web novels for free on AddNovel.";
const CANONICAL_ORIGIN = "https://addnovel.com";
const DEFAULT_OG_IMAGE = "/og-default.svg";

const PAGE_TITLE = "AddNovel - Read Free English Web Novels Online";
const PAGE_DESCRIPTION = SITE_DESCRIPTION;
const PAGE_URL = `${CANONICAL_ORIGIN}/`;
const PAGE_IMAGE = `${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE}`;

const LATEST_TARGET = 12;
const CHAPTER_BATCH_SIZE = 100;
const MAX_BATCHES = 5;

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

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max)}\u2026`;
}

function resolveCover(coverUrl: string | null | undefined): string {
  if (coverUrl && coverUrl.trim()) {
    if (coverUrl.startsWith("http")) return coverUrl;
    return `${CANONICAL_ORIGIN}${coverUrl.startsWith("/") ? "" : "/"}${coverUrl}`;
  }
  return `${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE}`;
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K`;
  return String(views);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split("T")[0];
  } catch {
    return dateStr;
  }
}

function effectivePubAt(ch: ChapterSummaryRow): string {
  return ch.publish_at ?? ch.published_at;
}

function safeJsonLd(obj: Record<string, unknown>): string {
  return JSON.stringify(obj)
    .replace(/</g, "\u003c")
    .replace(/>/g, "\u003e")
    .replace(/&/g, "\u0026");
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

function buildMeta(): string {
  return [
    `<title>${escapeAttr(PAGE_TITLE)}</title>`,
    `<meta name="description" content="${escapeAttr(PAGE_DESCRIPTION)}" />`,
    `<link rel="canonical" href="${escapeAttr(PAGE_URL)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeAttr(PAGE_TITLE)}" />`,
    `<meta property="og:description" content="${escapeAttr(PAGE_DESCRIPTION)}" />`,
    `<meta property="og:url" content="${escapeAttr(PAGE_URL)}" />`,
    `<meta property="og:image" content="${escapeAttr(PAGE_IMAGE)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(PAGE_TITLE)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(PAGE_DESCRIPTION)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(PAGE_IMAGE)}" />`,
  ].join("\n    ");
}

function buildWebsiteJsonLd(): string {
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${CANONICAL_ORIGIN}/`,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${CANONICAL_ORIGIN}/search?query={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
  return `<script id="ld-website" type="application/ld+json">${safeJsonLd(obj)}</script>`;
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
  if (jsonLd) {
    out = out.replace(
      /<script\s+id=["']ld-website["'][^>]*>[\s\S]*?<\/script>/gi,
      "",
    );
  }
  const inject = jsonLd ? `${metaTags}\n    ${jsonLd}` : metaTags;
  return out.replace(/<\/head>/i, `    ${inject}\n  </head>`);
}

function novelCardHtml(n: NovelSummaryRow): string {
  const href = `/novel/${encodeURIComponent(n.slug)}`;
  const cover = resolveCover(n.cover_url);
  const statusClass =
    n.status === "Ongoing" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : n.status === "Completed" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return `<a href="${href}" class="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left dark:border-slate-700 dark:bg-slate-800"><div class="relative aspect-[3/4] w-full overflow-hidden"><img src="${escapeAttr(cover)}" alt="${escapeAttr(n.title)}" loading="lazy" class="h-full w-full object-cover" /><span class="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}">${escapeHtml(n.status)}</span></div><div class="flex flex-1 flex-col gap-1.5 p-3"><h3 class="line-clamp-2 font-serif text-sm font-bold text-slate-900 dark:text-slate-100">${escapeHtml(n.title)}</h3><p class="text-xs text-slate-500 dark:text-slate-400">by ${escapeHtml(n.author)}</p><p class="mt-auto pt-1.5 text-[11px] text-slate-500 dark:text-slate-400">${formatViews(n.views)} views</p></div></a>`;
}

function buildSsrMarkup(
  featured: FeaturedNovelRow[],
  latest: LatestEntry[],
  popular: NovelSummaryRow[],
  completed: NovelSummaryRow[],
  ongoing: NovelSummaryRow[],
  genres: GenreRow[],
): string {
  const sections: string[] = [];

  // Hero
  if (featured.length > 0) {
    const hero = featured[0];
    const heroHref = `/novel/${encodeURIComponent(hero.slug)}`;
    const heroCover = resolveCover(hero.cover_url);
    const synopsisPlain = stripHtmlToText(hero.synopsis);
    const heroExcerpt = truncateText(synopsisPlain, 300);
    sections.push(
      `<section class="relative mb-12 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"><div class="grid md:grid-cols-2"><div class="relative flex min-w-0 flex-col justify-center gap-3 px-14 py-6 md:px-20 md:py-10" style="background:linear-gradient(135deg,#1e3a8a,#0ea5e9);height:400px"><span class="relative w-fit rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-900">Featured</span><h1 class="relative font-serif text-3xl font-black leading-tight text-white md:text-4xl">${escapeHtml(hero.title)}</h1><p class="relative text-sm text-white/80">by ${escapeHtml(hero.author)}</p><p class="relative text-sm text-white/90">${escapeHtml(heroExcerpt)}</p><a href="${heroHref}" class="relative mt-2 flex w-fit items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900">Start Reading</a></div><div class="hidden items-center justify-center bg-slate-100 p-10 md:flex dark:bg-slate-800"><img src="${escapeAttr(heroCover)}" alt="${escapeAttr(hero.title)}" class="h-[300px] w-[240px] rounded-lg object-cover shadow-2xl" /></div></div></section>`,
    );
  } else {
    sections.push(
      `<section class="mb-12"><h1 class="font-serif text-3xl font-black text-slate-900 dark:text-white md:text-4xl">Read Free English Web Novels Online</h1><p class="mt-2 text-slate-500 dark:text-slate-400">${escapeHtml(SITE_DESCRIPTION)}</p></section>`,
    );
  }

  // Featured Novels
  if (featured.length > 0) {
    const cards = featured.map(novelCardHtml).join("\n          ");
    sections.push(
      `<section class="mb-12"><h2 class="mb-4 flex items-center gap-2 font-serif text-xl font-bold text-slate-900 dark:text-white"><span class="h-5 w-1.5 rounded-full bg-amber-500"></span> Featured Novels</h2><div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">${cards}</div></section>`,
    );
  }

  // Latest Updates
  if (latest.length > 0) {
    const items = latest
      .map((e) => {
        const novelHref = `/novel/${encodeURIComponent(e.novel.slug)}`;
        const chapterHref = `/read/${encodeURIComponent(e.novel.slug)}/${e.chapter.number}`;
        const cover = resolveCover(e.novel.cover_url);
        const pubDate = formatDate(effectivePubAt(e.chapter));
        return `<article class="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"><img src="${escapeAttr(cover)}" alt="${escapeAttr(e.novel.title)}" loading="lazy" class="h-16 w-12 shrink-0 rounded object-cover" /><div class="min-w-0 flex-1"><a href="${novelHref}" class="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(e.novel.title)}</a><p class="truncate text-xs text-slate-500 dark:text-slate-400">${escapeHtml(e.novel.author)}</p><a href="${chapterHref}" class="mt-1 block text-xs text-amber-600 dark:text-amber-400">Ch. ${e.chapter.number}: ${escapeHtml(e.chapter.title)}</a><p class="text-[11px] text-slate-400">${pubDate}</p></div></article>`;
      })
      .join("\n          ");
    sections.push(
      `<section class="mb-12"><div class="mb-4 flex items-center justify-between"><h2 class="flex items-center gap-2 font-serif text-xl font-bold text-slate-900 dark:text-white"><span class="h-5 w-1.5 rounded-full bg-amber-500"></span> Latest Updates</h2><a href="/latest" class="flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">View more</a></div><div class="grid grid-cols-1 gap-2 sm:grid-cols-2">${items}</div></section>`,
    );
  }

  // Popular Novels
  if (popular.length > 0) {
    const cards = popular.map(novelCardHtml).join("\n          ");
    sections.push(
      `<section class="mb-12"><h2 class="mb-4 flex items-center gap-2 font-serif text-xl font-bold text-slate-900 dark:text-white"><span class="h-5 w-1.5 rounded-full bg-amber-500"></span> Popular Novels</h2><div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">${cards}</div></section>`,
    );
  }

  // Completed + Ongoing
  const halfSections: string[] = [];
  if (completed.length > 0) {
    const cards = completed.map(novelCardHtml).join("\n          ");
    halfSections.push(
      `<section class="mb-12"><h2 class="mb-4 flex items-center gap-2 font-serif text-xl font-bold text-slate-900 dark:text-white"><span class="h-5 w-1.5 rounded-full bg-amber-500"></span> Completed Novels</h2><div class="grid grid-cols-2 gap-4 sm:grid-cols-3">${cards}</div></section>`,
    );
  }
  if (ongoing.length > 0) {
    const cards = ongoing.map(novelCardHtml).join("\n          ");
    halfSections.push(
      `<section class="mb-12"><h2 class="mb-4 flex items-center gap-2 font-serif text-xl font-bold text-slate-900 dark:text-white"><span class="h-5 w-1.5 rounded-full bg-amber-500"></span> Ongoing Novels</h2><div class="grid grid-cols-2 gap-4 sm:grid-cols-3">${cards}</div></section>`,
    );
  }
  if (halfSections.length > 0) {
    sections.push(`<div class="grid gap-12 lg:grid-cols-2">${halfSections.join("\n      ")}</div>`);
  }

  // Browse by Genre
  if (genres.length > 0) {
    const genreLinks = genres
      .map((g) => `<a href="/genre/${encodeURIComponent(g.slug)}" class="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">${escapeHtml(g.name)}</a>`)
      .join("\n          ");
    sections.push(
      `<section class="mb-12"><h2 class="mb-4 flex items-center gap-2 font-serif text-xl font-bold text-slate-900 dark:text-white"><span class="h-5 w-1.5 rounded-full bg-amber-500"></span> Browse by Genre</h2><div class="flex flex-wrap gap-2">${genreLinks}</div></section>`,
    );
  }

  return `<main class="mx-auto max-w-7xl px-4 py-6">\n      ${sections.join("\n      ")}\n    </main>`;
}

function injectSsrRoot(html: string, markup: string): string {
  return html.replace(
    /<div\s+id=["']root["']\s*>\s*<\/div>/i,
    `<div id="root">\n      ${markup}\n    </div>`,
  );
}

async function fetchLatestEntries(
  baseUrl: string,
  anonKey: string,
): Promise<LatestEntry[]> {
  const seenNovelIds = new Set<string>();
  const orderedChapters: ChapterSummaryRow[] = [];
  let offset = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const chapters = await supabaseFetch<ChapterSummaryRow[]>(
      baseUrl,
      anonKey,
      `/rest/v1/chapters?select=novel_id,number,title,published_at,publish_at&published=eq.true&order=published_at.desc,publish_at.desc.nullslast&limit=${CHAPTER_BATCH_SIZE}&offset=${offset}`,
    );
    if (!chapters || chapters.length === 0) break;

    for (const ch of chapters) {
      if (!seenNovelIds.has(ch.novel_id)) {
        seenNovelIds.add(ch.novel_id);
        orderedChapters.push(ch);
        if (orderedChapters.length >= LATEST_TARGET) break;
      }
    }
    if (orderedChapters.length >= LATEST_TARGET) break;
    if (chapters.length < CHAPTER_BATCH_SIZE) break;
    offset += CHAPTER_BATCH_SIZE;
  }

  if (orderedChapters.length === 0) return [];

  const novelIds = orderedChapters.map((c) => c.novel_id);
  const novels = await supabaseFetch<NovelSummaryRow[]>(
    baseUrl,
    anonKey,
    `/rest/v1/novels?select=id,slug,title,author,status,views,cover_url&id=in.(${novelIds.join(",")})`,
  );
  const novelMap = new Map<string, NovelSummaryRow>();
  for (const n of novels ?? []) novelMap.set(n.id, n);

  const entries: LatestEntry[] = [];
  for (const ch of orderedChapters) {
    const novel = novelMap.get(ch.novel_id);
    if (novel) entries.push({ novel, chapter: ch });
  }
  return entries;
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

  const baseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";

  const jsonLd = buildWebsiteJsonLd();

  if (!baseUrl || !anonKey) {
    return buildResponse(injectMeta(html, buildMeta(), jsonLd));
  }

  // Run all independent bounded queries in parallel. Each degrades gracefully.
  const [featured, latest, popular, completed, ongoing, genres] = await Promise.all([
    (async (): Promise<FeaturedNovelRow[]> => {
      try {
        const rows = await supabaseFetch<FeaturedNovelRow[]>(
          baseUrl,
          anonKey,
          `/rest/v1/novels?select=id,slug,title,author,status,views,synopsis,cover_url,featured_at&featured=eq.true&order=featured_at.desc&limit=6`,
        );
        return rows ?? [];
      } catch {
        return [];
      }
    })(),
    (async (): Promise<LatestEntry[]> => {
      try {
        return await fetchLatestEntries(baseUrl, anonKey);
      } catch {
        return [];
      }
    })(),
    (async (): Promise<NovelSummaryRow[]> => {
      try {
        const curated = await supabaseFetch<NovelSummaryRow[]>(
          baseUrl,
          anonKey,
          `/rest/v1/novels?select=id,slug,title,author,status,views,cover_url&popular=eq.true&order=popular_at.desc&limit=12`,
        );
        if (curated && curated.length > 0) return curated;
        const fallback = await supabaseFetch<NovelSummaryRow[]>(
          baseUrl,
          anonKey,
          `/rest/v1/novels?select=id,slug,title,author,status,views,cover_url&order=views.desc&limit=12`,
        );
        return fallback ?? [];
      } catch {
        return [];
      }
    })(),
    (async (): Promise<NovelSummaryRow[]> => {
      try {
        const rows = await supabaseFetch<NovelSummaryRow[]>(
          baseUrl,
          anonKey,
          `/rest/v1/novels?select=id,slug,title,author,status,views,cover_url&status=eq.Completed&order=created_at.desc&limit=6`,
        );
        return rows ?? [];
      } catch {
        return [];
      }
    })(),
    (async (): Promise<NovelSummaryRow[]> => {
      try {
        const rows = await supabaseFetch<NovelSummaryRow[]>(
          baseUrl,
          anonKey,
          `/rest/v1/novels?select=id,slug,title,author,status,views,cover_url&status=eq.Ongoing&order=created_at.desc&limit=6`,
        );
        return rows ?? [];
      } catch {
        return [];
      }
    })(),
    (async (): Promise<GenreRow[]> => {
      try {
        const rows = await supabaseFetch<GenreRow[]>(
          baseUrl,
          anonKey,
          `/rest/v1/genres?select=id,name,slug&order=name.asc`,
        );
        return rows ?? [];
      } catch {
        return [];
      }
    })(),
  ]);

  let modified = injectMeta(html, buildMeta(), jsonLd);
  try {
    const ssr = buildSsrMarkup(featured, latest, popular, completed, ongoing, genres);
    modified = injectSsrRoot(modified, ssr);
  } catch {
    // SSR body failure: return meta + JSON-LD HTML (SPA still mounts normally)
  }
  return buildResponse(modified);
};
