import { can } from "@/lib/permissions";
import type { PermissionSubject } from "@/lib/permissions";
import { Lightbox } from "../../Lightbox";
import { DesignFieldsForm } from "./DesignFieldsForm";
import { AddComponentForm } from "./AddComponentForm";
import { ComponentRow } from "./ComponentRow";

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
          productionNotes={job.productionNotes}
        />
      ) : (
        <div className="card form-row" style={{ padding: 16 }}>
          <div>
            <div className="label">Designer</div>
            <div>{job.designer || "—"}</div>
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
              <ComponentRow key={c.id} component={c} jobId={job.id} />
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
