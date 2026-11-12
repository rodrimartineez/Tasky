# Análisis de economía y equilibrio — Modo Hábitos

Estudio hecho antes de implementar la Fase 4 (noviembre de 2026). Explica **por qué** se eligieron las fórmulas de
puntos por racha, dificultad por nivel, costes de mejoras y precios en oro, y qué se espera que pase tras meses y años.

Todo es reproducible:

- Modelo de economía: [src/habits/balance/economy.ts](src/habits/balance/economy.ts) (hábitos simulados día a día con
  perfiles de constancia, compra automática de mejoras).
- Combate: los estudios de `src/habits/balance/*.study.test.ts` juegan partidas reales de la simulación con un bot
  (`src/game/sim/bot.ts`) usando las mejoras que tendría cada perfil ese día (en las pruebas normales se omiten). Los
  del §4–§7 y §10.2 se retiraron en la Fase 5d; los vigentes están en el §11.

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

> **Sustituido por §10** (Fase 5c): precios de hasta 10 millones y bonificación por supervivencia.

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

## 9. Fase 5b: reglas de motivación (noviembre de 2026)

Reglas nuevas: escudo de racha cada 21 días, +1 punto por cada 4 semanas seguidas en semanales (máx. 6), mitad de
puntos a partir del 8.º diario y ayuda de vuelta. Estudio repetido con el contenido de la Fase 5 (3 semillas):

| Perfil | Puntos a 1 año (Fase 4 → 5b) | Puntos a 3 años | Supervivencia a 1 año | Oro por partida a 1 año |
|---|---|---|---|---|
| Constante | 12.955 → 13.077 | 48.671 | 30 / 16 / 30 min | ~7.500 |
| Normal | 9.742 → **12.054** | 42.914 | 30 / 30 / 17 min | ~6.900 |
| Irregular | 1.342 → 1.352 | 3.951 | 7 / 9 / 8 min | ~130 |

- **Constante frente a irregular: 9,7× a 1 año** (objetivo 6–15×). La diferencia para quien no cumple sigue siendo
  muy clara: el irregular no pasa de 5–10 minutos y gana poco oro.
- **El escudo beneficia sobre todo al perfil normal (+24 % de puntos, objetivo era < 10 %).** Con un 80 % de
  cumplimiento, muchos fallos sueltos dejan de romper rachas largas y el normal se acerca al constante. Con un
  escudo cada 21 días, como se decidió, es lo esperable. Si se quiere más distancia, se puede hacer el escudo más
  escaso (p. ej. cada 30 días) o que el día salvado no cuente para el próximo escudo. **Pendiente de decisión del
  usuario.**
- **Ayuda de vuelta** («abandona y vuelve», 90 días sin hábitos, ayuda al máximo: +30 % XP y +20 % de vida). Primeras
  partidas tras volver: 13,7 → 13,7 min de media el primer día y 14,0 → 17,0 min el quinto. El perfil normal, que
  no lo dejó, sobrevive ~25 min en esos días. La ayuda cubre como mucho ~1/4 de la diferencia (objetivo < 1/2) y
  desaparece en 5 partidas.

### Aviso para la Fase 5c: el contenido de la Fase 5 ha hecho el juego mucho más fácil

Con 13 armas y 12 pasivas (incluido el «Cuerno gemelo», +1 proyectil), el bot del perfil constante o normal ya
**sobrevive los 30 minutos casi siempre a partir de los 6–12 meses**, y el oro por partida pasa de ~500 a
**7.000–25.000**. Con esos ingresos, todo el contenido (~420.000 de oro) se desbloquearía en 2–3 meses en lugar de
1,5–2 años. El perfil irregular no cambia (5–10 min). Hay que reequilibrarlo en la Fase 5c: dificultad por nivel,
oro por partida o potencia de algunas armas y pasivas, sin tocar los puntos de los hábitos. Es el primer punto de la
Fase 5c.

## 10. Fase 5c: escudo y economía de oro a muy largo plazo (noviembre de 2026)

### 10.1 Escudo de racha

Estudio solo de puntos, con 20 semillas por perfil (`src/habits/balance/shield.study.test.ts`):

