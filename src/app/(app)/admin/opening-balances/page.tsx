import { requireRole } from "@/lib/auth";
import { openingAlreadyImported } from "./actions";
import { OpeningBalancesImport } from "./import-client";
import { t } from "@/strings";

export default async function OpeningBalancesPage() {
  await requireRole("admin");
  const alreadyImported = await openingAlreadyImported();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.opening.title}</h1>
      <p className="text-ink-60">{t.opening.intro}</p>
      <p className="text-sm text-ink-60">{t.opening.columns}</p>

      {alreadyImported ? (
        <p className="rounded-lg border border-amber bg-surface p-3 text-sm text-amber">
          {t.opening.alreadyImported}
        </p>
      ) : null}

      <OpeningBalancesImport alreadyImported={alreadyImported} />
    </div>
  );
}
