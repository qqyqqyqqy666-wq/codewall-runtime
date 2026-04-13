/**
 * Composes the runtime modules and mounts the fullscreen browser application.
 */
import './theme/runtime.css';

import { TypeflowEmitter } from './effects/typeflow-emitter';
import { GlyphAtlas } from './glyphs/glyph-atlas';
import { GlyphPool } from './glyphs/glyph-pool';
import { HandTracker, type HandFrame, type HandTrackerStatus } from './input/hand-tracker';
import { KeyboardInput } from './input/keyboard-input';
import { MouseInput } from './input/mouse-input';
import { FpsMonitor } from './perf/fps-monitor';
import { CodeAnimationScene } from './scene/code-animation-scene';
import { onHostLifecycleSignal } from './host/host-lifecycle';
import { RuntimeLifecyclePolicy, type RuntimeLifecycleState } from './host/lifecycle-policy';
import { RuntimeModeState, StateMachine } from './state/state-machine';
import { applyDarkTerminalTheme, darkTerminalTheme } from './theme/dark-terminal-theme';

type AppPhase = 'booting' | 'ready' | 'running';
const HAND_INACTIVE_TIMEOUT_MS = 300;
const HAND_TRACKING_RETRY_COOLDOWN_MS = 15_000;
const ATTRACT_PINCH_THRESHOLD = 0.7;
const REPEL_FIST_THRESHOLD = 0.7;
const VORTEX_OPENNESS_THRESHOLD = 0.8;
const VORTEX_SEPARATION_THRESHOLD = 0.9;

export class App {
  private readonly stateMachine = new StateMachine<AppPhase>('booting');
  private readonly runtimeModeState = new RuntimeModeState('IDLE');
  private readonly mouseInput = new MouseInput(window);
  private readonly keyboardInput = new KeyboardInput(window);
  private readonly handTracker = new HandTracker();
  private readonly glyphAtlas = new GlyphAtlas();
  private readonly glyphPool = new GlyphPool();
  private readonly typeflowEmitter = new TypeflowEmitter();
  private readonly fpsMonitor = new FpsMonitor();
  private readonly scene: CodeAnimationScene;
  private handFrameUnsubscribe: (() => void) | null = null;
  private handInactiveTimeoutId: number | null = null;
  private runtimeModeFrameId: number | null = null;
  private hostLifecycleUnsubscribe: (() => void) | null = null;
  private lifecyclePolicyUnsubscribe: (() => void) | null = null;
  private readonly lifecyclePolicy = new RuntimeLifecyclePolicy('active');
  private handTrackingBlockedStatus: HandTrackerStatus | null = null;
  private handTrackingBlockedAtMs: number | null = null;
  private handDetected = false;

  constructor(private readonly container: HTMLDivElement) {
    applyDarkTerminalTheme(container);
    this.container.classList.add('app-shell');

    this.scene = new CodeAnimationScene({
      container,
      mouseInput: this.mouseInput,
      keyboardInput: this.keyboardInput,
      fpsMonitor: this.fpsMonitor,
      typeflowEmitter: this.typeflowEmitter,
      getRuntimeMode: () => this.runtimeModeState.value,
      theme: darkTerminalTheme,
    });
  }

  mount(): void {
    if (this.stateMachine.matches('running')) {
      return;
    }

    this.stateMachine.transition('ready');
    this.mouseInput.connect();
    this.keyboardInput.connect();
    this.glyphAtlas.initialize();
    this.glyphPool.attachAtlas(this.glyphAtlas);
    this.glyphPool.seed(24);
    this.scene.mount();
    this.stateMachine.transition('running');
    this.startRuntimeModeSync();
    this.bindLifecyclePolicy();
    this.bindHostLifecycle();
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    void this.initializeHandTracking();
  }

  private bindLifecyclePolicy(): void {
    this.lifecyclePolicyUnsubscribe?.();
    this.lifecyclePolicyUnsubscribe = this.lifecyclePolicy.subscribe((state) => {
      this.handleLifecyclePolicyState(state);
    });
  }

  private bindHostLifecycle(): void {
    this.hostLifecycleUnsubscribe?.();
    this.hostLifecycleUnsubscribe = onHostLifecycleSignal((signal) => {
      this.lifecyclePolicy.handleHostSignal(signal);
    });
  }

