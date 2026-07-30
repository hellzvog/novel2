import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { adsenseConfig, isAdsEnabled, type AdPlacement } from "./adsense-config";

/**
 * Loads the Google AdSense loader script exactly once for the whole app.
 * The script tag is created with data-ad-client and inserted into <head>.
 * Safe to call from multiple components — the first call wins.
 */
let scriptLoaded = false;
let scriptLoading = false;

function loadAdSenseScript(publisherId: string): void {
  if (scriptLoaded || scriptLoading) return;
  if (typeof document === "undefined") return;
  scriptLoading = true;

  const existing = document.getElementById("adsense-loader") as HTMLScriptElement | null;
  if (existing) {
    scriptLoaded = true;
    scriptLoading = false;
    return;
  }

  const s = document.createElement("script");
  s.id = "adsense-loader";
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
  s.dataset.adClient = publisherId;
  document.head.appendChild(s);

  s.addEventListener("load", () => {
    scriptLoaded = true;
    scriptLoading = false;
  });
  s.addEventListener("error", () => {
    scriptLoading = false;
  });
}

interface AdSenseContextValue {
  /** Whether ads should render right now (config enabled + not abuse-blocked). */
  canShowAds: boolean;
  /** Whether the user has been flagged for suspicious behavior this session. */
  abuseBlocked: boolean;
  /** Seconds remaining in the abuse cooldown, or 0. */
  cooldownRemaining: number;
  /** Record a navigation event for abuse detection. */
  recordNavigation: () => void;
  /** Resolve the slot ID for a placement, or empty string if none configured. */
  resolveSlot: (placement: AdPlacement) => string;
}

const AdSenseContext = createContext<AdSenseContextValue | null>(null);

export function useAdSense(): AdSenseContextValue {
  const ctx = useContext(AdSenseContext);
  if (!ctx) {
    throw new Error("useAdSense must be used within an AdSenseProvider");
  }
  return ctx;
}

/**
 * Provider that loads the AdSense script once, tracks session-level abuse,
 * and exposes a single context for all AdBanner components.
 *
 * Abuse detection is purely behavioral (navigation frequency). It never
 * inspects AdSense iframes or attempts to detect ad clicks.
 */
export function AdSenseProvider({ children }: { children: ReactNode }) {
  const [abuseBlocked, setAbuseBlocked] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const navTimestamps = useRef<number[]>([]);
  const blockedAt = useRef<number | null>(null);

  // Load the script once when ads are enabled.
  useEffect(() => {
    if (isAdsEnabled()) {
      loadAdSenseScript(adsenseConfig.publisherId);
    }
  }, []);

  // Cooldown countdown timer.
  useEffect(() => {
    if (!abuseBlocked) return;
    const tick = () => {
      if (blockedAt.current === null) return;
      const elapsed = Date.now() - blockedAt.current;
      const remaining = Math.max(0, Math.ceil((adsenseConfig.abuse.cooldownMs - elapsed) / 1000));
      setCooldownRemaining(remaining);
      if (remaining === 0) {
        setAbuseBlocked(false);
        blockedAt.current = null;
        navTimestamps.current = [];
      }
    };
    const id = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(id);
  }, [abuseBlocked]);

  const recordNavigation = () => {
    if (!isAdsEnabled()) return;
    const now = Date.now();
    const { windowMs, maxNavigations } = adsenseConfig.abuse;
    navTimestamps.current = navTimestamps.current.filter((t) => now - t < windowMs);
    navTimestamps.current.push(now);
    if (navTimestamps.current.length > maxNavigations) {
      setAbuseBlocked(true);
      blockedAt.current = now;
    }
  };

  const resolveSlot = (placement: AdPlacement): string => {
    return adsenseConfig.slots[placement] ?? "";
  };

  const canShowAds = isAdsEnabled() && !abuseBlocked;

  return (
    <AdSenseContext.Provider value={{ canShowAds, abuseBlocked, cooldownRemaining, recordNavigation, resolveSlot }}>
      {children}
    </AdSenseContext.Provider>
  );
}
