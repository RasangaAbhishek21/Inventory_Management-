import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  csvResponse,
  toCsv,
  getStockOnHand,
  getMovementRows,
  getInTransit,
  getAdjustmentExceptions,
  getStockAccuracy,
  monthStart,
} from "@/lib/reports";
import { formatValue } from "@/lib/format";
import type { MovementType } from "@/types/database";

const SELLING = "Value at selling price";
const STANDARD = "Value at standard cost";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role === "staff") {
    return new Response("Forbidden", { status: 403 });
  }

  const { name: reportName } = await params;
  // Brief §5.5 — the exceptions report is finance / admin only.
  if (reportName === "adjustment-exceptions" && !["finance", "admin"].includes(user.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const name = reportName;
  const sp = request.nextUrl.searchParams;
  const supabase = await createClient();
  const arg = (k: string) => sp.get(k) || null;

  try {
    if (name === "stock-on-hand" || name === "close-pack") {
      const asAt = arg("as_at") ?? arg("month_end") ?? undefined;
      const { rows, asAt: at } = await getStockOnHand(supabase, {
        asAt,
        locationId: arg("location"),
        categoryId: arg("category"),
      });
      const csv = toCsv(
        ["Location", "Product", "Finish", "Category", "Quantity", SELLING, STANDARD],
        rows.map((r) => [
          r.location,
          r.product,
          r.finish ?? "",
          r.category ?? "",
          r.quantity,
          formatValue(r.valueAtSelling),
          formatValue(r.valueAtStandardCost),
        ]),
      );
      const prefix = name === "close-pack" ? "close-pack" : "stock-on-hand";
      return csvResponse(`${prefix}-${at}.csv`, csv);
    }

    if (name === "movement") {
      const { rows, from, to } = await getMovementRows(supabase, {
        from: arg("from") ?? undefined,
        to: arg("to") ?? undefined,
        locationId: arg("location"),
        productId: arg("product"),
        finishId: arg("finish"),
        type: (arg("type") as MovementType | null) ?? null,
        userId: arg("user"),
      });
      const csv = toCsv(
        ["ID", "Date", "Type", "Location", "Product", "Finish", "Quantity", SELLING, "Reference", "Entered by", "Entered at", "Reverses"],
        rows.map((r) => [
          r.id,
          r.date,
          r.type,
          r.location,
          r.product,
          r.finish ?? "",
          r.quantity,
          formatValue(r.valueAtSelling),
          r.reference ?? "",
          r.enteredBy,
          r.enteredAt,
          r.reverses ?? "",
        ]),
      );
      return csvResponse(`stock-movement-${from}_to_${to}.csv`, csv);
    }

    if (name === "in-transit") {
      const rows = await getInTransit(supabase);
      const csv = toCsv(
        ["Transfer", "From", "To", "Dispatched", "Age (hours)", "Lines", "Dispatched by", SELLING],
        rows.map((r) => [
          r.transfer_ref,
          r.from_location,
          r.to_location,
          r.dispatch_date,
          r.age_hours,
          r.line_count,
          r.dispatched_by_name,
          formatValue(Number(r.value_at_selling_price)),
        ]),
      );
      return csvResponse(`in-transit-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    }

    if (name === "adjustment-exceptions") {
      const month = monthStart(arg("month"));
      const rows = await getAdjustmentExceptions(supabase, month);
      const csv = toCsv(
        ["Date", "Location", "Product", "Finish", "Quantity", SELLING, "Reason", "Note", "Entered by"],
        rows.map((r) => [
          r.date,
          r.location,
          r.product,
          r.finish ?? "",
          r.quantity,
          formatValue(r.valueAtSelling),
          r.reason ?? "",
          r.notes ?? "",
          r.enteredBy,
        ]),
      );
      return csvResponse(`adjustment-exceptions-${month.slice(0, 7)}.csv`, csv);
    }

    if (name === "stock-accuracy") {
      const rows = await getStockAccuracy(supabase, {
        locationId: arg("location"),
        month: arg("month") ? `${arg("month")}-01` : null,
      });
      const csv = toCsv(
        ["Month", "Location", "Lines counted", "Line accuracy", "Unit accuracy", "Units over", "Units short", "Net value impact"],
        rows.map((r) => [
          r.month,
          r.location,
          r.linesCounted,
          r.lineAccuracy == null ? "" : (r.lineAccuracy * 100).toFixed(1) + "%",
          r.unitAccuracy == null ? "" : (r.unitAccuracy * 100).toFixed(1) + "%",
          r.unitsOver,
          r.unitsShort,
          formatValue(r.netValueImpact),
        ]),
      );
      return csvResponse(`stock-accuracy-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    }

    return new Response("Unknown report", { status: 404 });
  } catch (err) {
    return new Response((err as Error).message, { status: 500 });
  }
}