  private handleLifecyclePolicyState(state: RuntimeLifecycleState): void {
    if (state === 'background-paused') {
      this.pauseForHostLifecycle();
      return;
    }

    if (state === 'background-throttled') {
      this.throttleForHostLifecycle();
      return;
    }

    if (state === 'active') {
      this.activateForHostLifecycle();
    }
  }

  private stopInteractiveRuntimeForHostLifecycle(): void {
    this.stopRuntimeModeSync();
    this.clearHandFrameRuntimeModeBinding();
    this.handTracker.disconnect();
  }

  private throttleForHostLifecycle(): void {
    this.stopInteractiveRuntimeForHostLifecycle();
    this.scene.setThrottled(true);
    this.scene.resume();
  }

  private pauseForHostLifecycle(): void {
    this.stopInteractiveRuntimeForHostLifecycle();
    this.scene.setThrottled(false);
    this.scene.pause();
  }

  private activateForHostLifecycle(): void {
    if (!this.stateMachine.matches('running')) {
      return;
    }

    this.scene.setThrottled(false);
    this.scene.resume();
    this.startRuntimeModeSync();

    if (this.handTrackingBlockedStatus !== null && !this.canRetryBlockedHandTracking()) {
      this.clearHandFrameRuntimeModeBinding();
      this.runtimeModeState.transition('IDLE');
      return;
    }

    if (this.handTrackingBlockedStatus !== null) {
      this.resetHandTrackingBlockedState();
    }

    void this.initializeHandTracking();
  }

  private async initializeHandTracking(): Promise<void> {
    if (this.handTrackingBlockedStatus !== null && !this.canRetryBlockedHandTracking()) {
      this.clearHandFrameRuntimeModeBinding();
      this.runtimeModeState.transition('IDLE');
      return;
    }

    if (this.handTrackingBlockedStatus !== null) {
      this.resetHandTrackingBlockedState();
    }

    await this.handTracker.initialize();

    if (this.lifecyclePolicy.state !== 'active') {
      this.clearHandFrameRuntimeModeBinding();
      this.runtimeModeState.transition('IDLE');
      return;
    }

    const status = this.handTracker.getStatus();

    if (status === 'running') {
      this.bindHandFrameRuntimeMode();
      return;
    }

    if (status === 'denied' || status === 'unavailable' || status === 'error') {
      this.handTrackingBlockedStatus = status;
      this.handTrackingBlockedAtMs = Date.now();
      console.info(`[App] Hand tracking blocked (${status}); keeping runtime input policy in safe IDLE mode.`);
    }

    this.clearHandFrameRuntimeModeBinding();
    this.runtimeModeState.transition('IDLE');

    if (status !== 'running' && status !== 'idle') {
      console.info(`[App] Hand tracking inactive (${status}).`);
    }
  }

  private canRetryBlockedHandTracking(): boolean {
    if (this.handTrackingBlockedStatus === null || this.handTrackingBlockedAtMs === null) {
      return false;
    }

    return Date.now() - this.handTrackingBlockedAtMs >= HAND_TRACKING_RETRY_COOLDOWN_MS;
  }

  private resetHandTrackingBlockedState(): void {
    this.handTrackingBlockedStatus = null;
    this.handTrackingBlockedAtMs = null;
  }

  private bindHandFrameRuntimeMode(): void {
    this.clearHandFrameRuntimeModeBinding();

    this.handFrameUnsubscribe = this.handTracker.subscribe((frame) => {
      if (frame.detected) {
        this.handDetected = true;

        if (this.handInactiveTimeoutId !== null) {
          window.clearTimeout(this.handInactiveTimeoutId);
          this.handInactiveTimeoutId = null;
        }

        if (this.runtimeModeState.value !== 'TYPEFLOW') {
          this.transitionToResolvedHandMode(frame);
        }
        return;
      }

      if (
        (this.runtimeModeState.value !== 'HAND_ACTIVE' &&
          this.runtimeModeState.value !== 'ATTRACT' &&
          this.runtimeModeState.value !== 'REPEL' &&
          this.runtimeModeState.value !== 'VORTEX' &&
          this.runtimeModeState.value !== 'TYPEFLOW') ||
        this.handInactiveTimeoutId !== null
      ) {
        return;
      }

      this.handInactiveTimeoutId = window.setTimeout(() => {
        this.handInactiveTimeoutId = null;
        this.handDetected = false;

        if (this.runtimeModeState.value !== 'TYPEFLOW') {
          this.runtimeModeState.transition('IDLE');
        }
      }, HAND_INACTIVE_TIMEOUT_MS);
    });
  }

