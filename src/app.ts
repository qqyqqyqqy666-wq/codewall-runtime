/**
 * Composes the runtime modules and mounts the fullscreen browser application.
 */
import './theme/runtime.css';

import { TypeflowEmitter } from './effects/typeflow-emitter';
import { GlyphAtlas } from './glyphs/glyph-atlas';
import { GlyphPool } from './glyphs/glyph-pool';
import { HandTracker } from './input/hand-tracker';
import { KeyboardInput } from './input/keyboard-input';
import { MouseInput } from './input/mouse-input';
import { FpsMonitor } from './perf/fps-monitor';
import { CodeAnimationScene } from './scene/code-animation-scene';
import { StateMachine } from './state/state-machine';
import { applyDarkTerminalTheme, darkTerminalTheme } from './theme/dark-terminal-theme';

type AppPhase = 'booting' | 'ready' | 'running';

export class App {
  private readonly stateMachine = new StateMachine<AppPhase>('booting');
  private readonly mouseInput = new MouseInput(window);
  private readonly keyboardInput = new KeyboardInput(window);
  private readonly handTracker = new HandTracker();
  private readonly glyphAtlas = new GlyphAtlas();
  private readonly glyphPool = new GlyphPool();
  private readonly typeflowEmitter = new TypeflowEmitter();
  private readonly fpsMonitor = new FpsMonitor();
  private readonly scene: CodeAnimationScene;

  constructor(private readonly container: HTMLDivElement) {
    applyDarkTerminalTheme(container);
    this.container.classList.add('app-shell');

    this.scene = new CodeAnimationScene({
      container,
      mouseInput: this.mouseInput,
      keyboardInput: this.keyboardInput,
      fpsMonitor: this.fpsMonitor,
      typeflowEmitter: this.typeflowEmitter,
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
    void this.initializeHandTracking();
  }

  private async initializeHandTracking(): Promise<void> {
    await this.handTracker.initialize();

    const status = this.handTracker.getStatus();

    if (status !== 'running' && status !== 'idle') {
      console.info(`[App] Hand tracking inactive (${status}).`);
    }
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
