/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  readonly VITE_ADSENSE_PUBLISHER_ID?: string;
  readonly VITE_ADSENSE_ENABLED?: string;
  readonly VITE_ADSENSE_TEST_MODE?: string;
  readonly VITE_ADSENSE_SLOT_HOME?: string;
  readonly VITE_ADSENSE_SLOT_BROWSE?: string;
  readonly VITE_ADSENSE_SLOT_SEARCH?: string;
  readonly VITE_ADSENSE_SLOT_NOVEL?: string;
  readonly VITE_ADSENSE_SLOT_READER?: string;
}

interface Window {
  adsbygoogle?: unknown[];
}
