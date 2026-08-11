interface Env {
  ASSETS: Fetcher;
}

const SITE_NAME = "AddNovel";
const CANONICAL_ORIGIN = "https://addnovel.com";
const DEFAULT_OG_IMAGE = "/og-default.svg";

const PAGE_TITLE = "Latest Novel Updates - AddNovel";
const PAGE_DESCRIPTION =
  "Discover the latest updated novels and newly published chapters on AddNovel.";
const PAGE_URL = `${CANONICAL_ORIGIN}/latest`;
const PAGE_IMAGE = `${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE}`;

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

export const onRequest: PagesFunction<Env> = async (context) => {
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
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self' https://googleads.g.doubleclick.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    );
    return new Response(body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  };

  try {
    const modified = injectMeta(html, buildMeta());
    return buildResponse(modified);
  } catch {
    return buildResponse(html);
  }
};
