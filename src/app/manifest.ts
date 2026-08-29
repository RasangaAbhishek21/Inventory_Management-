import type { MetadataRoute } from "next";
import { t } from "@/strings";

/**
 * PWA manifest (brief §3 — installed to Android home screen). No offline mode and no
 * service-worker sync queue (brief §2); a minimal Serwist SW for shell precache is added
 * in step 10, along with a dedicated maskable icon set.
 *
 * `/icon` is the Next-generated icon (src/app/icon.tsx).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t.appName,
    short_name: "Home 47",
    description: "Finished-goods stock for Home 47 — record movements, check availability.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f1eb",
    theme_color: "#1a1a1a",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
    ],
  };
}
