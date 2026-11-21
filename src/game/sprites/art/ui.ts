/** Carta de arcana (marco dorado) o darkana (marco violeta): el símbolo, de hasta 12 filas de 8, va centrado. */
const card = (symbol: string[], dark = false): string[] => {
  const [edge, mid] = dark ? ['P', 'p'] : ['Y', 'y'];
  const pad = 12 - symbol.length;
  const body = [...Array<string>(Math.floor(pad / 2)).fill('nnnnnnnn'), ...symbol, ...Array<string>(pad - Math.floor(pad / 2)).fill('nnnnnnnn')];
  return ['.kkkkkkkkkk.', `k${edge}${mid.repeat(8)}${edge}k`, ...body.map((row) => `k${mid}${row}${mid}k`), `k${edge}${mid.repeat(8)}${edge}k`, '.kkkkkkkkkk.'];
};

/** Arte de interfaz: cofre abierto (presentación de cofres), icono de la mejora de recompensas y cartas de arcanas y darkanas. */
export const ART: Record<string, string[]> = {
  i_chest_open: [
    '..kkkkkkkkkkkk..',
    '.kTtttttttttTTk.',
    '.kTyYttttttyYTk.',
    '.kDDDDDDDDDDDDk.',
    'kkkkkkkkkkkkkkkk',
    'khwwwwhwwwwhwwhk',
    'kyhwwwwwwwwwwhyk',
    'kyyyyyyhhyyyyyYk',
    'kTtyYtyyyytyYTDk',
    'kTtyYtyykkytyYDk',
    'kTTyYTTyyyTTyYDk',
    'kTTyYTTTTTTTyYDk',
    'kDDyYDDDDDDDyYDk',
    'kDDDDDDDDDDDDDDk',
    '.kkkkkkkkkkkkkk.',
  ],
  u_bounty: [
    '................',
    '....kkkkkkk.....',
    '...kwppppPPk....',
    '..kwpwppppPPk...',
    '.kppppppppPPPk..',
    '.kkkkkkkkkkkkk..',
    '..kpwpppppPPk...',
    '...kppppppPk....',
    '....kpppPPk.....',
    '.....kpPPk.kkk..',
    '......kPk..kyk..',
    '.......k.kkkykkk',
    '.........kyyhyyk',
    '.........kkkYkkk',
    '...........kYk..',
    '...........kkk..',
  ],
  // Arcanas
  a_chaos: card(['nnccnnnn', 'ncnncnnn', 'cnnnncnc', 'nnnnnncn', 'nnnnnnnn', 'nncnnnnn', 'ncncnnnc', 'cnnncnnn', 'nnnnncnn', 'nnnnnnnn']),
  a_sarabande: card(['nrrnnrrn', 'rwrrrrrr', 'rrrrrrrr', 'rrrrrrRr', 'nrrrrrRn', 'nnrrrRnn', 'nnnrRnnn', 'nnnnnnnn']),
  a_ironblue: card(['bnnnnnnn', 'nbnnnnbb', 'nnbnnbnb', 'nnnbbnnb', 'nnnnnnnb', 'nnnnnnbB', 'nnnnnbBB', 'nnnnnnnn']),
  a_beginning: card(['nnnyynnn', 'nnnyynnn', 'nnnnnnnn', 'nyynnyyn', 'nyynnyyn', 'nnnnnnnn', 'nnnyynnn', 'nnnyynnn']),
  a_waltz: card(['nnwwnnnn', 'nwWWwnnn', 'nwWWwnnn', 'nnwwnnww', 'nnnnnwWW', 'nnnnnwWW', 'nnnnnnww', 'nnnnnnnn']),
  a_tragic: card(['nnuuuunn', 'nuLnnnun', 'uLnnLnnu', 'uLnnLnnu', 'unnnLLnu', 'unnnnnnu', 'nunnnnun', 'nnuuuunn']),
  // Darkanas
  a_sapphire: card(['nnnbbnnn', 'nnbBBbnn', 'nbBwBBbn', 'nnbBBbnn', 'nnnbbnnn', 'nnbbnnnn', 'nbBBbnnn', 'nnbbnnnn'], true),
  a_heir: card(['nnnnFnnn', 'nnnFFnnn', 'nnFFoFnn', 'nFFoooFn', 'nFooyyoF', 'nFooyyoF', 'nnFoyyFn', 'nnnFFFnn'], true),
};
