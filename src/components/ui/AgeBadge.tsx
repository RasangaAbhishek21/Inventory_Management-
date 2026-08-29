import { config } from "@/config";
import { t } from "@/strings";

/** Age indicator for inbound transfers / in-transit (brief §8.4). Amber past the
 *  amber threshold, muted red past the red threshold. */
export function AgeBadge({
  hours,
  amberAt = config.RECEIPT_AGE_AMBER_HOURS,
  redAt = config.RECEIPT_AGE_RED_HOURS,
}: {
  hours: number;
  amberAt?: number;
  redAt?: number;
}) {
  const tone =
    hours >= redAt ? "bg-danger text-page" : hours >= amberAt ? "bg-amber text-page" : "bg-sand text-ink";
  return (
    <span className={`num rounded-full px-2 py-0.5 text-sm ${tone}`}>
      {t.capture.ageHours(Math.floor(hours))}
    </span>
  );
}
