import { UPGRADES } from '../../game/content/upgrades';
import { spriteDataUrl } from '../../game/sprites/atlas';
import { toast } from '../../ui/components/Toaster';
import { EconomyError } from '../core/economy';
import { useEconomy, useHabits } from '../state/store';
import { GemIcon } from './PointsBadge';
import styles from './UpgradesPage.module.css';

/** Tienda de mejoras permanentes: se pagan con los puntos de los hábitos. Solo Constancia tiene nivel máximo. */
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
          <p className={styles.balanceLabel}>puntos para mejoras permanentes</p>
        </div>
      </div>
      <p className={styles.note}>
        Las mejoras se aplican en todas las partidas y con todos los personajes. Cada nivel cuesta algo más que el anterior. Constancia no
        mejora al personaje: hace que tus hábitos den más puntos (hasta el nivel 4).
      </p>
      <ul className={styles.grid}>
        {UPGRADES.map((u) => {
          const level = eco.upgrades[u.id] ?? 0;
          const maxed = level >= (u.maxLevel ?? Infinity);
          const cost = u.cost(level + 1);
          const affordable = !maxed && cost <= eco.points;
          return (
            <li key={u.id} className={styles.item}>
              <img className={styles.icon} src={spriteDataUrl(u.icon)} alt="" draggable={false} />
              <div className={styles.body}>
                <p className={styles.name}>
                  {u.name} <span className={styles.level}>{u.maxLevel ? `Nv ${level}/${u.maxLevel}` : `Nv ${level}`}</span>
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
