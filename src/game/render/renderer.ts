// La CSP de producción (public/_headers) prohíbe eval; este módulo hace que PixiJS genere sus shaders sin él.
import 'pixi.js/unsafe-eval';
import { Application, Container, Rectangle, Sprite, Texture, TilingSprite, type ApplicationOptions } from 'pixi.js';
import { behaviourOf, WEAPON_BY_ID } from '../content/weapons';
import { COLUMN_HALF, emberRadius } from '../sim/weapons';
import type { Fx, Projectile, World } from '../sim/types';
import { buildAtlas, buildGroundTile, CIRCLE_RADIUS, WHITE } from '../sprites/atlas';
import { GROUNDS } from '../sprites/grounds';

/**
 * Dibuja el estado de la simulación con PixiJS. No contiene reglas del juego: solo lee el mundo
 * y consume sus efectos visuales (`world.fx`). Todos los sprites salen de reservas reutilizadas.
 */

/** Lado corto de la pantalla, en píxeles del juego (decide el zoom). */
const VIEW_SHORT = 260;
/** Lado largo máximo: más allá aparecerían los enemigos dentro de la pantalla. */
const VIEW_LONG = 580;
const PROP_CELL = 56;
/** Partículas de ambiente en pantalla (estilos en sprites/grounds.ts). */
const AMBIENT_COUNT = 28;

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
    s.anchor.set(0.5);
    s.visible = true;
    s.alpha = 1;
    s.tint = 0xffffff;
    s.rotation = 0;
    s.scale.set(1);
    s.blendMode = 'normal';
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
  /** Chispa luminosa (mezcla aditiva) con tamaño; sin él, un punto normal. */
  glow?: number;
}

/** Color del resplandor de cada proyectil (por sprite); lo que no está aquí usa el color del arma o blanco cálido. */
const SHOT_GLOW: Record<string, number> = {
  x_spark: 0xffe27a, x_bullet: 0xffd75e, x_gun: 0xf6c945, x_lance: 0xbfe6ff, x_dawnlance: 0xffd36b, x_orb: 0x9fd0ff,
  x_eclipse: 0xb08cff, x_constellation: 0xd6c4ff, x_thorn: 0x7dff9a, x_arrow: 0xffd9a0, x_boomerang: 0xffc861,
  x_scythe: 0xe05cff, x_ricochet: 0x7ee8e0, x_luckyblades: 0xff4f9a, x_axe: 0xffa94d, x_deathspiral: 0xff3a5e,
  x_fireball: 0xff7a2a, x_hellfire: 0xff3a1a, x_flask: 0x6bc5ff, x_tornado: 0xd8f0ff, x_tuna: 0x7ee8ff,
  x_goldtuna: 0xffd75e, x_bigtuna: 0x7ee8ff, x_bubble: 0xbfeaff, x_flare: 0xff8a3a, x_ashflame: 0xc0243a,
  x_galewhip: 0xaef0ff, x_galedance: 0xff5a6a, x_vento: 0xaef0ff, x_victory: 0xffe9a8, x_finisher: 0xff8a8a, x_slash: 0xffffff,
};
/** Tipos de proyectil que ya dibujan su propio brillo o cubren mucha pantalla. */
const NO_GLOW = new Set(['cloud', 'column', 'galaxy', 'ray', 'dragon', 'enemyShot', 'critter']);
/** Tipos que sueltan chispas por donde pasan. */
const SPARKLING = new Set(['bolt', 'lance', 'boomerang', 'bounce', 'axe', 'spin', 'bomb', 'meteor', 'orbit', 'flare', 'leap']);
interface Ring {
  x: number;
  y: number;
  radius: number;
  life: number;
  color: number;
}
/** Impacto animado (3 fotogramas). */
interface Hit {
  x: number;
  y: number;
  sprite: string;
  life: number;
}
const HIT_LIFE = 0.24;
const MAX_HITS = 60;

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
/**
 * Calidad automática de los efectos: si el dispositivo se queda por debajo de ~48 fps durante 2 s, los topes de
 * partículas, impactos, cifras y ambiente bajan a la mitad; vuelven al completo tras 8 s por encima de ~57 fps.
 */
