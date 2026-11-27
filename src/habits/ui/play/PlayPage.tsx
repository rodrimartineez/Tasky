import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { FlaskConical, HeartHandshake, Lock, Play, Swords } from 'lucide-react';
import { ARCANA, MAX_ARCANA } from '../../../game/content/arcana';
import { CHARACTERS } from '../../../game/content/characters';
import { buildRunConfig } from '../../../game/content/run';
import { STAGES } from '../../../game/content/stages';
import { EVOLUTIONS } from '../../../game/content/evolutions';
import { WEAPON_BY_ID, WEAPONS } from '../../../game/content/weapons';
import { CYCLE_BOSS_BY_ID, CYCLE_LENGTH, cycleBossFor } from '../../../game/content/bosses';
import { RUN_SECONDS, type RunConfig, type RunMode, type RunResult, type World } from '../../../game/sim/types';
import { runResult } from '../../../game/sim/world';
import { spriteDataUrl } from '../../../game/sprites/atlas';
import { stagePreviewUrl } from '../../../game/sprites/preview';
import { Button } from '../../../ui/components/Button';
import { ConfirmDialog } from '../../../ui/components/ConfirmDialog';
import { toast } from '../../../ui/components/Toaster';
import { EconomyError, isUnlocked, MILESTONES, modeUnlocked, priceOf } from '../../core/economy';
import type { RunSnapshot } from '../../core/ports';
import { loadRunSnapshot, saveRunSnapshot, useEconomy, useHabits } from '../../state/store';
import { comebackFor } from '../../core/comeback';
import { ACHIEVEMENTS, achieved, recordsOf } from '../../core/records';
import { GAME_BUILD, releaseFor } from '../../core/release';
import { SoundSettings } from './SoundControls';
import { CardPickerDialog } from './CardPickerDialog';
import { StartingWeaponsDialog } from './StartingWeaponsDialog';
import { CoinIcon } from '../PointsBadge';
import styles from './PlayPage.module.css';

/** El motor del juego (PixiJS) se descarga al pulsar «Jugar», no al abrir Hábitos. */
const GameScreen = lazy(() => import('./GameScreen'));

interface Session {
  level: number;
  /** Número de intento (0 en el modo de pruebas). */
  attempt: number;
  config: RunConfig;
  resume: World | null;
  /** Partida del modo de pruebas: no se registra. */
  test: boolean;
}

const MODES: { id: RunMode; name: string }[] = [
  { id: 'normal', name: 'Normal' },
  { id: 'infinite', name: 'Infinito' },
  { id: 'mirror', name: 'Reflejo' },
];

