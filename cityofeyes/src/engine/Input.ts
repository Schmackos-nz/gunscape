// Thin keyboard wrapper. Edge-triggered actions (fire/brandish/toggle) are
// drained once per frame so a system reads each press exactly once.

export class Input {
  private down = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private clickThisFrame = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (!this.down.has(k)) this.pressedThisFrame.add(k);
      this.down.add(k);
      if (k === "tab" || k === " ") e.preventDefault(); // space = fire, don't scroll
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => this.down.clear());
    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.clickThisFrame = true; // left click
    });
    window.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  isDown(key: string): boolean {
    return this.down.has(key.toLowerCase());
  }

  /** True only on the frame the key first went down. */
  pressed(key: string): boolean {
    return this.pressedThisFrame.has(key.toLowerCase());
  }

  /** True only on the frame the left mouse button was pressed. */
  clicked(): boolean {
    return this.clickThisFrame;
  }

  /** Call at the very end of each frame. */
  endFrame() {
    this.pressedThisFrame.clear();
    this.clickThisFrame = false;
  }
}
