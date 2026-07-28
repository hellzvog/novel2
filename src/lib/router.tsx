import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Route =
  | { name: "home" }
  | { name: "novel"; slug: string }
  | { name: "reader"; slug: string; chapter: number }
  | { name: "search"; query?: string }
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

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash || hash === "/") return { name: "home" };
  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "novel" && parts[1]) return { name: "novel", slug: parts[1] };
  if (parts[0] === "read" && parts[1] && parts[2]) {
    return { name: "reader", slug: parts[1], chapter: Number(parts[2]) };
  }
  if (parts[0] === "search") {
    const q = parts.slice(1).join("/");
    return { name: "search", query: decodeURIComponent(q) };
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

function toHash(route: Route): string {
  switch (route.name) {
    case "home":
      return "#/";
    case "novel":
      return `#/novel/${route.slug}`;
    case "reader":
      return `#/read/${route.slug}/${route.chapter}`;
    case "search":
      return route.query ? `#/search/${encodeURIComponent(route.query)}` : "#/search";
    case "favorites":
      return "#/favorites";
    case "admin":
      return "#/admin";
    case "admin-login":
      return "#/admin/login";
    case "admin-novels":
      return "#/admin/novels";
    case "admin-novel-edit":
      return route.slug ? `#/admin/novels/edit/${route.slug}` : "#/admin/novels/new";
    case "admin-chapters":
      return `#/admin/chapters/${route.slug}`;
    case "admin-chapter-edit":
      return route.chapter ? `#/admin/chapters/${route.slug}/edit/${route.chapter}` : `#/admin/chapters/${route.slug}/new`;
    case "admin-import":
      return "#/admin/import";
  }
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (next: Route) => {
    const hash = toHash(next);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
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