| Escudo cada | Constante 1 año / 3 años | Normal 1 año / 3 años | Irregular 1 año / 3 años | Normal frente a sin escudo | Constante / Irregular |
|---|---|---|---|---|---|
| sin escudo | 13.074 / 48.625 | 10.092 / 31.573 | 1.321 / 3.938 | — | 9,9× |
| 21 días (antes) | 13.074 / 48.625 | 11.869 / 40.036 | 1.321 / 3.938 | +17,6 % | 9,9× |
| 30 días | = | 11.637 / 39.043 | = | +15,3 % | 9,9× |
| 45 días | = | 11.428 / 38.133 | = | +13,2 % | 9,9× |
| **60 días (elegido)** | = | **11.272 / 37.359** | = | **+11,7 %** | 9,9× |
| 75 días | = | 11.121 / 36.759 | = | +10,2 % | 9,9× |
| 90 días | = | 10.977 / 36.116 | = | +8,8 % | 9,9× |

- El escudo solo influye en quien cumple a menudo pero no siempre: el constante casi nunca falla y el irregular nunca
  llega a reunir los días necesarios.
- **Decisión: un escudo cada 60 días cumplidos** (y el día salvado no cuenta para el siguiente). Reduce el beneficio
  de +17,6 % a +11,7 % y sigue protegiendo un fallo puntual unas 5–6 veces al año en una racha larga. Ir más lejos
  apenas cambia nada (cada 15 días más, −1,5 puntos) y lo haría casi inexistente.

### 10.2 Ingresos de oro

Bot con el Errante en el Bosque Marchito, 3 semillas por punto, de 1 a 1.460 días (`gold.study.test.ts`). Oro por
partida ajustado a una curva `a · día^b` (los datos tienen mucho ruido: ganar o morir cambia el oro ×5):

| Perfil | Oro por partida | Oro acumulado a 1 año | a 2 años | a 3 años | a 4 años |
|---|---|---|---|---|---|
| Constante | 53 · día^0,72 | 0,78 M | 2,6 M | 5,1 M | 8,4 M |
| Normal | 51 · día^0,69 | 0,63 M | 2,0 M | 4,0 M | 6,6 M |
| Irregular | ~150–250, plano | 55 k | 104 k | 152 k | 199 k |

Con esos ingresos, un objetivo de 10 millones quedaba a más de 6 años incluso para el constante. Para que los
objetivos grandes sean alcanzables en años **solo para quien es constante**, se añade una **bonificación por
supervivencia** al acabar cada partida (`sim/difficulty.ts`):

`bonus = (multiplicador de oro del nivel − 1) · 9 · (minutos − 10)^1,5 · codicia`

- En el nivel 1 vale 0 y antes del minuto 10 también: no acelera los primeros desbloqueos.
- Crece con el nivel (las partidas que se juegan) y sobre todo con los minutos sobrevividos, que dependen de las
  mejoras permanentes, es decir, de los hábitos. Ejemplos: nivel 365 → 955 (20 min) / 2.700 (30 min); nivel 1.095
  → 2.300 / 6.500; nivel 1.460 → 2.900 / 8.200.
- Se probó con 30 en lugar de 9: los ingresos se triplicaban y todo se desbloqueaba en ~3 años; con 9 (≈30 % de
  aquel efecto) la escalera queda como se busca.

### 10.3 Precios y calendario de desbloqueos

Escalera casi geométrica: los primeros desbloqueos llegan en días; los siguientes, cada vez más separados; y cuatro
**legendarios** con habilidades únicas (revivir, empezar con varias armas…) como objetivos de años. Día estimado en
que se puede comprar cada uno **comprándolo todo en orden** (modelo de ingresos con la bonificación):

| Contenido | Precio | Normal | Constante | Irregular |
|---|---|---|---|---|
| Guardiana · Mística · Hierbera | 300 · 700 · 1.800 | días 4–12 | días 3–10 | días 1–10 |
| Pantano Sombrío (escenario) | 4.500 | ~28 | ~25 | ~47 |
| Cripta Olvidada (escenario) | 25.000 | ~85 | ~76 | ~390 |
| Cavernas de Cristal (escenario) | 75.000 | ~160 | ~145 | ~3,5 años |
| Páramo de Ceniza (escenario) | 150.000 | ~270 | ~240 | ~9 años |
| Archimaga (último normal) | 400.000 | ~480 | ~430 | — |
| Fénix Renacido (legendario) | 750.000 | ~590 | ~530 | — |
| Coleccionista (legendario) | 1.500.000 | ~760 | ~685 | — |
| Cronomante (legendario) | 4.000.000 | ~3 años | ~2,75 años | — |
| **Sol Eterno (legendario)** | **10.000.000** | **~4,8 años** | **~4,3 años** | — |

