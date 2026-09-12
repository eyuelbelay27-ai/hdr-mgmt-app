"use client";

import { HadarMark } from "./Logo";

/**
 * Route-level error boundary. Without this, any unhandled error — a failed
 * upload, a dropped connection mid-action, a stale tab after a deploy —
 * left the whole screen blank except Next's raw "Application error: a
 * client-side exception has occurred", which tells the team nothing and
 * offers no way out.
 *
 * A browser that still has the previous build's page open asks for JS
 * chunks the new build no longer has, so that case is called out
 * specifically: the fix is always to reload onto the current version.
 */
function isStaleBuildError(error: Error): boolean {
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|error loading dynamically imported module/i.test(
    `${error.name} ${error.message}`
  );
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const staleBuild = isStaleBuildError(error);

  return (
    <div className="login-page">
      <div className="card login-card" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <HadarMark size={36} />
        </div>
        <h1>{staleBuild ? "The app was updated" : "Something went wrong"}</h1>
        <p className="login-subtitle">
          {staleBuild
            ? "This page was open from an older version. Reload to pick up the latest one — nothing you saved has been lost."
            : "That didn't go through. Your work up to this point is safe — try again, or reload the page."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
          {!staleBuild && (
            <button className="btn" type="button" onClick={reset}>
              Try Again
            </button>
          )}
          <a className="btn btn-ghost" href="/">
            Back to Dashboard
          </a>
        </div>

        {error.digest && (
          <p className="label" style={{ marginTop: 14, marginBottom: 0 }}>
            Reference: <span className="mono">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  );
}
