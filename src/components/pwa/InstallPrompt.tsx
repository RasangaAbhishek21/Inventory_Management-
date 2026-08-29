"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "h47-install-dismissed";

/** Android "add to home screen" prompt (brief §10). Dismissible; stays dismissed. */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // storage unavailable — just show the prompt when it fires
    }
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!evt) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setEvt(null);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-yellow px-4 py-3 text-ink">
      <span className="text-sm font-medium">Add Home 47 to your home screen.</span>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={async () => {
            await evt.prompt();
            setEvt(null);
          }}
          className="rounded-lg border border-ink px-3 py-1.5 text-sm font-semibold"
        >
          Install
        </button>
        <button type="button" onClick={dismiss} className="px-2 text-sm">
          Not now
        </button>
      </div>
    </div>
  );
}
