import { useEffect, lazy, Suspense } from "react";
import { RouterProvider, useRouter } from "./lib/router";
import { ThemeProvider } from "./lib/theme";
import { AdminAuthProvider, useAdminAuth } from "./lib/admin-auth";
import ErrorBoundary from "./components/ErrorBoundary";
import Header from "./components/Header";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import NovelDetailPage from "./pages/NovelDetailPage";
import ChapterReaderPage from "./pages/ChapterReaderPage";
import SearchPage from "./pages/SearchPage";
import FavoritesPage from "./pages/FavoritesPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminNovelsPage from "./pages/admin/AdminNovelsPage";
import AdminNovelEditPage from "./pages/admin/AdminNovelEditPage";
import AdminChaptersPage from "./pages/admin/AdminChaptersPage";
import AdminChapterEditPage from "./pages/admin/AdminChapterEditPage";
const AdminImportPage = lazy(() => import("./pages/admin/AdminImportPage"));
import { Loader2 } from "lucide-react";

const ADMIN_ROUTES = new Set(["admin", "admin-novels", "admin-novel-edit", "admin-chapters", "admin-chapter-edit", "admin-import"]);

function Pages() {
  const { route, navigate } = useRouter();
  const { user, loading, isAdmin } = useAdminAuth();
  const isReader = route.name === "reader";
  const isAdminLogin = route.name === "admin-login";
  const isAdminRoute = ADMIN_ROUTES.has(route.name);

  // Redirect to login if accessing admin routes without auth
  useEffect(() => {
    if (isAdminRoute && !loading && (!user || !isAdmin)) {
      navigate({ name: "admin-login" });
    }
  }, [isAdminRoute, loading, user, isAdmin, navigate]);

  // Admin login page renders standalone (no site header/footer)
  if (isAdminLogin) {
    if (user && isAdmin) {
      navigate({ name: "admin" });
      return null;
    }
    return <AdminLoginPage />;
  }

  // Admin pages render with admin layout (guard handled by redirect above)
  if (isAdminRoute) {
    if (loading || !user || !isAdmin) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-900">
          <Loader2 className="animate-spin text-amber-500" size={32} />
        </div>
      );
    }
    return (
      <>
        {route.name === "admin" && <AdminDashboardPage />}
        {route.name === "admin-novels" && <AdminNovelsPage />}
        {route.name === "admin-novel-edit" && <AdminNovelEditPage slug={route.slug} />}
        {route.name === "admin-chapters" && <AdminChaptersPage slug={route.slug} />}
        {route.name === "admin-chapter-edit" && <AdminChapterEditPage slug={route.slug} chapter={route.chapter} />}
        {route.name === "admin-import" && (
          <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-amber-500" size={32} /></div>}>
            <AdminImportPage />
          </Suspense>
        )}
      </>
    );
  }

  // Public site
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-900">
      {!isReader && <Header />}
      <main className="flex-1">
        {route.name === "home" && <HomePage />}
        {route.name === "novel" && <NovelDetailPage slug={route.slug} />}
        {route.name === "reader" && <ChapterReaderPage slug={route.slug} chapter={route.chapter} />}
        {route.name === "search" && <SearchPage initialQuery={route.query} />}
        {route.name === "favorites" && <FavoritesPage />}
      </main>
      {!isReader && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <RouterProvider>
          <AdminAuthProvider>
            <Pages />
          </AdminAuthProvider>
        </RouterProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
