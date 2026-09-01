import { prisma } from "@/lib/prisma";
import { can, canViewAction, type PermissionSubject } from "@/lib/permissions";
import { costEstimateTotals } from "@/lib/calc/cost-estimate";
import { toNumber } from "@/lib/money";
import { saveCostEstimateQuantitiesAction, deleteCostEstimateItemAction } from "./costEstimateActions";
import { AddCostEstimateItemForm } from "./AddCostEstimateItemForm";
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

function CategorySheet({
  category,
  label,
  materials,
  items,
  jobId,
  editable,
  canAddAdhoc,
}: {
  category: "cash" | "stock";
  label: string;
  materials: { id: string; name: string; unit: string; rate: unknown }[];
  items: CostItem[];
  jobId: string;
  editable: boolean;
  canAddAdhoc: boolean;
}) {
  const itemsByMaterial = new Map(items.filter((i) => i.materialId).map((i) => [i.materialId as string, i]));
  const manualItems = items.filter((i) => !i.materialId && i.category === category);
  const categoryTotal = items
    .filter((i) => i.category === category)
    .reduce((sum, i) => sum + toNumber(i.total), 0);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>{label} Items</h3>
        <div className="mono">{categoryTotal.toLocaleString()} ETB</div>
      </div>

      <form action={saveCostEstimateQuantitiesAction.bind(null, jobId, category)} style={{ marginTop: 10 }}>
        <table className="dtable">
          <thead>
            <tr>
              <th>Material</th>
              <th>Unit</th>
              <th>Rate</th>
              <th>Qty</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => {
              const existing = itemsByMaterial.get(m.id);
              return (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.unit}</td>
                  <td className="mono">{m.rate === null ? "—" : toNumber(m.rate).toLocaleString()}</td>
                  <td>
                    {editable ? (
                      <input
                        className="input"
                        style={{ width: 90 }}
                        type="number"
                        step="0.01"
                        min="0"
                        name={`qty_${m.id}`}
                        defaultValue={existing ? String(existing.qty) : ""}
                        disabled={m.rate === null}
                      />
                    ) : (
                      (existing && String(existing.qty)) || "—"
                    )}
                  </td>
                  <td className="mono">{existing ? toNumber(existing.total).toLocaleString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {editable && (
          <button className="btn btn-sm btn-primary" type="submit" style={{ marginTop: 8 }}>
            Save {label} Quantities
          </button>
        )}
      </form>

      {manualItems.length > 0 && (
        <table className="dtable" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Ad-hoc Item</th>
              <th>Unit</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
              <th>Comment</th>
              {canAddAdhoc && <th />}
            </tr>
          </thead>
          <tbody>
            {manualItems.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>{i.unit}</td>
                <td className="mono">{String(i.qty)}</td>
                <td className="mono">{toNumber(i.unitPrice).toLocaleString()}</td>
                <td className="mono">{toNumber(i.total).toLocaleString()}</td>
                <td>{i.comment ?? "—"}</td>
                {canAddAdhoc && (
                  <td>
                    <form action={deleteCostEstimateItemAction.bind(null, i.id, jobId)}>
                      <button className="btn btn-sm btn-danger" type="submit">Delete</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canAddAdhoc && <AddCostEstimateItemForm jobId={jobId} category={category} />}
    </div>
  );
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
  const cashMaterials = materials.filter((m) => m.category === "cash");
  const stockMaterials = materials.filter((m) => m.category === "stock");

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

      <CategorySheet
        category="cash"
        label="Cash"
        materials={cashMaterials}
        items={job.costEstimateItems}
        jobId={job.id}
        editable={editableQty}
        canAddAdhoc={canAddAdhoc}
      />
      <CategorySheet
        category="stock"
        label="Stock"
        materials={stockMaterials}
        items={job.costEstimateItems}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 14 }}>
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
