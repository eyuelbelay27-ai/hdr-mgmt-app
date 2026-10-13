import type { Human, Config, FaceResult } from "@vladmandic/human";

/**
 * Browser-only face pipeline on the Human library (github.com/vladmandic/human,
 * MIT), the maintained successor to face-api.js. The library bundle and its
 * models are self-hosted under /public/human so nothing depends on a CDN.
 *
 * Two passes:
 *   1. Liveness: a light config (detector + mesh + iris) runs fast enough on
 *      a phone to catch a real blink, judged against the person's own
 *      open-eye baseline rather than one fixed number.
 *   2. Identity: a full config (+ face embedding, anti-spoof, liveness
 *      models) over several open-eye frames, averaged into one descriptor.
 * The identity decision itself is made on the server (lib/pulseclock/faceMatch.ts).
 */

const BASE = "/human";

const COMMON: Partial<Config> = {
  modelBasePath: `${BASE}/models/`,
  cacheSensitivity: 0, // every frame is analysed fresh — needed for blinks and for averaging
  debug: false,
  filter: { enabled: true, equalization: true }, // evens out poor office lighting
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  segmentation: { enabled: false },
  gesture: { enabled: false },
};

const LIGHT: Partial<Config> = {
  ...COMMON,
  face: {
    enabled: true,
    detector: { rotation: false, maxDetected: 2, minConfidence: 0.5 },
    mesh: { enabled: true },
    iris: { enabled: true },
    attention: { enabled: false },
    description: { enabled: false },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
    gear: { enabled: false },
  } as Config["face"],
};

const FULL: Partial<Config> = {
  ...COMMON,
  face: {
    ...(LIGHT.face as Config["face"]),
    detector: { rotation: true, maxDetected: 2, minConfidence: 0.5 },
    description: { enabled: true },
    antispoof: { enabled: true },
    liveness: { enabled: true },
  } as Config["face"],
};

let humanPromise: Promise<Human> | null = null;

export function loadFaceEngine(): Promise<Human> {
  humanPromise ??= (async () => {
    // Loaded from /public at runtime (not bundled) — a 2MB library would
    // otherwise blow the production build's memory limit.
    const mod = (await import(/* webpackIgnore: true */ `${BASE}/human.esm.js`)) as typeof import("@vladmandic/human");
    const human = new mod.Human(FULL);
    await human.load();
    await human.warmup();
    return human;
  })().catch((err) => {
    humanPromise = null;
    throw err;
  });
  return humanPromise;
}

/** Eye openness from the mesh, as Human's own blink gesture computes it:
 * lid gap divided by eye-socket height, averaged over both eyes. */
function eyeOpenness(face: FaceResult): number {
  const m = face.mesh;
  if (!m || m.length < 468) return 0;
  const left = Math.abs(m[374][1] - m[386][1]) / Math.max(1, Math.abs(m[443][1] - m[450][1]));
  const right = Math.abs(m[145][1] - m[159][1]) / Math.max(1, Math.abs(m[223][1] - m[230][1]));
  return (left + right) / 2;
}

export type FrameStatus =
  | { kind: "none" }
  | { kind: "many" }
  | { kind: "small" }
  | { kind: "face"; openness: number; face: FaceResult };

/** Minimum face width in camera pixels — smaller faces give poor descriptors. */
const MIN_FACE_PX = 110;

function classify(faces: FaceResult[]): FrameStatus {
  if (faces.length === 0) return { kind: "none" };
  if (faces.length > 1) return { kind: "many" };
  const face = faces[0];
  if (Math.min(face.box[2], face.box[3]) < MIN_FACE_PX) return { kind: "small" };
  return { kind: "face", openness: eyeOpenness(face), face };
}

export async function lightFrame(human: Human, video: HTMLVideoElement): Promise<FrameStatus> {
  const res = await human.detect(video, LIGHT);
  return classify(res.face);
}

export async function fullFrame(human: Human, video: HTMLVideoElement): Promise<FrameStatus> {
  const res = await human.detect(video, FULL);
  return classify(res.face);
}

/**
 * Blink = eyes drop well below this person's open-eye baseline, then come
 * back. The baseline is learned from the first frames with a face, so
 * narrow eyes or glasses don't break it. Timing-free on purpose: a slow
 * phone may only catch a single closed frame.
 */
export class BlinkDetector {
  private samples: number[] = [];
  private closed = false;

  get ready(): boolean {
    return this.samples.length >= 4;
  }

  private baseline(): number {
    const s = [...this.samples].sort((a, b) => a - b);
    return s[Math.floor(s.length * 0.7)] ?? 0; // upper-middle: open-eye level
  }

  /** Feed one frame's openness; true the moment a blink completes. */
  push(openness: number): boolean {
    if (!this.ready) {
      this.samples.push(openness);
      return false;
    }
    const base = this.baseline();
    if (base <= 0) return false;
    if (openness < base * 0.55) {
      this.closed = true;
      return false;
    }
    if (this.closed && openness > base * 0.8) {
      this.closed = false;
      return true;
    }
    if (!this.closed && openness > base * 0.8) {
      // keep adapting to the person's open-eye level
      this.samples.push(openness);
      if (this.samples.length > 30) this.samples.shift();
    }
    return false;
  }

  isOpen(openness: number): boolean {
    return this.ready && openness > this.baseline() * 0.75;
  }
}

/** Element-wise mean of several embeddings (kept in faceres' own scale,
 * which the server's similarity calibration expects). */
export function averageEmbedding(list: number[][]): number[] {
  const n = list[0].length;
  const out = new Array<number>(n).fill(0);
  for (const e of list) for (let i = 0; i < n; i++) out[i] += e[i] / list.length;
  return out;
}
