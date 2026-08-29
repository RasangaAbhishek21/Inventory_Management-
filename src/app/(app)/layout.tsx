import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppChrome } from "@/components/nav/AppChrome";
import type { NavContext } from "@/components/nav/Sidebar";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  const isOps = user.role === "ops_manager" || user.role === "admin";
  const canCapture = user.role !== "finance";

  let homeCanOriginate = false;
  if (user.homeLocationId) {
    const { data: loc } = await supabase
      .from("locations")
      .select("can_originate")
      .eq("id", user.homeLocationId)
      .maybeSingle();
    homeCanOriginate = Boolean(loc?.can_originate);
  }

  let inboundCount = 0;
  if (canCapture) {
    let q = supabase.from("v_in_transit").select("id", { count: "exact", head: true });
    if (user.role === "staff" && user.homeLocationId) {
      q = q.eq("to_location_id", user.homeLocationId);
    }
    const { count } = await q;
    inboundCount = count ?? 0;
  }

  const ctx: NavContext = {
    fullName: user.fullName,
    locationName: user.homeLocationName,
    canCapture,
    canOriginate: homeCanOriginate || isOps,
    isOps,
    isAdmin: user.role === "admin",
    isReportViewer: user.role !== "staff",
    inboundCount,
  };

  return (
    <AppChrome ctx={ctx}>
      <InstallPrompt />
      {children}
    </AppChrome>
  );
}