Precios intermedios de personajes: 2.600 · 9.000 · 12.000 · 19.000 · 40.000 · 50.000 · 85.000 · 120.000 · 190.000 ·
230.000 · 300.000.

Lectura:
- **Siempre hay un objetivo**: el último legendario queda a más de 4 años y, entre medias, cada desbloqueo está a
  semanas o meses del anterior. El campamento muestra el próximo objetivo, una barra de progreso y cuántas partidas
  faltan al ritmo de las últimas.
- **La constancia se nota mucho**: el irregular consigue los primeros personajes y escenarios, pero no los grandes
  objetivos. Cuanto más fuerte es el personaje (hábitos), más dura la partida y más oro da.
- **El oro nunca compra estadísticas**: solo contenido. Los legendarios son muy fuertes, pero se juegan con las mismas
  mejoras permanentes que salen de los hábitos.
- Los números exactos dependen de cómo juegue una persona (el bot huye y no elige mejoras con criterio): habrá que
  revisarlos con datos reales tras el lanzamiento. Todo está en `characters.ts`, `stages.ts` y `difficulty.ts`.

## 11. Fase 5d: progresión por niveles, intentos y jefes (noviembre de 2026)

Sustituye a los §4–§7 y §10.2 en todo lo que dependía del nivel: desde la Fase 5d el nivel ya no es «la partida
n-ésima», sino **el último nivel superado + 1**, y solo se supera llegando al minuto 30 (HABITS_GUIDE §11). Los
estudios antiguos (`balance.study`, `gold.study`) se han retirado porque medían un sistema que ya no existe; sus
conclusiones sobre puntos, mejoras y precios siguen valiendo.

Estudios nuevos (se omiten en las pruebas normales; cada uno indica en su cabecera cómo ejecutarlo):

- `frontier.study.test.ts`: para un perfil y un día, busca con el bot la **dureza máxima** (factor único sobre vida,
  daño y densidad) con la que todavía llega al minuto 30. Es la «frontera» de ese jugador.
- `progression.study.test.ts`: ajusta curvas a la frontera y simula 3 años día a día: intentos que dan los hábitos,
  cuántos se juegan, niveles superados y oro.
- `bosses.study.test.ts`: juega los 10 jefes de ciclo en la frontera del perfil Constante.

### 11.1 Frontera medida (perfil Constante, Errante, Bosque Marchito)

`F*(P) = 0,797 · (1 + P/1.484)^0,588`, con P = puntos gastados en mejoras. Valores medidos (una semilla por punto, con
mucho ruido): día 30 → 1,10 · día 90 → 1,26 · día 180 → 2,38 · día 365 → 2,94 · día 730 → 3,62 · día 1.095 → 7,31.

Probabilidad de llegar al minuto 30: `σ((0,06 − x) / 0,28)`, con `x = log(dureza / frontera)`. El ancho 0,28 es el
dato clave: **de una partida a otra hay mucho más azar (±28 %) que lo que crece el jugador en un día (~0,2 %)**. Por
eso los niveles superados en un día dependen sobre todo de cuántos intentos se juegan, y el ritmo a largo plazo lo
fija que la curva de niveles siga a la frontera.

### 11.2 Curva de niveles

`levelHp(L) = 0,77 · (1 + L/63)^0,75` (`sim/difficulty.ts`): la dureza del nivel L es la frontera del perfil
Constante en su día L (más el desplazamiento de la logística, para ~50 % por intento). El daño y la densidad derivan
de la misma dureza (`damageFor`, `densityFor`). Reflejo: dureza ×2 y oro ×2.

### 11.3 Ritmo resultante (3 años, 12 semillas, regla de puntos actual, niveles de jefe incluidos)

