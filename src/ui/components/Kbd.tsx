import styles from './Kbd.module.css';

export function Kbd({ children, tone = 'default' }: { children: string; tone?: 'default' | 'onPrimary' }) {
  return <kbd className={`${styles.kbd} ${tone === 'onPrimary' ? styles.onPrimary : ''}`}>{children}</kbd>;
}
