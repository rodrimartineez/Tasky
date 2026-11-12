import { useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { audio } from '../../../game/audio/engine';
import { play } from '../../../game/audio/sfx';
import styles from './PlayPage.module.css';

const useSound = () => useSyncExternalStore(audio.subscribe, audio.snapshot);

/** Botón de silencio de la partida (junto a la pausa). */
export function SoundToggle({ className }: { className?: string }) {
  const { muted } = useSound();
  return (
    <button
      type="button"
      className={className}
      onClick={() => audio.update({ muted: !muted })}
      aria-label={muted ? 'Activar sonido' : 'Silenciar'}
      aria-pressed={!muted}
    >
      {muted ? <VolumeX /> : <Volume2 />}
    </button>
  );
}

/** Ajustes de sonido del campamento: silencio y volumen de efectos y música (se guardan en este dispositivo). */
export function SoundSettings() {
  const settings = useSound();
  const slider = (key: 'sfx' | 'music', label: string) => (
    <label className={styles.soundRow}>
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(settings[key] * 100)}
        disabled={settings.muted}
        onChange={(e) => audio.update({ [key]: Number(e.target.value) / 100 })}
        onPointerUp={() => key === 'sfx' && play('select')}
      />
      <b>{Math.round(settings[key] * 100)} %</b>
    </label>
  );
  return (
    <div className={styles.sound}>
      <label className={styles.soundRow}>
        <span>Sonido</span>
        <input
          type="checkbox"
          checked={!settings.muted}
          onChange={(e) => {
            audio.update({ muted: !e.target.checked });
            if (e.target.checked) play('select');
          }}
        />
        <b>{settings.muted ? 'Silencio' : 'Activado'}</b>
      </label>
      {slider('sfx', 'Efectos')}
      {slider('music', 'Música')}
    </div>
  );
}
