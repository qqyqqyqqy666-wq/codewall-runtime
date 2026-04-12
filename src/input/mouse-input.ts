/**
 * Tracks normalized pointer movement for scene interaction modules.
 */
export type PointerState = {
  x: number;
  y: number;
  inside: boolean;
};

export class MouseInput {
  private readonly pointerState: PointerState = { x: 0, y: 0, inside: false };
  private connected = false;

  constructor(private readonly target: Window) {}

  get pointer(): Readonly<PointerState> {
    return this.pointerState;
  }

  connect(): void {
    if (this.connected) {
      return;
    }

    this.connected = true;
    this.target.addEventListener('pointermove', this.handlePointerMove);
    this.target.addEventListener('pointercancel', this.handlePointerExit);
    this.target.addEventListener('blur', this.handlePointerExit);
  }

  disconnect(): void {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.target.removeEventListener('pointermove', this.handlePointerMove);
    this.target.removeEventListener('pointercancel', this.handlePointerExit);
    this.target.removeEventListener('blur', this.handlePointerExit);
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.pointerState.x = (event.clientX / this.target.innerWidth) * 2 - 1;
    this.pointerState.y = (event.clientY / this.target.innerHeight) * 2 - 1;
    this.pointerState.inside = true;
  };

  private readonly handlePointerExit = (): void => {
    this.pointerState.x = 0;
    this.pointerState.y = 0;
    this.pointerState.inside = false;
  };
}
