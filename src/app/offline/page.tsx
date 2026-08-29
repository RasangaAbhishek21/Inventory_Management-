import { t } from "@/strings";

export const dynamic = "force-static";

export const metadata = { title: `${t.appName} — Offline` };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="text-ink-60">
        Home 47 needs a connection to record movements and check stock. Reconnect and try again.
      </p>
    </main>
  );
}
