import { useEffect, lazy, Suspense } from "react";
import { RouterProvider, useRouter } from "./lib/router";
import { ThemeProvider } from "./lib/theme";
import { AdminAuthProvider, useAdminAuth } from "./lib/admin-auth";
import { AdSenseProvider, useAdSense } from "./lib/adsense";
import { useSeo } from "./lib/seo";
import ErrorBoundary from "./components/ErrorBoundary";
import Header from "./components/Header";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import NovelDetailPage from "./pages/NovelDetailPage";
import ChapterReaderPage from "./pages/ChapterReaderPage";
import SearchPage from "./pages/SearchPage";
import FavoritesPage from "./pages/FavoritesPage";
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const DmcaPage = lazy(() => import("./pages/DmcaPage"));
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminNovelsPage = lazy(() => import("./pages/admin/AdminNovelsPage"));
const AdminNovelEditPage = lazy(() => import("./pages/admin/AdminNovelEditPage"));
const AdminChaptersPage = lazy(() => import("./pages/admin/AdminChaptersPage"));
const AdminChapterEditPage = lazy(() => import("./pages/admin/AdminChapterEditPage"));
const AdminImportPage = lazy(() => import("./pages/admin/AdminImportPage"));
const AdminGenresPage = lazy(() => import("./pages/admin/AdminGenresPage"));
import { Loader2 } from "lucide-react";

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="animate-spin text-amber-500" size={32} />
    </div>
  );
}

const ADMIN_ROUTES = new Set(["admin", "admin-novels", "admin-novel-edit", "admin-chapters", "admin-chapter-edit", "admin-import", "admin-genres"]);

function Pages() {
  const { route, navigate } = useRouter();
  const { user, loading, isAdmin } = useAdminAuth();
  const { recordNavigation } = useAdSense();
  const isReader = route.name === "reader";
  const isAdminLogin = route.name === "admin-login";
  const isAdminRoute = ADMIN_ROUTES.has(route.name);

  // Record navigations for session-level abuse detection.
  useEffect(() => {
    recordNavigation();
  }, [route, recordNavigation]);

  // Redirect to login if accessing admin routes without auth
  useEffect(() => {
    if (isAdminRoute && !loading && (!user || !isAdmin)) {
      navigate({ name: "admin-login" });
    }
  }, [isAdminRoute, loading, user, isAdmin, navigate]);

  // Admin login page renders standalone (no site header/footer)
  if (isAdminLogin) {
    useSeo({ title: "Admin Login - AddNovel", path: "/admin/login", robots: "noindex" });
    if (user && isAdmin) {
      navigate({ name: "admin" });
      return null;
    }
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-amber-500" size={32} /></div>}>
        <AdminLoginPage />
      </Suspense>
    );
  }

  // Admin pages render with admin layout (guard handled by redirect above)
  if (isAdminRoute) {
    useSeo({ title: "Admin - AddNovel", path: "/admin", robots: "noindex" });
    if (loading || !user || !isAdmin) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-900">
          <Loader2 className="animate-spin text-amber-500" size={32} />
        </div>
      );
    }
    return (
      <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-amber-500" size={32} /></div>}>
        {route.name === "admin" && <AdminDashboardPage />}
        {route.name === "admin-novels" && <AdminNovelsPage />}
        {route.name === "admin-novel-edit" && <AdminNovelEditPage slug={route.slug} />}
        {route.name === "admin-chapters" && <AdminChaptersPage slug={route.slug} />}
        {route.name === "admin-chapter-edit" && <AdminChapterEditPage slug={route.slug} chapter={route.chapter} />}
        {route.name === "admin-import" && <AdminImportPage />}
        {route.name === "admin-genres" && <AdminGenresPage />}
      </Suspense>
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
        {route.name === "search" && <SearchPage initialQuery={route.query} initialGenre={route.genre} initialStatus={route.status} />}
        {route.name === "favorites" && <FavoritesPage />}
        {route.name === "about" && <Suspense fallback={<PageLoader />}><AboutPage /></Suspense>}
        {route.name === "contact" && <Suspense fallback={<PageLoader />}><ContactPage /></Suspense>}
        {route.name === "privacy" && <Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense>}
        {route.name === "terms" && <Suspense fallback={<PageLoader />}><TermsPage /></Suspense>}
        {route.name === "dmca" && <Suspense fallback={<PageLoader />}><DmcaPage /></Suspense>}
      </main>
      {!isReader && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AdSenseProvider>
          <RouterProvider>
            <AdminAuthProvider>
              <Pages />
            </AdminAuthProvider>
          </RouterProvider>
        </AdSenseProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
