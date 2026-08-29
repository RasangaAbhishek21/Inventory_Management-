/**
 * The single configuration module (build brief §3).
 *
 * Every tunable number in the system lives here. Do not scatter magic numbers
 * through the code. Anything the database also needs (the adjustment-exception
 * thresholds) is mirrored into the `app_config` table by a migration that reads
 * these values — see supabase/migrations. Changing a threshold that the DB uses
 * therefore means a new migration, not just an edit here.
 */
export const config = {
  /** Staff may backdate a movement at most this many days. admin/ops_manager: no lower bound. Brief §5.6. */
  BACKDATE_LIMIT_DAYS: 30,

  /** An adjustment with abs(quantity) >= this appears on the monthly exceptions report. Brief §5.5. */
  ADJ_QTY_EXCEPTION: 3,
  /** An adjustment with abs(quantity * unit_selling_price) >= this appears on the monthly exceptions report. Brief §5.5. */
  ADJ_VALUE_EXCEPTION: 100_000,

  /** Inbound-transfer age badge turns amber past this many hours. Brief §8.4. */
  RECEIPT_AGE_AMBER_HOURS: 24,
  /** Inbound-transfer age badge turns red past this many hours. Brief §8.4. */
  RECEIPT_AGE_RED_HOURS: 48,

  /** In-transit report age badge thresholds (hours). Brief §8.10. */
  IN_TRANSIT_AGE_AMBER_HOURS: 24,
  IN_TRANSIT_AGE_RED_HOURS: 48,

  /** All dates are interpreted in this zone. `transaction_date` is a plain date, so "today" = today here. */
  APP_TZ: "Asia/Colombo",

  /** Product images are compressed client-side and rejected above this size. Brief §8.11. */
  MAX_IMAGE_BYTES: 2_000_000,

  /** Currency display. No multi-currency (brief §2); this is presentation only. */
  CURRENCY_CODE: "LKR",
  CURRENCY_LOCALE: "en-LK",
} as const;

export type Config = typeof config;
