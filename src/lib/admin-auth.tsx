import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "./supabase";

interface AdminUser {
  id: string;
  email: string;
}

interface AdminAuthValue {
  user: AdminUser | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

const TOKEN_KEY = "lumen_admin_token";

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.rpc("admin_verify_token", { p_token: token });
        if (error || !data || !data.valid) {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
        } else {
          setUser({ id: data.user.id, email: data.user.email });
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      }
      setLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.rpc("admin_login", {
      p_email: email,
      p_password: password,
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    if (!data?.token) throw new Error("Login failed");

    localStorage.setItem(TOKEN_KEY, data.token);
    setUser({ id: data.user.id, email: data.user.email });
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AdminAuthContext.Provider value={{ user, loading, isAdmin: !!user, signIn, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
