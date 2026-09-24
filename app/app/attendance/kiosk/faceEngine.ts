import * as faceapi from "@vladmandic/face-api";

/**
 * Browser-only face detection/landmarks/descriptor + blink-liveness. Never
 * imported from server code — the actual identity decision is re-made
 * server-side in submitKioskCaptureAction (see lib/attendance/faceMatch.ts);
 * everything here just prepares what gets sent up.
 */

let modelsLoaded = false;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  ]);
  modelsLoaded = true;
}

export interface FrameResult {
  descriptor: Float32Array;
  ear: number; // average eye-aspect-ratio this frame, for blink detection
}

const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

/** Runs detection + landmarks + descriptor on one video frame. Null if no
 * face (or more than one — the kiosk only ever wants exactly one person
 * in frame) was found. */
export async function analyzeFrame(video: HTMLVideoElement): Promise<FrameResult | null> {
  const result = await faceapi
    .detectSingleFace(video, DETECTOR_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!result) return null;

  const ear = averageEyeAspectRatio(result.landmarks);
  return { descriptor: result.descriptor, ear };
}

/** Classic Soukupová & Čech eye-aspect-ratio: low while closed, recovers
 * once open. Averaged across both eyes so a single dip-then-recover
 * sequence across consecutive frames is a blink. */
function eyeAspectRatio(eye: faceapi.Point[]): number {
  const dist = (a: faceapi.Point, b: faceapi.Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const vertical = dist(eye[1], eye[5]) + dist(eye[2], eye[4]);
  const horizontal = dist(eye[0], eye[3]);
  return horizontal === 0 ? 0 : vertical / (2 * horizontal);
}

function averageEyeAspectRatio(landmarks: faceapi.FaceLandmarks68): number {
  const left = eyeAspectRatio(landmarks.getLeftEye());
  const right = eyeAspectRatio(landmarks.getRightEye());
  return (left + right) / 2;
}

export const EAR_BLINK_THRESHOLD = 0.23;

/**
 * Tracks EAR readings across frames and reports the first completed
 * blink — a dip below threshold followed by a recovery above it, both
 * within a plausible human-blink frame span. Tune the two frame-count
 * bounds here if a real office webcam needs it; they were picked for a
 * ~150ms sampling interval (see KioskScreen's poll loop).
 */
export class BlinkDetector {
  private belowCount = 0;
  private sawDip = false;

  /** Feed one frame's EAR; returns true the moment a blink completes. */
  push(ear: number): boolean {
    if (ear < EAR_BLINK_THRESHOLD) {
      this.belowCount++;
      if (this.belowCount >= 1) this.sawDip = true;
      return false;
    }
    // Eyes open this frame — did we just come out of a plausible blink?
    if (this.sawDip && this.belowCount >= 1 && this.belowCount <= 6) {
      this.reset();
      return true;
    }
    this.reset();
    return false;
  }

  private reset(): void {
    this.belowCount = 0;
    this.sawDip = false;
  }
}
