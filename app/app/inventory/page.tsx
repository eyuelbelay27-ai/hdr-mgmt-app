import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { getInventoryBalances } from "@/lib/calc/inventory";
import { AppNav } from "../AppNav";
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

        <table className="card" style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
          <thead>
            <tr>
              {["Material", "Balance", "Unit"].map((h) => (
                <th key={h} className="label" style={{ textAlign: "left", padding: "10px 12px" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.key} style={{ borderTop: "1px solid var(--border-soft)" }}>
                <td style={{ padding: "10px 12px" }}>{b.label}</td>
                <td className="mono" style={{ padding: "10px 12px" }}>{b.balance.toLocaleString()}</td>
                <td style={{ padding: "10px 12px" }}>{b.unit ?? "—"}</td>
              </tr>
            ))}
            {balances.length === 0 && (
              <tr>
                <td className="label" style={{ padding: "10px 12px" }} colSpan={3}>No stock movements recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
          {TABS.map((t) => (
            <a key={t.key} href={`?tab=${t.key}`} className={`tab${activeTab === t.key ? " active" : ""}`}>
              {t.label}
            </a>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
          {canManage && activeTab !== "transactions" && (
            <RecordForm direction={activeTab as "in" | "out"} materials={stockMaterials} />
          )}

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
                  <td>{e.date.toISOString().slice(0, 10)}</td>
                  <td>{e.direction === "in" ? "In" : "Out"}</td>
                  <td>{e.itemName}</td>
                  <td className="mono">{String(e.qty)}</td>
                  <td>{e.unit ?? "—"}</td>
                  <td className="label">{e.source}</td>
                  <td>
                    {e.job ? (
                      <a href={`/jobs/${e.job.id}`}>{e.job.jobNumber} — {e.job.clientName}</a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{e.note ?? "—"}</td>
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
      </main>
    </div>
  );
}
