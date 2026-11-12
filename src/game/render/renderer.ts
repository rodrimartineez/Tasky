// La CSP de producción (public/_headers) prohíbe eval; este módulo hace que PixiJS genere sus shaders sin él.
import 'pixi.js/unsafe-eval';
import { Application, Container, Rectangle, Sprite, Texture, TilingSprite, type ApplicationOptions } from 'pixi.js';
import { behaviourOf, WEAPON_BY_ID } from '../content/weapons';
import { emberRadius, MINE_ARM } from '../sim/weapons';
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
}
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
    if (ember) {
      const emberColor = WEAPON_BY_ID.get(ember.id)?.color ?? 0xff8a3c;
      const s = this.under.next(this.tex('disc'));
      s.position.set(p.x, p.y);
      s.scale.set(emberRadius(w, ember) / CIRCLE_RADIUS);
      s.tint = emberColor;
      s.alpha = 0.13 + Math.sin(this.clock * 6) * 0.03;
      const edge = this.under.next(this.tex('ring'));
      edge.position.set(p.x, p.y);
      edge.scale.set(emberRadius(w, ember) / CIRCLE_RADIUS);
      edge.tint = 0xffb347;
      edge.alpha = 0.22;
    }
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
      if (!visible(shot.x, shot.y)) continue;
      this.drawShot(shot);
    }
    this.shots.end();

    this.drawEffects(dt);
    this.app.render();
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
        // Sombra en el suelo que se concreta al caer, y la roca con su cola de fuego.
        const t = 1 - Math.max(0, shot.life) / shot.total;
        const shadow = pool.next(this.tex('disc'));
        shadow.position.set(shot.tx, shot.ty);
        shadow.scale.set((shot.radius * (0.3 + 0.7 * t)) / CIRCLE_RADIUS);
        shadow.tint = 0x1a0d0a;
        shadow.alpha = 0.2 + 0.25 * t;
        const rot = Math.atan2(shot.ty - shot.sy, shot.tx - shot.sx);
        this.trail(shot, Math.cos(rot), Math.sin(rot), rot, 4, 6);
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        s.rotation = rot;
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
      case 'ricochet': {
        // Cuchilla giratoria con estela corta en la dirección de vuelo.
        const speed = Math.hypot(shot.vx, shot.vy) || 1;
        this.trail(shot, shot.vx / speed, shot.vy / speed, shot.angle, 3, 5);
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        s.rotation = shot.angle;
        return;
      }
      case 'drone': {
        // Dron: flota con un vaivén suave; aparece y se retira encogiéndose.
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y + Math.sin(this.clock * 5 + shot.angle * 3) * 1.5);
        s.scale.set(Math.min(1, shot.life * 3));
        return;
      }
      case 'flame': {
        // Llama: halo en el suelo y dos lenguas verticales que nacen del suelo y parpadean; se apaga al final.
        const fade = Math.min(1, shot.life * 1.5);
        const halo = pool.next(this.tex('disc'));
        halo.position.set(shot.x, shot.y);
        halo.scale.set(shot.radius / CIRCLE_RADIUS);
        halo.tint = shot.sprite === 'x_flame' ? 0xff7a2c : 0x3f8cff;
        halo.alpha = 0.1 * fade;
        for (let i = 0; i < 2; i++) {
          const flick = Math.sin(this.clock * 14 + shot.x * 0.7 + i * 2.4);
          const tongue = pool.next(this.tex(shot.sprite));
          const size = Math.max(0.8, shot.radius / 16);
          tongue.anchor.set(0.5, 1);
          tongue.position.set(shot.x + (i - 0.5) * shot.radius * 0.6, shot.y + shot.radius * 0.35);
          // Crecen hacia arriba al parpadear, con la base fija en el suelo.
          tongue.scale.set(size, size * (0.85 + 0.2 * flick));
          tongue.alpha = 0.9 * fade;
        }
        return;
      }
      case 'mine': {
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        // Armada: parpadea en rojo; si va a desaparecer, titila.
        if (shot.total - shot.life >= MINE_ARM && Math.floor(this.clock * 4) % 2 === 0) s.tint = 0xff8888;
        if (shot.life < 1.5) s.alpha = Math.floor(this.clock * 10) % 2 === 0 ? 0.4 : 1;
        return;
      }
      case 'beam': {
        // Rayo: núcleo blanco sobre un halo cian, con un destello en la punta.
        const cx = Math.cos(shot.angle);
        const cy = Math.sin(shot.angle);
        const mid = shot.orbitR / 2;
        const glow = pool.next(this.tex('px'));
        glow.position.set(shot.x + cx * mid, shot.y + cy * mid);
        glow.rotation = shot.angle;
        glow.scale.set(shot.orbitR / 2, shot.radius * 0.9);
        glow.tint = 0x4fd6e8;
        glow.alpha = 0.55 + Math.sin(this.clock * 30) * 0.1;
        const core = pool.next(this.tex('px'));
        core.position.set(glow.x, glow.y);
        core.rotation = shot.angle;
        core.scale.set(shot.orbitR / 2, shot.radius * 0.35);
        const tip = pool.next(this.tex(shot.sprite));
        tip.position.set(shot.x + cx * shot.orbitR, shot.y + cy * shot.orbitR);
        tip.rotation = this.clock * 6;
        return;
      }
      case 'cloud': {
        // Nube: disco tenue con tres bocanadas que giran despacio.
        const pulse = 1 + Math.sin(this.clock * 3 + shot.x) * 0.04;
        const base = pool.next(this.tex('disc'));
        base.position.set(shot.x, shot.y);
        base.scale.set((shot.radius * pulse) / CIRCLE_RADIUS);
        base.tint = 0x5ee08a;
        // Varias nubes grandes se solapan: el disco va tenue para no teñir toda la pantalla.
        base.alpha = Math.min(shot.radius > 60 ? 0.1 : 0.22, shot.life * 0.4);
        for (let i = 0; i < 3; i++) {
          const a = this.clock * 0.8 + i * 2.1 + shot.x;
          const puff = pool.next(this.tex(shot.sprite));
          puff.position.set(shot.x + Math.cos(a) * shot.radius * 0.5, shot.y + Math.sin(a) * shot.radius * 0.4);
          // Con mucha área, las bocanadas no crecen más (se verían como bloques que tapan a los enemigos).
          puff.scale.set(Math.min(3, Math.max(1, shot.radius / 22)));
          puff.alpha = Math.min(0.45, shot.life * 0.8);
        }
        return;
      }
      case 'slash': {
        // Destello del látigo: la media luna se estira y se desvanece.
        const t = 1 - Math.max(0, shot.life) / shot.total;
        const s = pool.next(this.tex(shot.sprite));
        s.position.set(shot.x, shot.y);
        s.rotation = shot.angle;
        s.scale.set(shot.radius / 20, shot.radius / 14);
        // Muy ampliado se vuelve translúcido para no tapar la escena.
        s.alpha = (1 - t) * (shot.radius > 60 ? 0.35 : 1);
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

    // Impactos: anticipación, impacto y disipación, con mezcla aditiva.
    for (const hit of this.hits) {
      hit.life -= dt;
      const frame = Math.min(2, Math.floor((1 - hit.life / HIT_LIFE) * 3));
      const s = fx.next(this.tex(`${hit.sprite}_${frame}`));
      s.position.set(hit.x, hit.y);
      s.blendMode = 'add';
    }
    this.hits = this.hits.filter((h) => h.life > 0);

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
