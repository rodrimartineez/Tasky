import { describe, expect, it } from 'vitest';
import { parseLinks, previewText } from './RichText';

describe('enlaces en descripciones', () => {
  it('una dirección suelta se muestra como su dominio', () => {
    expect(parseLinks('Mira https://www.github.com/rodri/tasky/issues/1?a=b. Fin')).toEqual([
      { text: 'Mira ' },
      { label: 'github.com', url: 'https://www.github.com/rodri/tasky/issues/1?a=b' },
      { text: '. Fin' },
    ]);
  });

  it('[texto](url) muestra el texto', () => {
    expect(parseLinks('Ver [la documentación](https://ejemplo.com/docs) ahora')).toEqual([
      { text: 'Ver ' },
      { label: 'la documentación', url: 'https://ejemplo.com/docs' },
      { text: ' ahora' },
    ]);
  });

  it('solo http(s): otros esquemas se dejan como texto', () => {
    expect(parseLinks('[x](javascript:alert(1)) y javascript:alert(1)')).toEqual([{ text: '[x](javascript:alert(1)) y javascript:alert(1)' }]);
  });

  it('la vista previa nunca muestra la dirección larga', () => {
    expect(previewText('Repo https://github.com/a/b/c/d y [guía](https://x.dev/larguisimo)')).toBe('Repo github.com y guía');
  });
});
