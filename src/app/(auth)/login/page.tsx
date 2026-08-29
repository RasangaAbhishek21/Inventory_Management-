import { LoginForm } from "./login-form";
import { t } from "@/strings";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">{t.appName}</h1>
        <p className="mt-1 text-ink-60">{t.auth.signInTitle}</p>
      </div>
      <LoginForm next={next} />
    </main>
  );
}
