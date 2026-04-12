import {
  FilesetResolver,
  HandLandmarker,
  type Category,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import visionWasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import visionWasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import visionWasmNoSimdBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url';
import visionWasmNoSimdLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url';

export type HandFrame = {
  detected: boolean;
  left?: {
    center: { x: number; y: number; z: number };
    openness: number;
    pinch: number;
    fist: number;
    wristRotation: number;
    velocity: { x: number; y: number; z: number };
  };
  right?: {
    center: { x: number; y: number; z: number };
    openness: number;
    pinch: number;
    fist: number;
    wristRotation: number;
    velocity: { x: number; y: number; z: number };
  };
  timestamp: number;
};

export type HandTrackerStatus =
  | 'idle'
  | 'initializing'
  | 'running'
  | 'denied'
  | 'unavailable'
  | 'error';

type HandSlot = 'left' | 'right';
type HandVector = { x: number; y: number; z: number };
type HandSample = NonNullable<HandFrame['left']>;
type PreviousHandSample = { center: HandVector; timestamp: number };
type FrameListener = (frame: Readonly<HandFrame>) => void;
type Point3D = { x: number; y: number; z: number };

const HAND_MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const HAND_CENTER_INDICES = [0, 5, 9, 13, 17] as const;
const FINGERTIP_INDICES = [8, 12, 16, 20] as const;
const THUMB_TIP_INDEX = 4;
const INDEX_MCP_INDEX = 5;
const MIDDLE_MCP_INDEX = 9;
const PINKY_MCP_INDEX = 17;
const LOST_HAND_TIMEOUT_MS = 250;
const ZERO_VECTOR: HandVector = { x: 0, y: 0, z: 0 };

export class HandTracker {
  private status: HandTrackerStatus = 'idle';
  private frame: HandFrame = { detected: false, timestamp: 0 };
  private readonly listeners = new Set<FrameListener>();
  private readonly previousHands = new Map<HandSlot, PreviousHandSample>();

  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private animationFrameId: number | null = null;
  private lastVideoTime = -1;

  async initialize(): Promise<void> {
    if (this.status === 'initializing' || this.status === 'running') {
      return;
    }

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.fail('unavailable');
      return;
    }

    this.status = 'initializing';
    this.pushFrame({ detected: false, timestamp: performance.now() });

    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    let landmarker: HandLandmarker | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      video = await createVideoElement(stream);

      landmarker = await HandLandmarker.createFromOptions(await this.createVisionFileset(), {
        baseOptions: {
          delegate: 'CPU',
          modelAssetPath: HAND_MODEL_ASSET_URL,
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });

      this.disposeRuntime();
      this.stream = stream;
      this.video = video;
      this.landmarker = landmarker;
      this.status = 'running';
      this.processFrame();
    } catch (error) {
      landmarker?.close();
      stopStream(stream);
      this.handleInitializationFailure(error);
    }
  }

  getStatus(): HandTrackerStatus {
    return this.status;
  }

  getFrame(): Readonly<HandFrame> {
    return this.frame;
  }

  subscribe(listener: FrameListener): () => void {
    this.listeners.add(listener);
    listener(this.frame);

    return () => {
      this.listeners.delete(listener);
    };
  }

  disconnect(): void {
    this.status = 'idle';
    this.previousHands.clear();
    this.disposeRuntime();
    this.pushFrame({ detected: false, timestamp: performance.now() });
  }

  private readonly processFrame = (): void => {
    if (this.status !== 'running' || !this.landmarker || !this.video) {
      return;
    }

    if (
      this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      this.video.currentTime !== this.lastVideoTime
    ) {
      this.lastVideoTime = this.video.currentTime;

      const timestamp = performance.now();

      try {
        const result = this.landmarker.detectForVideo(this.video, timestamp);
        this.pushFrame(this.buildFrame(result, timestamp));
      } catch (error) {
        this.fail('error', error);
        return;
      }
    }

    this.animationFrameId = window.requestAnimationFrame(this.processFrame);
  };

  private buildFrame(result: HandLandmarkerResult, timestamp: number): HandFrame {
    const frame: HandFrame = { detected: false, timestamp };
    const seenHands = new Set<HandSlot>();

    for (let index = 0; index < result.landmarks.length; index += 1) {
      const normalizedLandmarks = result.landmarks[index];
      const metricLandmarks = result.worldLandmarks[index] ?? normalizedLandmarks;

      if (normalizedLandmarks.length === 0 || metricLandmarks.length === 0) {
        continue;
      }

      const signals = this.deriveHandSignals(normalizedLandmarks, metricLandmarks);
      const slot = resolveHandSlot(result.handedness[index]?.[0], signals.center.x, frame);
      const velocity = this.computeVelocity(slot, signals.center, timestamp);

      frame[slot] = {
        ...signals,
        velocity,
      };

      seenHands.add(slot);
    }

    for (const slot of ['left', 'right'] as const) {
      if (!seenHands.has(slot)) {
        this.previousHands.delete(slot);
      }
    }

    frame.detected = Boolean(frame.left || frame.right);

    if (!frame.detected) {
      this.previousHands.clear();
    }

    return frame;
  }

  private deriveHandSignals(
    normalizedLandmarks: NormalizedLandmark[],
    metricLandmarks: Point3D[],
  ): Omit<HandSample, 'velocity'> {
    const metricPalmCenter = averagePoint(HAND_CENTER_INDICES.map((index) => metricLandmarks[index]));
    const normalizedPalmCenter = averagePoint(
      HAND_CENTER_INDICES.map((index) => normalizedLandmarks[index]),
    );
    const palmScale = Math.max(
      averagePalmScale(metricLandmarks),
      averagePalmScale(normalizedLandmarks),
      0.0001,
    );

    // MediaPipe landmarks arrive normalized to the camera frame in [0, 1]. We
    // mirror X for selfie-style webcam input, then remap X/Y into the runtime's
    // existing pointer space of [-1, 1].
    const center = {
      x: clampSigned((1 - normalizedPalmCenter.x) * 2 - 1),
      y: clampSigned(normalizedPalmCenter.y * 2 - 1),
      z: metricPalmCenter.z / palmScale,
    };

    // Gesture signals intentionally stay low-level for now: fingertip distances
    // are normalized against palm size so pinch/openness remain usable even as
    // the hand moves closer to or farther from the camera.
    const openness = clamp01(
      average(
        FINGERTIP_INDICES.map((index) => {
          const distanceToPalm = distance3(metricLandmarks[index], metricPalmCenter) / palmScale;
          return (distanceToPalm - 0.6) / 1.2;
        }),
      ),
    );
    const pinchDistance =
      distance3(metricLandmarks[THUMB_TIP_INDEX], metricLandmarks[8]) / palmScale;
    const pinch = clamp01(1 - (pinchDistance - 0.15) / 0.55);
    const fist = clamp01(1 - openness);
    const wristRotation = Math.atan2(
      normalizedLandmarks[PINKY_MCP_INDEX].y - normalizedLandmarks[INDEX_MCP_INDEX].y,
      (1 - normalizedLandmarks[PINKY_MCP_INDEX].x) - (1 - normalizedLandmarks[INDEX_MCP_INDEX].x),
    );

    return {
      center,
      openness,
      pinch,
      fist,
      wristRotation,
    };
  }

  private computeVelocity(slot: HandSlot, center: HandVector, timestamp: number): HandVector {
    const previous = this.previousHands.get(slot);
    this.previousHands.set(slot, {
      center: { ...center },
      timestamp,
    });

    if (!previous || timestamp - previous.timestamp > LOST_HAND_TIMEOUT_MS) {
      return ZERO_VECTOR;
    }

    const deltaSeconds = Math.max((timestamp - previous.timestamp) / 1000, 1 / 240);

    return {
      x: (center.x - previous.center.x) / deltaSeconds,
      y: (center.y - previous.center.y) / deltaSeconds,
      z: (center.z - previous.center.z) / deltaSeconds,
    };
  }

  private async createVisionFileset(): Promise<{
    wasmLoaderPath: string;
    wasmBinaryPath: string;
  }> {
    const simdSupported = await FilesetResolver.isSimdSupported();

    return simdSupported
      ? {
          wasmLoaderPath: visionWasmLoaderUrl,
          wasmBinaryPath: visionWasmBinaryUrl,
        }
      : {
          wasmLoaderPath: visionWasmNoSimdLoaderUrl,
          wasmBinaryPath: visionWasmNoSimdBinaryUrl,
        };
  }

  private disposeRuntime(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.lastVideoTime = -1;
    this.landmarker?.close();
    this.landmarker = null;

    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }

    stopStream(this.stream);
    this.stream = null;
  }

  private handleInitializationFailure(error: unknown): void {
    if (isPermissionDeniedError(error)) {
      this.fail('denied', error);
      return;
    }

    if (isUnavailableCameraError(error)) {
      this.fail('unavailable', error);
      return;
    }

    this.fail('error', error);
  }

  private fail(status: Extract<HandTrackerStatus, 'denied' | 'unavailable' | 'error'>, error?: unknown): void {
    this.status = status;
    this.previousHands.clear();
    this.disposeRuntime();
    this.pushFrame({ detected: false, timestamp: performance.now() });

    if (error instanceof Error) {
      console.warn(`[HandTracker] ${status}`, error);
    } else if (error) {
      console.warn(`[HandTracker] ${status}`, error);
    }
  }

  private pushFrame(frame: HandFrame): void {
    this.frame = frame;

    for (const listener of this.listeners) {
      listener(this.frame);
    }
  }
}

