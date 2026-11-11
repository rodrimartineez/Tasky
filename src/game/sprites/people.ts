/**
 * Personajes jugables: cada uno es una cabeza propia (7 filas) sobre un cuerpo de plantilla (5 filas + piernas
 * con 2 fotogramas) recoloreado. El resultado son sprites de 12×14 como el del héroe base (`hero_0/1` en data.ts).
 * Todo el arte es original; las cabezas son lo que da su silueta a cada personaje.
 */

type Rows = string[];

const HEADS: Record<string, Rows> = {
  warden: ['.....rr.....', '...kssssk...', '..kssWWssk..', '..ksttttsk..', '..kskttksk..', '..ksttttsk..', '...kssssk...'],
  mystic: ['.....kk.....', '....kmmk....', '...kmymmk...', '.kkkmmmmkkk.', '..ktkttktk..', '..kttttttk..', '...kttttk...'],
  herbalist: ['...g.gg.g...', '..kgggggGk..', '.kgggggggGk.', '.kggttttGgk.', '.kggtkktGgk.', '.kggttttGgk.', '..kGgttGgk..'],
  hunter: ['......rr....', '....kkGGkk..', '..kGGGGGGGk.', '.kkddddddkk.', '..ktkttktk..', '..kttttttk..', '...kttttk...'],
  gladiator: ['.....rr.....', '....krrk....', '..kssssssk..', '..ksttttsk..', '..kstkktsk..', '..ksttttsk..', '...kssssk...'],
  alchemist: ['..oo.oo.oo..', '..kooooook..', '.kkbbkkbbkk.', '..kttttttk..', '..ktkttktk..', '..kttttttk..', '...kcccck...'],
  stormcaller: ['..y..yy..y..', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kbttttBk..', '..kbtkktBk..', '..kbttttBk..', '...kBBBBk...'],
  sapper: ['.....ww.....', '...kyyyyk...', '..kyyyyyyk..', '.kkYYYYYYkk.', '..ktkttktk..', '..kttttttk..', '..kTTttTTk..'],
  astronomer: ['....kkkk....', '...kBByBk...', '..kBBBByBk..', '..kBttttBk..', '..kBwkkwBk..', '..kBttttBk..', '...kBBBBk...'],
  prism: ['.....cc.....', '...kWWWWk...', '..kWWccWWk..', '..kWttttWk..', '..kWtkktWk..', '..kWttttWk..', '..kWWttWWk..'],
  hermit: ['....kkkk....', '...kSSSSk...', '..kSSSSSSk..', '..kSttttSk..', '..kStkktSk..', '..kWWWWWWk..', '...kWWWWk...'],
  thief: ['....kkkk....', '...kDDDDk...', '..kDDDDDDk..', '..kDDDDDDk..', '..kDwkkwDk..', '..kDrrrrDk..', '...krrrrk...'],
  centella: ['..oo....oo..', '.kooooooook.', '.kooyyyyook.', '.kottttttok.', '.kotkttktok.', '.kottttttok.', '..koottook..'],
  knight: ['.....bb.....', '...kyyyyk...', '..kyyYYyyk..', '..kYkkkkYk..', '..kyYYYYyk..', '..kyyyyyyk..', '...kYYYYk...'],
  archmage: ['.....kk.....', '....kPPk....', '...kPpyPk...', '.kkkPPPPkkk.', '.kWtkttktWk.', '.kWttttttWk.', '..kWWttWWk..'],
};

/** Torsos de plantilla (p = color principal, P = su sombra, y = adorno). */
const TORSOS: Record<string, Rows> = {
  tunic: ['..kPppppPk..', '.kPPpyypPPk.', '.ktPppppPtk.', '..kPPppPPk..', '..kPPkkPPk..'],
  armor: ['.kssPppPssk.', 'ksssPyyPsssk', 'kstsPppPstsk', '.kssPppPssk.', '..kPPkkPPk..'],
  robe: ['..kPppppPk..', '.kPppyyppPk.', 'kPPppppppPPk', 'kPPPppppPPPk', '.kPPPPPPPPk.'],
  cloak: ['...kPppPk...', '..kPPyyPPk..', '.ktPPppPPtk.', '..kPppppPk..', '...kPkkPk...'],
};

/** Piernas: dos fotogramas de paso. Las túnicas largas solo dejan ver las botas. */
const LEGS: Record<string, [Rows, Rows]> = {
  boots: [
    ['..kTTk.kTTk.', '..kkk..kkk..'],
    ['.kTTk..kTTk.', '.kkk....kkk.'],
  ],
  robe: [
    ['.kPPPPPPPPk.', '..kkTkkTkk..'],
    ['.kPPPPPPPPk.', '..kTkkkkTk..'],
  ],
};

interface Look {
  head: string;
  torso: keyof typeof TORSOS;
  /** Colores del cuerpo: p, P y adorno (y). */
  colors: [string, string, string];
}

const LOOKS: Record<string, Look> = {
  warden: { head: 'warden', torso: 'armor', colors: ['b', 'B', 'y'] },
  mystic: { head: 'mystic', torso: 'robe', colors: ['m', 'M', 'y'] },
  herbalist: { head: 'herbalist', torso: 'tunic', colors: ['g', 'G', 'o'] },
  hunter: { head: 'hunter', torso: 'cloak', colors: ['G', 'd', 'T'] },
  gladiator: { head: 'gladiator', torso: 'armor', colors: ['r', 'R', 'y'] },
  alchemist: { head: 'alchemist', torso: 'tunic', colors: ['W', 's', 'c'] },
  stormcaller: { head: 'stormcaller', torso: 'robe', colors: ['b', 'B', 'y'] },
  sapper: { head: 'sapper', torso: 'tunic', colors: ['o', 'O', 'y'] },
  astronomer: { head: 'astronomer', torso: 'robe', colors: ['B', 'P', 'y'] },
  prism: { head: 'prism', torso: 'robe', colors: ['c', 'b', 'w'] },
  hermit: { head: 'hermit', torso: 'cloak', colors: ['s', 'S', 'W'] },
  thief: { head: 'thief', torso: 'cloak', colors: ['S', 'D', 'r'] },
  centella: { head: 'centella', torso: 'tunic', colors: ['y', 'Y', 'o'] },
  knight: { head: 'knight', torso: 'armor', colors: ['y', 'Y', 'b'] },
  archmage: { head: 'archmage', torso: 'robe', colors: ['p', 'P', 'y'] },
};

/** Sustituye los colores de plantilla del cuerpo. */
function paint(rows: Rows, [p, P, y]: [string, string, string]): Rows {
  return rows.map((row) => row.replace(/[pPy]/g, (ch) => (ch === 'p' ? p : ch === 'P' ? P : y)));
}

/** Sprites `c_<id>_0` y `c_<id>_1` de todos los personajes salvo el Errante (que usa `hero`). */
export const PEOPLE: Record<string, Rows> = {};
for (const [id, look] of Object.entries(LOOKS)) {
  const body = paint(TORSOS[look.torso], look.colors);
  const legs = LEGS[look.torso === 'robe' ? 'robe' : 'boots'];
  const recolored = legs.map((frame) => paint(frame, look.colors));
  PEOPLE[`c_${id}_0`] = [...HEADS[look.head], ...body, ...recolored[0]];
  PEOPLE[`c_${id}_1`] = [...HEADS[look.head], ...body, ...recolored[1]];
}
