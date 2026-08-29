import { requireUser } from "@/lib/auth";
import { getPickerData, getLocations, STORAGE_RENDER_BASE } from "@/lib/capture-data";
import { CaptureForm } from "@/components/capture/CaptureForm";
import { t } from "@/strings";
import { recordDelivery } from "./actions";

export default async function DeliverPage() {
  const user = await requireUser();

  const [{ products, finishes }, locations] = await Promise.all([
    getPickerData(),
    getLocations(),
  ]);
  const isStaff = user.role === "staff";

  if (user.role === "finance") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t.capture.deliverTitle}</h1>
        <p className="text-ink-60">{t.errors.forbidden}</p>
      </div>
    );
  }

  const usable = isStaff ? locations.filter((l) => l.id === user.homeLocationId) : locations;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t.capture.deliverTitle}</h1>
      <CaptureForm
        products={products}
        finishes={finishes}
        locations={usable.map((l) => ({ id: l.id, name: l.name }))}
        defaultLocationId={isStaff ? (user.homeLocationId ?? usable[0]?.id) : usable[0]?.id}
        lockLocation={isStaff}
        thumbBaseUrl={STORAGE_RENDER_BASE}
        action={recordDelivery}
        submitLabel={t.capture.deliverAction}
        orderNumber="required"
        dateLabel={t.capture.deliveryDate}
      />
    </div>
  );
}
