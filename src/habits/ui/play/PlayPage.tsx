import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { FlaskConical, HeartHandshake, Lock, Play, Swords } from 'lucide-react';
import { CHARACTERS } from '../../../game/content/characters';
import { buildRunConfig } from '../../../game/content/run';
import { STAGES } from '../../../game/content/stages';
import type { RunConfig, RunResult, World } from '../../../game/sim/types';
import { spriteDataUrl } from '../../../game/sprites/atlas';
import { Button } from '../../../ui/components/Button';
import { ConfirmDialog } from '../../../ui/components/ConfirmDialog';
import { toast } from '../../../ui/components/Toaster';
import { EconomyError, isUnlocked, priceOf } from '../../core/economy';
import type { RunSnapshot } from '../../core/ports';
import { loadRunSnapshot, saveRunSnapshot, useEconomy, useHabits } from '../../state/store';
import { comebackFor } from '../../core/comeback';
import { GAME_BUILD, releaseFor } from '../../core/release';
import { HabitBridge } from '../HabitBridge';
import { CoinIcon } from '../PointsBadge';
import styles from './PlayPage.module.css';

/** El motor del juego (PixiJS) se descarga al pulsar «Jugar», no al abrir Hábitos. */
const GameScreen = lazy(() => import('./GameScreen'));

