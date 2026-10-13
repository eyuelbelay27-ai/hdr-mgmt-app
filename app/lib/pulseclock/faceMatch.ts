/**
 * Server-side face matching — pure arithmetic, no ML runtime here. The
 * browser runs Human's faceres model and sends a 1024-float embedding
 * (averaged over several frames); the server makes the identity decision,
 * never trusting a client's own "it matched".
 *
 * `similarity` is a port of Human's own match.similarity() with the options
 * its FaceID demo uses for faceres: Euclidean (order 2), multiplier 25,
 * normalised to 0.2..0.8 and clamped to 0..1.
 *
 * Measured with this model: two very different photos of the same person
 * (years apart, other angle and lighting, single frames) scored 0.45;
 * different people about 0.23. Real check-ins (same phone, averaged frames)
 * land higher than the former, so 0.40 accepts the genuine person reliably
 * while staying well clear of a different face. Each check-in logs its match
 * % in the audit trail, so this can be retuned from real data.
 */

export const DESCRIPTOR_LENGTH = 1024;
export const MATCH_SIMILARITY = 0.4;

export function isValidDescriptor(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === DESCRIPTOR_LENGTH &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function similarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  const dist = Math.round(100 * 25 * sum) / 100;
  if (dist === 0) return 1;
  const norm = (1 - Math.sqrt(dist) / 100 - 0.2) / (0.8 - 0.2);
  return Math.round(100 * Math.max(Math.min(norm, 1), 0)) / 100;
}

export function isMatch(sim: number): boolean {
  return sim >= MATCH_SIMILARITY;
}
