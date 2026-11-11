/**
 * Controles: joystick virtual flotante (aparece donde se apoya el dedo, así no tapa una zona fija)
 * y teclado (WASD o flechas). Expone la dirección de movimiento con módulo ≤ 1.
 */
const RADIUS = 44;
const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export class Input {
  x = 0;
  y = 0;
  private pressed = new Set<string>();
  private pointer: number | null = null;
  private originX = 0;
  private originY = 0;
  private base = document.createElement('div');
  private knob = document.createElement('div');
  private abort = new AbortController();

  constructor(
    private target: HTMLElement,
    private onPauseKey: () => void,
  ) {
    const ring = 'position:absolute;border-radius:50%;pointer-events:none;display:none;transform:translate(-50%,-50%);';
    this.base.style.cssText = `${ring}width:${RADIUS * 2}px;height:${RADIUS * 2}px;border:2px solid rgba(255,255,255,.28);background:rgba(255,255,255,.06);`;
    this.knob.style.cssText = `${ring}width:36px;height:36px;background:rgba(246,201,69,.75);box-shadow:0 0 0 2px rgba(11,10,20,.7);`;
    target.append(this.base, this.knob);

    const { signal } = this.abort;
    target.addEventListener('pointerdown', this.down, { signal });
    target.addEventListener('pointermove', this.move, { signal });
    target.addEventListener('pointerup', this.up, { signal });
    target.addEventListener('pointercancel', this.up, { signal });
    target.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
    window.addEventListener('keydown', this.keyDown, { signal });
    window.addEventListener('keyup', this.keyUp, { signal });
    window.addEventListener('blur', this.release, { signal });
  }

  private local(e: PointerEvent) {
    const rect = this.target.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private down = (e: PointerEvent) => {
    if (this.pointer !== null) return;
    this.pointer = e.pointerId;
    this.target.setPointerCapture(e.pointerId);
    const at = this.local(e);
    this.originX = at.x;
    this.originY = at.y;
    for (const el of [this.base, this.knob]) {
      el.style.display = 'block';
      el.style.left = `${at.x}px`;
      el.style.top = `${at.y}px`;
    }
    e.preventDefault();
  };

  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer) return;
    const at = this.local(e);
    let dx = at.x - this.originX;
    let dy = at.y - this.originY;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      // El dedo se ha salido del círculo: la base lo sigue para que girar no exija volver al centro.
      this.originX += (dx / d) * (d - RADIUS);
      this.originY += (dy / d) * (d - RADIUS);
      dx = (dx / d) * RADIUS;
      dy = (dy / d) * RADIUS;
      this.base.style.left = `${this.originX}px`;
      this.base.style.top = `${this.originY}px`;
    }
    this.knob.style.left = `${this.originX + dx}px`;
    this.knob.style.top = `${this.originY + dy}px`;
    // Zona muerta pequeña para que un toque quieto no mueva al personaje.
    const length = Math.min(d, RADIUS);
    const strength = length < 6 ? 0 : length / RADIUS;
    this.x = length > 0 ? (dx / length) * strength : 0;
    this.y = length > 0 ? (dy / length) * strength : 0;
  };

  private up = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer) return;
    this.pointer = null;
    this.base.style.display = this.knob.style.display = 'none';
    this.fromKeys();
  };

  private keyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!e.repeat) this.onPauseKey();
      return;
    }
    if (!(e.code in KEYS)) return;
    e.preventDefault();
    this.pressed.add(e.code);
    this.fromKeys();
  };

  private keyUp = (e: KeyboardEvent) => {
    if (this.pressed.delete(e.code)) this.fromKeys();
  };

  /** Suelta las teclas (la ventana pierde el foco o la partida se detiene). */
  release = () => {
    this.pressed.clear();
    this.fromKeys();
  };

  private fromKeys() {
    if (this.pointer !== null) return;
    let x = 0;
    let y = 0;
    for (const code of this.pressed) {
      x += KEYS[code][0];
      y += KEYS[code][1];
    }
    const d = Math.hypot(x, y) || 1;
    this.x = x / d;
    this.y = y / d;
  }

  destroy() {
    this.abort.abort();
    this.base.remove();
    this.knob.remove();
  }
}
