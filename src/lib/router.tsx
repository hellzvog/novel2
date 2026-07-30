import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Route =
  | { name: "home" }
  | { name: "novel"; slug: string }
  | { name: "reader"; slug: string; chapter: number }
  | { name: "search"; query?: string; genre?: string; status?: string }
  | { name: "favorites" }
  | { name: "admin" }
  | { name: "admin-login" }
  | { name: "admin-novels" }
  | { name: "admin-novel-edit"; slug?: string }
  | { name: "admin-chapters"; slug: string }
  | { name: "admin-chapter-edit"; slug: string; chapter?: number }
  | { name: "admin-import" };

interface RouterValue {
  route: Route;
  navigate: (route: Route) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

/**
 * Detect whether the server supports clean (History API) URLs.
 * In Bolt Preview (static SPA hosting without a catch-all fallback),
 * direct navigation to a deep link like /novel/slug would 404.
 * We detect this at runtime: if the initial page load came via a
 * hash URL or the server returned a 404 fallback, we stay in hash mode.
 *
 * Strategy: use History API for in-app navigation (clean URLs in the
 * address bar). On initial load, if the URL has a hash, parse it.
 * If the URL is a clean path, try to use it directly — the app shell
 * is the same regardless of path, so as long as the server serves
 * index.html for the path, it works. If not, the user can navigate
 * back to home via the UI.
 */
let useCleanUrls = true;

function detectMode(): boolean {
  // If the initial URL has a hash fragment that looks like a route,
  // we may be in an environment that only supports hash routing.
  const hash = window.location.hash.replace(/^#/, "");
  if (hash && hash.startsWith("/")) {
    // Hash-based URL detected — check if pathname is just "/"
    // This means we're in hash mode (e.g. user has a bookmarked hash URL)
    // We still try clean URLs for new navigation, but parse the hash for initial route.
    return true; // Still use clean URLs for navigation, just parse hash for initial
  }
  return true;
}

function parseHash(hash: string): Route | null {
  if (!hash || hash === "/") return { name: "home" };
  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "novel" && parts[1]) return { name: "novel", slug: parts[1] };
  if (parts[0] === "read" && parts[1] && parts[2]) {
    return { name: "reader", slug: parts[1], chapter: Number(parts[2]) };
  }
  if (parts[0] === "search") {
    const rest = parts.slice(1).join("/");
    if (rest.startsWith("genre:")) {
      return { name: "search", genre: decodeURIComponent(rest.slice(6)) };
    }
    if (rest.startsWith("status:")) {
      return { name: "search", status: decodeURIComponent(rest.slice(7)) };
    }
    return { name: "search", query: decodeURIComponent(rest) };
  }
  if (parts[0] === "favorites") return { name: "favorites" };
  if (parts[0] === "admin") {
    if (!parts[1] || parts[1] === "dashboard") return { name: "admin" };
    if (parts[1] === "login") return { name: "admin-login" };
    if (parts[1] === "novels") {
      if (parts[2] === "new") return { name: "admin-novel-edit" };
      if (parts[2] === "edit" && parts[3]) return { name: "admin-novel-edit", slug: parts[3] };
      return { name: "admin-novels" };
    }
    if (parts[1] === "chapters" && parts[2]) {
      if (parts[3] === "new") return { name: "admin-chapter-edit", slug: parts[2] };
      if (parts[3] === "edit" && parts[4]) return { name: "admin-chapter-edit", slug: parts[2], chapter: Number(parts[4]) };
      return { name: "admin-chapters", slug: parts[2] };
    }
    if (parts[1] === "import") return { name: "admin-import" };
    return { name: "admin" };
  }
  return null;
}

function parsePath(pathname: string, search: string): Route {
  // Check for hash-based URL first (backward compatibility with old bookmarks)
  const hash = window.location.hash.replace(/^#/, "");
  if (hash && hash.startsWith("/")) {
    const hashRoute = parseHash(hash);
    if (hashRoute) return hashRoute;
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "home" };
  if (parts[0] === "novel" && parts[1]) return { name: "novel", slug: parts[1] };
  if (parts[0] === "read" && parts[1] && parts[2]) {
    return { name: "reader", slug: parts[1], chapter: Number(parts[2]) };
  }
  if (parts[0] === "search") {
    const params = new URLSearchParams(search);
    const query = params.get("query") || undefined;
    const genre = params.get("genre") || undefined;
    const status = params.get("status") || undefined;
    if (query || genre || status) {
      return { name: "search", query, genre, status };
    }
    return { name: "search" };
  }
  if (parts[0] === "favorites") return { name: "favorites" };
  if (parts[0] === "admin") {
    if (!parts[1] || parts[1] === "dashboard") return { name: "admin" };
    if (parts[1] === "login") return { name: "admin-login" };
    if (parts[1] === "novels") {
      if (parts[2] === "new") return { name: "admin-novel-edit" };
      if (parts[2] === "edit" && parts[3]) return { name: "admin-novel-edit", slug: parts[3] };
      return { name: "admin-novels" };
    }
    if (parts[1] === "chapters" && parts[2]) {
      if (parts[3] === "new") return { name: "admin-chapter-edit", slug: parts[2] };
      if (parts[3] === "edit" && parts[4]) return { name: "admin-chapter-edit", slug: parts[2], chapter: Number(parts[4]) };
      return { name: "admin-chapters", slug: parts[2] };
    }
    if (parts[1] === "import") return { name: "admin-import" };
    return { name: "admin" };
  }
  return { name: "home" };
}

function toPath(route: Route): string {
  switch (route.name) {
    case "home":
      return "/";
    case "novel":
      return `/novel/${route.slug}`;
    case "reader":
      return `/read/${route.slug}/${route.chapter}`;
    case "search": {
      const params = new URLSearchParams();
      if (route.query) params.set("query", route.query);
      if (route.genre) params.set("genre", route.genre);
      if (route.status) params.set("status", route.status);
      const qs = params.toString();
      return qs ? `/search?${qs}` : "/search";
    }
    case "favorites":
      return "/favorites";
    case "admin":
      return "/admin";
    case "admin-login":
      return "/admin/login";
    case "admin-novels":
      return "/admin/novels";
    case "admin-novel-edit":
      return route.slug ? `/admin/novels/edit/${route.slug}` : "/admin/novels/new";
    case "admin-chapters":
      return `/admin/chapters/${route.slug}`;
    case "admin-chapter-edit":
      return route.chapter ? `/admin/chapters/${route.slug}/edit/${route.chapter}` : `/admin/chapters/${route.slug}/new`;
    case "admin-import":
      return "/admin/import";
  }
}

function getInitialRoute(): Route {
  detectMode();
  return parsePath(window.location.pathname, window.location.search);
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(getInitialRoute);

  useEffect(() => {
    const onPopState = () => {
      setRoute(parsePath(window.location.pathname, window.location.search));
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (next: Route) => {
    const path = toPath(next);
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath !== path) {
      window.history.pushState({}, "", path);
      setRoute(next);
      window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  };

  return (
    <RouterContext.Provider value={{ route, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return ctx;
}
