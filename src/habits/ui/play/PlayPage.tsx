import { lazy, Suspense, useState } from 'react';
import { Swords } from 'lucide-react';
import { Button } from '../../../ui/components/Button';
import styles from './PlayPage.module.css';

/** El motor del juego (PixiJS) se descarga al pulsar «Jugar», no al abrir Hábitos. */
const GameScreen = lazy(() => import('./GameScreen'));

export function PlayPage() {
  const [playing, setPlaying] = useState(false);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.stage}>Bosque Marchito</p>
        <h1 className={styles.title}>Partida de prueba</h1>
        <p className={styles.text}>
          Sobrevive hasta 30 minutos a oleadas cada vez más duras. Tu personaje ataca solo: tú lo mueves, recoges la experiencia y eliges
          mejoras al subir de nivel.
        </p>
        <ul className={styles.list}>
          <li>Móvil: arrastra el dedo por cualquier parte de la pantalla.</li>
          <li>Teclado: WASD o flechas · Esc para pausar · 1–4 para elegir mejora.</li>
        </ul>
        <Button variant="primary" icon={<Swords />} className={styles.play} onClick={() => setPlaying(true)} disabled={playing}>
          {playing ? 'Cargando…' : 'Jugar'}
        </Button>
        <p className={styles.note}>
          Versión de prueba del núcleo jugable: todavía no gasta partidas diarias ni guarda el oro. Las mejoras permanentes y los
          desbloqueos llegan en la siguiente fase.
        </p>
      </div>
      {playing && (
        <Suspense fallback={null}>
          <GameScreen onExit={() => setPlaying(false)} />
        </Suspense>
      )}
    </div>
  );
}
