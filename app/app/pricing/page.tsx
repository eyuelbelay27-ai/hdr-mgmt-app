import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Lightbulb, Zap, RectangleHorizontal, Signpost, type LucideIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { PRICING_TOOLS, findTool, type PricingTool } from "@/lib/pricing/tools";
import { AppNav } from "../AppNav";
import { ToolFrame } from "./ToolFrame";
import { PinPanel } from "./PinPanel";

const ICONS: Record<PricingTool["id"], LucideIcon> = {
  lightbox: Lightbulb,
  neon: Zap,
  tapela: RectangleHorizontal,
  hanger: Signpost,
};

const SHORT: Record<PricingTool["id"], string> = {
  lightbox: "Material cost breakdown, formulas & invoice",
  neon: "Readymade designs or custom size",
  tapela: "Readymade designs or custom size",
  hanger: "Readymade signs with UV / colour board",
};

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Addis_Ababa" });
}

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
  if (tool) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="pricing" />
        <main className="app-main">
          <ToolFrame id={tool.id} title={tool.title} />
        </main>
      </div>
    );
  }

  const year = new Date().getFullYear();
  const [settings, counters, edits] = await Promise.all([
    prisma.pricingSettings.findUnique({ where: { id: "singleton" } }),
    prisma.pricingCounter.findMany(),
    prisma.pricingStore.findMany({ select: { key: true, updatedAt: true, updatedBy: true }, orderBy: { updatedAt: "desc" } }),
  ]);
  const invoices = (id: PricingTool["id"]) =>
    id === "lightbox"
      ? counters.find((c) => c.key === `lightbox:${year}`)?.value ?? 0
      : counters.find((c) => c.key === id)?.value ?? 0;
  const lastEdit = (id: PricingTool["id"]) => edits.find((e) => e.key.startsWith(`${id}:`)) ?? null;
  const totalInvoices = PRICING_TOOLS.reduce((s, t) => s + invoices(t.id), 0);

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="pricing" />
      <main className="app-main">
        <section className="card dash-hero prc-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="dash-hero-watermark" src="/brand/hadar-mark.png" alt="" />
          <div>
            <div className="label" style={{ marginBottom: 2 }}>Pricing</div>
            <h1>What are you pricing today?</h1>
          </div>
          <div className="prc-hero-stats">
            <span><b className="mono">{PRICING_TOOLS.length}</b> tools</span>
            <span><b className="mono">{totalInvoices}</b> invoices issued</span>
            <span className={settings?.pinHash ? "prc-pin-on" : "prc-pin-off"}>
              {settings?.pinHash ? "Settings protected by PIN" : "No Settings PIN yet"}
            </span>
          </div>
        </section>

        <div className="prc-tools">
          {PRICING_TOOLS.map((t) => {
            const Icon = ICONS[t.id];
            const edit = lastEdit(t.id);
            const n = invoices(t.id);
            return (
              <Link key={t.id} href={`/pricing?tool=${t.id}`} className="card prc-tool-card">
                <span className="dash-stat-icon prc-tool-icon"><Icon size={20} strokeWidth={2} /></span>
                <span className="prc-tool-body">
                  <span className="prc-tool-name font-display">{t.title.replace(" Sign Pricing", "")}</span>
                  <span className="prc-tool-desc">{SHORT[t.id]}</span>
                  <span className="prc-tool-meta">
                    <span className="badge prc-badge">{n} invoice{n === 1 ? "" : "s"}{t.id === "lightbox" ? ` in ${year}` : ""}</span>
                    {edit && <span className="prc-tool-edit">Prices updated {shortDate(edit.updatedAt)} · {edit.updatedBy}</span>}
                  </span>
                </span>
                <ChevronRight size={18} strokeWidth={2} className="prc-tool-chevron" />
              </Link>
            );
          })}
        </div>

        <PinPanel pinSet={!!settings?.pinHash} isAppAdmin={can(user, "manageUsers")} />
      </main>
    </div>
  );
}
