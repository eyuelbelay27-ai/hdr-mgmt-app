import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { PRICING_TOOLS, findTool } from "@/lib/pricing/tools";
import { AppNav } from "../AppNav";
import { ToolFrame } from "./ToolFrame";
import { PinPanel } from "./PinPanel";

export default async function PricingPage({ searchParams }: { searchParams: { tool?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!canSeePage(user, "pricing")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="pricing" />
        <main className="app-main">
          <h1 style={{ marginTop: 0 }}>Pricing</h1>
          <p className="label">You don&apos;t have access to Pricing.</p>
        </main>
      </div>
    );
  }

  const tool = searchParams.tool ? findTool(searchParams.tool) : null;
  const settings = tool ? null : await prisma.pricingSettings.findUnique({ where: { id: "singleton" } });

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="pricing" />
      <main className="app-main">
        {tool ? (
          <ToolFrame id={tool.id} title={tool.title} />
        ) : (
          <div className="prc-home">
            <h1>What are you pricing today?</h1>
            <p className="prc-lead">
              Choose a tool. Each one has its own settings and invoice numbers, shared by the whole team on every device.
            </p>
            <div className="prc-grid">
              {PRICING_TOOLS.map((t) => (
                <Link key={t.id} href={`/pricing?tool=${t.id}`} className="prc-card">
                  <span className="prc-icon" aria-hidden>{t.icon}</span>
                  <h3>{t.title}</h3>
                  <p>{t.desc}</p>
                  <span className="prc-go">Open {t.title} →</span>
                </Link>
              ))}
            </div>
            <PinPanel pinSet={!!settings?.pinHash} isAppAdmin={can(user, "manageUsers")} />
          </div>
        )}
      </main>
    </div>
  );
}
