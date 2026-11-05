import { v7 } from 'uuid';

/** Identificador único global, ordenado por tiempo (UUID v7). Se genera en el dispositivo. */
export const newId = (): string => v7();
