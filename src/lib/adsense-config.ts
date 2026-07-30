/**
 * Centralized Google AdSense configuration.
 *
 * All AdSense values are read from Vite environment variables so nothing is
 * hardcoded across the app. Set these in your `.env` file:
 *
 *   VITE_ADSENSE_PUBLISHER_ID=ca-pub-XXXXXXXXXXXXXXXX
 *   VITE_ADSENSE_ENABLED=true
 *   VITE_ADSENSE_TEST_MODE=false
 *   VITE_ADSENSE_SLOT_HOME=1234567890
 *   VITE_ADSENSE_SLOT_BROWSE=...
 *   VITE_ADSENSE_SLOT_NOVEL=...
 *   VITE_ADSENSE_SLOT_READER=...
 *
 * When the publisher ID is empty or ads are disabled, every AdBanner renders
 * nothing and the AdSense script is never loaded.
 */

export type AdPlacement = "home" | "browse" | "search" | "novel" | "reader";

interface AdSenseConfig {
  publisherId: string;
  enabled: boolean;
  testMode: boolean;
  slots: Record<AdPlacement, string>;
  /** Abuse-protection thresholds (session-based). */
  abuse: {
    /** Max page navigations within the window before ads are suppressed. */
    maxNavigations: number;
    /** Rolling window in ms during which navigations are counted. */
    windowMs: number;
    /** How long ads stay suppressed once triggered, in ms. */
    cooldownMs: number;
  };
}

const env = import.meta.env;

function readSlot(placement: AdPlacement): string {
  return (env[`VITE_ADSENSE_SLOT_${placement.toUpperCase()}`] as string | undefined) ?? "";
}

export const adsenseConfig: AdSenseConfig = {
  publisherId: (env.VITE_ADSENSE_PUBLISHER_ID as string | undefined) ?? "",
  enabled: ((env.VITE_ADSENSE_ENABLED as string | undefined) ?? "true") !== "false",
  testMode: ((env.VITE_ADSENSE_TEST_MODE as string | undefined) ?? "false") === "true",
  slots: {
    home: readSlot("home"),
    browse: readSlot("browse"),
    search: readSlot("search"),
    novel: readSlot("novel"),
    reader: readSlot("reader"),
  },
  abuse: {
    maxNavigations: 40,
    windowMs: 60_000,
    cooldownMs: 120_000,
  },
};

export function isAdsEnabled(): boolean {
  return adsenseConfig.enabled && !!adsenseConfig.publisherId;
}

export function getSlotId(placement: AdPlacement): string {
  return adsenseConfig.slots[placement];
}
