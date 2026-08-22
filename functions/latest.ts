interface Env {
  ASSETS: Fetcher;
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_ANON_KEY?: string;
}

interface ChapterSummaryRow {
  novel_id: string;
  number: number;
  title: string;
  published_at: string;
  publish_at: string | null;
}

interface NovelSummaryRow {
  id: string;
  slug: string;
  title: string;
  author: string;
  status: string;
  cover_url: string | null;
}

interface LatestEntry {
  novel: NovelSummaryRow;
  chapter: ChapterSummaryRow;
}

const SITE_NAME = "AddNovel";
const CANONICAL_ORIGIN = "https://addnovel.com";
const DEFAULT_OG_IMAGE = "/og-default.svg";

const PAGE_TITLE = "Latest Novel Updates - AddNovel";
const PAGE_DESCRIPTION =
  "Discover the latest updated novels and newly published chapters on AddNovel.";
const PAGE_URL = `${CANONICAL_ORIGIN}/latest`;
const PAGE_IMAGE = `${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE}`;

const TARGET_UNIQUE_NOVELS = 24;
const CHAPTER_BATCH_SIZE = 100;
const MAX_BATCHES = 10;

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

function resolveCover(coverUrl: string | null | undefined): string {
  if (coverUrl && coverUrl.trim()) {
    if (coverUrl.startsWith("http")) return coverUrl;
    return `${CANONICAL_ORIGIN}${coverUrl.startsWith("/") ? "" : "/"}${coverUrl}`;
  }
  return `${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE}`;
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

function effectivePubAt(ch: ChapterSummaryRow): string {
  return ch.publish_at ?? ch.published_at;
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

async function fetchLatestEntries(
  baseUrl: string,
  anonKey: string,
): Promise<LatestEntry[]> {
  // Fetch ordered published chapter summaries in batches, taking the first
  // occurrence of each unique novel_id until we reach the target count.
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
        if (orderedChapters.length >= TARGET_UNIQUE_NOVELS) break;
      }
    }
    if (orderedChapters.length >= TARGET_UNIQUE_NOVELS) break;
    if (chapters.length < CHAPTER_BATCH_SIZE) break;
    offset += CHAPTER_BATCH_SIZE;
  }

  if (orderedChapters.length === 0) return [];

  // Fetch novel metadata for the unique novel IDs.
  const novelIds = orderedChapters.map((c) => c.novel_id);
  const novels = await supabaseFetch<NovelSummaryRow[]>(
    baseUrl,
    anonKey,
    `/rest/v1/novels?select=id,slug,title,author,status,cover_url&id=in.(${novelIds.join(",")})`,
  );
  const novelMap = new Map<string, NovelSummaryRow>();
  for (const n of novels ?? []) novelMap.set(n.id, n);

  // Restore latest-chapter ordering.
  const entries: LatestEntry[] = [];
  for (const ch of orderedChapters) {
    const novel = novelMap.get(ch.novel_id);
    if (novel) entries.push({ novel, chapter: ch });
  }
  return entries;
}

function buildSsrMarkup(entries: LatestEntry[]): string {
  if (entries.length === 0) {
    return [
      `<main class="mx-auto max-w-7xl px-4 py-6">`,
      `<div class="mb-6">`,
      `<h1 class="font-serif text-2xl font-bold text-slate-900 dark:text-white">Latest Novel Updates</h1>`,
      `<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Discover the latest updated novels on ${SITE_NAME}.</p>`,
      `</div>`,
      `<div class="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400 dark:border-slate-700">No novel updates yet.</div>`,
      `</main>`,
    ].join("\n      ");
  }

  const items = entries
    .map((e) => {
      const novelHref = `/novel/${encodeURIComponent(e.novel.slug)}`;
      const chapterHref = `/read/${encodeURIComponent(e.novel.slug)}/${e.chapter.number}`;
      const cover = resolveCover(e.novel.cover_url);
      const pubDate = formatDate(effectivePubAt(e.chapter));
      const statusClass =
        e.novel.status === "Ongoing" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        : e.novel.status === "Completed" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
      return `<article class="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"><img src="${escapeAttr(cover)}" alt="${escapeAttr(e.novel.title)}" loading="lazy" class="h-16 w-12 shrink-0 rounded object-cover" /><div class="min-w-0 flex-1"><a href="${novelHref}" class="block truncate text-sm font-semibold text-slate-900 group-hover:text-amber-600 dark:text-slate-100 dark:group-hover:text-amber-400">${escapeHtml(e.novel.title)}</a><p class="truncate text-xs text-slate-500 dark:text-slate-400">${escapeHtml(e.novel.author)}</p><a href="${chapterHref}" class="mt-1 block text-xs text-amber-600 dark:text-amber-400">Ch. ${e.chapter.number}: ${escapeHtml(e.chapter.title)}</a><p class="text-[11px] text-slate-400">${pubDate}</p></div><span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass}">${escapeHtml(e.novel.status)}</span></article>`;
    })
    .join("\n          ");

  return [
    `<main class="mx-auto max-w-7xl px-4 py-6">`,
    `<div class="mb-6">`,
    `<h1 class="font-serif text-2xl font-bold text-slate-900 dark:text-white">Latest Novel Updates</h1>`,
    `<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Discover the latest updated novels on ${SITE_NAME}.</p>`,
    `</div>`,
    `<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">`,
    items,
    `</div>`,
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

  const baseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";

  if (!baseUrl || !anonKey) {
    return buildResponse(injectMeta(html, buildMeta()));
  }

  try {
    const entries = await fetchLatestEntries(baseUrl, anonKey);
    let modified = injectMeta(html, buildMeta());
    try {
      const ssr = buildSsrMarkup(entries);
      modified = injectSsrRoot(modified, ssr);
    } catch {
      // SSR body failure: return meta-only HTML (SPA still mounts normally)
    }
    return buildResponse(modified);
  } catch {
    return buildResponse(injectMeta(html, buildMeta()));
  }
};
