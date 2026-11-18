import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { canSeePage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { AppNav } from "../AppNav";
import { PnlApp } from "./PnlApp";
import { toEntry } from "./data";

export const dynamic = "force-dynamic";

export default async function PnlPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "pnl")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="pnl" />
        <main className="app-main">
          <p className="label">You don&apos;t have access to P&amp;L.</p>
        </main>
      </div>
    );
  }

  const [accounts, entries] = await Promise.all([
    prisma.pnlAccount.findMany({ orderBy: { name: "asc" } }),
    prisma.pnlEntry.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
  ]);

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="pnl" />
      <main className="app-main">
        <PnlApp initialAccounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))} initialEntries={entries.map(toEntry)} />
      </main>
    </div>
  );
}
