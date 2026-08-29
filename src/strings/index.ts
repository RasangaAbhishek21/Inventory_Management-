import { en, type Strings } from "./en";

/**
 * Locale accessor. English only for v2 (brief §9, assumption 4). When Sinhala is
 * added, this switches on a cookie/profile preference and returns `si` instead —
 * no component changes required.
 */
export const t: Strings = en;

export type { Strings };
