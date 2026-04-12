/**
 * Captures key state so future animation systems can react to commands and shortcuts.
 */
export class KeyboardInput {
  private readonly pressedCodes = new Set<string>();
  private connected = false;

  constructor(private readonly target: Window) {}

  connect(): void {
    if (this.connected) {
      return;
    }

    this.connected = true;
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.handleBlur);
  }

  disconnect(): void {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.handleBlur);
  }

  isPressed(code: string): boolean {
    return this.pressedCodes.has(code);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.pressedCodes.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedCodes.delete(event.code);
  };

  private readonly handleBlur = (): void => {
    this.pressedCodes.clear();
  };
}