  private clearHandFrameRuntimeModeBinding(): void {
    if (this.handFrameUnsubscribe) {
      this.handFrameUnsubscribe();
      this.handFrameUnsubscribe = null;
    }

    if (this.handInactiveTimeoutId !== null) {
      window.clearTimeout(this.handInactiveTimeoutId);
      this.handInactiveTimeoutId = null;
    }

    this.handDetected = false;
  }

  private readonly syncRuntimeMode = (): void => {
    const typeflowActive = this.keyboardInput.isPressed('Space');

    if (typeflowActive) {
      this.runtimeModeState.transition('TYPEFLOW');
    } else if (this.runtimeModeState.value === 'TYPEFLOW') {
      this.runtimeModeState.transition(this.handDetected ? 'HAND_ACTIVE' : 'IDLE');
    }

    this.runtimeModeFrameId = window.requestAnimationFrame(this.syncRuntimeMode);
  };

  private startRuntimeModeSync(): void {
    if (this.runtimeModeFrameId !== null) {
      return;
    }

    this.runtimeModeFrameId = window.requestAnimationFrame(this.syncRuntimeMode);
  }

  private stopRuntimeModeSync(): void {
    if (this.runtimeModeFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.runtimeModeFrameId);
    this.runtimeModeFrameId = null;
  }

  private readonly handleBeforeUnload = (): void => {
    this.stopRuntimeModeSync();
    this.clearHandFrameRuntimeModeBinding();
    this.handTracker.disconnect();
    this.hostLifecycleUnsubscribe?.();
    this.hostLifecycleUnsubscribe = null;
    this.lifecyclePolicyUnsubscribe?.();
    this.lifecyclePolicyUnsubscribe = null;
    this.scene.pause();
  };

  private isAttractActive(frame: Readonly<HandFrame>): boolean {
    return [frame.left, frame.right].some((hand) => hand !== undefined && hand.pinch >= ATTRACT_PINCH_THRESHOLD);
  }

  private isRepelActive(frame: Readonly<HandFrame>): boolean {
    return [frame.left, frame.right].some((hand) => hand !== undefined && hand.fist >= REPEL_FIST_THRESHOLD);
  }

  private resolveHandDrivenMode(
    frame: Readonly<HandFrame>,
  ): 'HAND_ACTIVE' | 'ATTRACT' | 'REPEL' | 'VORTEX' {
    if (this.isAttractActive(frame)) {
      return 'ATTRACT';
    }

    if (this.isRepelActive(frame)) {
      return 'REPEL';
    }

    if (this.isVortexActive(frame)) {
      return 'VORTEX';
    }

    return 'HAND_ACTIVE';
  }

  private transitionToResolvedHandMode(frame: Readonly<HandFrame>): void {
    const nextMode = this.resolveHandDrivenMode(frame);
    const currentMode = this.runtimeModeState.value;

    if (currentMode === nextMode) {
      return;
    }

    if (currentMode === 'IDLE' && nextMode !== 'HAND_ACTIVE') {
      this.runtimeModeState.transition('HAND_ACTIVE');
    }

    this.runtimeModeState.transition(nextMode);
  }

  private isVortexActive(frame: Readonly<HandFrame>): boolean {
    if (frame.left === undefined || frame.right === undefined) {
      return false;
    }

    const handsOpen =
      frame.left.openness >= VORTEX_OPENNESS_THRESHOLD &&
      frame.right.openness >= VORTEX_OPENNESS_THRESHOLD;

    if (!handsOpen) {
      return false;
    }

    const handSeparation = Math.hypot(
      frame.left.center.x - frame.right.center.x,
      frame.left.center.y - frame.right.center.y,
    );

    return (
      handSeparation >= VORTEX_SEPARATION_THRESHOLD
    );
  }
}

export function bootstrapApp(): void {
  const container = document.querySelector<HTMLDivElement>('#app');

  if (!container) {
    throw new Error('Missing #app mount point.');
  }

  const app = new App(container);
  app.mount();
}
