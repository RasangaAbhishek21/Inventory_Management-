import { requireRole } from "@/lib/auth";

/** Reports are for ops_manager / finance / admin — staff do not run reports (brief §7). */
export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("ops_manager", "finance", "admin");
  return <>{children}</>;
}
