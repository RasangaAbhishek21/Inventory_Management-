import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/(auth)/login/actions";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { t } from "@/strings";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <a
        href="#content"
        className="sr-only rounded-lg bg-ink px-3 py-2 text-page focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10"
      >
        Skip to content
      </a>

      <header className="flex items-center justify-between border-b border-sand px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          {t.appName}
        </Link>
        <form action={signOut}>
          <button type="submit" className="text-sm text-ink-60 underline">
            {t.auth.signOut}
          </button>
        </form>
      </header>

      <main id="content" className="flex flex-1 flex-col gap-4 px-4 py-4">
        <InstallPrompt />
        {children}
      </main>

      <footer className="border-t border-sand px-4 py-3 text-sm text-ink-60">
        {user.fullName}
        {user.homeLocationName ? ` · ${user.homeLocationName}` : ` · ${t.home.noLocation}`}
      </footer>
    </div>
  );
}