interface Session {
  level: number;
  config: RunConfig;
  resume: World | null;
  /** Partida del modo de pruebas: no se registra. */
  test: boolean;
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const gold = (n: number) => n.toLocaleString('es-ES');

/** Muestra el error de una acción del juego (p. ej. «No tienes oro suficiente») sin romper la pantalla. */
function attempt(action: () => void) {
  try {
    action();
  } catch (e) {
    if (e instanceof EconomyError) toast(e.message, 'error');
    else throw e;
  }
}

/** Campamento: partidas disponibles, nivel siguiente, personaje y escenario. */
export function PlayPage() {
  const eco = useEconomy();
  const data = useHabits((s) => s.data);
  const today = useHabits((s) => s.today);
  const profile = data.profile;
  const testMode = useHabits((s) => s.testMode);
  const setTestMode = useHabits((s) => s.setTestMode);
  const comeback = useMemo(() => comebackFor(data, today, eco.runs, releaseFor(testMode)), [data, today, eco.runs, testMode]);
  const startRun = useHabits((s) => s.startRun);
  const finishRun = useHabits((s) => s.finishRun);
  const unlock = useHabits((s) => s.unlock);
  const setLoadout = useHabits((s) => s.setLoadout);
  const [session, setSession] = useState<Session | null>(null);
  // Copia leída y de qué modo es: al cambiar de modo, la del otro no se muestra mientras se lee la nueva.
  const [loaded, setLoaded] = useState<{ test: boolean; snapshot: RunSnapshot | null } | null>(null);
  const snapshot = loaded && loaded.test === testMode ? loaded.snapshot : undefined;
  const [buying, setBuying] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const open = eco.openRun;
  // Copia guardada de la partida en curso (solo si es de esa partida).
  useEffect(() => {
    if (session) return;
    let alive = true;
    loadRunSnapshot(testMode)
      .then((s) => alive && setLoaded({ test: testMode, snapshot: s }))
      .catch(() => alive && setLoaded({ test: testMode, snapshot: null }));
    return () => {
      alive = false;
    };
  }, [session, open?.level, testMode]);
  const resumable = eco.testMode
    ? snapshot?.test
      ? snapshot
      : null
    : open && snapshot && !snapshot.test && snapshot.level === open.level
      ? snapshot
      : null;

  // Lo elegido en el modo de pruebas puede estar bloqueado en producción: entonces se usa lo inicial.
  const character = profile && isUnlocked(eco, `character:${profile.character}`) ? profile.character : 'wanderer';
  const stage = profile && isUnlocked(eco, `stage:${profile.stage}`) ? profile.stage : 'withered_woods';
  const stageDef = STAGES.find((s) => s.id === stage) ?? STAGES[0];

  const play = () =>
    attempt(() => {
      const { level, comeback: boost, test } = startRun();
      if (level > 0)
        setSession({
          level,
          config: buildRunConfig(level, character, stage, eco.upgrades, boost ?? undefined),
          resume: null,
          test,
        });
    });

  const resume = () => {
    if (!resumable) return;
    if (eco.testMode) {
      setSession({
        level: 1,
        config: buildRunConfig(1, character, stage, eco.upgrades),
        resume: resumable.world as World,
        test: true,
      });
      return;
    }
    if (!open) return;
    setSession({
      level: open.level,
      config: buildRunConfig(open.level, open.character, open.stage, eco.upgrades),
      resume: resumable.world as World,
      test: false,
    });
  };

  const finish = (level: number, result: RunResult, test: boolean) => {
    if (!test)
      finishRun(level, {
        gold: result.gold,
        time: result.time,
        kills: result.kills,
        won: result.won,
        xpLevel: result.level,
      });
    void saveRunSnapshot(null, test);
  };

  const choose = (kind: 'character' | 'stage', id: string) => {
    const key = `${kind}:${id}`;
    if (!isUnlocked(eco, key)) return setBuying(key);
    attempt(() => setLoadout(kind === 'character' ? id : character, kind === 'stage' ? id : stage));
  };

  const confirmBuy = () => {
    if (!buying) return;
    const [kind, id] = buying.split(':') as ['character' | 'stage', string];
    attempt(() => {
      unlock(buying);
      setLoadout(kind === 'character' ? id : character, kind === 'stage' ? id : stage);
      toast('¡Desbloqueado!');
    });
    setBuying(null);
  };
  // Objetivo de oro: el contenido bloqueado más barato, con una estimación de cuántas partidas faltan.
  const goal = useMemo(() => {
    if (eco.testMode) return null;
    const locked = [
      ...CHARACTERS.map((c) => ({ key: `character:${c.id}`, name: c.name, price: c.price })),
      ...STAGES.map((s) => ({ key: `stage:${s.id}`, name: s.name, price: s.price })),
    ]
      .filter((x) => !isUnlocked(eco, x.key))
      .sort((a, b) => a.price - b.price)[0];
    if (!locked) return null;
    const recent = eco.runs.filter((r) => r.result).slice(-7);
    const average = recent.reduce((sum, r) => sum + (r.result?.gold ?? 0), 0) / Math.max(1, recent.length);
    const runs = average > 0 ? Math.ceil((locked.price - eco.gold) / average) : null;
    return { ...locked, runs };
  }, [eco]);

  const buyingName =
    buying && (CHARACTERS.find((c) => `character:${c.id}` === buying)?.name ?? STAGES.find((s) => `stage:${s.id}` === buying)?.name);
  const buyingPrice = buying ? priceOf(buying) : 0;

  return (
    <div className={styles.page}>
      {GAME_BUILD.devTools && (
        <div className={`${styles.devBar} ${eco.testMode ? styles.devBarOn : ''}`} role="group" aria-label="Herramienta de desarrollo">
          <FlaskConical />
          <span className={styles.devText}>
            <b>Desarrollo · Modo de pruebas {eco.testMode ? 'activado' : 'desactivado'}</b>
            {eco.testMode
              ? 'Nada de lo que juegues ahora cuenta para la progresión real.'
              : 'Progresión real: partidas, niveles, oro y compras cuentan.'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={eco.testMode}
            className={styles.devSwitch}
            onClick={() => setTestMode(!eco.testMode)}
            disabled={!!session}
          >
            {eco.testMode ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      )}
      <section className={styles.card}>
        {eco.testMode ? (
          <>
            <p className={styles.testBadge}>Modo de pruebas</p>
            <h1 className={styles.title}>Nivel 1</h1>
            <p className={styles.text}>
              Puedes jugar sin límite: todas las partidas son de nivel 1 y tienes todos los personajes y escenarios. El oro de estas
              partidas no se guarda; tus hábitos, puntos y mejoras funcionan con normalidad.
            </p>
            {resumable && (
              <Button variant="secondary" icon={<Play />} className={styles.play} onClick={resume} disabled={!!session}>
                Continuar la partida de prueba
              </Button>
            )}
            <Button variant="primary" icon={<Swords />} className={styles.play} onClick={play} disabled={!!session}>
              {session ? 'Cargando…' : resumable ? 'Nueva partida' : 'Jugar'}
            </Button>
          </>
        ) : open ? (
          <>
            <p className={styles.stage}>Partida en curso</p>
            <h1 className={styles.title}>Nivel {open.level}</h1>
            {snapshot === undefined ? null : resumable ? (
              <>
                <p className={styles.text}>La partida quedó guardada. Puedes continuarla desde donde la dejaste.</p>
                <Button variant="primary" icon={<Play />} className={styles.play} onClick={resume}>
                  Continuar
                </Button>
              </>
            ) : (
              <>
                <p className={styles.text}>
                  Esta partida se empezó en otro dispositivo o no llegó a guardarse aquí. Ciérrala para seguir con el nivel {open.level + 1}
                  .
                </p>
                <Button variant="primary" className={styles.play} onClick={() => setClosing(true)}>
                  Cerrar partida
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <p className={styles.stage}>{stageDef.name}</p>
            <h1 className={styles.title}>Nivel {eco.nextLevel}</h1>
            <p className={styles.text}>
              {eco.available > 0
                ? `${eco.available === 1 ? 'Tienes 1 partida disponible' : `Tienes ${eco.available} partidas disponibles`}. Cada partida que juegas, ganes o pierdas, sube el nivel: más enemigos y más fuertes, y más oro.`
                : 'Ya has jugado todas tus partidas. Mañana a las 00:00 recibirás otra (se acumulan si no las juegas).'}
            </p>
            <Button variant="primary" icon={<Swords />} className={styles.play} onClick={play} disabled={eco.available <= 0 || !!session}>
              {session ? 'Cargando…' : 'Jugar'}
            </Button>
          </>
        )}
        {!eco.testMode && (
          <dl className={styles.stats}>
            <div>
              <dt>Partidas jugadas</dt>
              <dd>{eco.runs.length}</dd>
            </div>
            <div>
              <dt>Mejor tiempo</dt>
              <dd>{clock(eco.bestTime)}</dd>
            </div>
            <div>
              <dt>Oro ganado</dt>
              <dd>{gold(eco.totalGoldEarned)}</dd>
            </div>
          </dl>
        )}
      </section>

      {goal && (
        <div className={styles.goal}>
          <div className={styles.goalHead}>
            <span>
              Próximo objetivo: <b>{goal.name}</b>
            </span>
            <span className={styles.goalPrice}>
              <CoinIcon size={12} /> {gold(eco.gold)} / {gold(goal.price)}
            </span>
          </div>
          <div className={styles.goalBar} aria-hidden="true">
            <span style={{ width: `${Math.min(100, (eco.gold / goal.price) * 100)}%` }} />
          </div>
          <p className={styles.goalText}>
            {eco.gold >= goal.price
              ? '¡Ya puedes desbloquearlo!'
              : goal.runs !== null
                ? `Al ritmo de tus últimas partidas, te faltan unas ${goal.runs.toLocaleString('es-ES')} ${goal.runs === 1 ? 'partida' : 'partidas'}.`
                : 'Cada partida te acerca un poco más.'}
          </p>
        </div>
      )}

      {comeback && !open && (
        <div className={styles.comeback} role="status">
          <HeartHandshake />
          <p>
            <b>¡Has vuelto!</b> Tras {comeback.breakDays} días sin hábitos, tu próxima partida tendrá +{Math.round(comeback.xp * 100)} % de
            experiencia y +{Math.round(comeback.hp * 100)} % de vida. La ayuda baja en cada partida y dura{' '}
            {comeback.runsLeft === 1 ? '1 partida más' : `${comeback.runsLeft} partidas más`} como mucho esta semana.
          </p>
        </div>
      )}

      <HabitBridge />

      <section className={styles.section}>
        <h2 className={styles.heading}>Personaje</h2>
        <div className={styles.grid}>
          {CHARACTERS.map((c) => {
            const unlocked = isUnlocked(eco, `character:${c.id}`);
            return (
              <button
                key={c.id}
                type="button"
                className={`${styles.option} ${c.id === character ? styles.selected : ''} ${unlocked ? '' : styles.locked} ${c.legendary ? styles.legendary : ''}`}
                onClick={() => choose('character', c.id)}
                disabled={!!open}
                aria-pressed={c.id === character}
              >
                <img className={styles.sprite} src={spriteDataUrl(`${c.sprite}_0`)} alt="" draggable={false} />
                <span className={styles.optionName}>{c.name}</span>
                {c.legendary && <span className={styles.legendaryTag}>Legendario</span>}
                <span className={styles.optionText}>{c.trait}</span>
                {!unlocked && (
                  <span className={styles.price}>
                    <Lock /> <CoinIcon size={12} /> {gold(c.price)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Escenario</h2>
        <div className={styles.grid}>
          {STAGES.map((s) => {
            const unlocked = isUnlocked(eco, `stage:${s.id}`);
            return (
              <button
                key={s.id}
                type="button"
                className={`${styles.option} ${s.id === stage ? styles.selected : ''} ${unlocked ? '' : styles.locked}`}
                onClick={() => choose('stage', s.id)}
                disabled={!!open}
                aria-pressed={s.id === stage}
              >
                <span className={styles.optionName}>{s.name}</span>
                {!unlocked && (
                  <span className={styles.price}>
                    <Lock /> <CoinIcon size={12} /> {gold(s.price)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <p className={styles.note}>
        Móvil: arrastra el dedo por la pantalla · Teclado: WASD o flechas, Esc para pausar y 1–4 para elegir mejora.
      </p>

      <ConfirmDialog
        open={!!buying}
        title={`Desbloquear ${buyingName ?? ''}`}
        description={
          buyingPrice > eco.gold
            ? `Cuesta ${gold(buyingPrice)} de oro y tienes ${gold(eco.gold)}. Sigue jugando para conseguir el resto.`
            : `Cuesta ${gold(buyingPrice)} de oro (tienes ${gold(eco.gold)}).`
        }
        confirmLabel="Desbloquear"
        onConfirm={confirmBuy}
        onClose={() => setBuying(null)}
      />
      <ConfirmDialog
        open={closing}
        title="Cerrar la partida"
        description="Como no hay una copia guardada en este dispositivo, la partida se cerrará sin oro. El nivel siguiente queda disponible."
        confirmLabel="Cerrar partida"
        onConfirm={() => {
          if (open)
            finishRun(open.level, {
              gold: 0,
              time: 0,
              kills: 0,
              won: false,
              xpLevel: 0,
            });
          setClosing(false);
        }}
        onClose={() => setClosing(false)}
      />

      {session && (
        <Suspense fallback={null}>
          <GameScreen
            level={session.level}
            config={session.config}
            resume={session.resume}
            test={session.test}
            onFinish={(result) => finish(session.level, result, session.test)}
            onExit={() => setSession(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
