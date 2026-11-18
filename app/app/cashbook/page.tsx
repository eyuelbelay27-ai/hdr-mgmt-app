import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { canSeePage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { AppNav } from "../AppNav";
import { CashBookApp } from "./CashBookApp";
import { toCbEntry, toCbSettings } from "./data";

export const dynamic = "force-dynamic";

export default async function CashBookPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "cashbook")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="cashbook" />
        <main className="app-main">
          <p className="label">You don&apos;t have access to the Cash Book.</p>
        </main>
      </div>
    );
  }

  const [entries, settings] = await Promise.all([
    prisma.cashBookEntry.findMany({ orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.cashBookSettings.findUnique({ where: { id: "main" } }),
  ]);

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="cashbook" />
      <main className="app-main">
        <CashBookApp initialEntries={entries.map(toCbEntry)} initialSettings={toCbSettings(settings)} />
      </main>
    </div>
  );
}
