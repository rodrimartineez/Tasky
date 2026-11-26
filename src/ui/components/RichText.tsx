import { Fragment } from 'react';
import { ExternalLink } from 'lucide-react';
import styles from './RichText.module.css';

type Part = { text: string } | { label: string; url: string };

/** `[texto](https://…)` (el texto es lo que se ve) o una dirección suelta `https://…` (se muestra su dominio). */
const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>"]+/g;

/** Solo http(s): nunca `javascript:` ni otros esquemas. */
function safeUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** Parte un texto en trozos de texto y enlaces. */
export function parseLinks(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    let [match] = m;
    const start = m.index;
    const label = m[1];
    let raw = m[2];
    if (!raw) {
      // Dirección suelta: la puntuación final no forma parte del enlace.
      const trimmed = match.replace(/[.,;:!?)\]'"]+$/, '');
      raw = trimmed;
      match = trimmed;
    }
    const url = safeUrl(raw);
    if (!url) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ label: label ?? url.hostname.replace(/^www\./, ''), url: url.href });
    last = start + match.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Texto de las vistas previas: los enlaces se reducen a su nombre (nunca se muestra la dirección larga). */
export const previewText = (text: string) => parseLinks(text).map((p) => ('text' in p ? p.text : p.label)).join('');

/** Descripción completa: el texto tal cual y cada enlace como un botón con su nombre. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseLinks(text).map((p, i) =>
        'text' in p ? (
          <Fragment key={i}>{p.text}</Fragment>
        ) : (
          <a key={i} className={styles.link} href={p.url} target="_blank" rel="noopener noreferrer" title={p.url} onClick={(e) => e.stopPropagation()}>
            {p.label}
            <ExternalLink aria-hidden />
          </a>
        ),
      )}
    </>
  );
}
