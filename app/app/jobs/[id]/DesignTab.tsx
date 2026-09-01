import { can } from "@/lib/permissions";
import type { PermissionSubject } from "@/lib/permissions";
import { Lightbox } from "../../Lightbox";
import { FileField } from "../../FileField";
import { DesignFieldsForm } from "./DesignFieldsForm";
import { AddComponentForm } from "./AddComponentForm";
import { updateComponentAction, deleteComponentAction } from "./actions";

interface Component {
  id: string;
  name: string;
  width: unknown;
  height: unknown;
  qty: number;
  ledColor: string | null;
  artName: string | null;
  artUrl: string | null;
  artKind: string | null;
}

interface DesignJob {
  id: string;
  designer: string | null;
  supervisor: string | null;
  productionNotes: string | null;
  components: Component[];
}

export function DesignTab({
  job,
  user,
  locked,
}: {
  job: DesignJob;
  user: PermissionSubject;
  locked: boolean;
}) {
  const editable = can(user, "editDesign") && !locked;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {locked && (
        <p className="label">
          This job&apos;s design is locked (status is past Draft). An Admin can unlock it from
          the header if it needs changes.
        </p>
      )}

      {editable ? (
        <DesignFieldsForm
          jobId={job.id}
          designer={job.designer}
          supervisor={job.supervisor}
          productionNotes={job.productionNotes}
        />
      ) : (
        <div className="card form-row" style={{ padding: 16 }}>
          <div>
            <div className="label">Designer</div>
            <div>{job.designer || "—"}</div>
          </div>
          <div>
            <div className="label">Supervisor</div>
            <div>{job.supervisor || "—"}</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="label">Production Notes</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{job.productionNotes || "—"}</div>
          </div>
        </div>
      )}

      <div>
        <h3 style={{ margin: "0 0 8px" }}>Sign Description Components</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {job.components.map((c) =>
            editable ? (
              <form
                key={c.id}
                action={updateComponentAction.bind(null, c.id, job.id)}
                encType="multipart/form-data"
                className="card form-row"
                style={{ padding: 12 }}
              >
                <div>
                  <label className="label">Name</label>
                  <input className="input" name="name" defaultValue={c.name} required />
                </div>
                <div>
                  <label className="label">Width (m)</label>
                  <input className="input" name="width" type="number" step="0.01" defaultValue={String(c.width)} required />
                </div>
                <div>
                  <label className="label">Height (m)</label>
                  <input className="input" name="height" type="number" step="0.01" defaultValue={String(c.height)} required />
                </div>
                <div>
                  <label className="label">Qty</label>
                  <input className="input" name="qty" type="number" step="1" defaultValue={c.qty} required />
                </div>
                <div>
                  <label className="label">LED Colour</label>
                  <input className="input" name="ledColor" defaultValue={c.ledColor ?? ""} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-sm" type="submit">Save</button>
                  <button
                    className="btn btn-sm btn-danger"
                    type="submit"
                    formAction={deleteComponentAction.bind(null, c.id, job.id)}
                  >
                    Delete
                  </button>
                </div>
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center" }}>
                  {c.artUrl && (
                    <Lightbox file={{ name: c.artName ?? "art", url: c.artUrl, kind: c.artKind ?? "" }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <FileField id={`art-${c.id}`} name="art" label="Replace art (optional)" />
                  </div>
                </div>
              </form>
            ) : (
              <div key={c.id} className="card" style={{ padding: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                {c.artUrl && (
                  <Lightbox file={{ name: c.artName ?? "art", url: c.artUrl, kind: c.artKind ?? "" }} />
                )}
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div className="label" style={{ marginTop: 2 }}>
                    {String(c.width)}m × {String(c.height)}m · qty {c.qty}
                    {c.ledColor ? ` · ${c.ledColor}` : ""}
                  </div>
                </div>
              </div>
            )
          )}
          {job.components.length === 0 && <p className="label">No components yet.</p>}
        </div>
      </div>

      {editable && <AddComponentForm jobId={job.id} />}
    </div>
  );
}
