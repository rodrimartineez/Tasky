import { useState } from 'react';
import { getSupabaseClient } from '../../adapters/supabaseSync';
import { UPGRADES } from '../../game/content/upgrades';
import { spriteDataUrl } from '../../game/sprites/atlas';
import { toast } from '../../ui/components/Toaster';
import { EconomyError } from '../core/economy';
import { useEconomy, useHabits } from '../state/store';
import { GemIcon } from './PointsBadge';
import styles from './UpgradesPage.module.css';

/** Tienda de mejoras permanentes: se pagan con puntos de habilidad (1 por paso). Hasta el nivel 999. */
export function UpgradesPage() {
  const eco = useEconomy();
  const buy = useHabits((s) => s.buyUpgrade);

  const purchase = (id: string) => {
    try {
      buy(id);
    } catch (e) {
      if (e instanceof EconomyError) toast(e.message, 'error');
      else throw e;
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.balance}>
        <GemIcon size={40} />
        <div>
          <p className={styles.balanceValue}>{eco.points.toLocaleString('es-ES')}</p>
          <p className={styles.balanceLabel}>puntos de habilidad (1 por paso)</p>
        </div>
      </div>
      <p className={styles.note}>
        Cada paso que registra tu iPhone es un punto de habilidad. Las mejoras se aplican en todas las partidas y con todos los
        personajes; cada nivel cuesta algo más que el anterior, hasta el nivel 999.
      </p>
      <StepsLink />
      <ul className={styles.grid}>
        {UPGRADES.map((u) => {
          const level = eco.upgrades[u.id] ?? 0;
          const maxed = level >= u.maxLevel;
          const cost = u.cost(level + 1);
          const affordable = !maxed && cost <= eco.points;
          return (
            <li key={u.id} className={styles.item}>
              <img className={styles.icon} src={spriteDataUrl(u.icon)} alt="" draggable={false} />
              <div className={styles.body}>
                <p className={styles.name}>
                  {u.name} <span className={styles.level}>Nv {level}</span>
                </p>
                <p className={styles.effect}>{level > 0 ? u.effect(level) : 'Sin mejorar'}</p>
                <p className={styles.next}>{maxed ? 'Nivel máximo' : `Siguiente: ${u.effect(level + 1)}`}</p>
              </div>
              <button
                type="button"
                className={styles.buy}
                disabled={!affordable}
                onClick={() => purchase(u.id)}
                aria-label={maxed ? `${u.name} al máximo` : `Mejorar ${u.name} por ${cost} puntos`}
              >
                {maxed ? (
                  'Máx.'
                ) : (
                  <>
                    <GemIcon size={12} /> {cost.toLocaleString('es-ES')}
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Código personal del Atajo de iOS que envía los pasos (ATAJO_PASOS_IOS.md). Se muestra una sola vez. */
function StepsLink() {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    const client = getSupabaseClient();
    if (!client) return toast('Inicia sesión con la sincronización para conectar el Atajo.', 'error');
    setBusy(true);
    const { data, error } = await client.rpc('create_steps_token');
    setBusy(false);
    if (error) return toast(`No se pudo generar el código: ${error.message}`, 'error');
    setToken(String(data));
  };

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      toast('Código copiado.');
    } catch {
      toast('No se pudo copiar: selecciónalo y cópialo a mano.', 'error');
    }
  };

  return (
    <div className={styles.steps}>
      <p className={styles.stepsTitle}>Pasos del iPhone</p>
      {token ? (
        <>
          <p className={styles.note}>
            Pega este código en el Atajo. Solo se muestra ahora; si lo pierdes, genera otro (el anterior deja de funcionar).
          </p>
          <code className={styles.token}>{token}</code>
          <button type="button" className={styles.buy} onClick={copy}>
            Copiar código
          </button>
        </>
      ) : (
        <>
          <p className={styles.note}>El Atajo de iOS envía tus pasos diarios a Tasky con un código personal.</p>
          <button type="button" className={styles.buy} onClick={generate} disabled={busy}>
            {busy ? 'Generando…' : 'Generar código del Atajo'}
          </button>
        </>
      )}
    </div>
  );
}
