import { type LucideIcon } from "lucide-react";
import { useRouter, type Route } from "../lib/router";

interface NotFoundProps {
  icon: LucideIcon;
  title: string;
  message: string;
  backLabel?: string;
  backRoute?: Route;
}

export default function NotFound({ icon: Icon, title, message, backLabel = "Back to Home", backRoute = { name: "home" } }: NotFoundProps) {
  const { navigate } = useRouter();
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <Icon className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={48} />
      <h1 className="mb-2 font-serif text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
      <p className="text-slate-500 dark:text-slate-400">{message}</p>
      <button
        onClick={() => navigate(backRoute)}
        className="mt-6 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400"
      >
        {backLabel}
      </button>
    </div>
  );
}
