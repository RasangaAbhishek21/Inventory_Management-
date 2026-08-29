import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar, type NavContext } from "@/components/nav/Sidebar";
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
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-page"
      >
        Skip to content
      </a>
      <Sidebar ctx={ctx} />
      <main
        id="content"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5 md:px-8 md:py-8"
      >
        <InstallPrompt />
        {children}
      </main>
    </div>
  );
}
