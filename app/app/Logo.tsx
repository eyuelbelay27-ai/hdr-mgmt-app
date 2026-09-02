/**
 * A plain <img>, not next/image — this deploys to a self-hosted container
 * (AletCloud) without the `sharp` package installed, and next/image's
 * built-in optimizer throws at runtime without it outside Vercel. The mark
 * is a single ~16KB PNG, small enough that skipping optimization costs
 * nothing in practice.
 */
export function HadarMark({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/brand/hadar-mark.png"
      alt=""
      width={450}
      height={442}
      style={{ width: size, height: "auto", display: "block" }}
    />
  );
}

/** Mark + wordmark, used anywhere the app identifies itself (nav, login, print). */
export function HadarLogo({ size = 28, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <HadarMark size={size} />
      {wordmark && (
        <span
          className="font-display"
          style={{ fontWeight: 700, fontSize: size * 0.5, letterSpacing: "-0.01em" }}
        >
          Hadar Advertising
        </span>
      )}
    </span>
  );
}
