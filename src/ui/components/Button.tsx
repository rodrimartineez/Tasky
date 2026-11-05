import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
  shortcut?: string;
}

export function Button({ variant = 'secondary', icon, shortcut, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={[styles.button, styles[variant], className].filter(Boolean).join(' ')} {...rest}>
      {icon}
      {children && <span>{children}</span>}
      {shortcut && <kbd className={styles.kbd}>{shortcut}</kbd>}
    </button>
  );
}