| Perfil | Juega al día | Nivel día 30 / 90 / 365 / 1.095 | Niveles al día | Días con 2+ / 3+ niveles | Oro año 1 / 2 / 3 |
|---|---|---|---|---|---|
| Constante (95 %) | 1 | 17 / 52 / 233 / 727 | 0,67 | 0 % / 0 % | 1,23 M / 2,21 M / 2,99 M |
| **Constante (95 %)** | **2** | **30 / 80 / 341 / 1.030** | **0,94** | **23 % / 0 %** | **2,63 M / 4,84 M / 6,64 M** |
| Constante (95 %) | 3 | 40 / 102 / 412 / 1.218 | 1,11 | 32 % / 6 % | 3,86 M / 7,05 M / 9,68 M |
| Constante (95 %) | todos | 59 / 141 / 537 / 1.551 | 1,40 | 42 % / 16 % | 7,03 M / 13,13 M / 18,00 M |
| Normal (80 %) | 2 | 30 / 78 / 324 / 934 | 0,85 | 19 % / 0 % | 2,56 M / 4,52 M / 5,96 M |
| Irregular (50 %) | 2 | 27 / 57 / 149 / 327 | 0,28 | 2 % / 0 % | 1,17 M / 1,22 M / 1,41 M |
| Abandona y vuelve | 2 | 30 / 80 / 269 / 904 | 0,82 | 18 % / 0 % | 2,15 M / 4,14 M / 5,97 M |

Lectura:
- Objetivo cumplido: con casi todos los hábitos y 2 intentos al día, **~1 nivel al día** (0,94), 2 algunos días (23 %) y 3
  prácticamente nunca. Jugar más intentos acelera (3+ niveles en el 6–17 % de los días), pero nunca más allá de lo
  que permiten las mejoras: la frontera crece solo con los hábitos.
- Quien cumple menos avanza más despacio (Irregular ~0,28 niveles al día) aunque tenga intentos de sobra.
- Los intentos sobran: un jugador constante gana ~5 al día. Son oportunidades acumulables, no una obligación.
- Volver tras un abandono no castiga: el nivel superado y las mejoras se conservan, y se retoma con intentos.

### 11.4 Oro

Con niveles que suben despacio, el oro por nivel tenía que crecer más deprisa que antes; se reajustó para mantener el
calendario del §10.3: `levelGold` con `a = 0,017` (antes 0,03) y bonificación por supervivencia de 5 por minuto
(antes 9). Comprarlo todo (~18 M) lleva unos **3,6 años** al Constante jugando 2 intentos al día (Archimaga ~0,7
años, Fénix ~1,0) y bastante más a quien cumple menos. Infinito da oro sin cambiar el nivel; reflejo, el doble.

### 11.5 Jefes de ciclo

Diseño (`content/bosses.ts`, `sim/bosses.ts`): 10 jefes con 2–4 ataques cada uno, que aparecen en el minuto 20 de
los niveles 7, 14, 21…; al acabar la rotación vuelven con +25 % de vida, +10 % de daño, más proyectiles, ataques más
seguidos, ataques nuevos y furia bajo el 50 % de vida.

Objetivo: en la frontera del Constante, un nivel de jefe se supera en **~1 de cada 3 intentos** (un nivel normal, en
~1 de cada 2), así que cuesta de media un día más sin bloquear. Estudio en los días 30, 90, 180, 365 y 730 (rondas 0
a 14 de la rotación), 3 semillas por jefe y día:

| Ajuste (`BOSS_TUNING`) | Llega al minuto 30 | Supera (vence al jefe y llega al 30) |
|---|---|---|
| Inicial (vida ×1, disparos ×0,45–0,8 según el ataque, 2,4 s entre ataques) | 35 / 140 (25 %) | 13 / 140 (9 %) |
| **Elegido (vida ×0,6, disparos ×0,35, 3 s)** | **60 / 150 (40 %)** | **46 / 150 (31 %)** |

Por jefe (superados de 15): Guardián 7 · Madre de la Nidada 7 · Mago de las Sombras 6 · Tejedora 6 · Caballero
Espectral 5 · Señor de la Plaga 4 · Coloso 3 · Fauces 3 · Dragón 3 · Hidra 2. Con 15 partidas por jefe la diferencia
entre ellos está dentro del ruido; se revisará con datos reales. En el estudio de progresión los niveles de jefe
cuentan como una dureza ×1,33 (la que da un 31 % en la logística del §11.1).

### 11.6 Regla de puntos: hitos de racha frente a 1 punto plano

Con la curva fijada al Constante, la regla de puntos decide cuánto se separan los perfiles. Simulado con 1 punto
plano por hábito diario cumplido (sin hitos de racha): Constante 0,38 niveles al día, Normal 0,37 — la constancia
casi no se nota y todos avanzan mucho más lento. **Se mantiene la regla actual** (base + hitos de racha de la Fase 5b):
es la que hace que cumplir casi todo marque la diferencia.

