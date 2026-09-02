import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { getInventoryBalances } from "@/lib/calc/inventory";
import { AppNav } from "../AppNav";
import { ActiveTabAutoScroll } from "../ActiveTabAutoScroll";
import { RecordForm } from "./RecordForm";

const TABS = [
  { key: "in", label: "Stock In" },
  { key: "out", label: "Stock Out" },
  { key: "transactions", label: "Inventory Transactions" },
] as const;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "inventory")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="inventory" />
        <main className="app-main">
          <p className="label">You don&apos;t have access to Inventory.</p>
        </main>
      </div>
    );
  }

  const sp = await searchParams;
  const activeTab = (TABS.find((t) => t.key === sp.tab)?.key ?? "transactions") as (typeof TABS)[number]["key"];
  const balances = await getInventoryBalances();
  const stockMaterials = await prisma.material.findMany({
    where: { active: true, category: "stock" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const canManage = can(user, "manageInventory");

  const entries = await prisma.inventoryEntry.findMany({
    where: activeTab === "in" ? { direction: "in" } : activeTab === "out" ? { direction: "out" } : {},
    orderBy: { date: "desc" },
    include: { job: true },
    take: 200,
  });

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="inventory" />
      <main className="app-main">
        <h1 style={{ marginTop: 0 }}>Inventory</h1>

        <div className="card dtable-wrap" style={{ marginBottom: 20 }}>
        <table className="dtable">
          <thead>
            <tr>
              {["Material", "Balance", "Unit"].map((h) => (
                <th key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.key}>
                <td data-label="Material">{b.label}</td>
                <td className="mono" data-label="Balance">{b.balance.toLocaleString()}</td>
                <td data-label="Unit">{b.unit ?? "—"}</td>
              </tr>
            ))}
            {balances.length === 0 && (
              <tr>
                <td className="label" colSpan={3}>No stock movements recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
          {TABS.map((t) => (
            <a key={t.key} href={`?tab=${t.key}`} className={`tab${activeTab === t.key ? " active" : ""}`} style={{ whiteSpace: "nowrap" }}>
              {t.label}
            </a>
          ))}
        </div>
        <ActiveTabAutoScroll />

        <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
          {canManage && activeTab !== "transactions" && (
            <RecordForm direction={activeTab as "in" | "out"} materials={stockMaterials} />
          )}

          <div className="dtable-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Direction</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Source</th>
                <th>Project</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td data-label="Date">{e.date.toISOString().slice(0, 10)}</td>
                  <td data-label="Direction">{e.direction === "in" ? "In" : "Out"}</td>
                  <td data-label="Item">{e.itemName}</td>
                  <td className="mono" data-label="Qty">{String(e.qty)}</td>
                  <td data-label="Unit">{e.unit ?? "—"}</td>
                  <td className="label" data-label="Source">{e.source}</td>
                  <td data-label="Project">
                    {e.job ? (
                      <a href={`/jobs/${e.job.id}`}>{e.job.jobNumber} — {e.job.clientName}</a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label="Note">{e.note ?? "—"}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td className="label" colSpan={8}>No entries.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </main>
    </div>
  );
}
