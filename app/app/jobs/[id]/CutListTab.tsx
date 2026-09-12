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

  // Only pictures can be printed onto the job record — a PDF prints as
  // its filename and nothing else — so flag the case where someone
  // uploaded the PDF and stopped.
  const isImage = (kind: string | null) => (kind ?? "").startsWith("image/");
  const needsPicture = job.cutFiles.some((f) => !isImage(f.kind)) && !job.cutFiles.some((f) => isImage(f.kind));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {locked && <p className="label">This job&apos;s cut list is locked (status is past Draft).</p>}

      {needsPicture && (
        <p
          className="card"
          style={{
            padding: 12,
            margin: 0,
            fontSize: 13,
            background: "var(--warn-soft)",
            color: "var(--warn)",
            borderColor: "var(--warn)",
          }}
        >
          Add a picture of the cut list too. Only pictures print onto the job record — a PDF shows as a filename and nothing more.
        </p>
      )}

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
