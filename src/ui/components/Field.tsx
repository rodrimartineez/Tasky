import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import styles from './Field.module.css';

interface BaseProps {
  label: string;
  optional?: boolean;
}

export function TextField({ label, optional, ...rest }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={styles.field}>
      <Label id={id} label={label} optional={optional} />
      <input id={id} className={styles.control} autoComplete="off" spellCheck {...rest} />
    </div>
  );
}

export function TextArea({ label, optional, ...rest }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={styles.field}>
      <Label id={id} label={label} optional={optional} />
      <textarea id={id} className={`${styles.control} ${styles.textarea}`} rows={3} spellCheck {...rest} />
    </div>
  );
}

function Label({ id, label, optional }: { id: string } & BaseProps) {
  return (
    <label htmlFor={id} className={styles.label}>
      {label}
      {optional && <span className={styles.optional}>Opcional</span>}
    </label>
  );
}
