/**
 * Server-side face-descriptor matching — pure arithmetic, no face-api.js
 * or TensorFlow needed here. The kiosk (a browser client) runs the actual
 * face-detection/landmark/recognition models locally and sends up only
 * the resulting 128-float descriptor; this file makes the identity
 * decision that the server trusts, since a client's own "it matched"
 * claim is never enough on its own (see revealCrmLeadPhoneAction and
 * every other action in this app that re-checks rather than trusting the
 * client).
 *
 * face-api.js descriptors are 128-dimensional; a Euclidean distance below
 * ~0.6 is that library's own convention for "same person" (the threshold
 * its model was actually tuned/benchmarked against). An initial, untested
 * 0.5 here proved too strict on real hardware — two genuine same-person
 * captures a few minutes apart (different angle/lighting/expression) came
 * back just over it and got rejected. 0.6 matches the library's own
 * calibration; retune here in one place if further real-world testing
 * calls for it.
 */

export const DESCRIPTOR_LENGTH = 128;
export const MATCH_DISTANCE_THRESHOLD = 0.6;

export function isValidDescriptor(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === DESCRIPTOR_LENGTH &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function isMatch(distance: number): boolean {
  return distance <= MATCH_DISTANCE_THRESHOLD;
}
