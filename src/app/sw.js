import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

// Minimal service worker (brief §10). Precache the app shell, serve an offline page
// for navigations that fail. NO offline write queue (brief §2) — `defaultCache` is
// network-first for pages and never buffers failed POSTs.

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