### 11.7 Límites del estudio

- El bot juega peor que una persona (no elige mejoras con criterio, esquiva mal). Una persona real probablemente
  supere más niveles al principio; hay que calibrarlo con partidas reales (Fase 8) y, si hace falta, desplazar la
  curva (`DIFFICULTY.base`).
- Frontera medida con un personaje y un escenario; los legendarios y escenarios difíciles la mueven.
- Todo cambio en el poder del jugador o de los enemigos obliga a repetir frontera → progresión → jefes.

## 12. Fase 5e: combate más intenso (noviembre de 2026)

Los cambios de la Fase 5e (HABITS_GUIDE §12) mueven el poder del jugador (armas y pasivas de 7 niveles, más fuertes
al 7 que el antiguo nivel 8; armas hasta el 999) y el de los enemigos (más apariciones, oleadas, jefes nuevos), así
que se repitieron los tres estudios del §11. **Estos valores sustituyen a los del §11** (el método es el mismo).

### 12.1 Ritmo de partida (`pace.study.test.ts`)

Partidas «bien jugadas»: mejoras del Constante en los días 30, 90 y 365 y dureza 0,8 × su frontera.

| Ajuste | Nivel del personaje al minuto 30 (partidas que llegan) | Enemigos en pantalla (media / pico) | ms por paso |
|---|---|---|---|
| Más apariciones y oleadas, experiencia sin tocar | 60–71 (media 67) | 40–73 / 110–200 | 0,11–0,12 |
| Experiencia ÷ densidad del nivel, curva ×1,05 (**elegido**) | 51–70 (**mediana 59**) | 40–144 / 110–344 | 0,1–0,4 |

- Dividir la experiencia de cada enemigo por la densidad del nivel evita que en niveles altos (más enemigos) se suba
  mucho más deprisa. Así el ritmo es parecido en cualquier nivel.
- Se eliminan 17.000–28.000 enemigos por partida (10–15 por segundo).
- Coste de la simulación: 0,1–0,4 ms por paso en escritorio con el ordenador cargado por otros estudios. En móvil
  hay margen, pero hay que medirlo (Fase 6).

### 12.2 Frontera, curva y oro

- Frontera nueva: `F*(P) = 0,557 · (1 + P/385)^0,535`; logística `σ((0,02 − x) / 0,26)`. Al principio es más baja
  que antes (las oleadas castigan a un personaje sin mejoras), pero crece antes.
- Curva de niveles nueva: `levelHp(L) = 0,48 · (1 + L/18)^0,67`.
- Oro: `goldA` 0,017 → 0,023 para mantener el calendario de desbloqueos.

| Perfil (2 intentos al día) | Nivel día 30 / 90 / 365 / 1.095 | Niveles al día | Días con 2+ / 3+ | Oro año 1 / 2 / 3 |
|---|---|---|---|---|
| **Constante (95 %)** | 30 / 82 / 348 / 1.045 | **0,95** | 24 % / 0 % | 2,14 M / 4,21 M / 5,83 M |
| Normal (80 %) | 29 / 79 / 330 / 944 | 0,86 | 20 % / 0 % | 1,99 M / 3,62 M / 4,77 M |
| Irregular (50 %) | 22 / 45 / 126 / 301 | 0,26 | 2 % / 0 % | — |

Comprarlo todo le lleva ~3,8 años al Constante. Jugando 3 intentos al día: 1,12 niveles al día (6 % de días con 3+).

### 12.3 Jefes con ataques propios

Mismo estudio que en el §11.5, con los ataques nuevos y la frontera nueva. Sin cambiar `BOSS_TUNING`:
**llegan al minuto 30 61 de 150 partidas y superan el nivel 44 (29 %)**, dentro del objetivo (~1 de cada 3).

| Jefe | Superados de 15 |
|---|---|
| Mago de las Sombras, Caballero Espectral, Tejedora del Tiempo | 6 |
| Guardián, Madre de la Nidada, Señor de la Plaga | 5 |
| Fauces del Abismo | 4 |
| Hidra | 3 |
| Coloso, Dragón del Eclipse | 2 |

Los dos últimos (los más pesados y con ondas o rayos) salen más duros; con 15 partidas por jefe aún es ruido, pero se
vigilarán con datos reales.

## 13. Mejora de recompensas «Constancia» (noviembre de 2026)

