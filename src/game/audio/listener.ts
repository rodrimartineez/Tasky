import { inWave } from '../sim/core';
import type { World } from '../sim/types';
import { audio } from './engine';
import { Music } from './music';
import { play } from './sfx';

/**
 * Sonido de una partida: lo deduce del estado del mundo en cada fotograma (bajas, experiencia, oro, daño
 * recibido, fases, jefes, oleadas) y de sus efectos visuales (golpes, rayos, explosiones). La simulación no
 * sabe nada del sonido, así que sigue siendo pura y determinista.
 */
export class GameAudio {
  private music: Music;
  private prev: { kills: number; xp: number; level: number; gold: number; hp: number; phase: World['phase']; boss: boolean; wave: boolean; reaper: boolean };

  constructor(w: World) {
    this.music = new Music(w.config.stage.ground);
    this.prev = this.read(w);
    this.music.start();
  }

  private read(w: World) {
    const p = w.player;
    return {
      kills: w.kills,
      xp: p.xp,
      level: p.level,
      gold: Math.floor(w.gold),
      hp: p.hp,
      phase: w.phase,
      boss: w.bossAlive || (w.cycleBoss === 1 && w.enemies.some((e) => !e.dead && e.def.patterns)),
      wave: inWave(w) && !w.completed,
      reaper: !!w.completed,
    };
  }

  /** Llamar antes de dibujar (los efectos visuales se consumen al dibujar). `held`: pausa, menús o cofre. */
  frame(w: World, held: boolean) {
    for (const f of w.fx) {
      if (f.type === 'hit') play('hit', f.sprite.slice(3, -4));
      else if (f.type === 'line') play('zap');
      else if (f.type === 'ring' && f.radius >= 40) play('boom');
    }
    const now = this.read(w);
    const was = this.prev;
    if (now.kills > was.kills) play('kill');
    if (now.xp > was.xp || now.level > was.level) play('xp');
    if (now.gold > was.gold) play('coin');
    if (now.hp < was.hp - 0.5) play('hurt');
    if (now.phase !== was.phase) {
      if (now.phase === 'levelup') play('levelUp');
      else if (now.phase === 'purge') play('purge');
      else if (now.phase === 'dead') {
        play(w.completed ? 'victory' : 'defeat');
        this.music.stop();
      }
    }
    if (now.boss && !was.boss) play('boss');
    if (now.wave && !was.wave && !now.boss) play('wave');
    if (now.reaper && !was.reaper) play('reaper');
    this.prev = now;

    this.music.intensity = now.boss || now.reaper ? 2 : now.wave ? 1 : 0;
    audio.setDuck(held ? 0.35 : 1);
  }

  destroy() {
    this.music.stop();
    audio.setDuck(1);
  }
}