/** Arcanas y darkanas elegidas: preferencia de este dispositivo (no cambian la progresión, no hace falta sincronizarlas). */
const EXTRAS_KEY = 'tasky-game-extras';
function loadExtras(): { arcana: string[] } {
  try {
    const saved = JSON.parse(localStorage.getItem(EXTRAS_KEY) ?? 'null') as { arcana?: unknown } | null;
    return { arcana: Array.isArray(saved?.arcana) ? saved.arcana.filter((id): id is string => typeof id === 'string') : [] };
  } catch {
    return { arcana: [] };
  }
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

type Kind = 'character' | 'stage';

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
  const [mode, setMode] = useState<RunMode>('normal');
  // Modo de pruebas: nivel que se quiere probar.
  const [testLevel, setTestLevel] = useState(1);
  const [extras, setExtras] = useState(loadExtras);
  const saveExtras = (patch: Partial<typeof extras>) =>
    setExtras((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(EXTRAS_KEY, JSON.stringify(next));
      } catch {
        // Sin almacenamiento la elección dura hasta cerrar la app.
      }
      return next;
    });
  // Logros conseguidos: desbloquean las cartas de arcana.
  const earned = useMemo(() => achieved(recordsOf(eco, data)), [eco, data]);

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
  }, [session, open?.attempt, testMode]);
  const resumable = eco.testMode
    ? snapshot?.test
      ? snapshot
      : null
    : open && snapshot && !snapshot.test && snapshot.attempt === open.attempt
      ? snapshot
      : null;
  // Modalidad elegida, si sigue disponible (al desactivar el modo de pruebas puede no estarlo).
  const runMode = modeUnlocked(eco, mode) ? mode : 'normal';
  const level = eco.testMode ? testLevel : eco.nextLevel;
  const boss = cycleBossFor(level);
  const bossDef = boss ? CYCLE_BOSS_BY_ID.get(boss.id) : undefined;
  const cycle = Math.ceil(level / CYCLE_LENGTH);

  // Lo elegido en el modo de pruebas puede estar bloqueado en producción: entonces se usa lo inicial.
  const character = profile && isUnlocked(eco, `character:${profile.character}`) ? profile.character : 'wanderer';
  const stage = profile && isUnlocked(eco, `stage:${profile.stage}`) ? profile.stage : 'withered_woods';
  const stageDef = STAGES.find((s) => s.id === stage) ?? STAGES[0];
  // Cartas de arcana y darkana: cada una se desbloquea con su logro de hábitos (no se compran).
  const cardOwned = (def: (typeof ARCANA)[number]) => eco.testMode || earned.has(def.achievement);
  const cardsOwned = ARCANA.filter(cardOwned).length;
  // Lo elegido puede haber dejado de estar disponible (al salir del modo de pruebas): entonces, nada.
  const arcana = extras.arcana.filter((id) => ARCANA.some((a) => a.id === id && cardOwned(a))).slice(0, MAX_ARCANA);

  const [pickingWeapons, setPickingWeapons] = useState(false);
  const pickStart = CHARACTERS.find((c) => c.id === character)?.pickStart;
  // Cartas elegidas en el menú, mientras se eligen las armas iniciales (si el personaje las pide).
  const [pickingCards, setPickingCards] = useState(false);
  const [cardsChosen, setCardsChosen] = useState<string[]>([]);
  const afterCards = (cards: string[]) => (pickStart ? (setCardsChosen(cards), setPickingWeapons(true)) : begin(undefined, cards));
  // «Jugar»: con alguna carta desbloqueada se abre antes el menú de cartas.
  const play = () => (cardsOwned > 0 ? setPickingCards(true) : afterCards([]));
  const begin = (weapons?: string[], cards: string[] = []) =>
    attempt(() => {
      const started = startRun(runMode, testLevel, cards);
      if (started.level > 0)
        setSession({
          level: started.level,
          attempt: started.attempt,
          config: buildRunConfig(started.level, character, stage, eco.upgrades, {
            boost: started.comeback ?? undefined,
            mode: runMode,
            arcana: cards,
            weapons,
            // Las de prueba no se registran: cada una con una semilla distinta.
            seed: started.test ? Math.floor(Math.random() * 1e9) : started.attempt,
          }),
          resume: null,
          test: started.test,
        });
    });

  // La partida guardada lleva su propia configuración (nivel, modalidad, jefe…).
  // Una partida infinita guardada pasado el minuto 15 no se reanuda: se cierra con su resultado (nivel superado y oro).
  const resumableWorld = resumable ? (resumable.world as World) : null;
  const pastEnd = !!resumableWorld && resumableWorld.config.mode === 'infinite' && resumableWorld.time >= RUN_SECONDS;
  const resume = () => {
    if (!resumable || (!eco.testMode && !open)) return;
    const world = resumable.world as World;
    if (pastEnd) {
      const result = runResult(world);
      finish(open?.attempt ?? 0, result, eco.testMode);
      toast(result.won ? `¡Nivel ${world.config.level} superado!` : 'Partida cerrada con su resultado.');
      return;
    }
    setSession({ level: world.config.level, attempt: open?.attempt ?? 0, config: world.config, resume: world, test: eco.testMode });
  };

  const finish = (attemptNumber: number, result: RunResult, test: boolean) => {
    if (!test)
      finishRun(attemptNumber, {
        gold: result.gold,
        time: result.time,
        kills: result.kills,
        won: result.won,
        xpLevel: result.level,
      });
    void saveRunSnapshot(null, test);
  };

  const select = (kind: Kind, id: string | null) => {
    if (id) attempt(() => setLoadout(kind === 'character' ? id : character, kind === 'stage' ? id : stage));
  };
  /** Personaje tocado: se muestran las armas con las que empieza (esté comprado o no). */
  const [inspected, setInspected] = useState<string | null>(null);
  const pickText = (pick: NonNullable<(typeof CHARACTERS)[number]['pickStart']>) =>
    pick.from === 'evolutions' ? `${pick.count} evolución a tu elección` : `${pick.count} armas a tu elección`;
  const startingWeapons = (c: (typeof CHARACTERS)[number]) =>
    [c.weapon, ...(c.bonusWeapons ?? [])].map((id) => WEAPON_BY_ID.get(id)).filter((w) => w !== undefined);

  const choose = (kind: Kind, id: string) => {
    const key = `${kind}:${id}`;
    if (!isUnlocked(eco, key)) return setBuying(key);
    select(kind, id);
  };

  const confirmBuy = () => {
    if (!buying) return;
    const [kind, id] = buying.split(':') as [Kind, string];
    attempt(() => {
      unlock(buying);
      select(kind, id);
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
    buying &&
    (CHARACTERS.find((c) => `character:${c.id}` === buying)?.name ??
      STAGES.find((s) => `stage:${s.id}` === buying)?.name);
  const buyingCharacter = buying ? CHARACTERS.find((c) => `character:${c.id}` === buying) : undefined;
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
        {open && !eco.testMode ? (
          <>
            <p className={styles.stage}>Partida en curso</p>
            <h1 className={styles.title}>Nivel {open.level}</h1>
            {snapshot === undefined ? null : resumable ? (
              <>
                <p className={styles.text}>
                  {pastEnd
                    ? 'Esta partida infinita ya pasó del minuto 15, así que no se puede continuar: ciérrala para guardar su resultado y su oro.'
                    : 'La partida quedó guardada. Puedes continuarla desde donde la dejaste.'}
                </p>
                <Button variant="primary" icon={<Play />} className={styles.play} onClick={resume}>
                  {pastEnd ? 'Cerrar y guardar el resultado' : 'Continuar'}
                </Button>
              </>
            ) : (
              <>
                <p className={styles.text}>
                  Esta partida se empezó en otro dispositivo o no llegó a guardarse aquí. Ciérrala para seguir: el intento cuenta como
                  gastado y sigues en el nivel {open.level}.
                </p>
                <Button variant="primary" className={styles.play} onClick={() => setClosing(true)}>
                  Cerrar partida
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            {eco.testMode && <p className={styles.testBadge}>Modo de pruebas</p>}
            <p className={styles.stage}>
              {bossDef
                ? `Fin del ciclo ${cycle} · Jefe: ${bossDef.name}`
                : `${stageDef.name} · Ciclo ${cycle}, nivel ${((level - 1) % CYCLE_LENGTH) + 1} de ${CYCLE_LENGTH}`}
            </p>
            <h1 className={styles.title}>{runMode === 'infinite' ? 'Modo infinito' : `Nivel ${level}`}</h1>
            {eco.testMode ? (
              <div className={styles.levelPicker}>
                <span>Nivel de prueba</span>
                <button type="button" onClick={() => setTestLevel((n) => Math.max(1, n - 1))} aria-label="Nivel anterior">
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={testLevel}
                  onChange={(e) => setTestLevel(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                  aria-label="Nivel de prueba"
                />
                <button type="button" onClick={() => setTestLevel((n) => n + 1)} aria-label="Nivel siguiente">
                  +
                </button>
                <button type="button" onClick={() => setTestLevel((n) => (Math.floor(n / CYCLE_LENGTH) + 1) * CYCLE_LENGTH)}>
                  Próximo jefe
                </button>
              </div>
            ) : (
              <p className={styles.attempts}>
                <Swords /> {eco.available === 1 ? '1 intento' : `${gold(eco.available)} intentos`}
              </p>
            )}
            <div className={styles.modes} role="radiogroup" aria-label="Modalidad">
              {MODES.map((m) => {
                const unlocked = modeUnlocked(eco, m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={runMode === m.id}
                    className={`${styles.mode} ${runMode === m.id ? styles.modeOn : ''}`}
                    disabled={!unlocked}
                    onClick={() => setMode(m.id)}
                  >
                    <span>
                      {!unlocked && <Lock />} {m.name}
                    </span>
                  </button>
                );
              })}
            </div>
            {eco.testMode && resumable && (
              <Button variant="secondary" icon={<Play />} className={styles.play} onClick={resume} disabled={!!session}>
                Continuar la partida
              </Button>
            )}
            <Button variant="primary" icon={<Swords />} className={styles.play} onClick={play} disabled={eco.available <= 0 || !!session}>
              {session ? 'Cargando…' : 'Jugar'}
            </Button>
          </>
        )}
        {!eco.testMode && (
          <ul className={styles.milestones} aria-label="Hitos">
            <li className={eco.unlocks.infinite ? styles.done : ''}>Nivel {MILESTONES.infinite}: modo infinito</li>
            <li className={eco.unlocks.mirror ? styles.done : ''}>Nivel {MILESTONES.mirror}: modo reflejo</li>
          </ul>
        )}
        {!eco.testMode && (
          <dl className={styles.stats}>
            <div>
              <dt>Niveles superados</dt>
              <dd>{eco.passedLevel}</dd>
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
                ? `Al ritmo de tus últimas partidas, te faltan unos ${goal.runs.toLocaleString('es-ES')} ${goal.runs === 1 ? 'intento' : 'intentos'}.`
                : 'Cada intento te acerca un poco más.'}
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
                onClick={() => {
                  setInspected(c.id);
                  if (!open) choose('character', c.id);
                }}
                aria-pressed={c.id === character}
              >
                <img className={styles.sprite} src={spriteDataUrl(`${c.sprite}_0`)} alt="" draggable={false} />
                <span className={styles.optionName}>{c.name}</span>
                {c.legendary && <span className={styles.legendaryTag}>Legendario</span>}
                <span className={styles.optionText}>{c.trait}</span>
                {c.id === (inspected ?? character) && (
                  <span className={styles.startsWith}>
                    Empieza con:
                    {c.pickStart && <span className={styles.startWeapon}>{pickText(c.pickStart)}</span>}
                    {startingWeapons(c).filter(() => !c.pickStart).map((w) => (
                      <span key={w.id} className={styles.startWeapon}>
                        <img src={spriteDataUrl(w.icon)} alt="" draggable={false} /> {w.name}
                      </span>
                    ))}
                  </span>
                )}
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
        <figure className={styles.preview}>
          <img src={stagePreviewUrl(stageDef)} alt={`Vista previa de ${stageDef.name}`} draggable={false} />
          <figcaption>{stageDef.name}</figcaption>
        </figure>
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
                <img className={styles.thumb} src={stagePreviewUrl(s)} alt="" draggable={false} />
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

      <section className={styles.section}>
        <h2 className={styles.heading}>Sonido</h2>
        <SoundSettings />
      </section>

      <p className={styles.note}>
        Móvil: arrastra el dedo por la pantalla · Teclado: WASD o flechas, Esc para pausar y 1–4 para elegir mejora.
      </p>

      <CardPickerDialog
        key={`cards${pickingCards}`}
        open={pickingCards}
        max={MAX_ARCANA}
        initial={arcana}
        cards={ARCANA.map((a) => ({
          id: a.id,
          name: a.name,
          dark: a.dark,
          icon: a.icon,
          text: a.text,
          owned: cardOwned(a),
          achievement: ACHIEVEMENTS.find((x) => x.id === a.achievement)?.name ?? '',
        }))}
        onClose={() => setPickingCards(false)}
        onConfirm={(ids) => {
          setPickingCards(false);
          saveExtras({ arcana: ids });
          afterCards(ids);
        }}
      />

      <StartingWeaponsDialog
        key={`${pickingWeapons}`}
        open={pickingWeapons}
        count={pickStart?.count ?? 0}
        evolutions={pickStart?.from === 'evolutions'}
        options={pickStart?.from === 'evolutions' ? EVOLUTIONS.map((e) => e.def) : WEAPONS}
        onClose={() => setPickingWeapons(false)}
        onConfirm={(ids) => {
          setPickingWeapons(false);
          begin(ids, cardsChosen);
        }}
      />

      <ConfirmDialog
        open={!!buying}
        title={`Desbloquear ${buyingName ?? ''}`}
        description={`${
          buyingPrice > eco.gold
            ? `Cuesta ${gold(buyingPrice)} de oro y tienes ${gold(eco.gold)}. Sigue jugando para conseguir el resto.`
            : `Cuesta ${gold(buyingPrice)} de oro (tienes ${gold(eco.gold)}).`
        }${buyingCharacter ? ` Empieza con: ${buyingCharacter.pickStart ? pickText(buyingCharacter.pickStart) : startingWeapons(buyingCharacter).map((w) => w.name).join(' y ')}.` : ''}`}
        confirmLabel="Desbloquear"
        onConfirm={confirmBuy}
        onClose={() => setBuying(null)}
      />
      <ConfirmDialog
        open={closing}
        title="Cerrar la partida"
        description="Como no hay una copia guardada en este dispositivo, la partida se cerrará sin oro y el intento contará como gastado."
        confirmLabel="Cerrar partida"
        onConfirm={() => {
          if (open)
            finishRun(open.attempt, {
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
            attempt={session.attempt}
            config={session.config}
            resume={session.resume}
            test={session.test}
            onFinish={(result) => finish(session.attempt, result, session.test)}
            onExit={() => setSession(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
