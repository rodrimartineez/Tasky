# Guía de estilo del arte del juego (Fase 7)

Referencia de todo el arte del modo Hábitos. El objetivo es un pixel art **original** con la legibilidad y la
fuerza de los juegos tipo *survivors* (siluetas grandes y claras, colores saturados sobre suelo oscuro, mucho
contraste), sin copiar personajes, enemigos ni arte de ningún juego existente.

## Formato

- Cada sprite es una lista de filas de texto; cada carácter es un píxel de `PALETTE` (`src/game/sprites/data.ts`)
  y `.` es transparente. Todas las filas de un sprite tienen la misma longitud.
- El arte nuevo vive en `src/game/sprites/art/<grupo>.ts` (`export const ART`). Lo que se dibuja ahí sustituye al
  sprite antiguo del mismo nombre, así que los nombres no cambian.
- Revisión: apartado **Catálogo → Ver todos los sprites** (solo en desarrollo) o
  `python scripts/render_sprites.py src/game/sprites/art/<grupo>.ts hoja.png`.

## Reglas de dibujo

- **Contorno** de 1 px con `k` (casi negro) en todo lo físico (personajes, enemigos, objetos, iconos). Las líneas
  interiores, con `n` o `e`, no con `k`.
- **Luz desde arriba a la izquierda**: 3–4 tonos por material (brillo, base, sombra y sombra profunda). Brillo arriba
  a la izquierda, sombra abajo a la derecha.
- **Siluetas que se lean al tamaño real**: formas grandes y simples, cabezas grandes (~40 % de la altura en los
  personajes), ojos de 1–2 px muy visibles, sin ruido de píxeles sueltos.
- **Color**: saturado y con una idea principal por sprite. Nada de tonos apagados que se confundan con el suelo
  (los suelos son verdes, azules, violetas y marrones muy oscuros).
- **Energía** (proyectiles mágicos, rayos, efectos): sin contorno, núcleo blanco o `h`, halo del color del elemento.
  Los proyectiles físicos (flechas, frascos, cuchillas) sí llevan contorno.
- Los proyectiles se dibujan **apuntando a la derecha** (el juego los gira según su dirección).

## Tamaños

| Grupo | Tamaño | Notas |
|---|---|---|
| Personajes (`hero_0/1`, `c_<id>_0/1`) | 14×18 a 22×22 | Cada uno con su silueta (animales, criaturas, seres fantásticos; solo el Errante es humano) y 2 fotogramas con un movimiento propio (saltar, aletear, flotar…) |
| Enemigos normales (`e_*`) | 12–18 de alto | Pequeños rápidos ~12, normales ~16, grandes ~18–20 |
| Jefes de escenario | 28×28 | |
| Jefes de ciclo | 32×32 | Diseño propio cada uno, sin recolorear a otro |
| La Muerte (`e_reaper`) | 24×32 | Encapuchada, manto rojo y guadaña grande |
| Iconos de armas (`w_*`) | 16×16 | Sin marco |
| Iconos de evoluciones | 16×16 | Marco dorado: borde `k`, `y` arriba e izquierda, `Y` abajo y derecha |
| Pasivas (`p_*`) y mejoras (`u_*`) | 16×16 | Sin marco, como las armas: el objeto suelto con contorno `k` |
| Proyectiles (`x_*`) | 6–12 | |
| Impactos (`fx_<familia>_hit_0/1/2`) | 12×12 | Anticipación (pequeño) → impacto (estallido) → disipación (chispas sueltas) |
| Recogidas (`i_*`) | 8–16 | Gemas de experiencia 8×10 (azul, verde, roja) |
| Adornos de mapa (`d_*`) | 8–24 | Árboles y rocas grandes, flores y matas pequeñas |

## Familias de armas (color del elemento)

| Familia | Colores | Armas |
|---|---|---|
| Fuego | `F` `o` `y` `h` `R` | Aura de ascuas, Lluvia de meteoritos, Estela de fuego |
| Rayo | `y` `h` `w` `u` | Chispa errante, Tormenta en cadena, Haz prismático |
| Arcano | `p` `P` `m` `x` `c` | Lunas guardianas, Onda de choque, Cuchillas rebotantes |
| Veneno | `l` `g` `G` `v` | Frasco volátil, Nube venenosa, Minas de resina |
| Acero | `W` `s` `S` `L` `b` | Lanza solar, Látigo de sauce, Búmeran de hueso, Dron centinela |

Las evoluciones mantienen la familia de su arma, con más brillo, una forma ampliada y el marco dorado en el icono.

## Rendimiento

Todo va a un único atlas, así que el número de sprites apenas influye. Los efectos tienen tope (`MAX_PARTICLES`,
`MAX_HITS`) y nada del arte cambia la simulación: el equilibrio no varía.
