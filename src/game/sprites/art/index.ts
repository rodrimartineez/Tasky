import { ART as BOSSES } from './bosses';
import { ART as CHARACTERS } from './characters';
import { ART as ENEMIES } from './enemies';
import { ART as ITEMS } from './items';
import { ART as WEAPONS } from './weapons';

/** Todo el arte de la Fase 7. Cada grupo vive en su archivo; lo que se redibuja aquí sustituye al sprite antiguo. */
export const ART: Record<string, string[]> = { ...CHARACTERS, ...ENEMIES, ...BOSSES, ...WEAPONS, ...ITEMS };
