import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { t } from "@/strings";

/** Admin is for ops_manager / admin. Finance is also allowed in, but only reaches
 *  Product costs (each sub-route guards itself further). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("ops_manager", "admin", "finance");
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin" className="text-sm text-ink-60 underline">
        ← {t.admin.title}
      </Link>
      {children}
    </div>
  );
}
