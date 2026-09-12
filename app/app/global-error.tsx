"use client";

/**
 * Last-resort boundary: this one replaces the root layout entirely, so it
 * can't rely on globals.css being applied and styles itself inline.
 * Reached only when the layout itself fails — app/error.tsx handles
 * everything inside a page.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#fdf8f6",
          color: "#221c1f",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 18, margin: "0 0 6px" }}>Hadar Advertising</h1>
          <p style={{ fontSize: 13.5, color: "#6b5d62", margin: "0 0 18px" }}>
            The app couldn&apos;t load. Reload to try again — nothing you saved has been lost.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: "#c41643",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ fontSize: 11.5, color: "#8a7b80", marginTop: 14 }}>Reference: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
