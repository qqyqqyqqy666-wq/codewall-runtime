/**
 * Samples frame timing so performance instrumentation has a stable entry point later on.
 */
export class FpsMonitor {
  private fps = 60;

  sample(deltaSeconds: number): number {
    if (deltaSeconds <= 0) {
      return this.fps;
    }

    const instantaneousFps = 1 / deltaSeconds;
    this.fps = this.fps * 0.9 + instantaneousFps * 0.1;
    return this.fps;
  }

  get currentFps(): number {
    return this.fps;
  }
}
