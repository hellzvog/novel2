import { useMemo } from "react";

interface CoverProps {
  title: string;
  hue: number;
  className?: string;
}

const palettes = [
  { from: "#1e3a8a", to: "#0ea5e9", accent: "#fbbf24" },
  { from: "#7c2d12", to: "#f97316", accent: "#fde68a" },
  { from: "#064e3b", to: "#10b981", accent: "#fef3c7" },
  { from: "#831843", to: "#ec4899", accent: "#fef9c3" },
  { from: "#1e1b4b", to: "#6366f1", accent: "#fca5a5" },
  { from: "#451a03", to: "#a16207", accent: "#fef3c7" },
  { from: "#0f172a", to: "#475569", accent: "#fb7185" },
  { from: "#3b0764", to: "#a855f7", accent: "#fcd34d" },
];

export default function Cover({ title, hue, className = "" }: CoverProps) {
  const palette = useMemo(() => palettes[((hue % palettes.length) + palettes.length) % palettes.length], [hue]);
  const initials = title
    .split(" ")
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`relative overflow-hidden rounded-lg shadow-md ${className}`}
      style={{
        background: `linear-gradient(155deg, ${palette.from}, ${palette.to})`,
      }}
    >
      <div className="absolute inset-0 opacity-25" style={{
        backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.4) 0%, transparent 50%)",
      }} />
      <div className="absolute top-0 left-0 h-1 w-full" style={{ background: palette.accent }} />
      <div className="absolute bottom-0 right-0 h-16 w-16 rounded-full opacity-20" style={{ background: palette.accent }} />
      <div className="relative flex h-full flex-col justify-between p-3">
        <span
          className="self-start rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black/70"
          style={{ background: palette.accent }}
        >
          Novel
        </span>
        <div className="flex items-end justify-between gap-2">
          <h3 className="font-serif text-sm font-bold leading-tight text-white drop-shadow-sm line-clamp-4">
            {title}
          </h3>
          <span className="font-serif text-2xl font-black text-white/30">{initials}</span>
        </div>
      </div>
    </div>
  );
}
