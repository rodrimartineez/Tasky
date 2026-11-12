import { Input } from './input/input';
import { Renderer } from './render/renderer';
import type { RunConfig, RunResult, UpgradeChoice, World } from './sim/types';
import { GameAudio } from './audio/listener';
import { inWave } from './sim/core';
import { banishChoice, evolutionReady, rerollChoices } from './sim/upgrades';
import { chooseUpgrade, createWorld, purgeItems, runResult, step } from './sim/world';

/**
 * Partida en pantalla: une la simulación, el render y los controles con un bucle de paso fijo.
 * La interfaz (React) solo usa esta clase: no conoce la simulación ni PixiJS.
 */

/** Datos que la interfaz muestra durante la partida (se envían varias veces por segundo). */
export interface Hud {
  time: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  kills: number;
  gold: number;
  /** `ready`: al nivel máximo y con la pasiva de su evolución (el próximo cofre la evoluciona). */
  weapons: { id: string; level: number; ready: boolean }[];
  passives: { id: string; level: number }[];
  bossAlive: boolean;
  /** Jefe de ciclo en pantalla: nombre y vida que le queda (0–1). */
  cycleBoss: { name: string; hp: number } | null;
  /** Ha llegado el minuto 30: La Muerte está en camino. */
  reaper: boolean;
  /** Oleada en curso. */
  wave: boolean;
  /** Multiplicador de velocidad de la partida. */
  speed: number;
  /** Repeticiones y descartes que quedan en la partida. */
  rerolls: number;
  banishes: number;
  fps: number;
  /** Motor gráfico en uso («webgl», «canvas»…). */
  graphics: string;
}

function cycleBossHud(w: World): Hud['cycleBoss'] {
  const boss = w.cycleBoss === 1 ? w.enemies.find((e) => !e.dead && e.def.patterns) : undefined;
  return boss ? { name: boss.def.name, hp: Math.max(0, boss.hp / boss.maxHp) } : null;
}

export interface GameCallbacks {
  onHud(hud: Hud): void;
  onLevelUp(choices: UpgradeChoice[]): void;
  /** Se eligió la mejora de eliminar: hay que mostrar el inventario para elegir qué quitar. */
  onPurge(): void;
  /** Cofre abierto: la partida queda detenida hasta llamar a `closeChest()`. */
  onChest(rewards: UpgradeChoice[], gold: number): void;
  onPause(paused: boolean): void;
  onEnd(result: RunResult): void;
}

const STEP = 1 / 60;
/** Tras un tirón (pestaña en segundo plano, recolector de basura) no se intenta recuperar todo el tiempo perdido. */
const MAX_STEPS = 5;
/** Velocidades de partida (las rápidas se desbloquean al superar el nivel 20). La simulación no cambia: solo se dan más pasos por fotograma. */
export const SPEEDS = [1, 1.5, 2];
const HUD_INTERVAL = 0.1;
/** Duración de la animación de muerte: más larga y solemne si La Muerte cierra un nivel completado. */
const deathDuration = (w: World) => (w.completed ? 2.4 : 1.6);

export class Game {
  private world: World;
  private input: Input;
  private frame = 0;
  private last = 0;
  private acc = 0;
  private speed = 1;
  private hudTimer = 0;
  private fps = 60;
  private paused = false;
  /** Presentación de un cofre en curso: la simulación espera sin mostrar la pausa. */
  private chestOpen = false;
  private announced: World['phase'] = 'playing';
  /** Segundos de la animación de muerte ya mostrados (null mientras se juega). */
  private dying: number | null = null;
  private destroyed = false;
  private ended = false;
  private sound: GameAudio;

  private constructor(
    host: HTMLElement,
    config: RunConfig,
    private renderer: Renderer,
    private callbacks: GameCallbacks,
    resume: World | null,
  ) {
    this.world = resume ?? createWorld(config);
    // Una partida reanudada empieza en pausa: el jugador decide cuándo seguir.
    if (resume && resume.phase === 'playing') this.paused = true;
    this.sound = new GameAudio(this.world);
    this.input = new Input(host, () => this.togglePause());
    document.addEventListener('visibilitychange', this.onVisibility);
    this.frame = requestAnimationFrame(this.loop);
  }

  /** `resume`: estado guardado con `snapshot()` para continuar una partida interrumpida. */
  static async start(host: HTMLElement, config: RunConfig, callbacks: GameCallbacks, resume: World | null = null): Promise<Game> {
    const game = new Game(host, config, await Renderer.create(host), callbacks, resume);
    if (game.paused) callbacks.onPause(true);
    return game;
  }

  /** Copia del estado para reanudar la partida más tarde (null si ya ha terminado). Es JSON puro. */
  snapshot(): World | null {
    const w = this.world;
    if (this.ended || w.phase === 'dead') return null;
    return JSON.parse(JSON.stringify({ ...w, fx: [] })) as World;
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.setPaused(true);
  };

