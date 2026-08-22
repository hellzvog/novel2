interface Env {
  ASSETS: Fetcher;
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_ANON_KEY?: string;
}

interface GenreRow {
  id: string;
  name: string;
  slug: string;
}

interface NovelGenreRow {
  novel_id: string;
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

const SITE_NAME = "AddNovel";
const DEFAULT_OG_IMAGE = "/og-default.svg";
const CANONICAL_ORIGIN = "https://addnovel.com";
const PAGE_SIZE = 12;

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

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K`;
  return String(views);
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

function buildGenreMeta(name: string, slug: string): string {
  const title = `${name} Novels - Read Online | ${SITE_NAME}`;
  const description = `Browse ${name} novels and discover stories to read online on ${SITE_NAME}.`;
  const canonical = `${CANONICAL_ORIGIN}/genre/${encodeURIComponent(slug)}`;
  const image = `${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE}`;

  return [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
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

function buildNoindexMeta(slug: string): string {
  const canonical = `${CANONICAL_ORIGIN}/genre/${encodeURIComponent(slug)}`;
  return [
    `<title>Genre — ${SITE_NAME}</title>`,
    `<meta name="robots" content="noindex, nofollow" />`,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
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
  out = out.replace(
    /<meta\s+[^>]*?name\s*=\s*["']robots["'][^>]*>/gi,
    "",
  );
  return out.replace(/<\/head>/i, `    ${metaTags}\n  </head>`);
}

function buildSsrMarkup(
  genre: GenreRow,
  novels: NovelSummaryRow[],
  total: number,
  otherGenres: GenreRow[],
): string {
  const novelCards = novels
    .map((n) => {
      const href = `/novel/${encodeURIComponent(n.slug)}`;
      const cover = resolveCover(n.cover_url);
      const statusClass =
        n.status === "Ongoing" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        : n.status === "Completed" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
      return `<a href="${href}" class="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left dark:border-slate-700 dark:bg-slate-800"><div class="relative aspect-[3/4] w-full overflow-hidden"><img src="${escapeAttr(cover)}" alt="${escapeAttr(n.title)}" loading="lazy" class="h-full w-full object-cover" /><span class="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}">${escapeHtml(n.status)}</span></div><div class="flex flex-1 flex-col gap-1.5 p-3"><h3 class="line-clamp-2 font-serif text-sm font-bold text-slate-900 dark:text-slate-100">${escapeHtml(n.title)}</h3><p class="text-xs text-slate-500 dark:text-slate-400">by ${escapeHtml(n.author)}</p><p class="mt-auto pt-1.5 text-[11px] text-slate-500 dark:text-slate-400">${formatViews(n.views)} views</p></div></a>`;
    })
    .join("\n          ");

  const otherGenreLinks = otherGenres
    .map((g) => `<a href="/genre/${encodeURIComponent(g.slug)}" class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">${escapeHtml(g.name)}</a>`)
    .join("\n          ");

  const novelSection = novels.length === 0
    ? `<div class="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400 dark:border-slate-700">No novels found in this genre yet.</div>`
    : `<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">${novelCards}</div>`;

  const otherGenresSection = otherGenres.length > 0
    ? `<section class="mt-12 border-t border-slate-200 pt-8 dark:border-slate-700"><h2 class="mb-4 font-serif text-xl font-bold text-slate-900 dark:text-white">Other Genres</h2><div class="flex flex-wrap gap-2">${otherGenreLinks}</div></section>`
    : "";

  return [
    `<main class="mx-auto max-w-7xl px-4 py-6">`,
    `<div class="mb-6">`,
    `<h1 class="font-serif text-2xl font-bold text-slate-900 dark:text-white">${escapeHtml(genre.name)} Novels</h1>`,
    `<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Browse ${escapeHtml(genre.name)} novels and discover stories to read online on ${SITE_NAME}.</p>`,
    `</div>`,
    `<div class="mb-4 text-sm text-slate-500 dark:text-slate-400">${total} ${total === 1 ? "novel" : "novels"} found</div>`,
    novelSection,
    otherGenresSection,
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

  const baseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";
  if (!baseUrl || !anonKey) return spaResponse();

  const slug = context.params.slug as string | undefined;
  if (!slug) return spaResponse();

  try {
    const rows = await supabaseFetch<GenreRow[]>(
      baseUrl,
      anonKey,
      `/rest/v1/genres?select=id,name,slug&slug=eq.${encodeURIComponent(slug)}`,
    );
    const genre = rows?.[0];
    if (!genre) {
      const modified = injectMeta(html, buildNoindexMeta(slug));
      const r = buildResponse(modified);
      return new Response(r.body, { status: 404, statusText: "Not Found", headers: r.headers });
    }

    // Fetch genre novels and other genres in parallel. Secondary failures
    // degrade gracefully — they never turn a valid genre into a 404.
    const [novelsResult, otherGenres] = await Promise.all([
      (async (): Promise<{ novels: NovelSummaryRow[]; total: number }> => {
        try {
          const links = await supabaseFetch<NovelGenreRow[]>(
            baseUrl,
            anonKey,
            `/rest/v1/novel_genres?select=novel_id&genre_id=eq.${encodeURIComponent(genre.id)}`,
          );
          const novelIds = (links ?? []).map((l) => l.novel_id);
          const total = new Set(novelIds).size;
          if (novelIds.length === 0) return { novels: [], total: 0 };

          const novels = await supabaseFetch<NovelSummaryRow[]>(
            baseUrl,
            anonKey,
            `/rest/v1/novels?select=id,slug,title,author,status,views,cover_url&id=in.(${novelIds.join(",")})&order=views.desc&limit=${PAGE_SIZE}`,
          );
          return { novels: novels ?? [], total };
        } catch {
          return { novels: [], total: 0 };
        }
      })(),
      (async (): Promise<GenreRow[]> => {
        try {
          const genres = await supabaseFetch<GenreRow[]>(
            baseUrl,
            anonKey,
            `/rest/v1/genres?select=id,name,slug&order=name.asc`,
          );
          return (genres ?? []).filter((g) => g.id !== genre.id);
        } catch {
          return [];
        }
      })(),
    ]);

    const metaTags = buildGenreMeta(genre.name, genre.slug);
    let modified = injectMeta(html, metaTags);
    try {
      const ssr = buildSsrMarkup(genre, novelsResult.novels, novelsResult.total, otherGenres);
      modified = injectSsrRoot(modified, ssr);
    } catch {
      // SSR body failure: return meta-only HTML (SPA still mounts normally)
    }
    return buildResponse(modified);
  } catch {
    return spaResponse();
  }
};
