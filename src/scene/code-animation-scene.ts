/**
 * Owns the current fullscreen Three.js scene and keeps visual runtime concerns isolated.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from 'three';

import type { TypeflowEmitter } from '../effects/typeflow-emitter';
import type { KeyboardInput } from '../input/keyboard-input';
import type { MouseInput } from '../input/mouse-input';
import type { FpsMonitor } from '../perf/fps-monitor';
import type { RuntimeMode } from '../state/state-machine';
import type { DarkTerminalTheme } from '../theme/dark-terminal-theme';

type CodeAnimationSceneOptions = {
  container: HTMLDivElement;
  mouseInput: MouseInput;
  keyboardInput: KeyboardInput;
  fpsMonitor: FpsMonitor;
  typeflowEmitter: TypeflowEmitter;
  getRuntimeMode: () => RuntimeMode;
  theme: DarkTerminalTheme;
};

export class CodeAnimationScene {
  private static readonly THROTTLED_FRAME_INTERVAL_MS = 1000 / 12;

  private static readonly ATTRACT_PULL = 0.35;
  private static readonly ATTRACT_DEPTH_PULL = 0.2;
  private static readonly REPEL_PUSH = 1.3;
  private static readonly REPEL_DEPTH_PUSH = 1.18;
  private static readonly VORTEX_SPEED = 0.9;
  private static readonly VORTEX_RADIUS = 0.9;

  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(55, 1, 0.1, 100);
  private readonly renderer = new WebGLRenderer({ antialias: true, alpha: true });
  private readonly clock = new Clock();
  private readonly basePositions: number[] = [];

  private animationFrameId: number | null = null;
  private throttleTimeoutId: number | null = null;
  private particles: Points<BufferGeometry, PointsMaterial> | null = null;
  private mounted = false;
  private throttled = false;

  constructor(private readonly options: CodeAnimationSceneOptions) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(this.options.theme.backgroundHex, 1);
    this.renderer.domElement.classList.add('codewall-canvas');

    this.camera.position.set(0, 0, 9);
  }

  mount(): void {
    if (this.mounted) {
      return;
    }

    this.mounted = true;
    this.buildScene();
    this.options.container.appendChild(this.renderer.domElement);
    this.handleResize();

    window.addEventListener('resize', this.handleResize);
    this.render();
  }

  pause(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.throttleTimeoutId !== null) {
      window.clearTimeout(this.throttleTimeoutId);
      this.throttleTimeoutId = null;
    }
  }

  setThrottled(throttled: boolean): void {
    if (this.throttled === throttled) {
      return;
    }

    this.throttled = throttled;

    if (!this.mounted) {
      return;
    }

    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.scheduleNextFrame();
    } else if (this.throttleTimeoutId !== null) {
      window.clearTimeout(this.throttleTimeoutId);
      this.throttleTimeoutId = null;
      this.scheduleNextFrame();
    }
  }

  resume(): void {
    if (!this.mounted || this.animationFrameId !== null) {
      return;
    }

    this.clock.getDelta();
    this.render();
  }

  private buildScene(): void {
    this.scene.background = new Color(this.options.theme.backgroundHex);

    const particleCount = 1400;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const palette = this.options.theme.particlePalette.map((token) => new Color(token));

    for (let index = 0; index < particleCount; index += 1) {
      const stride = index * 3;
      const radius = 9 + Math.random() * 12;
      const angle = Math.random() * Math.PI * 2;
      const depth = (Math.random() - 0.5) * 12;

      positions[stride] = Math.cos(angle) * radius * (0.3 + Math.random());
      positions[stride + 1] = Math.sin(angle * 1.5) * radius * 0.4;
      positions[stride + 2] = depth;

      this.basePositions.push(
        positions[stride],
        positions[stride + 1],
        positions[stride + 2],
      );

      const color = palette[index % palette.length];
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));

    const material = new PointsMaterial({
      size: 0.07,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
    });

    this.particles = new Points(geometry, material);
    this.scene.add(this.particles);
  }

  private readonly handleResize = (): void => {
    const { clientWidth, clientHeight } = this.options.container;
    const width = Math.max(clientWidth, 1);
    const height = Math.max(clientHeight, 1);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly render = (): void => {
    if (!this.mounted) {
      return;
    }

    const runtimeMode = this.options.getRuntimeMode();
    const typeflowEnabled = runtimeMode === 'TYPEFLOW';
    const attractEnabled = runtimeMode === 'ATTRACT';
    const repelEnabled = runtimeMode === 'REPEL';
    const vortexEnabled = runtimeMode === 'VORTEX';

    if (typeflowEnabled && this.options.keyboardInput.isPressed('Space')) {
      this.options.typeflowEmitter.pulse(0.55);
    }

    const deltaSeconds = this.clock.getDelta();
    const elapsedSeconds = this.clock.elapsedTime;
    const emission = this.options.typeflowEmitter.update(deltaSeconds);
    const pointer = this.options.mouseInput.pointer;

    this.options.fpsMonitor.sample(deltaSeconds);

    if (this.particles) {
      const positions = this.particles.geometry.getAttribute('position') as BufferAttribute;

      for (let index = 0; index < positions.count; index += 1) {
        const stride = index * 3;
        const baseX = this.basePositions[stride];
        const baseY = this.basePositions[stride + 1];
        const baseZ = this.basePositions[stride + 2];
        // Baseline vertical motion shared across modes.
        const baseDrift =
          Math.sin(elapsedSeconds * 0.85 + index * 0.07 + baseZ * 0.15) * (0.14 + emission * 0.08);

        // Mode-specific radial/depth transforms for ATTRACT and REPEL.
        const attractPulse = attractEnabled ? 1 + Math.sin(elapsedSeconds * 2 + index * 0.05) * 0.06 : 1;
        const repelPulse = repelEnabled ? 1 + Math.sin(elapsedSeconds * 1.8 + index * 0.04) * 0.05 : 1;
        const radialScale = attractEnabled
          ? CodeAnimationScene.ATTRACT_PULL * attractPulse
          : repelEnabled
            ? CodeAnimationScene.REPEL_PUSH * repelPulse
            : 1;
        const depthScale = attractEnabled
          ? CodeAnimationScene.ATTRACT_DEPTH_PULL
          : repelEnabled
            ? CodeAnimationScene.REPEL_DEPTH_PUSH
            : 1;
        const scaledX = baseX * radialScale;
        const scaledY = baseY * radialScale;
        const scaledZ = baseZ * depthScale;

        // VORTEX composes from scaled basis, with reduced pointer/drift influence to keep orbit dominant.
        const orbitRadius = Math.hypot(scaledX, scaledY) * CodeAnimationScene.VORTEX_RADIUS;
        const orbitBaseAngle = Math.atan2(scaledY, scaledX);
        const orbitAngle =
          orbitBaseAngle + elapsedSeconds * CodeAnimationScene.VORTEX_SPEED + baseZ * 0.03;
        const orbitX = Math.cos(orbitAngle) * orbitRadius;
        const orbitY = Math.sin(orbitAngle) * orbitRadius;

        const pointerInfluence = vortexEnabled ? 0.06 : 0.18;
        const driftInfluence = vortexEnabled ? 0.4 : 1;
        const resolvedX = (vortexEnabled ? orbitX : scaledX) + pointer.x * pointerInfluence;
        const resolvedY =
          (vortexEnabled ? orbitY : scaledY) +
          baseDrift * driftInfluence +
          pointer.y * pointerInfluence;

        positions.setXYZ(index, resolvedX, resolvedY, scaledZ);
      }

      positions.needsUpdate = true;
      this.particles.rotation.y = elapsedSeconds * (0.04 + emission * 0.02);
      this.particles.rotation.x = pointer.y * 0.08;
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  private scheduleNextFrame(): void {
    if (!this.mounted) {
      return;
    }

    if (this.throttled) {
      this.throttleTimeoutId = window.setTimeout(() => {
        this.throttleTimeoutId = null;
        this.render();
      }, CodeAnimationScene.THROTTLED_FRAME_INTERVAL_MS);
      return;
    }

    this.animationFrameId = window.requestAnimationFrame(this.render);
  }
}
