import { describe, it, expect } from "vitest";
import { config } from "@/config";
import { formatQty, formatValue } from "@/lib/format";

describe("config", () => {
  it("carries the brief's default thresholds", () => {
    expect(config.BACKDATE_LIMIT_DAYS).toBe(30);
    expect(config.ADJ_QTY_EXCEPTION).toBe(3);
    expect(config.ADJ_VALUE_EXCEPTION).toBe(100_000);
    expect(config.RECEIPT_AGE_AMBER_HOURS).toBe(24);
    expect(config.RECEIPT_AGE_RED_HOURS).toBe(48);
  });
});

describe("format", () => {
  it("groups thousands and fixes 2dp for values", () => {
    expect(formatValue(1234)).toBe("1,234.00");
    expect(formatValue(null)).toBe("—");
  });
  it("renders whole-unit quantities", () => {
    expect(formatQty(1200)).toBe("1,200");
    expect(formatQty(null)).toBe("—");
  });
});
