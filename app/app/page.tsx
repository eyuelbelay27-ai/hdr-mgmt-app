import { redirect } from "next/navigation";
import {
  FileEdit,
  Clock,
  CircleDollarSign,
  RefreshCw,
  ChevronRight,
  Wallet,
  ShoppingCart,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import { canSeePage, canSeeTab, type TabKey } from "@/lib/permissions";
import { remainingPayment } from "@/lib/calc/payments";
import { AppNav } from "./AppNav";
import { StatusBadge, DeadlineBadge } from "./StatusBadge";
import { PurchaseOrdersPanel } from "./PurchaseOrdersPanel";

const STATUS_CARDS: { tab: TabKey; label: string; status: JobStatus; icon: LucideIcon }[] = [
  { tab: "dash_draft", label: "Draft", status: "Draft", icon: FileEdit },
  { tab: "dash_approval", label: "Waiting for Approval", status: "WaitingForApproval", icon: Clock },
  { tab: "dash_budget", label: "Approved Budget", status: "ApprovedBudget", icon: CircleDollarSign },
  { tab: "dash_reconciliation", label: "Waiting for Reconciliation", status: "WaitingForReconciliation", icon: RefreshCw },
];

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "dashboard")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="dashboard" />
        <main className="app-main">
          <p className="label">You don&apos;t have access to the Dashboard.</p>
        </main>
      </div>
    );
  }

  const sp = await searchParams;
  const counts = await prisma.job.groupBy({ by: ["status"], _count: { _all: true } });
  const countFor = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;

  const statusCards = STATUS_CARDS.filter((c) => canSeeTab(user, c.tab)).map((c) => ({
    ...c,
    value: countFor(c.status),
  }));

  const openJobs = await prisma.job.findMany({
    where: { status: { notIn: ["Closed", "Cancelled"] } },
    include: { payments: true },
  });
  const remainingRows = openJobs
    .map((j) => ({ job: j, remaining: remainingPayment(j.costEstimateSoldPrice, j.payments) }))
    .filter((r) => r.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);
  const remainingTotal = Math.round(remainingRows.reduce((s, r) => s + r.remaining, 0) * 100) / 100;

  const showRemaining = canSeeTab(user, "dash_remaining");
  const showPO = canSeeTab(user, "dash_purchaseOrders");

  const activeTab = (["dash_draft", "dash_approval", "dash_budget", "dash_reconciliation", "dash_remaining", "dash_purchaseOrders"].includes(sp.tab ?? "")
    ? sp.tab
    : statusCards[0]?.tab ?? (showRemaining ? "dash_remaining" : showPO ? "dash_purchaseOrders" : undefined)) as TabKey | undefined;

  const activeStatus = STATUS_CARDS.find((c) => c.tab === activeTab)?.status;
  const activeJobs = activeStatus
    ? await prisma.job.findMany({ where: { status: activeStatus }, orderBy: { createdAt: "desc" } })
    : [];

  const greeting = greetingForHour(new Date().getHours());

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="dashboard" />
      <main className="app-main">
        <section className="card dash-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="dash-hero-watermark" src="/brand/hadar-mark.png" alt="" />
          <div className="dash-greeting-row">
            <div className="dash-avatar">{initialsFor(user.name)}</div>
            <div>
              <div className="label" style={{ marginBottom: 0 }}>{greeting},</div>
              <div className="font-display" style={{ fontSize: 16, fontWeight: 700 }}>{user.name}</div>
            </div>
          </div>
          <h1>Overview of your business status.</h1>
        </section>

        <div className="dash-stats-grid" style={{ marginTop: 16 }}>
          {statusCards.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.tab}
                href={`?tab=${c.tab}`}
                className="card dash-stat-card"
                style={{ borderColor: activeTab === c.tab ? "var(--accent)" : undefined }}
              >
                <span className="dash-stat-icon"><Icon size={19} strokeWidth={2} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="label" style={{ marginBottom: 2 }}>{c.label}</div>
                  <div className="dash-stat-value">{c.value}</div>
                </div>
                <ChevronRight size={16} strokeWidth={2} className="dash-stat-chevron" />
              </a>
            );
          })}
          {statusCards.length === 0 && !showRemaining && !showPO && (
            <p className="label">No dashboard tabs are enabled for your account.</p>
          )}
        </div>

        {(showRemaining || showPO) && (
          <div className="dash-lower-grid" style={{ marginTop: 12 }}>
            {showRemaining && (
              <a
                href="?tab=dash_remaining"
                className="dash-remaining-card"
                style={{ outline: activeTab === "dash_remaining" ? "2px solid var(--text)" : undefined }}
              >
                <span className="dash-remaining-icon"><Wallet size={18} strokeWidth={2} color="#fff" /></span>
                <div className="dash-remaining-label">Remaining Payments</div>
                <div className="dash-remaining-value">{remainingTotal.toLocaleString()} Br</div>
                <svg className="dash-remaining-sparkline" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true">
                  <path
                    d="M0,45 L40,38 L75,50 L110,30 L150,42 L190,20 L230,32 L265,12 L300,22 L300,60 L0,60 Z"
                    fill="rgba(255,255,255,0.16)"
                  />
                  <path
                    d="M0,45 L40,38 L75,50 L110,30 L150,42 L190,20 L230,32 L265,12 L300,22"
                    fill="none"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="2"
                  />
                </svg>
              </a>
            )}
            {showPO && (
              <a
                href="?tab=dash_purchaseOrders"
                className="card dash-po-card"
                style={{ borderColor: activeTab === "dash_purchaseOrders" ? "var(--accent)" : undefined }}
              >
                <div className="dash-po-top">
                  <span className="dash-po-icon"><ShoppingCart size={17} strokeWidth={2} /></span>
                  <div className="font-display" style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Purchase Orders</div>
                  <ChevronRight size={16} strokeWidth={2} color="var(--text-faint)" />
                </div>
                <div className="dash-po-link">View all orders</div>
              </a>
            )}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          {activeStatus && (
            activeJobs.length === 0 ? (
              <div className="card dash-empty-state">
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span className="dash-empty-icon"><ClipboardCheck size={20} strokeWidth={2} /></span>
                  <div>
                    <div style={{ fontWeight: 600 }}>No jobs in this status.</div>
                    <div className="label" style={{ marginTop: 2, marginBottom: 0 }}>Great! All caught up.</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card dtable-wrap">
              <table className="dtable">
                <thead><tr><th>Job #</th><th>Client</th><th>Status</th></tr></thead>
                <tbody>
                  {activeJobs.map((j) => (
                    <tr key={j.id}>
                      <td className="mono" data-label="Job #"><a href={`/jobs/${j.id}`}>{j.jobNumber}</a></td>
                      <td data-label="Client">
                        <a href={`/jobs/${j.id}`} style={{ display: "flex", gap: 8, alignItems: "center", color: "inherit" }}>
                          {j.clientName}
                          {j.deadline && <DeadlineBadge deadline={j.deadline} status={j.status} />}
                        </a>
                      </td>
                      <td data-label="Status"><StatusBadge status={j.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )
          )}

          {activeTab === "dash_remaining" && (
            remainingRows.length === 0 ? (
              <div className="card dash-empty-state">
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span className="dash-empty-icon"><Wallet size={20} strokeWidth={2} /></span>
                  <div>
                    <div style={{ fontWeight: 600 }}>No outstanding balances.</div>
                    <div className="label" style={{ marginTop: 2, marginBottom: 0 }}>Every job is paid up.</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card dtable-wrap">
              <table className="dtable">
                <thead><tr><th>Job #</th><th>Client</th><th>Remaining</th></tr></thead>
                <tbody>
                  {remainingRows.map(({ job, remaining }) => (
                    <tr key={job.id}>
                      <td className="mono" data-label="Job #"><a href={`/jobs/${job.id}`}>{job.jobNumber}</a></td>
                      <td data-label="Client">{job.clientName}</td>
                      <td className="mono" data-label="Remaining">{remaining.toLocaleString()} Br</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )
          )}

          {activeTab === "dash_purchaseOrders" && <PurchaseOrdersPanel user={user} />}
        </div>
      </main>
    </div>
  );
}