async function createVideoElement(stream: MediaStream): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  await video.play();

  return video;
}

function resolveHandSlot(category: Category | undefined, centerX: number, frame: HandFrame): HandSlot {
  const preferredSlot = normalizeHandSlot(category?.categoryName) ?? (centerX <= 0 ? 'left' : 'right');

  if (!frame[preferredSlot]) {
    return preferredSlot;
  }

  return preferredSlot === 'left' && !frame.right ? 'right' : 'left';
}

function normalizeHandSlot(value: string | undefined): HandSlot | undefined {
  switch (value?.toLowerCase()) {
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    default:
      return undefined;
  }
}

function averagePalmScale(landmarks: readonly Point3D[]): number {
  return average([
    distance3(landmarks[0], landmarks[MIDDLE_MCP_INDEX]),
    distance3(landmarks[INDEX_MCP_INDEX], landmarks[PINKY_MCP_INDEX]),
  ]);
}

function average(points: readonly number[]): number {
  return points.reduce((sum, value) => sum + value, 0) / Math.max(points.length, 1);
}

function averagePoint(points: readonly Point3D[]): Point3D {
  return {
    x: average(points.map((point) => point.x)),
    y: average(points.map((point) => point.y)),
    z: average(points.map((point) => point.z)),
  };
}

function distance3(a: Point3D, b: Point3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampSigned(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function isPermissionDeniedError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

function isUnavailableCameraError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotFoundError' ||
      error.name === 'NotReadableError' ||
      error.name === 'OverconstrainedError')
  );
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}
