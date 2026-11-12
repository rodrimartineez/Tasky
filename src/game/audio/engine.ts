/**
 * Motor de sonido del juego (Fase 9): todo se sintetiza con Web Audio, sin archivos (original, ligero, sin
 * conexión y compatible con la CSP). Un bus para efectos y otro para música, con volúmenes guardados en este
 * dispositivo. En móviles empieza en silencio. El contexto se crea al primer sonido y se desbloquea con el primer
 * toque o tecla (requisito de iOS y de los navegadores).
 */
export interface SoundSettings {
  muted: boolean;
  /** 0–1 */
  sfx: number;
  /** 0–1 */
  music: number;
}

const KEY = 'tasky-game-sound';
/** Voces de efectos sonando a la vez como mucho: con cientos de golpes, el resto se omite. */
const MAX_VOICES = 24;

function defaults(): SoundSettings {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return { muted: touch, sfx: 0.7, music: 0.45 };
}

function load(): SoundSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SoundSettings> | null;
    if (saved) return { ...defaults(), ...saved };
  } catch {
    // Sin almacenamiento: valores por defecto.
  }
  return defaults();
}

export interface ToneOptions {
  type?: OscillatorType;
  freq: number;
  /** Frecuencia al final (barrido exponencial). */
  to?: number;
  dur: number;
  vol: number;
  attack?: number;
  /** Retraso en segundos desde ahora (o tiempo absoluto con `at`). */
  delay?: number;
  at?: number;
  bus?: 'sfx' | 'music';
  /** Filtro paso bajo (Hz). */
  lowpass?: number;
}

export interface NoiseOptions {
  dur: number;
  vol: number;
  filter?: BiquadFilterType;
  freq?: number;
  to?: number;
  delay?: number;
  at?: number;
  bus?: 'sfx' | 'music';
}

class AudioEngine {
  settings: SoundSettings = load();
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private voices = 0;
  private listeners = new Set<() => void>();
  /** Atenuación de la música (pausa, menús): 1 = normal. */
  private duck = 1;

  constructor() {
    if (typeof window === 'undefined') return;
    // Desbloqueo: el primer gesto del usuario reanuda el contexto si el navegador lo dejó suspendido.
    const unlock = () => void this.ctx?.resume();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
  }

  /** Contexto listo para sonar, o null en silencio / sin Web Audio. */
  context(): AudioContext | null {
    if (this.settings.muted) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      // Limitador: con muchas voces a la vez la suma no satura.
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;
      this.master.connect(limiter);
      limiter.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      const length = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : 1, t, 0.02);
    // Curva cuadrática: el control se siente más natural que lineal.
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx ** 2, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.settings.music ** 2 * this.duck, t, 0.15);
  }

  update(patch: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      // Sin almacenamiento la preferencia dura hasta cerrar la app.
    }
    if (this.settings.muted) void this.ctx?.suspend();
    else this.context();
    this.applyVolumes();
    this.listeners.forEach((l) => l());
  }

  /** Para `useSyncExternalStore`. */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  snapshot = () => this.settings;

  setDuck(value: number) {
    if (this.duck === value) return;
    this.duck = value;
    this.applyVolumes();
  }

  /** ¿Hay sitio para otra voz de efecto? (la música no cuenta). */
  canPlay(): boolean {
    return this.voices < MAX_VOICES;
  }

  private track(node: AudioScheduledSourceNode, bus: 'sfx' | 'music') {
    if (bus !== 'sfx') return;
    this.voices += 1;
    node.onended = () => (this.voices -= 1);
  }

  tone(o: ToneOptions) {
    const ctx = this.context();
    if (!ctx) return;
    const bus = o.bus ?? 'sfx';
    const start = o.at ?? ctx.currentTime + (o.delay ?? 0);
    const attack = o.attack ?? 0.005;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.freq, start);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), start + o.dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(o.vol, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
    let node: AudioNode = osc;
    if (o.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = o.lowpass;
      osc.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(bus === 'sfx' ? this.sfxBus : this.musicBus);
    osc.start(start);
    osc.stop(start + o.dur + 0.02);
    this.track(osc, bus);
  }

  noise(o: NoiseOptions) {
    const ctx = this.context();
    if (!ctx) return;
    const bus = o.bus ?? 'sfx';
    const start = o.at ?? ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter ?? 'bandpass';
    filter.frequency.setValueAtTime(o.freq ?? 2000, start);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, start + o.dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(o.vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus === 'sfx' ? this.sfxBus : this.musicBus);
    src.start(start, Math.random() * 0.5);
    src.stop(start + o.dur + 0.02);
    this.track(src, bus);
  }
}

/** Motor único de la app. */
export const audio = new AudioEngine();