  private loop = (now: number) => {
    if (this.destroyed) return;
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(0.25, this.last ? (now - this.last) / 1000 : STEP);
    this.last = now;
    this.fps += (1 / Math.max(dt, 1e-3) - this.fps) * 0.05;
    const w = this.world;

    if (!this.paused && !this.chestOpen && !this.ended && w.phase === 'playing') {
      this.acc += dt * this.speed;
      for (let i = 0; i < MAX_STEPS * Math.ceil(this.speed) && this.acc >= STEP && w.phase === 'playing'; i++) {
        step(w, STEP, this.input.x, this.input.y);
        this.acc -= STEP;
      }
      if (this.acc > STEP) this.acc = 0;
    }

    if (w.chestRewards.length > 0) {
      this.chestOpen = true;
      this.input.release();
      this.callbacks.onChest(w.chestRewards, w.chestGold ?? 0);
      w.chestRewards = [];
    }
    if (w.phase !== this.announced) {
      this.announced = w.phase;
      if (w.phase === 'levelup') {
        this.input.release();
        this.callbacks.onLevelUp(w.choices);
      } else if (w.phase === 'purge') {
        this.input.release();
        this.callbacks.onPurge();
      } else if (w.phase === 'dead') {
        // Breve pausa con la animación de muerte antes de la pantalla de resultado.
        this.input.release();
        this.sendHud();
        this.dying = 0;
      }
    }
    if (this.dying !== null && !this.ended) {
      this.dying += dt;
      if (this.dying >= deathDuration(w)) {
        this.ended = true;
        this.callbacks.onEnd(runResult(w));
      }
    }

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = HUD_INTERVAL;
      this.sendHud();
    }
    const held = this.paused || this.chestOpen || w.phase === 'levelup' || w.phase === 'purge';
    this.sound.frame(w, held);
    // En pausa los efectos se congelan con el resto de la escena.
    this.renderer.draw(
      w,
      held ? 0 : dt,
      this.dying === null ? null : Math.min(1, this.dying / deathDuration(w)),
    );
  };

  private sendHud() {
    const w = this.world;
    const p = w.player;
    this.callbacks.onHud({
      time: w.time,
      hp: p.hp,
      maxHp: p.stats.maxHp,
      level: p.level,
      xp: p.xp,
      xpNext: p.xpNext,
      kills: w.kills,
      gold: Math.floor(w.gold),
      weapons: p.weapons.map((x) => ({ id: x.id, level: x.level, ready: evolutionReady(w, x) !== null })),
      passives: p.passives.map((x) => ({ id: x.id, level: x.level })),
      bossAlive: w.bossAlive,
      cycleBoss: cycleBossHud(w),
      reaper: !!w.completed,
      wave: inWave(w) && !w.completed,
      speed: this.speed,
      rerolls: p.rerolls ?? 0,
      banishes: p.banishes ?? 0,
      fps: Math.round(this.fps),
      graphics: this.renderer.kind,
    });
  }

  /** Elige una mejora de la subida de nivel. Si quedan más niveles pendientes, se vuelven a ofrecer opciones. */
  choose(index: number) {
    const w = this.world;
    chooseUpgrade(w, index);
    this.afterChoice();
  }

  /** Mejora de eliminar: quita las armas y pasivas de esas posiciones del inventario. */
  purge(weapons: number[], passives: number[]) {
    purgeItems(this.world, weapons, passives);
    this.afterChoice();
  }

  private afterChoice() {
    const w = this.world;
    if (w.phase === 'levelup') this.callbacks.onLevelUp(w.choices);
    else if (w.phase === 'purge') this.callbacks.onPurge();
    this.announced = w.phase;
    this.sendHud();
  }

  /** Repite las opciones de la subida de nivel (gasta una repetición). */
  reroll() {
    if (rerollChoices(this.world)) this.refreshChoices();
  }

  /** Descarta la opción `index` para el resto de la partida (gasta un descarte) y saca otras. */
  banish(index: number) {
    if (banishChoice(this.world, index)) this.refreshChoices();
  }

  private refreshChoices() {
    this.callbacks.onLevelUp(this.world.choices);
    this.sendHud();
  }

  /** Cambia la velocidad de la partida (1, 1,5 o 2). */
  setSpeed(speed: number) {
    this.speed = SPEEDS.includes(speed) ? speed : 1;
    this.sendHud();
  }

  setPaused(paused: boolean) {
    if (this.paused === paused || this.ended || this.world.phase === 'dead') return;
    this.paused = paused;
    this.input.release();
    this.callbacks.onPause(paused);
  }

  private togglePause() {
    if (this.world.phase === 'playing' && !this.chestOpen) this.setPaused(!this.paused);
  }

  /** Cierra la presentación del cofre y la partida continúa. */
  closeChest() {
    this.chestOpen = false;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.destroy();
    this.sound.destroy();
    this.renderer.destroy();
  }
}
