import { can } from "@/lib/permissions";
import type { PermissionSubject } from "@/lib/permissions";
import { Lightbox } from "../../Lightbox";
import { AddCutFileForm } from "./AddCutFileForm";
import { deleteCutFileAction } from "./actions";

interface CutFile {
  id: string;
  name: string;
  url: string;
  kind: string | null;
  uploadedBy: string | null;
  uploadedAt: Date;
}

export function CutListTab({
  job,
  user,
  locked,
}: {
  job: { id: string; cutFiles: CutFile[] };
  user: PermissionSubject;
  locked: boolean;
}) {
  const editable = can(user, "editCutList") && !locked;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {locked && <p className="label">This job&apos;s cut list is locked (status is past Draft).</p>}

      <div style={{ display: "grid", gap: 10 }}>
        {job.cutFiles.map((f) => (
          <div key={f.id} className="card" style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
            <Lightbox file={{ name: f.name, url: f.url, kind: f.kind ?? "" }} />
            <div style={{ flex: 1 }}>
              <div>{f.name}</div>
              <div className="label" style={{ marginTop: 2 }}>
                {f.uploadedBy ?? "unknown"} · {f.uploadedAt.toISOString().slice(0, 10)}
              </div>
            </div>
            {editable && (
              <form action={deleteCutFileAction.bind(null, f.id, job.id)}>
                <button className="btn btn-sm btn-danger" type="submit">Delete</button>
              </form>
            )}
          </div>
        ))}
        {job.cutFiles.length === 0 && <p className="label">No cut files uploaded yet.</p>}
      </div>

      {editable && <AddCutFileForm jobId={job.id} />}
    </div>
  );
}
