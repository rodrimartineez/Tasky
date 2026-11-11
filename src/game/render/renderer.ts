import { Application, Container, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import { emberRadius } from '../sim/weapons';
import type { Fx, World } from '../sim/types';
import { buildAtlas, buildGroundTile, CIRCLE_RADIUS, WHITE } from '../sprites/atlas';
import { resolveSprite } from '../sprites/data';

/**
 * Dibuja el estado de la simulación con PixiJS. No contiene reglas del juego: solo lee el mundo
 * y consume sus efectos visuales (`world.fx`). Todos los sprites salen de reservas reutilizadas.
 */

/** Lado corto de la pantalla, en píxeles del juego (decide el zoom). */
const VIEW_SHORT = 260;
/** Lado largo máximo: más allá aparecerían los enemigos dentro de la pantalla. */
const VIEW_LONG = 580;
const PROP_CELL = 56;

/** Reserva de sprites: se piden en orden cada fotograma y los que sobran se ocultan. */
class Pool {
  private sprites: Sprite[] = [];
  private used = 0;
  constructor(private parent: Container) {}

  begin() {
    this.used = 0;
  }

  next(texture: Texture): Sprite {
    let s = this.sprites[this.used];
    if (!s) {
      s = new Sprite(texture);
      s.anchor.set(0.5);
      this.sprites.push(s);
      this.parent.addChild(s);
    }
    this.used += 1;
    s.texture = texture;
    s.visible = true;
    s.alpha = 1;
    s.tint = 0xffffff;
    s.rotation = 0;
    s.scale.set(1);
    return s;
  }

  end() {
    for (let i = this.used; i < this.sprites.length; i++) this.sprites[i].visible = false;
  }
}

interface FloatingNumber {
  x: number;
  y: number;
  value: number;
  life: number;
  color: number;
  big: boolean;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
}
interface Ring {
  x: number;
  y: number;
  radius: number;
  life: number;
  color: number;
}
interface Bolt {
  points: number[];
  life: number;
  color: number;
}

const NUMBER_LIFE = 0.6;
const RING_LIFE = 0.3;
const BOLT_LIFE = 0.18;
const MAX_NUMBERS = 70;
const MAX_PARTICLES = 220;

/** Azar solo visual (no afecta a la simulación). */
function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Renderer {
  private textures = new Map<string, Texture>();
  private world = new Container();
  private ground!: TilingSprite;
  private props: Pool;
  private under: Pool;
  private pickups: Pool;
  private enemies: Pool;
  private actors: Pool;
  private shots: Pool;
  private effects: Pool;
  private numbers: FloatingNumber[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private bolts: Bolt[] = [];
  private shake = 0;
  private clock = 0;

  private constructor(private app: Application) {
    const layer = () => new Pool(this.world.addChild(new Container()));
    this.props = layer();
    this.under = layer();
    this.pickups = layer();
    this.enemies = layer();
    this.actors = layer();
    this.shots = layer();
    this.effects = layer();
  }

  static async create(host: HTMLElement): Promise<Renderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: 0x12201a,
      antialias: false,
      autoStart: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 3),
    });
    host.appendChild(app.canvas);
    const renderer = new Renderer(app);
    renderer.loadTextures();
    return renderer;
  }

  private loadTextures() {
    const atlas = buildAtlas();
    const source = Texture.from(atlas.canvas).source;
    source.scaleMode = 'nearest';
    for (const [name, f] of atlas.frames) {
      this.textures.set(name, new Texture({ source, frame: new Rectangle(f.x, f.y, f.w, f.h) }));
    }
    const tile = Texture.from(buildGroundTile('#1b2f24', '#24402f', '#15251c'));
    tile.source.scaleMode = 'nearest';
    this.ground = new TilingSprite({ texture: tile, width: 16, height: 16 });
    this.app.stage.addChild(this.ground, this.world);
  }

  private tex(name: string, white = false): Texture {
    const key = resolveSprite(name) + (white ? WHITE : '');
    return this.textures.get(key) ?? Texture.WHITE;
  }

  /** Incorpora los efectos emitidos por la simulación desde el último fotograma. */
  private consume(fx: Fx[]) {
    for (const f of fx) {
      if (f.type === 'number') {
        if (this.numbers.length >= MAX_NUMBERS) this.numbers.shift();
        this.numbers.push({
          x: f.x + (Math.random() - 0.5) * 8,
          y: f.y,
          value: f.value,
          life: NUMBER_LIFE,
          color: f.player ? 0xff6b6b : f.crit ? 0xffd75e : 0xffffff,
          big: f.crit || f.player,
        });
      } else if (f.type === 'puff') {
        for (let i = 0; i < f.count && this.particles.length < MAX_PARTICLES; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 20 + Math.random() * 60;
          this.particles.push({ x: f.x, y: f.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.25 + Math.random() * 0.25, color: f.color });
        }
      } else if (f.type === 'ring') {
        this.rings.push({ x: f.x, y: f.y, radius: f.radius, life: RING_LIFE, color: f.color });
      } else if (f.type === 'line') {
        // Rayo quebrado: puntos intermedios desplazados al azar.
        const points = [f.x, f.y];
        const segments = 4;
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          points.push(f.x + (f.x2 - f.x) * t + (Math.random() - 0.5) * 12, f.y + (f.y2 - f.y) * t + (Math.random() - 0.5) * 12);
        }
        points.push(f.x2, f.y2);
        this.bolts.push({ points, life: BOLT_LIFE, color: f.color });
      } else {
        this.shake = Math.min(8, this.shake + f.power);
      }
    }
    fx.length = 0;
  }

  /** Dibuja un fotograma. `dt` = segundos reales desde el anterior (anima los efectos). */
  draw(w: World, dt: number) {
    this.clock += dt;
    this.consume(w.fx);
    const { width, height } = this.app.screen;
    const dpr = this.app.renderer.resolution;
    // Zoom en pasos de píxel de dispositivo: cada píxel del arte ocupa un número entero de píxeles reales.
    const ideal = Math.max(Math.min(width, height) / VIEW_SHORT, Math.max(width, height) / VIEW_LONG);
    const zoom = Math.max(1, Math.round(ideal * dpr)) / dpr;
    const p = w.player;

    this.shake *= Math.exp(-12 * dt);
    const shakeX = (Math.random() - 0.5) * this.shake;
    const shakeY = (Math.random() - 0.5) * this.shake;
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    const camX = snap(width / 2 - (p.x + shakeX) * zoom);
    const camY = snap(height / 2 - (p.y + shakeY) * zoom);
    this.world.position.set(camX, camY);
    this.world.scale.set(zoom);
    this.ground.width = width;
    this.ground.height = height;
    this.ground.tileScale.set(zoom);
    this.ground.tilePosition.set(camX, camY);

    const halfW = width / zoom / 2 + 24;
    const halfH = height / zoom / 2 + 24;
    const visible = (x: number, y: number) => Math.abs(x - p.x) < halfW && Math.abs(y - p.y) < halfH;

    // Decoración: la misma en cada celda del mapa infinito (depende solo de sus coordenadas).
    this.props.begin();
    const propNames = w.config.stage.props;
    for (let cy = Math.floor((p.y - halfH) / PROP_CELL); cy <= Math.floor((p.y + halfH) / PROP_CELL); cy++) {
      for (let cx = Math.floor((p.x - halfW) / PROP_CELL); cx <= Math.floor((p.x + halfW) / PROP_CELL); cx++) {
        const roll = hash(cx, cy);
        if (roll > 0.42) continue;
        const s = this.props.next(this.tex(propNames[Math.floor(hash(cy, cx) * propNames.length)]));
        s.position.set(Math.round((cx + hash(cx + 7, cy)) * PROP_CELL), Math.round((cy + hash(cx, cy + 7)) * PROP_CELL));
        s.alpha = 0.9;
      }
    }
    this.props.end();

    // Bajo los personajes: aura de ascuas.
    this.under.begin();
    const ember = p.weapons.find((ws) => ws.id === 'ember');
    if (ember) {
      const s = this.under.next(this.tex('disc'));
      s.position.set(p.x, p.y);
      s.scale.set(emberRadius(w, ember) / CIRCLE_RADIUS);
      s.tint = 0xff8a3c;
      s.alpha = 0.13 + Math.sin(this.clock * 6) * 0.03;
      const edge = this.under.next(this.tex('ring'));
      edge.position.set(p.x, p.y);
      edge.scale.set(emberRadius(w, ember) / CIRCLE_RADIUS);
      edge.tint = 0xffb347;
      edge.alpha = 0.22;
    }
    this.under.end();

    this.pickups.begin();
    for (const item of w.pickups) {
      if (!visible(item.x, item.y)) continue;
      const name =
        item.kind === 'xp' ? (item.value >= 10 ? 'i_xp3' : item.value >= 3 ? 'i_xp2' : 'i_xp1') : item.kind === 'coin' ? 'i_coin' : `i_${item.kind}`;
      const s = this.pickups.next(this.tex(name));
      s.position.set(item.x, item.y + (item.kind === 'chest' ? Math.sin(this.clock * 4) * 1.5 : 0));
    }
    this.pickups.end();

    this.enemies.begin();
    for (const e of w.enemies) {
      if (!visible(e.x, e.y)) continue;
      const s = this.enemies.next(this.tex(e.def.sprite, e.flash > 0));
      const size = e.elite ? 1.5 : 1;
      // Rebote al andar (aplastar y estirar) y orientación hacia el jugador.
      const bounce = 1 + Math.sin(this.clock * 9 + e.uid) * 0.07;
      s.scale.set((p.x < e.x ? -size : size) * (2 - bounce), size * bounce);
      s.position.set(e.x, e.y);
      if (e.elite && e.flash <= 0) s.tint = 0xffe08a;
    }
    this.enemies.end();

    this.actors.begin();
    const hero = this.actors.next(this.tex(p.moving && Math.floor(this.clock * 8) % 2 === 1 ? 'hero_1' : 'hero_0'));
    hero.position.set(p.x, p.y - 2);
    hero.scale.x = p.dirX < 0 ? -1 : 1;
    if (p.hurtTimer > 0) hero.alpha = Math.floor(this.clock * 20) % 2 === 0 ? 0.35 : 1;
    // Barra de vida bajo el personaje.
    const barBack = this.actors.next(this.tex('px'));
    barBack.position.set(p.x, p.y + 9);
    barBack.scale.set(8, 1.5);
    barBack.tint = 0x0b0a14;
    const ratio = Math.max(0, p.hp / p.stats.maxHp);
    const bar = this.actors.next(this.tex('px'));
    bar.position.set(p.x - 7 + 7 * ratio, p.y + 9);
    bar.scale.set(7 * ratio, 0.75);
    bar.tint = ratio > 0.35 ? 0x5ee08a : 0xe5484d;
    this.actors.end();

    this.shots.begin();
    for (const shot of w.projectiles) {
      if (!visible(shot.x, shot.y)) continue;
      const s = this.shots.next(this.tex(shot.sprite));
      if (shot.kind === 'bomb') {
        // Vuelo en arco: sube y baja, y gira.
        const t = 1 - Math.max(0, shot.life) / shot.total;
        s.position.set(shot.x, shot.y - Math.sin(t * Math.PI) * 34);
        s.rotation = t * 9;
      } else {
        s.position.set(shot.x, shot.y);
        if (shot.kind !== 'orbit') s.rotation = shot.angle;
        if (shot.kind === 'lance') s.scale.set(1, Math.max(1, shot.radius / 6));
      }
    }
    this.shots.end();

    this.drawEffects(dt);
    this.app.render();
  }

  private drawEffects(dt: number) {
    const fx = this.effects;
    fx.begin();

    for (const ring of this.rings) {
      ring.life -= dt;
      const t = 1 - ring.life / RING_LIFE;
      const s = fx.next(this.tex('ring'));
      s.position.set(ring.x, ring.y);
      s.scale.set((ring.radius * (0.4 + 0.6 * t)) / CIRCLE_RADIUS);
      s.tint = ring.color;
      s.alpha = 1 - t;
    }
    this.rings = this.rings.filter((r) => r.life > 0);

    for (const bolt of this.bolts) {
      bolt.life -= dt;
      const pts = bolt.points;
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const dx = pts[i + 2] - pts[i];
        const dy = pts[i + 3] - pts[i + 1];
        const s = fx.next(this.tex('px'));
        s.position.set(pts[i] + dx / 2, pts[i + 1] + dy / 2);
        s.rotation = Math.atan2(dy, dx);
        s.scale.set(Math.hypot(dx, dy) / 2, 1);
        s.tint = bolt.color;
        s.alpha = bolt.life / BOLT_LIFE;
      }
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);

    for (const part of this.particles) {
      part.life -= dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      const s = fx.next(this.tex('px'));
      s.position.set(part.x, part.y);
      s.tint = part.color;
      s.alpha = Math.min(1, part.life * 5);
    }
    this.particles = this.particles.filter((q) => q.life > 0);

    for (const n of this.numbers) {
      n.life -= dt;
      n.y -= 22 * dt;
      const text = String(n.value);
      const size = n.big ? 1.5 : 1;
      const startX = n.x - (text.length * 4 * size) / 2 + 2 * size;
      for (let i = 0; i < text.length; i++) {
        const s = fx.next(this.tex(`n${text[i]}`));
        s.position.set(startX + i * 4 * size, n.y);
        s.scale.set(size);
        s.tint = n.color;
        s.alpha = Math.min(1, n.life * 4);
      }
    }
    this.numbers = this.numbers.filter((n) => n.life > 0);

    fx.end();
  }

  destroy() {
    this.app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
  }
}