**Petición:** con la progresión actual los costes de las mejoras permanentes pesan mucho frente a los puntos que da
cumplir los hábitos. Se añade una mejora, disponible desde el principio en «Mejoras», que sube los puntos de cada
hábito cumplido y compite con las mejoras del personaje.

| Nivel | Coste | Puntos por hábito diario | Puntos por hábito semanal |
|---|---:|---:|---:|
| Inicial | — | 1 | 3 |
| 1 | 21 | 2 | 6 |
| 2 | 75 | 3 | 9 |
| 3 | 200 | 4 | 12 |
| 4 (máximo) | 450 | 5 | 15 |

Total: 746 puntos. Las bonificaciones de racha (hitos de los diarios y racha de los semanales) se suman aparte, y el
límite de 7 diarios con puntos completos sigue igual (la mitad a partir del 8.º). Cuenta desde la compra: las
recompensas concedidas después, aunque sean de un periodo ya cumplido, usan el nivel nuevo. Código:
`BOUNTY` en `game/content/upgrades.ts`, aplicado en `evaluateRewards` y `outlook` (`habits/core/habits.ts`).

**Estudio** (`bounty.study.test.ts`, 12 semillas, 2 años, perfiles de §9 con 5 diarios y 2 semanales). Se probaron
seis curvas con la primera mejora en 21 y tres estrategias: no comprarla, comprarla antes que nada, o tratarla como
una mejora más (siempre lo más barato). Resumen con la estrategia «antes que nada»:

| Curva | Constante: día de los niveles 1 / 2 / 3 / 4 | Normal | Irregular |
|---|---|---|---|
| 21/60/150/320 | 7 / 30 / 108 / 342 | 7 / 32 / 126 / 379 | 62 / 196 / 701 / — |
| 21/63/189/567 | 7 / 33 / 163 / — | 7 / 34 / 187 / — | 62 / 216 / — / — |
| **21/75/200/450 (elegida)** | **7 / 48 / 172 / 566** | **7 / 45 / 196 / 682** | **62 / 280 / — / —** |
| 21/80/220/500 | 7 / 50 / 200 / 684 | 7 / 49 / 237 / — | 62 / 306 / — / — |
| 21/90/270/640 | 7 / 56 / 275 / — | 7 / 63 / 321 / — | 62 / 391 / — / — |
| 21/120/400/1000 | 7 / 91 / 522 / — | 7 / 98 / 628 / — | 62 / 616 / — / — |

Con la curva elegida (Constante; «en combate» = puntos gastados o por gastar en mejoras del personaje):

| | Puntos ganados día 90 / 365 / 730 | En combate día 30 / 90 / 365 / 730 |
|---|---|---|
| Sin Constancia | 2.231 / 13.061 / 29.905 | 522 / 2.231 / 13.061 / 29.905 |
| Comprándola antes que nada | 2.948 / 18.071 / 42.209 | 631 / 2.852 / 17.775 / 41.463 |
| Como una mejora más (niveles en los días 16 / 71 / 232 / 710) | 2.760 / 17.537 / 40.812 | 581 / 2.664 / 17.241 / 40.066 |

Conclusiones:
- **Merece la pena siempre**, también en el corto plazo: el nivel 1 se recupera en unos 4 días (5,5 puntos más al
  día con 5 diarios y 2 semanales), y cada nivel siguiente tarda más en devolverse (≈ 14, 36 y 82 días).
- **No se compra entera de golpe:** el nivel 2 llega hacia la 7.ª semana y el máximo hacia el año y medio para un
  usuario constante (casi 2 años para uno normal). Mientras se ahorra para ella, el personaje deja de mejorar unas
  semanas: esa es la decisión.
- **Las mejoras del personaje siguen siendo atractivas:** los puntos que acaban en combate son un 25–40 % más que sin
  Constancia a partir del 3.er mes, y las mejoras sin máximo siguen absorbiendo todo lo que sobra.
- **Efecto en la progresión:** con más puntos en combate el personaje es más fuerte antes (nivel de partida
  superable aproximado al año: 365 → 469 para un constante). Como cada intento solo puede superar un nivel, el
  ritmo de niveles queda limitado sobre todo por los intentos; se volverá a medir en la Fase 8 (validación global).
- Los irregulares (50 %) tardan unos 2 meses en el nivel 1 y 9 meses en el 2: es una mejora que premia la
  constancia, como su nombre.
