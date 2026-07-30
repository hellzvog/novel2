import type { CSSProperties } from "react";
import { useEffect, useRef, useState, memo } from "react";
import { useAdSense } from "../lib/adsense";
import type { AdPlacement } from "../lib/adsense-config";

type AdFormat = "banner" | "rectangle" | "in-article";

interface AdBannerProps {
  placement: AdPlacement;
  format?: AdFormat;
  /** Tailwind classes for the outer wrapper. */
  className?: string;
  /** Optional label shown above the ad slot (e.g. "Advertisement"). */
  label?: string;
}

const FORMAT_TO_ADSBYGOOGLE: Record<AdFormat, string> = {
  banner: "auto",
  rectangle: "rectangle",
  "in-article": "fluid",
};

const FORMAT_TO_LAYOUT: Record<AdFormat, CSSProperties> = {
  banner: { display: "block" },
  rectangle: { display: "block" },
  "in-article": { display: "block", textAlign: "center" },
};

const FORMAT_TO_MIN_HEIGHT: Record<AdFormat, string> = {
  banner: "90px",
  rectangle: "250px",
  "in-article": "200px",
};

/**
 * Renders a single Google AdSense ad unit.
 *
 * - Renders nothing when ads are disabled, the publisher ID is missing,
 *   the slot is unconfigured, or abuse protection is active.
 * - Lazy-loads via IntersectionObserver so off-screen ads are not pushed.
 * - Reserves space with a min-height to prevent layout shift.
 * - Pushes (adsbygoogle = window.adsbygoogle || []).push({}) exactly once
 *   per mounted instance, guarded against duplicate rendering.
 */
function AdBannerImpl({ placement, format = "banner", className = "", label = "Advertisement" }: AdBannerProps) {
  const { canShowAds, resolveSlot } = useAdSense();
  const slotId = resolveSlot(placement);
  const containerRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);
  const [visible, setVisible] = useState(false);

  // Lazy load: only mark visible when the slot scrolls into view.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Push the ad to AdSense once visible and not already pushed.
  useEffect(() => {
    if (!visible || pushedRef.current) return;
    if (!canShowAds || !slotId) return;
    pushedRef.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      // AdSense not ready yet — no-op, no console spam.
    }
  }, [visible, canShowAds, slotId]);

  if (!canShowAds || !slotId) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`mx-auto w-full overflow-hidden ${className}`}
      style={{ minHeight: FORMAT_TO_MIN_HEIGHT[format] }}
      aria-label="advertisement"
    >
      {label && (
        <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
      )}
      {visible && (
        <ins
          className="adsbygoogle"
          style={FORMAT_TO_LAYOUT[format]}
          data-ad-client={import.meta.env.VITE_ADSENSE_PUBLISHER_ID}
          data-ad-slot={slotId}
          data-ad-format={FORMAT_TO_ADSBYGOOGLE[format]}
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
}

export const AdBanner = memo(AdBannerImpl);
export default AdBanner;
