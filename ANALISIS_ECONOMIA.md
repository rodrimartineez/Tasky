# Análisis de economía y equilibrio — Modo Hábitos

Estudio hecho antes de implementar la Fase 4 (noviembre de 2026). Explica **por qué** se eligieron las fórmulas de
puntos por racha, dificultad por nivel, costes de mejoras y precios en oro, y qué se espera que pase tras meses y años.

Todo es reproducible:

- Modelo de economía: [src/habits/balance/economy.ts](src/habits/balance/economy.ts) (hábitos simulados día a día con
  perfiles de constancia, compra automática de mejoras).
- Combate: [src/habits/balance/balance.study.test.ts](src/habits/balance/balance.study.test.ts) juega partidas reales de la
  simulación con un bot (`src/game/sim/bot.ts`) usando las mejoras que tendría cada perfil ese día. Se ejecuta con
  `BALANCE_OUT=<archivo.md> npx vitest run src/habits/balance` (en las pruebas normales se omite).

Supuestos del modelo: 5 hábitos diarios + 2 semanales; cada hábito tiene «inercia» (cumplir ayer hace más probable
cumplir hoy), así las rachas se parecen a las reales; los puntos se gastan siempre en la mejora de combate más barata.
El bot juega peor que una persona (no elige mejoras con criterio ni esquiva bien): los tiempos de supervivencia son un
**suelo**, no una predicción.

## 1. Perfiles

| Perfil | Diarios cumplidos | Semanales cumplidos | Juega |
|---|---|---|---|
| Constante | 95 % | 90 % | todos los días |
| Normal | 80 % | 70 % | todos los días |
| Irregular | 50 % | 40 % | todos los días |
| Abandona y vuelve | 85 %, 0 % entre los días 120–210 | 70 % / 0 % | todos los días |
| Abandona y no juega | igual | igual | no juega durante la pausa |

## 2. Puntos por racha (hábitos diarios)

Se compararon seis reglas. Puntos acumulados por perfil (5 diarios + 2 semanales):

| Regla | Puntos por cumplir con racha *r* | Constante a 1 año | Constante a 3 años | Irregular a 3 años | Constante / Irregular |
|---|---|---|---|---|---|
| Plano | 1 | 2.107 | 6.315 | 3.157 | 2× |
| **Lineal (la idea inicial: racha 50 → 50)** | *r* | 334.257 | **3.001.140** | 6.303 | **476×** |
| Raíz | ⌈√r⌉ | 22.702 | 119.035 | 3.608 | 33× |
| log₂ | 1 + ⌊log₂ r⌋ | 14.197 | 50.885 | 5.055 | 10× |
| Escalones | +1 cada 30 días, máx. 8 | 7.897 | 32.190 | 3.230 | 10× |
| **Hitos (elegida)** | 1 + nº de hitos superados | 12.955 | 48.198 | 3.939 | 12× |

Conclusiones:

- **Lineal no es sostenible.** Una racha de un año da 365 puntos *cada día por hábito*: a los 3 años hay 3 millones de
  puntos, cualquier coste se vuelve irrelevante y la economía se rompe. Además castiga brutalmente romper la racha
  (pasar de 365 a 1 punto de un día para otro), lo que convierte un mal día en un motivo para abandonar.
- **Plano no premia la constancia**: quien cumple la mitad gana la mitad, sin incentivo para mantener la racha.
- **Hitos** se comporta como log₂ (crecimiento sostenido pero acotado) con números fáciles de recordar y de mostrar:

  | Racha (días) | 1 | 3 | 7 | 14 | 30 | 60 | 100 | 180 | 365 | 730 | 1095 |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | Puntos por día cumplido | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |

  Romper la racha cuesta, pero se recupera rápido: en dos semanas ya vuelve a dar 4 puntos al día.
  Implementación: [src/habits/core/rewards.ts](src/habits/core/rewards.ts).

- **Semanales**: mantienen su sistema propio e independiente, 3 puntos fijos por semana cumplida (no cuentan como
  diarios ni comparten racha). Un hábito semanal equivale a ~3 días de un diario sin racha; premiar su racha (p. ej.
  +1 cada 4 semanas seguidas) queda como propuesta en `IDEAS_MEJORAS_JUEGO.md`.

## 3. Mejoras permanentes

16 mejoras sin nivel máximo ([src/game/content/upgrades.ts](src/game/content/upgrades.ts)). Coste del nivel *n*:
`base · n^1,5` (algunas `n^1,55`), así el coste total de *N* niveles crece como `N^2,5`: con el doble de puntos se
compra ~1,3× más niveles. Ninguna se «completa» y ninguna deja obsoletas a las demás. Las que romperían el juego si
crecieran sin freno usan rendimientos decrecientes (velocidad, crítico) o coste exponencial (proyectiles extra).

Niveles alcanzados de Poder · Vida · Celeridad (el resto, en proporción):

| Perfil | 30 días | 90 días | 180 días | 1 año | 2 años | 3 años |
|---|---|---|---|---|---|---|
| Constante | 4 · 4 · 3 | 7 · 7 · 5 | 10 · 10 · 8 | 15 · 15 · 11 | 21 · 21 · 16 | 25 · 25 · 20 |
| Normal | 3 · 3 · 3 | 6 · 6 · 5 | 9 · 9 · 7 | 13 · 13 · 11 | 18 · 18 · 14 | 22 · 22 · 17 |
| Irregular | 2 · 2 · 1 | 3 · 3 · 2 | 4 · 4 · 3 | 6 · 6 · 4 | 8 · 8 · 6 | 9 · 9 · 7 |

