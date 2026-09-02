import { can, canViewAction, type PermissionSubject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { costEstimateTotals } from "@/lib/calc/cost-estimate";
import { toNumber } from "@/lib/money";
import { CostEstimateCategorySheet } from "./CostEstimateCategorySheet";
import { SoldPriceForm } from "./SoldPriceForm";
import { CostEstimateNotesForm } from "./CostEstimateNotesForm";
import { Lightbox } from "../../Lightbox";

interface CostItem {
  id: string;
  materialId: string | null;
  name: string;
  category: string;
  unit: string;
  qty: unknown;
  unitPrice: unknown;
  total: unknown;
  source: string;
  comment: string | null;
}

interface CostJob {
  id: string;
  costEstimateItems: CostItem[];
  costEstimateSoldPrice: unknown;
  costEstimateCommissionActive: boolean;
  costEstimateNotes: string | null;
  costEstimatePriceListName: string | null;
  costEstimatePriceListUrl: string | null;
  costEstimatePriceListKind: string | null;
}

export async function CostEstimateTab({
  job,
  user,
  locked,
}: {
  job: CostJob;
  user: PermissionSubject;
  locked: boolean;
}) {
  const materials = await prisma.material.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  // CostEstimateCategorySheet is a client component (needs live Qty→Total
  // math as you type) — Prisma's Decimal fields can't cross that
  // server/client boundary as-is (React silently drops them), so they're
  // converted to plain numbers here before being passed down.
  const plainMaterials = materials.map((m) => ({
    id: m.id,
    name: m.name,
    unit: m.unit,
    category: m.category,
    rate: m.rate === null ? null : toNumber(m.rate),
  }));
  const plainItems = job.costEstimateItems.map((i) => ({
    ...i,
    qty: toNumber(i.qty),
    unitPrice: toNumber(i.unitPrice),
    total: toNumber(i.total),
  }));
  const cashMaterials = plainMaterials.filter((m) => m.category === "cash");
  const stockMaterials = plainMaterials.filter((m) => m.category === "stock");

  const editableQty = can(user, "manageCostEstimate") && !locked;
  const canAddAdhoc = can(user, "addCostEstimateItem") && !locked;
  const canEditNotes = can(user, "manageCostEstimateNotes") && !locked;
  const canSeeProfit = canViewAction(user, "manageSalePriceProfit");
  const canEditProfit = can(user, "manageSalePriceProfit") && !locked;

  const totals = costEstimateTotals(
    job.costEstimateItems,
    job.costEstimateSoldPrice,
    job.costEstimateCommissionActive
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {locked && <p className="label">This job&apos;s Cost Estimate is locked (status is past Draft).</p>}

      <CostEstimateCategorySheet
        category="cash"
        label="Cash"
        materials={cashMaterials}
        items={plainItems}
        jobId={job.id}
        editable={editableQty}
        canAddAdhoc={canAddAdhoc}
      />
      <CostEstimateCategorySheet
        category="stock"
        label="Stock"
        materials={stockMaterials}
        items={plainItems}
        jobId={job.id}
        editable={editableQty}
        canAddAdhoc={canAddAdhoc}
      />

      {/* Sale Price & Profit — View=false hides the whole card (Section 7.2). */}
      {canSeeProfit && (
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Sale Price & Profit</h3>
          {canEditProfit ? (
            <SoldPriceForm
              jobId={job.id}
              soldPrice={toNumber(job.costEstimateSoldPrice)}
              commissionActive={job.costEstimateCommissionActive}
            />
          ) : (
            <div className="label">
              Sold Price: {toNumber(job.costEstimateSoldPrice).toLocaleString()} ETB · Commission{" "}
              {job.costEstimateCommissionActive ? "active" : "off"}
            </div>
          )}
          <div className="form-row" style={{ marginTop: 14 }}>
            <div>
              <div className="label">Sub Total</div>
              <div className="mono">{totals.subTotal.toLocaleString()} ETB</div>
            </div>
            <div>
              <div className="label">Commission (7%)</div>
              <div className="mono">{totals.commission.toLocaleString()} ETB</div>
            </div>
            <div>
              <div className="label">Profit</div>
              <div className="mono">{totals.profit.toLocaleString()} ETB</div>
            </div>
            <div>
              <div className="label">Grand Total (Sold Price)</div>
              <div className="mono">{totals.grandTotal.toLocaleString()} ETB</div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Notes</h3>
        {job.costEstimatePriceListUrl && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <Lightbox
              file={{
                name: job.costEstimatePriceListName ?? "price list",
                url: job.costEstimatePriceListUrl,
                kind: job.costEstimatePriceListKind ?? "",
              }}
            />
            <span className="label">{job.costEstimatePriceListName}</span>
          </div>
        )}
        {canEditNotes ? (
          <CostEstimateNotesForm jobId={job.id} notes={job.costEstimateNotes} />
        ) : (
          <p style={{ whiteSpace: "pre-wrap" }}>{job.costEstimateNotes || "—"}</p>
        )}
      </div>
    </div>
  );
}
