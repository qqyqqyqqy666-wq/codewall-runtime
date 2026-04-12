/**
 * Stores lightweight emission energy so future glyph and scene effects can share a timing source.
 */
export class TypeflowEmitter {
  private intensity = 0;

  pulse(amount = 0.35): void {
    this.intensity = Math.max(this.intensity, Math.min(amount, 1));
  }

  update(deltaSeconds: number): number {
    this.intensity = Math.max(0, this.intensity - deltaSeconds * 0.65);
    return this.intensity;
  }

  getValue(): number {
    return this.intensity;
  }
}