## 4. Dificultad por nivel

La partida *n* es el nivel *n* (ganes o pierdas). Sobre la escalada por minutos de cada partida se aplica
([src/game/sim/difficulty.ts](src/game/sim/difficulty.ts)):

- Vida de los enemigos ×(1 + 0,012·(n−1)^0,86), daño ×(1 + 0,006·(n−1)^0,86): sin techo, pero cada vez más despacio.
- Densidad ×(1 + 0,004·(n−1)), con techo ×1,6 (el límite real es el rendimiento en móvil).
- Oro ×(1 + 0,03·(n−1)^0,8): avanzar siempre compensa.

| Nivel | 30 | 90 | 180 | 365 | 730 | 1095 |
|---|---|---|---|---|---|---|
| Vida enemigos | ×1,22 | ×1,57 | ×2,04 | ×2,91 | ×4,48 | ×5,93 |

Se probó primero una curva mucho más empinada (0,09 en vida): a los 30 días ningún perfil pasaba de 2–3 minutos.
Es el motivo de la curva actual.

## 5. Resultado en combate

Minutos sobrevividos por el bot (3 semillas) y oro de la primera partida, con la configuración final:

| Perfil | Día 1 | 30 | 90 | 180 | 1 año | 2 años | 3 años |
|---|---|---|---|---|---|---|---|
| Constante | 25 / 5 / 11 | 29 / 12 / 12 | 12 / 12 / 14 | 13 / 16 / 15 | 18 / 17 / 12 | 30 / 15 / 14 | 30 / 17 / 17 |
| Normal | 25 / 5 / 11 | 14 / 12 / 15 | 14 / 21 / 12 | 25 / 12 / 12 | 15 / 15 / 10 | 12 / 23 / 15 | 12 / 12 / 11 |
| Irregular | 10 / 12 / 12 | 5 / 8 / 11 | 8 / 16 / 25 | 7 / 10 / 5 | 12 / 6 / 11 | 13 / 8 / 5 | 8 / 10 / 5 |

| Oro por partida | Día 1 | 30 | 90 | 180 | 1 año | 2 años | 3 años |
|---|---|---|---|---|---|---|---|
| Constante | 149 | 438 | 252 | 641 | 536 | 4.296 | 8.190 |
| Normal | 149 | 191 | 261 | 532 | 546 | 2.128 | 685 |
| Irregular | 109 | 61 | 144 | 124 | 286 | 52 | 57 |

Lectura:

- **Hay tensión real**: nadie gana siempre; las partidas duran 10–20 minutos durante años y llegar a los 30 sigue siendo
  un logro.
- **Cumplir hábitos se nota**: el perfil constante se mantiene o mejora con los años; el normal se mantiene; el
  irregular baja poco a poco (5–10 minutos a los 2–3 años) pero sigue jugando y ganando algo de oro.
- **Nunca hay callejón sin salida**: incluso sin mejoras, una partida dura minutos, da oro y sube el nivel. Como el
  nivel solo sube al *jugar*, quien deja de jugar no se queda atrás (las partidas se acumulan sin endurecerse).

## 6. Recuperación tras inactividad

| Perfil | Antes (día 110) | Tras 90 días sin hábitos (día 210) | 3 meses después (día 300) | Día 540 |
|---|---|---|---|---|
| Abandona y vuelve (sigue jugando) | 12 / 10 / 16 min | 23 / 8 / 21 min | 16 / 11 / 12 min | 25 / 12 / 13 min |
| Abandona y no juega | 12 / 10 / 16 min · nivel 110 | 25 / 13 / 18 min · nivel 120 | 16 / 18 / 13 min · nivel 210 | 15 / 14 / 16 min · nivel 450 |

Una pausa de 3 meses **no hunde** la partida: las mejoras compradas no se pierden y la dificultad crece despacio.
Al volver, los puntos vuelven a entrar desde el primer día (con racha corta) y en pocas semanas se recupera el ritmo.

## 7. Oro y desbloqueos

El oro solo sale de las partidas y solo compra contenido (personajes y escenarios). Ingresos esperados (perfil
normal, una partida al día): ~200/partida el primer mes, ~500 a los 6–12 meses, ~1.000–3.000 a los 2 años
→ unos **15.000 de oro el primer año** y unos 60.000 en dos.

Precios propuestos para la Fase 5 (16 personajes y 5 escenarios), pensados para desbloquear algo cada pocas semanas
al principio y que el contenido final cueste meses:

| Personajes (por orden) | 0 · 400 · 800 · 1.500 · 2.500 · 4.000 · 6.000 · 8.500 · 12.000 · 16.000 · 21.000 · 27.000 · 34.000 · 42.000 · 52.000 · 65.000 |
|---|---|
| **Escenarios** | 0 · 5.000 · 15.000 · 35.000 · 70.000 |

Total ≈ 420.000 de oro: un jugador normal lo desbloquea todo en ~1,5–2 años; uno constante, antes.

## 8. Parámetros a vigilar

Todos los números están en `difficulty.ts`, `rewards.ts` y `upgrades.ts`, y el estudio se puede repetir tras
cualquier cambio. Si con datos reales las partidas resultan demasiado cortas, lo primero es bajar `hpA`; si el oro
sobra, subir los precios o añadir usos (ver `IDEAS_MEJORAS_JUEGO.md`).
