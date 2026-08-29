import { requireUser } from "@/lib/auth";
import { getPickerData, getLocations, STORAGE_RENDER_BASE } from "@/lib/capture-data";
import { CaptureForm } from "@/components/capture/CaptureForm";
import { t } from "@/strings";
import { recordOrigination } from "./actions";

export default async function OriginatePage() {
  const user = await requireUser();

  const [{ products, finishes }, locations] = await Promise.all([
    getPickerData(),
    getLocations(),
  ]);
  const originating = locations.filter((l) => l.can_originate);
  const isStaff = user.role === "staff";
  const homeCanOriginate = originating.some((l) => l.id === user.homeLocationId);

  if (user.role === "finance" || (isStaff && !homeCanOriginate)) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t.capture.originateTitle}</h1>
        <p className="text-ink-60">{t.capture.cannotOriginateHere}</p>
      </div>
    );
  }

  const usable = isStaff
    ? originating.filter((l) => l.id === user.homeLocationId)
    : originating;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.capture.originateTitle}</h1>
      <CaptureForm
        products={products}
        finishes={finishes}
        locations={usable.map((l) => ({ id: l.id, name: l.name }))}
        defaultLocationId={
          isStaff ? (user.homeLocationId ?? usable[0]?.id) : usable[0]?.id
        }
        lockLocation={isStaff}
        thumbBaseUrl={STORAGE_RENDER_BASE}
        action={recordOrigination}
        submitLabel={t.capture.originateAction}
        dateLabel={t.capture.transactionDate}
      />
    </div>
  );
}
