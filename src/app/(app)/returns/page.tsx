import { requireUser } from "@/lib/auth";
import { getPickerData, getLocations, STORAGE_RENDER_BASE } from "@/lib/capture-data";
import { CaptureForm } from "@/components/capture/CaptureForm";
import { t } from "@/strings";
import { recordReturn } from "./actions";

export default async function ReturnsPage() {
  const user = await requireUser();

  const [{ products, finishes }, locations] = await Promise.all([
    getPickerData(),
    getLocations(),
  ]);
  const isStaff = user.role === "staff";

  if (user.role === "finance") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t.capture.returnTitle}</h1>
        <p className="text-ink-60">{t.errors.forbidden}</p>
      </div>
    );
  }

  const usable = isStaff ? locations.filter((l) => l.id === user.homeLocationId) : locations;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.capture.returnTitle}</h1>
      <CaptureForm
        products={products}
        finishes={finishes}
        locations={usable.map((l) => ({ id: l.id, name: l.name }))}
        defaultLocationId={isStaff ? (user.homeLocationId ?? usable[0]?.id) : usable[0]?.id}
        lockLocation={isStaff}
        thumbBaseUrl={STORAGE_RENDER_BASE}
        action={recordReturn}
        submitLabel={t.capture.returnAction}
        orderNumber="optional"
        dateLabel={t.capture.transactionDate}
        notesLabel={t.capture.reasonNote}
      />
    </div>
  );
}
