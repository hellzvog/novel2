import { useState } from "react";
import { BookOpen, Loader2, Lock, Mail, AlertCircle } from "lucide-react";
import { useAdminAuth } from "../../lib/admin-auth";
import { useRouter } from "../../lib/router";

export default function AdminLoginPage() {
  const { signIn } = useAdminAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate({ name: "admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 shadow-lg shadow-amber-500/20">
            <BookOpen size={28} className="text-white" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white">LumenAdmin</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to manage your novel platform</p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-800 bg-rose-900/30 p-3 text-sm text-rose-300">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition-colors focus:border-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition-colors focus:border-amber-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400 disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Sign In"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          LumenNovel Admin CMS — authorized personnel only
        </p>
      </div>
    </div>
  );
}
