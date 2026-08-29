import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// Next 16: this file convention replaces `middleware.ts`. Same behaviour.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * All request paths except:
     *  - _next/static, _next/image
     *  - favicon, manifest, icons and other image assets
     *  - the service worker and the offline fallback (must work with no session)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|icons/|sw.js|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
