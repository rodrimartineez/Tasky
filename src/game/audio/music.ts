import { audio } from './engine';

/**
 * Música original por escenario, generada en directo: bajo, arpegio, melodía y percusión de 8 bits sobre una
 * progresión de 4 compases. Cada escenario tiene su tonalidad, escala, tempo y una melodía fija (semilla propia).
 * Tres intensidades: 0 tranquila, 1 oleada (entra la percusión completa y la melodía), 2 jefe (más rápida y aguda).
 */
interface Style {
  /** Nota MIDI de la tónica. */
  root: number;
  scale: number[];
  bpm: number;
  /** Grado de la escala de cada compás. */
  chords: number[];
  seed: number;
}

const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const STYLES: Record<string, Style> = {
  // Bosque: la menor, aventurero.
  t_grass: { root: 57, scale: AEOLIAN, bpm: 116, chords: [0, 5, 2, 6], seed: 11 },
  // Pantano: re dórico, lento y pegajoso.
  t_bog: { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 98, chords: [0, 3, 0, 6], seed: 23 },
  // Cripta: mi frigio, inquietante.
  t_crypt: { root: 52, scale: [0, 1, 3, 5, 7, 8, 10], bpm: 104, chords: [0, 1, 0, 6], seed: 37 },
  // Cavernas: fa# menor, brillante y rápido.
  t_cave: { root: 54, scale: AEOLIAN, bpm: 124, chords: [0, 2, 5, 4], seed: 41 },
  // Páramo de ceniza: do menor armónico, agresivo.
  t_ash: { root: 48, scale: [0, 2, 3, 5, 7, 8, 11], bpm: 136, chords: [0, 5, 6, 4], seed: 53 },
};

const STEPS = 16;
const BARS = 4;
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Music {
  private style: Style;
  private melody: (number | null)[];
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private next = 0;
  intensity = 0;

  constructor(ground: string) {
    this.style = STYLES[ground] ?? STYLES.t_grass;
    this.melody = compose(this.style);
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Programa las notas de los próximos ~120 ms (planificador con margen: no depende del ritmo de fotogramas). */
  private schedule() {
    const ctx = audio.context();
    if (!ctx) {
      this.next = 0;
      return;
    }
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
    const speed = this.intensity >= 2 ? 1.08 : 1;
    const stepDur = 60 / (this.style.bpm * speed) / 4;
    while (this.next < ctx.currentTime + 0.12) {
      this.play(this.step, this.next, stepDur);
      this.step = (this.step + 1) % (STEPS * BARS);
      this.next += stepDur;
    }
  }

  private degree(d: number, octave = 0) {
    const { scale, root } = this.style;
    const o = Math.floor(d / scale.length);
    return root + scale[((d % scale.length) + scale.length) % scale.length] + 12 * (o + octave);
  }

  private play(step: number, at: number, dur: number) {
    const s = step % STEPS;
    const chord = this.style.chords[Math.floor(step / STEPS)];
    const level = this.intensity;
    const bus = 'music' as const;
    // Bajo sincopado (en jefe, corcheas seguidas).
    const bassHits = level >= 2 ? s % 2 === 0 : [0, 6, 8, 14].includes(s);
    if (bassHits) audio.tone({ type: 'triangle', freq: midi(this.degree(chord, -2)), dur: dur * 1.8, vol: 0.2, at, bus });
    // Arpegio de la tríada, a corcheas.
    if (s % 2 === 0) {
      const tone = [0, 2, 4, 2][(s / 2) % 4];
      audio.tone({ type: 'square', freq: midi(this.degree(chord + tone, 0)), dur: dur * 1.6, vol: level ? 0.035 : 0.028, at, bus, lowpass: 1600 });
    }
    // Melodía (desde la oleada).
    const note = this.melody[step];
    if (level >= 1 && note !== null)
      audio.tone({
        type: 'square',
        freq: midi(this.degree(chord + note, level >= 2 ? 2 : 1)),
        dur: dur * 2.4,
        vol: 0.03,
        at,
        bus,
        lowpass: 3200,
      });
    // Percusión: suave en calma, completa en oleada y jefe.
    if (s === 0 || (level >= 1 && s === 8) || (level >= 2 && (s === 4 || s === 12)))
      audio.tone({ type: 'sine', freq: 140, to: 45, dur: 0.16, vol: level ? 0.3 : 0.16, at, bus });
    if (level >= 1 && (s === 4 || s === 12)) audio.noise({ dur: 0.12, vol: 0.12, filter: 'bandpass', freq: 1800, at, bus });
    if (s % 2 === 0 && (level >= 1 || s % 4 === 2)) audio.noise({ dur: 0.03, vol: level >= 2 ? 0.07 : 0.045, filter: 'highpass', freq: 7000, at, bus });
  }
}

/** Melodía fija del escenario: paseo por la escala (relativo al acorde) con silencios, de su semilla. */
function compose(style: Style): (number | null)[] {
  let seed = style.seed;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out: (number | null)[] = [];
  let pitch = 0;
  for (let i = 0; i < STEPS * BARS; i++) {
    const strong = i % 4 === 0;
    if (i % 2 === 1 || (!strong && rnd() < 0.45)) {
      out.push(null);
      continue;
    }
    pitch = Math.max(-2, Math.min(6, pitch + Math.round((rnd() - 0.5) * 4)));
    // En los tiempos fuertes, una nota del acorde (0, 2 o 4).
    out.push(strong ? [0, 2, 4][Math.floor(rnd() * 3)] : pitch);
  }
  return out;
}
