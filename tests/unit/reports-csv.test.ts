import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/reports";

describe("toCsv", () => {
  it("joins with CRLF and comma", () => {
    expect(toCsv(["A", "B"], [[1, 2], [3, 4]])).toBe("A,B\r\n1,2\r\n3,4");
  });

  it("quotes values containing comma, quote or newline", () => {
    const out = toCsv(
      ["Name", "Note"],
      [["Leo, Vertical", 'has "quotes"'], ["plain", "line\nbreak"]],
    );
    expect(out).toBe(
      'Name,Note\r\n"Leo, Vertical","has ""quotes"""\r\n' + 'plain,"line\nbreak"',
    );
  });

  it("renders null as empty", () => {
    expect(toCsv(["A"], [[null]])).toBe("A\r\n");
  });
});
