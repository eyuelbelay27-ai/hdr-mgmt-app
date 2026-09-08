import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { AppNav } from "../AppNav";
import { PriceDatabaseBoard } from "./PriceDatabaseBoard";

export default async function PriceDatabasePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "calculator")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="calculator" />
        <main className="app-main">
          <p className="label">You don&apos;t have access to the Price Database.</p>
        </main>
      </div>
    );
  }

  const materials = await prisma.material.findMany({
    orderBy: { name: "asc" },
    include: { priceHistory: { orderBy: { effectiveDate: "desc" }, include: { changedBy: true } } },
  });
  const editable = can(user, "manageSignagePrices");

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="calculator" />
      <main className="app-main">
        <h1 style={{ marginTop: 0 }}>Price Database</h1>
        <p className="label" style={{ marginBottom: 12 }}>
          The single shared material catalog powering every job&apos;s Cost Estimate tab.
          Editing a rate here updates every job&apos;s Cost Estimate live.
        </p>

        <PriceDatabaseBoard initialMaterials={materials} editable={editable} />
      </main>
    </div>
  );
}