const QUALITY = { slowFrame: 1 / 48, fastFrame: 1 / 57, lowAfter: 2, highAfter: 8, low: 0.5 };

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
  private groundKey = '';
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
  private hits: Hit[] = [];
  /** Partículas de ambiente: posición en el mundo, fase del vaivén y color. */
  private motes: { x: number; y: number; phase: number; color: number }[] = [];
  private shake = 0;
  private clock = 0;
  private deathBurst = false;

  private constructor(private app: Application) {
    const layer = () => new Pool(this.world.addChild(new Container()));
    this.props = layer();
    this.under = layer();
    this.pickups = layer();
    this.enemies = layer();
    this.shots = layer();
    this.effects = layer();
    // El personaje y su barra de vida van siempre encima: las armas salen desde detrás de él y nada lo tapa.
    this.actors = layer();
  }

  /**
   * Arranca el motor gráfico probando de más a menos exigente: WebGL a la resolución de la pantalla (hasta 2×,
   * de sobra para pixel art), WebGL a 1× y en bajo consumo, y por último el dibujado con Canvas 2D, que funciona
   * en cualquier navegador aunque WebGL esté desactivado o falle (iOS en modo de bajo consumo o con el modo de
   * aislamiento, contextos perdidos…). `localStorage['tasky-game-renderer'] = 'canvas'` fuerza el último (pruebas).
   */
  static async create(host: HTMLElement): Promise<Renderer> {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const attempts: Partial<ApplicationOptions>[] = [
      { preference: 'webgl', resolution: dpr },
      { preference: 'webgl', resolution: 1, powerPreference: 'low-power' },
      { preference: 'canvas', resolution: 1 },
    ];
    let forced: string | null = null;
    try {
      forced = localStorage.getItem('tasky-game-renderer');
    } catch {
      // Sin almacenamiento: se usa el orden normal.
    }
    const errors: string[] = [];
    for (const attempt of forced === 'canvas' ? attempts.slice(-1) : attempts) {
      const app = new Application();
      try {
        await app.init({
          ...attempt,
          resizeTo: host,
          background: 0x12201a,
          antialias: false,
          autoStart: false,
          autoDensity: true,
        });
        host.appendChild(app.canvas);
        const renderer = new Renderer(app);
        renderer.loadTextures();
        return renderer;
      } catch (e) {
        errors.push(`${attempt.preference}@${attempt.resolution}: ${e instanceof Error ? e.message : String(e)}`);
        try {
          app.destroy({ removeView: true });
        } catch {
          // Si ni siquiera llegó a crearse, no hay nada que liberar.
        }
      }
    }
    throw new Error(`No se pudo iniciar ningún motor gráfico (${errors.join(' · ')})`);
  }

  /** Motor gráfico en uso (para el aviso de rendimiento y los diagnósticos). */
  get kind(): string {
    return this.app.renderer.name + (this.quality < 1 ? ' · efectos reducidos' : '');
  }

  private quality = 1;
  private frameAvg = 1 / 60;
  private qualityTimer = 0;

  /** Ajusta `quality` según el tiempo medio de fotograma (ver QUALITY). */
  private adapt(dt: number) {
    if (dt <= 0) return;
    this.frameAvg += (Math.min(dt, 0.1) - this.frameAvg) * 0.1;
    const wants = this.quality === 1 ? this.frameAvg > QUALITY.slowFrame : this.frameAvg < QUALITY.fastFrame;
    this.qualityTimer = wants ? this.qualityTimer + dt : 0;
    if (this.qualityTimer >= (this.quality === 1 ? QUALITY.lowAfter : QUALITY.highAfter)) {
      this.quality = this.quality === 1 ? QUALITY.low : 1;
      this.qualityTimer = 0;
    }
  }

  /** Tope de efectos según la calidad actual. */
  private cap(max: number) {
    return Math.floor(max * this.quality);
  }

  private loadTextures() {
    const atlas = buildAtlas();
    const source = Texture.from(atlas.canvas).source;
    source.scaleMode = 'nearest';
    for (const [name, f] of atlas.frames) {
      this.textures.set(name, new Texture({ source, frame: new Rectangle(f.x, f.y, f.w, f.h) }));
    }
    this.ground = new TilingSprite({ texture: this.groundTexture('t_grass'), width: 16, height: 16 });
    this.app.stage.addChild(this.ground, this.world);
  }

  /** Cambia el suelo al del escenario (solo se recalcula cuando cambia). */
  private setGround(key: string) {
    if (key === this.groundKey) return;
    this.ground.texture.destroy(true);
    this.ground.texture = this.groundTexture(key);
  }

  private groundTexture(key: string): Texture {
    const g = GROUNDS[key] ?? GROUNDS.t_grass;
    this.groundKey = key in GROUNDS ? key : 't_grass';
    this.motes = [];
    this.app.renderer.background.color = g.background;
    const tile = Texture.from(buildGroundTile(g));
    tile.source.scaleMode = 'nearest';
    return tile;
  }

  private tex(name: string, white = false): Texture {
    const key = name + (white ? WHITE : '');
    return this.textures.get(key) ?? Texture.WHITE;
  }

  /** Incorpora los efectos emitidos por la simulación desde el último fotograma. */
  private consume(fx: Fx[]) {
    for (const f of fx) {
      if (f.type === 'number') {
        if (this.numbers.length >= this.cap(MAX_NUMBERS)) this.numbers.shift();
        this.numbers.push({
          x: f.x + (Math.random() - 0.5) * 8,
          y: f.y,
          value: f.value,
          life: NUMBER_LIFE,
          color: f.player ? 0xff6b6b : f.crit ? 0xffd75e : 0xffffff,
          big: f.crit || f.player,
        });
      } else if (f.type === 'puff') {
        for (let i = 0; i < f.count && this.particles.length < this.cap(MAX_PARTICLES); i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 20 + Math.random() * 60;
          this.particles.push({
            x: f.x,
            y: f.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.25 + Math.random() * 0.25,
            color: f.color,
            glow: 0.7 + Math.random() * 0.9,
          });
        }
      } else if (f.type === 'hit') {
        if (this.hits.length < this.cap(MAX_HITS)) this.hits.push({ x: f.x, y: f.y, sprite: f.sprite, life: HIT_LIFE });
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
  /**
   * `dying`: avance de la animación de muerte (0–1), o null mientras se juega. Hay dos: derrota (cae, se tiñe de
   * rojo y se desvanece) y nivel completado por La Muerte (el alma asciende con un destello dorado).
   */
  draw(w: World, dt: number, dying: number | null = null) {
    this.clock += dt;
    this.adapt(dt);
    if (dying === null) this.deathBurst = false;
    else if (!this.deathBurst) {
      this.deathBurst = true;
      this.burstDeath(w);
    }
    this.consume(w.fx);
    const { width, height } = this.app.screen;
    const dpr = this.app.renderer.resolution;
    // Zoom en pasos de píxel de dispositivo: cada píxel del arte ocupa un número entero de píxeles reales.
    const ideal = Math.max(Math.min(width, height) / VIEW_SHORT, Math.max(width, height) / VIEW_LONG);
    const zoom = Math.max(1, Math.round(ideal * dpr)) / dpr;
    const p = w.player;
    this.setGround(w.config.stage.ground);

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
    // Ambiente: cuando una partícula sale de la vista reaparece por el borde opuesto.
    const amb = GROUNDS[this.groundKey].ambient;
    if (this.motes.length > this.cap(AMBIENT_COUNT)) this.motes.length = this.cap(AMBIENT_COUNT);
    while (this.motes.length < this.cap(AMBIENT_COUNT)) {
      this.motes.push({
        x: p.x + (Math.random() * 2 - 1) * halfW,
        y: p.y + (Math.random() * 2 - 1) * halfH,
        phase: Math.random() * Math.PI * 2,
        color: amb.colors[this.motes.length % amb.colors.length],
      });
    }
    for (const m of this.motes) {
      m.phase += dt;
      m.x += (amb.vx + Math.cos(m.phase * 1.3) * amb.sway) * dt;
      m.y += amb.vy * dt;
      if (m.x < p.x - halfW) m.x += halfW * 2;
      else if (m.x > p.x + halfW) m.x -= halfW * 2;
      if (m.y < p.y - halfH) m.y += halfH * 2;
      else if (m.y > p.y + halfH) m.y -= halfH * 2;
      const s = this.props.next(this.tex('px'));
      s.position.set(m.x, m.y);
      s.scale.set(0.5);
      s.tint = m.color;
      s.alpha = amb.twinkle ? amb.alpha * (0.35 + 0.65 * Math.abs(Math.sin(m.phase * 2))) : amb.alpha;
    }
    this.props.end();

    // Bajo los personajes: aura de ascuas.
    this.under.begin();
    const ember = p.weapons.find((ws) => behaviourOf(ws.id) === 'ember');
    if (ember) this.drawGarlicAura(p.x, p.y, emberRadius(w, ember), WEAPON_BY_ID.get(ember.id)?.color ?? 0xdff0b0, ember.id !== 'ember');
    // Zonas marcadas por los jefes de ciclo: se intensifican hasta estallar (sim/bosses.ts).
    for (const h of w.hazards ?? []) {
      const kind = h.kind ?? 'blast';
      if (kind !== 'beam' && !visible(h.x, h.y)) continue;
      const left = Math.max(0, Math.min(1, h.at - w.time));
      const armed = w.time >= h.at;
      if (kind === 'beam') {
        // Rayo: línea fina de aviso y, al dispararse, ancho y brillante.
        const dx = (h.x2 ?? h.x) - h.x;
        const dy = (h.y2 ?? h.y) - h.y;
        const line = this.under.next(this.tex('px'));
        line.position.set(h.x + dx / 2, h.y + dy / 2);
        line.rotation = Math.atan2(dy, dx);
        line.scale.set(Math.hypot(dx, dy) / 2, armed ? h.radius : 0.75);
        line.tint = armed ? 0xffffff : (h.color ?? 0xff3c2e);
        line.alpha = armed ? 0.85 : 0.25 + (1 - left) * 0.4;
        if (armed) {
          const glow = this.under.next(this.tex('px'));
          glow.position.copyFrom(line.position);
          glow.rotation = line.rotation;
          glow.scale.set(line.scale.x, h.radius * 1.8);
          glow.tint = h.color ?? 0xff3c2e;
          glow.alpha = 0.45;
        }
        continue;
      }
      if (kind === 'ring') {
        // Onda sísmica: la corona que va a golpear.
        for (const r of [h.inner ?? 0, h.radius]) {
          const edge = this.under.next(this.tex('ring'));
          edge.position.set(h.x, h.y);
          edge.scale.set(r / CIRCLE_RADIUS);
          edge.tint = 0xffa04a;
          edge.alpha = 0.3 + (1 - left) * 0.5;
        }
        continue;
      }
      const lasting = kind === 'zone' || kind === 'slow';
      const zone = this.under.next(this.tex('disc'));
      zone.position.set(h.x, h.y);
      zone.scale.set(h.radius / CIRCLE_RADIUS);
      zone.tint = kind === 'zone' ? 0x7fd94a : kind === 'slow' ? (h.color ?? 0x6bf2e0) : 0xff3c2e;
      zone.alpha = lasting ? (armed ? 0.3 : 0.12) : 0.12 + (1 - left) * 0.3;
      const rim = this.under.next(this.tex('ring'));
      rim.position.set(h.x, h.y);
      rim.scale.set(h.radius / CIRCLE_RADIUS);
      rim.tint = kind === 'zone' ? 0x9fd94a : kind === 'slow' ? 0xd8fffb : 0xff6b4a;
      rim.alpha = lasting ? 0.55 : 0.5 + Math.sin(this.clock * 20) * 0.2;
    }
    this.under.end();

    this.pickups.begin();
    for (const item of w.pickups) {
      if (!visible(item.x, item.y)) continue;
      const name =
        item.kind === 'xp'
          ? item.value >= 10
            ? 'i_xp3'
            : item.value >= 3
              ? 'i_xp2'
              : 'i_xp1'
          : item.kind === 'coin'
            ? 'i_coin'
            : `i_${item.kind}`;
      const s = this.pickups.next(this.tex(name));
      s.position.set(item.x, item.y + (item.kind === 'chest' ? Math.sin(this.clock * 4) * 1.5 : 0));
    }
    this.pickups.end();

    this.enemies.begin();
    for (const e of w.enemies) {
      if (!visible(e.x, e.y) || e.def.ai === 'boss') continue;
      const s = this.enemies.next(this.tex(e.def.sprite, e.flash > 0));
      // Sombras y cabezas son copias pequeñas y oscuras de su jefe.
      const copy = e.def.id === 'clone' || e.def.id === 'head';
      // La Muerte se dibuja a ~48 px de alto, sea cual sea su sprite.
      const size = e.def.ai === 'reaper' ? 48 / s.texture.height : e.elite ? 1.5 : e.champion ? 1.2 : copy ? 0.6 : 1;
      // Rebote al andar (aplastar y estirar) y orientación hacia el jugador.
      const bounce = 1 + Math.sin(this.clock * 9 + e.uid) * 0.07;
      s.scale.set((p.x < e.x ? -size : size) * (2 - bounce), size * bounce);
      s.position.set(e.x, e.y);
      if (e.elite && e.flash <= 0) s.tint = 0xffe08a;
      // Veteranos: más grandes y rojizos.
      else if (e.champion && e.flash <= 0) s.tint = 0xff9c8a;
      if (copy && e.flash <= 0) {
        s.tint = e.def.id === 'clone' ? 0x6a5a9a : 0x9adf9a;
        s.alpha = 0.85;
      }
      // Congelados, azul hielo y quietos; ralentizados, algo azulados.
      if ((e.freeze ?? 0) > 0) {
        s.tint = 0x9fd8ff;
        s.scale.set(p.x < e.x ? -size : size, size);
      } else if ((e.chill ?? 0) > 0 && e.flash <= 0) s.tint = 0xc8b8ff;
    }
    // Jefes encima del resto de enemigos, mucho más grandes que el jugador y con un aura de su color.
    for (const e of w.enemies) {
      if (!visible(e.x, e.y) || e.def.ai !== 'boss') continue;
      const color = e.def.color ?? 0xff5a5a;
      // Altura en pantalla fija (jefes de ciclo ~64 px, de escenario ~54 px), sea cual sea el tamaño de su sprite.
      const size = (e.def.patterns ? 64 : 54) / this.tex(e.def.sprite).height;
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * 4 + e.uid);
      const aura = this.enemies.next(this.tex('disc'));
      aura.position.set(e.x, e.y + 4);
      aura.scale.set(((e.radius + 10) * size * 0.6) / CIRCLE_RADIUS, ((e.radius + 10) * size * 0.3) / CIRCLE_RADIUS);
      aura.tint = color;
      aura.alpha = 0.22 + pulse * 0.12;
      const rim = this.enemies.next(this.tex('ring'));
      rim.position.copyFrom(aura.position);
      rim.scale.copyFrom(aura.scale);
      rim.tint = color;
      rim.alpha = 0.55 + pulse * 0.3;
      const s = this.enemies.next(this.tex(e.def.sprite, e.flash > 0));
      const bounce = 1 + Math.sin(this.clock * 5 + e.uid) * 0.04;
      s.scale.set((p.x < e.x ? -size : size) * (2 - bounce), size * bounce);
      s.position.set(e.x, e.y - 4);
    }
    this.enemies.end();

    this.actors.begin();
    // Las partidas guardadas antes de existir los demás personajes no traen sprite: usan el del héroe base.
    const sprite = w.config.sprite ?? 'hero';
    const skin = w.config.skin;
    if (skin?.aura !== undefined && dying === null) {
      // Aura del aspecto: un anillo que late bajo los pies.
      const aura = this.actors.next(this.tex('ring'));
      aura.position.set(p.x, p.y + 6);
      aura.scale.set(0.42 + Math.sin(this.clock * 3) * 0.03, 0.17);
      aura.tint = skin.aura;
      aura.alpha = 0.8;
    }
    const hero = this.actors.next(this.tex(`${sprite}_${p.moving && Math.floor(this.clock * 8) % 2 === 1 ? 1 : 0}`));
    hero.position.set(p.x, p.y - 2);
    hero.scale.x = p.dirX < 0 ? -1 : 1;
    if (skin) hero.tint = skin.tint;
    // Al recibir daño destella en rojo, sin volverse transparente: el personaje se ve siempre.
    if (p.hurtTimer > 0 && dying === null && Math.floor(this.clock * 20) % 2 === 0) hero.tint = 0xff7a7a;
    // Escudo del Laurel: burbuja verde mientras le quede alguna carga (roja con el Sudario Carmesí).
    const shield = p.shield ?? 0;
    const shroud = p.weapons.some((x) => x.id === 'thornmail');
    if (shield >= 1 && dying === null) {
      const bubble = this.actors.next(this.tex('ring'));
      bubble.position.set(p.x, p.y - 2);
      bubble.scale.set((14 + Math.sin(this.clock * 6)) / CIRCLE_RADIUS);
      bubble.tint = shroud ? 0xff5a6a : 0x9fe8a0;
      bubble.alpha = 0.5 + 0.15 * Math.min(3, shield);
      const glow = this.actors.next(this.tex('disc'));
      glow.position.copyFrom(bubble.position);
      glow.scale.copyFrom(bubble.scale);
      glow.tint = bubble.tint;
      glow.alpha = 0.15;
    }
    if (dying !== null) {
      const fade = Math.max(0, 1 - dying * 1.15);
      if (w.completed) {
        // El alma sube, pálida, y se disuelve.
        hero.position.y -= dying * 26;
        hero.scale.y = 1 + dying * 0.3;
        hero.tint = 0xcfe9ff;
        hero.alpha = fade * (0.75 + 0.25 * Math.sin(this.clock * 30));
      } else {
        // Se desploma, se tiñe de rojo y se apaga.
        const fall = Math.min(1, dying * 2.5);
        hero.rotation = ((fall * Math.PI) / 2) * (p.dirX < 0 ? -1 : 1);
        hero.position.y += fall * 4;
        hero.tint = dying < 0.4 ? 0xff6b6b : 0x6a5a6a;
        hero.alpha = fade;
      }
    }
    // Barra de vida bajo el personaje.
    const barBack = this.actors.next(this.tex('px'));
    // Barra de vida justo bajo los pies, según la altura del sprite.
    const barY = p.y - 2 + hero.texture.height / 2 + 2;
    barBack.position.set(p.x, barY);
    barBack.scale.set(8, 1.5);
    barBack.tint = 0x0b0a14;
    const ratio = Math.max(0, p.hp / p.stats.maxHp);
    const bar = this.actors.next(this.tex('px'));
    bar.position.set(p.x - 7 + 7 * ratio, barY);
    bar.scale.set(7 * ratio, 0.75);
    bar.tint = ratio > 0.35 ? 0x5ee08a : 0xe5484d;
    if (dying !== null) barBack.alpha = bar.alpha = Math.max(0, 1 - dying * 2);
    this.actors.end();

    this.shots.begin();
    for (const shot of w.projectiles) {
      // Los haces y la galaxia empiezan fuera de la pantalla o la cubren entera.
      if (shot.kind !== 'ray' && shot.kind !== 'galaxy' && !visible(shot.x, shot.y)) continue;
      if (!NO_GLOW.has(shot.kind)) this.glowShot(shot, dt);
      this.drawShot(shot);
    }
    this.shots.end();

    this.drawEffects(dt);
    this.app.render();
  }

  /** Resplandor aditivo bajo cada proyectil y chispas que quedan a su paso: todo lo que vuela brilla. */
  private glowShot(shot: Projectile, dt: number) {
    const color = shot.color ?? SHOT_GLOW[shot.sprite] ?? 0xffe9b0;
    const size = Math.min(34, Math.max(8, shot.radius * 1.5));
    const pulse = 1 + Math.sin(this.clock * 14 + shot.x * 0.1) * 0.12;
    const halo = this.shots.next(this.tex('disc'));
    halo.position.set(shot.x, shot.y);
    halo.scale.set((size * 1.7 * pulse) / CIRCLE_RADIUS);
    halo.tint = color;
    halo.alpha = shot.kind === 'slash' ? 0.1 : 0.2;
    halo.blendMode = 'add';
    const core = this.shots.next(this.tex('disc'));
    core.position.set(shot.x, shot.y);
    core.scale.set((size * 0.8 * pulse) / CIRCLE_RADIUS);
    core.tint = 0xffffff;
    core.alpha = shot.kind === 'slash' ? 0.1 : 0.22;
    core.blendMode = 'add';
    if (SPARKLING.has(shot.kind) && this.particles.length < this.cap(MAX_PARTICLES) && Math.random() < dt * 40) {
      this.particles.push({
        x: shot.x + (Math.random() - 0.5) * size * 0.6,
        y: shot.y + (Math.random() - 0.5) * size * 0.6,
        vx: (Math.random() - 0.5) * 24 - (shot.vx ?? 0) * 0.05,
        vy: (Math.random() - 0.5) * 24 - (shot.vy ?? 0) * 0.05 - 6,
        life: 0.3 + Math.random() * 0.25,
        color: Math.random() < 0.35 ? 0xffffff : color,
        glow: 0.8 + Math.random() * 0.9,
      });
    }
  }

  /** Estela: copias tenues del proyectil detrás de su trayectoria (dirección unitaria `dx, dy`). */
  private trail(shot: Projectile, dx: number, dy: number, rotation: number, steps = 3, gap = 4) {
    for (let i = steps; i >= 1; i--) {
      const t = this.shots.next(this.tex(shot.sprite));
      t.position.set(shot.x - dx * gap * i, shot.y - dy * gap * i);
      t.rotation = rotation;
      t.alpha = 0.5 - i * 0.12;
      t.scale.set(1 - i * 0.12);
    }
  }

  private drawShot(shot: Projectile) {
    const pool = this.shots;
    switch (shot.kind) {
      case 'bomb': {
        // Vuelo en arco: sube y baja, y gira.
        const t = 1 - Math.max(0, shot.life) / shot.total;
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y - Math.sin(t * Math.PI) * 34);
        s.rotation = t * 9;
        return;
      }
      case 'meteor': {
        // Cae del cielo: sombra en el suelo que se concreta al caer y el atún dando vueltas con su estela.
        const t = 1 - Math.max(0, shot.life) / shot.total;
        const shadow = pool.next(this.tex('disc'));
        shadow.position.set(shot.tx, shot.ty);
        shadow.scale.set((shot.radius * (0.3 + 0.7 * t)) / CIRCLE_RADIUS);
        shadow.tint = 0x0b1a2a;
        shadow.alpha = 0.2 + 0.25 * t;
        const rot = Math.atan2(shot.ty - shot.sy, shot.tx - shot.sx);
        this.trail(shot, Math.cos(rot), Math.sin(rot), shot.angle, 3, 6);
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        s.rotation = shot.angle;
        return;
      }
      case 'boomerang': {
        const speed = Math.hypot(shot.vx, shot.vy) || 1;
        this.trail(shot, shot.vx / speed, shot.vy / speed, shot.angle, 2, 5);
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        s.rotation = shot.angle;
        return;
      }
      case 'bounce': {
        // Runa o pistola que rebota: gira con una estela larga y un halo.
        const speed = Math.hypot(shot.vx, shot.vy) || 1;
        const halo = pool.next(this.tex('disc'));
        halo.position.set(shot.x, shot.y);
        halo.scale.set((shot.radius * 1.6) / CIRCLE_RADIUS);
        halo.tint = shot.sprite === 'x_gun' ? 0xf6c945 : shot.sprite === 'x_luckyblades' ? 0xff4f9a : 0x7ee8e0;
        halo.alpha = 0.18;
        this.trail(shot, shot.vx / speed, shot.vy / speed, shot.angle, 4, 5);
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        s.rotation = shot.angle;
        return;
      }
      case 'cloud': {
        // Charco: disco tenue del color del arma con un borde y bocanadas (o burbujas) que giran despacio.
        const pulse = 1 + Math.sin(this.clock * 3 + shot.x) * 0.04;
        const color = shot.color ?? 0x6bc5ff;
        const fade = Math.min(1, shot.life * 2);
        const base = pool.next(this.tex('disc'));
        base.position.set(shot.x, shot.y);
        base.scale.set((shot.radius * pulse) / CIRCLE_RADIUS);
        base.tint = color;
        // Varios charcos grandes se solapan: el disco va tenue para no teñir toda la pantalla.
        base.alpha = (shot.radius > 60 ? 0.12 : 0.22) * fade;
        const rim = pool.next(this.tex('ring'));
        rim.position.set(shot.x, shot.y);
        rim.scale.set((shot.radius * pulse) / CIRCLE_RADIUS);
        rim.tint = 0xffffff;
        rim.alpha = 0.3 * fade;
        const bubbles = shot.sprite === 'x_bubble';
        for (let i = 0; i < (bubbles ? 5 : 3); i++) {
          const a = this.clock * 0.8 + i * 2.1 + shot.x;
          const rise = bubbles ? (this.clock * 0.7 + i * 0.37) % 1 : 0;
          const puff = pool.next(this.tex(shot.sprite));
          puff.position.set(shot.x + Math.cos(a) * shot.radius * 0.5, shot.y + Math.sin(a) * shot.radius * 0.4 - rise * 10);
          // Con mucha área, las bocanadas no crecen más (se verían como bloques que tapan a los enemigos).
          puff.scale.set(bubbles ? 1 : Math.min(3, Math.max(1, shot.radius / 22)));
          puff.alpha = Math.min(0.55, shot.life * 0.8) * (1 - rise * 0.6);
        }
        // Destellos que suben del charco.
        for (let i = 0; i < 4; i++) {
          const rise = (this.clock * 0.9 + i * 0.25 + shot.x * 0.01) % 1;
          const a = i * 2.4 + shot.x;
          const mote = pool.next(this.tex('disc'));
          mote.position.set(shot.x + Math.cos(a) * shot.radius * 0.6, shot.y + Math.sin(a) * shot.radius * 0.35 - rise * 16);
          mote.scale.set((1.8 * (1 - rise)) / CIRCLE_RADIUS);
          mote.tint = 0xffffff;
          mote.alpha = 0.7 * fade * (1 - rise);
          mote.blendMode = 'add';
        }
        return;
      }
      case 'slash': {
        // Destello del tajo: la media luna se estira y se desvanece.
        const t = 1 - Math.max(0, shot.life) / shot.total;
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        s.rotation = shot.angle;
        if (shot.sprite === 'x_finisher') s.scale.set(Math.max(1, shot.radius / 40) * (1 + t * 0.5), shot.radius / 11);
        else if (shot.sprite === 'x_victory') s.scale.set(shot.radius / 20, shot.radius / 14);
        else {
          // Estela de Látigo / Viento Sacro: media luna alargada que barre hacia fuera y se desvanece.
          const sweep = 1 - (1 - Math.min(1, t * 2.5)) ** 2;
          const sx = (shot.radius * 1.2) / 20;
          s.scale.set(sx * (0.5 + 0.5 * sweep), sx * (1.1 - 0.4 * t));
          s.alpha = (1 - t) ** 0.7 * (shot.radius > 60 ? 0.5 : 1);
          // Filo brillante que se adelanta al tajo y lo deja ardiendo.
          const edge = pool.next(this.tex(shot.sprite));
          edge.position.set(shot.x, shot.y);
          edge.rotation = shot.angle;
          edge.scale.set(s.scale.x * 1.12, s.scale.y * 1.12);
          edge.tint = 0xffffff;
          edge.alpha = s.alpha * 0.55;
          edge.blendMode = 'add';
          return;
        }
        // Muy ampliado se vuelve translúcido para no tapar la escena.
        s.alpha = (1 - t) * (shot.radius > 60 ? 0.45 : 1);
        return;
      }
      case 'axe':
      case 'spin': {
        const speed = Math.hypot(shot.vx, shot.vy) || 1;
        this.trail(shot, shot.vx / speed, shot.vy / speed, shot.angle, 2, 5);
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        s.rotation = shot.angle;
        s.scale.set(Math.max(1, shot.radius / 8));
        return;
      }
      case 'critter': {
        // Remolino: gira deformándose, con polvo en la base y un atún dando vueltas dentro.
        const base = pool.next(this.tex('disc'));
        base.position.set(shot.x, shot.y + 7);
        base.scale.set(9 / CIRCLE_RADIUS, 3 / CIRCLE_RADIUS);
        base.tint = 0xd8f0ff;
        base.alpha = 0.3;
        const s = pool.next(this.tex(shot.sprite));
        const size = Math.max(1, shot.radius / 8);
        s.position.set(shot.x + Math.sin(this.clock * 18) * 1.5, shot.y);
        s.scale.set((Math.sin(this.clock * 20) > 0 ? 1 : -1) * size, size);
        s.alpha = Math.min(1, shot.life * 3);
        const fish = pool.next(this.tex('x_tuna'));
        fish.position.set(shot.x + Math.cos(this.clock * 9) * 4, shot.y - 2 + Math.sin(this.clock * 9) * 2);
        fish.rotation = this.clock * 9;
        fish.scale.set(0.6);
        fish.alpha = s.alpha;
        return;
      }
      case 'column': {
        this.drawManaColumn(pool, shot);
        return;
      }
      case 'ray': {
        // Haz o rayo: halo del color del arma y núcleo blanco que se estrechan al apagarse; los rayos finos, quebrados.
        const t = Math.max(0, shot.life) / shot.total;
        const color = shot.color ?? 0xffffff;
        const dx = shot.tx - shot.x;
        const dy = shot.ty - shot.y;
        const len = Math.hypot(dx, dy) || 1;
        const jagged = shot.radius < 3.5 && len > 30;
        const parts = jagged ? 5 : 1;
        let px = shot.x;
        let py = shot.y;
        for (let k = 1; k <= parts; k++) {
          const f = k / parts;
          const off = k < parts ? Math.sin(shot.sx * 0.37 + k * 2.3 + this.clock * 40) * 6 : 0;
          const nx = shot.x + dx * f - (dy / len) * off;
          const ny = shot.y + dy * f + (dx / len) * off;
          const sdx = nx - px;
          const sdy = ny - py;
          const glow = pool.next(this.tex('px'));
          glow.position.set(px + sdx / 2, py + sdy / 2);
          glow.rotation = Math.atan2(sdy, sdx);
          glow.scale.set(Math.hypot(sdx, sdy) / 2 + 0.5, shot.radius * (0.5 + t * 0.5));
          glow.tint = color;
          glow.alpha = (shot.radius > 6 ? 0.35 : 0.55) * t + 0.15;
          const core = pool.next(this.tex('px'));
          core.position.copyFrom(glow.position);
          core.rotation = glow.rotation;
          core.scale.set(glow.scale.x, Math.max(0.5, shot.radius * 0.35 * t));
          core.alpha = Math.min(1, t * 1.4);
          px = nx;
          py = ny;
        }
        if (jagged) {
          const spark = pool.next(this.tex('disc'));
          spark.position.set(shot.tx, shot.ty);
          spark.scale.set((6 * t + 2) / CIRCLE_RADIUS);
          spark.tint = color;
          spark.alpha = t;
        }
        return;
      }
      case 'flare': {
        // Llamarada: crece, sube un poco y se apaga, con un resplandor cálido (rojo oscuro en las Cenizas).
        const t = 1 - Math.max(0, shot.life) / shot.total;
        const ash = shot.sprite === 'x_ashflame';
        const glow = pool.next(this.tex('disc'));
        glow.position.set(shot.x, shot.y);
        glow.scale.set((shot.radius * 1.3) / CIRCLE_RADIUS);
        glow.tint = ash ? 0x7a1a24 : 0xff6a2a;
        glow.alpha = 0.25 * (1 - t);
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y - t * 4);
        s.rotation = Math.sin(shot.sx * 0.3) * 0.5;
        s.scale.set(Math.max(0.6, shot.radius / 5));
        s.alpha = 1 - t * t;
        return;
      }
      case 'leap': {
        // Atún saltarín: gira en el aire, se mece junto al jugador y suelta burbujas.
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        s.rotation = shot.total === 0 ? Math.atan2(shot.vy, shot.vx || 0.001) : Math.sin(this.clock * 6) * 0.3;
        s.scale.set(Math.max(1, shot.radius / 8));
        s.alpha = Math.min(1, shot.life * 3);
        const b = pool.next(this.tex('x_bubble'));
        const rise = (this.clock * 1.5 + shot.sx) % 1;
        b.position.set(shot.x - 5, shot.y - 4 - rise * 10);
        b.alpha = (1 - rise) * s.alpha;
        return;
      }
      case 'dragon': {
        // Dragón espectral: anillos que siguen a la cabeza por su ocho, con un halo verde.
        for (let k = 6; k >= 1; k--) {
          const a = shot.angle - k * 0.12;
          const seg = pool.next(this.tex('disc'));
          seg.position.set(shot.x + (Math.sin(a) - Math.sin(shot.angle)) * 110, shot.y + (Math.sin(a * 2) - Math.sin(shot.angle * 2)) * 25);
          seg.scale.set((7 - k * 0.7) / CIRCLE_RADIUS);
          seg.tint = k % 2 ? 0x2c9a56 : 0x5ee08a;
          seg.alpha = 0.75;
        }
        const halo = pool.next(this.tex('disc'));
        halo.position.set(shot.x, shot.y);
        halo.scale.set(14 / CIRCLE_RADIUS);
        halo.tint = 0x5ee08a;
        halo.alpha = 0.18 + Math.sin(this.clock * 8) * 0.06;
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        s.scale.set(Math.cos(shot.angle) >= 0 ? 1 : -1, 1);
        return;
      }
      case 'galaxy': {
        // Galaxia: brazos de estrellas que giran sobre toda la pantalla y se recogen al final.
        const fade = Math.min(1, shot.life, (10 - shot.life) * 2);
        for (let arm = 0; arm < 4; arm++)
          for (let k = 0; k < 14; k++) {
            const r = 12 + k * 15;
            const a = shot.angle + arm * (Math.PI / 2) + k * 0.32;
            const star = pool.next(this.tex(k % 3 === 0 ? 'disc' : 'px'));
            star.position.set(shot.x + Math.cos(a) * r, shot.y + Math.sin(a) * r * 0.62);
            star.scale.set(k % 3 === 0 ? (3 + (k % 2)) / CIRCLE_RADIUS : 1);
            star.tint = [0x8f7bff, 0x6bc5ff, 0xff7ac3, 0xffffff][(arm + k) % 4];
            star.alpha = fade * (0.9 - k * 0.04);
          }
        const veil = pool.next(this.tex('disc'));
        veil.position.set(shot.x, shot.y);
        veil.scale.set(230 / CIRCLE_RADIUS, 140 / CIRCLE_RADIUS);
        veil.tint = 0x3a2f5c;
        veil.alpha = 0.18 * fade;
        return;
      }
      case 'enemyShot': {
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        s.rotation = shot.angle;
        s.scale.set(1.5);
        return;
      }
      default: {
        if (shot.kind === 'bolt' || shot.kind === 'lance')
          this.trail(shot, Math.cos(shot.angle), Math.sin(shot.angle), shot.angle, 2, shot.kind === 'bolt' ? 4 : 8);
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        if (shot.kind !== 'orbit') s.rotation = shot.angle;
        if (shot.kind === 'lance') s.scale.set(1, Math.max(1, shot.radius / 6));
      }
    }
  }

  /** Estallido al morir: sangre y humo en la derrota; luz dorada y blanca al completar el nivel. */
  private burstDeath(w: World) {
    const p = w.player;
    const colors = w.completed ? [0xffffff, 0xf6c945, 0xcfe9ff] : [0xe5484d, 0x9b2335, 0x5a5670];
    for (let i = 0; i < 40 && this.particles.length < this.cap(MAX_PARTICLES); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 25 + Math.random() * 70;
      this.particles.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (w.completed ? 40 : 0),
        life: 0.5 + Math.random() * 0.7,
        color: colors[i % colors.length],
      });
    }
    for (let i = 0; i < 3; i++) this.rings.push({ x: p.x, y: p.y, radius: 14 + i * 14, life: RING_LIFE * (1 + i * 0.6), color: colors[i] });
    this.shake = Math.max(this.shake, w.completed ? 6 : 10);
  }

  /**
   * Ajo / Engullealmas: aura que late como un halo suave (discos concentrales aditivos, borde ondulante y destellos
   * que giran), no un disco plano. La evolución añade un segundo anillo y volutas que orbitan.
   */
  private drawGarlicAura(x: number, y: number, radius: number, color: number, evolved: boolean) {
    const layer = this.under;
    const pulse = 1 + Math.sin(this.clock * 4) * 0.035;
    const r = radius * pulse;
    const glow = (scale: number, alpha: number, tint = color) => {
      const d = layer.next(this.tex('disc'));
      d.position.set(x, y);
      d.scale.set((r * scale) / CIRCLE_RADIUS);
      d.tint = tint;
      d.alpha = alpha;
      d.blendMode = 'add';
    };
    for (let i = 0; i < 4; i++) glow(1 - i * 0.2, 0.05 + i * 0.015);
    if (evolved) glow(0.45, 0.14, 0xffffff);
    for (let k = 0; k < 2; k++) {
      const ring = layer.next(this.tex('ring'));
      ring.position.set(x, y);
      ring.scale.set((r * (1 - k * 0.07 + Math.sin(this.clock * 5 + k * 2) * 0.012)) / CIRCLE_RADIUS);
      ring.tint = color;
      ring.alpha = 0.34 - k * 0.14;
      ring.blendMode = 'add';
    }
    // Borde ondulante: destellos que respiran sobre el perímetro.
    const beads = evolved ? 24 : 16;
    for (let k = 0; k < beads; k++) {
      const a = (k / beads) * Math.PI * 2 + this.clock * (evolved ? 0.9 : 0.4);
      const wob = 1 + Math.sin(this.clock * 6 + k * 1.9) * 0.035;
      const bead = layer.next(this.tex('disc'));
      bead.position.set(x + Math.cos(a) * r * wob, y + Math.sin(a) * r * wob);
      bead.scale.set((1.6 + Math.sin(this.clock * 7 + k) * 0.7) / CIRCLE_RADIUS);
      bead.tint = k % 3 === 0 ? 0xffffff : color;
      bead.alpha = 0.5;
      bead.blendMode = 'add';
    }
    if (evolved) {
      // Volutas que orbitan por dentro, con estela.
      for (let k = 0; k < 6; k++) {
        for (let t = 0; t < 4; t++) {
          const a = this.clock * 1.6 + (k / 6) * Math.PI * 2 - t * 0.16;
          const wisp = layer.next(this.tex('disc'));
          wisp.position.set(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62);
          wisp.scale.set((4.5 - t) / CIRCLE_RADIUS);
          wisp.tint = t === 0 ? 0xffffff : color;
          wisp.alpha = 0.55 - t * 0.12;
          wisp.blendMode = 'add';
        }
      }
    }
  }

  /**
   * Canción de Maná / Partitura de Maná: haz vertical de bordes ondulantes que se afina hacia los extremos, con núcleo
   * brillante, hebras de energía entrelazadas y notas que suben. La hitbox sigue siendo la columna del arma.
   */
  private drawManaColumn(pool: Pool, shot: Projectile) {
    const evolved = shot.sprite !== 'x_mana';
    const fade = Math.min(1, shot.life * 4);
    const color = evolved ? 0xc89bff : 0x8fb8ff;
    const slices = 18;
    const sliceHalf = COLUMN_HALF / slices;
    const spread = evolved ? 1.15 : 1;
    for (let i = 0; i < slices; i++) {
      const t = (i + 0.5) / slices;
      const taper = Math.pow(Math.sin(Math.PI * t), 0.45);
      const wave = 1 + Math.sin(this.clock * 9 + i * 0.8) * 0.13;
      const half = shot.radius * spread * taper * wave;
      const y = shot.y - COLUMN_HALF + (i + 0.5) * sliceHalf * 2;
      const strip = (width: number, tint: number, alpha: number, dx = 0) => {
        const s = pool.next(this.tex('px'));
        s.position.set(shot.x + dx, y);
        s.scale.set(Math.max(0.3, width), sliceHalf + 0.4);
        s.tint = tint;
        s.alpha = alpha * fade * Math.min(1, taper * 1.4);
        s.blendMode = 'add';
      };
      strip(half * 1.6, color, 0.09);
      strip(half, color, 0.2);
      strip(half * 0.32 * (1 + Math.sin(this.clock * 13 - i * 0.7) * 0.25), 0xffffff, 0.5);
      // Bordes brillantes que ondulan: rompen la forma de rectángulo.
      for (const side of [-1, 1]) strip(0.9, 0xffffff, 0.45, side * half);
      if (evolved) {
        // Dos hebras de energía que se trenzan a lo largo del haz.
        for (const side of [-1, 1]) strip(1.4, 0xffd9ff, 0.7, Math.sin(this.clock * 6 + i * 0.55) * half * 0.7 * side);
      }
    }
    // Notas que suben por el haz.
    for (let i = 0; i < (evolved ? 7 : 4); i++) {
      const rise = (this.clock * 0.6 + i * (evolved ? 0.143 : 0.25)) % 1;
      const rune = pool.next(this.tex(shot.sprite));
      rune.position.set(shot.x + Math.sin(this.clock * 3 + i * 1.7) * shot.radius * 0.55, shot.y + COLUMN_HALF * 0.85 - rise * COLUMN_HALF * 1.7);
      rune.alpha = fade * Math.sin(Math.PI * rise);
    }
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
      s.blendMode = 'add';
      const wash = fx.next(this.tex('disc'));
      wash.position.set(ring.x, ring.y);
      wash.scale.set((ring.radius * (0.4 + 0.6 * t)) / CIRCLE_RADIUS);
      wash.tint = ring.color;
      wash.alpha = 0.16 * (1 - t);
      wash.blendMode = 'add';
      const inner = fx.next(this.tex('ring'));
      inner.position.set(ring.x, ring.y);
      inner.scale.set((ring.radius * (0.25 + 0.55 * t)) / CIRCLE_RADIUS);
      inner.tint = 0xffffff;
      inner.alpha = 0.7 * (1 - t) ** 2;
      inner.blendMode = 'add';
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
        const len = Math.hypot(dx, dy) / 2;
        const k = bolt.life / BOLT_LIFE;
        s.scale.set(len, 3.2);
        s.tint = bolt.color;
        s.alpha = 0.35 * k;
        s.blendMode = 'add';
        const core = fx.next(this.tex('px'));
        core.position.copyFrom(s.position);
        core.rotation = s.rotation;
        core.scale.set(len, 1);
        core.alpha = k;
        core.blendMode = 'add';
        const flash = fx.next(this.tex('disc'));
        flash.position.set(pts[i], pts[i + 1]);
        flash.scale.set((4 + 4 * k) / CIRCLE_RADIUS);
        flash.tint = bolt.color;
        flash.alpha = 0.5 * k;
        flash.blendMode = 'add';
      }
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);

    // Impactos: anticipación, impacto y disipación, con mezcla aditiva.
    for (const hit of this.hits) {
      hit.life -= dt;
      const frame = Math.min(2, Math.floor((1 - hit.life / HIT_LIFE) * 3));
      const s = fx.next(this.tex(`${hit.sprite}_${frame}`));
      s.position.set(hit.x, hit.y);
      s.blendMode = 'add';
      s.scale.set(1.25);
      const flash = fx.next(this.tex('disc'));
      const k = hit.life / HIT_LIFE;
      flash.position.set(hit.x, hit.y);
      flash.scale.set((5 + 9 * (1 - k)) / CIRCLE_RADIUS);
      flash.alpha = 0.5 * k;
      flash.blendMode = 'add';
    }
    this.hits = this.hits.filter((h) => h.life > 0);

    for (const part of this.particles) {
      part.life -= dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      const s = fx.next(this.tex(part.glow ? 'disc' : 'px'));
      s.position.set(part.x, part.y);
      s.tint = part.color;
      s.alpha = Math.min(1, part.life * 5);
      if (part.glow) {
        s.scale.set((part.glow * Math.min(1, part.life * 3) * 2.2) / CIRCLE_RADIUS);
        s.blendMode = 'add';
      }
    }
    this.particles = this.particles.filter((q) => q.life > 0);

    for (const n of this.numbers) {
      n.life -= dt;
      n.y -= 22 * dt;
      const text = String(n.value);
      const size = n.big ? 1.5 : 1;
      // Cifras de 4 px más 1 de separación (los contornos se solapan).
      const startX = n.x - (text.length * 5 * size) / 2 + 2.5 * size;
      for (let i = 0; i < text.length; i++) {
        const s = fx.next(this.tex(`n${text[i]}`));
        s.position.set(startX + i * 5 * size, n.y);
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
