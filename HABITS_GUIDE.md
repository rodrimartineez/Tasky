# HABITS_GUIDE.md — Modo Hábitos (habit tracker + videojuego)

> Documento de diseño de la Fase 1 (análisis). Complementa a [TASKY_GUIDE.md](TASKY_GUIDE.md), que sigue
> siendo la referencia del modo Proyectos. **Estado: diseño aprobado; Fases 2, 3, 4 y 5 implementadas (ver §9).** Las cifras de economía y equilibrio están en `ANALISIS_ECONOMIA.md`.

---

## 1. Punto de partida (lo que hay hoy en Tasky)

| Pieza | Situación actual | Qué implica para Hábitos |
|---|---|---|
| Capas `core/` · `state/` · `adapters/` · `ui/` | Reglas de capas reforzadas con ESLint; `core/` es TS puro y testeado (64 tests). | Se replica el mismo patrón en un módulo propio, sin tocar los archivos de Proyectos. |
| Persistencia local | Un documento JSON (`TaskyData`, `schemaVersion` 1) en `tasky.json` (Tauri) o IndexedDB (web). Guardado inmediato serializado. | Hábitos usa **otro documento** (`habits.json` / otra clave de IndexedDB). Un fallo o migración de uno nunca afecta al otro. |
| Sync | Supabase local-first, **LWW por registro**, cursor `server_seq`, Realtime, RLS + lista blanca, sin DELETE. | LWW sirve para hábitos (nombre, objetivo…), **no** para dinero ni contadores: se añade un *ledger* de eventos inmutables (§4). |
| Auth | Un cliente Supabase creado en `adapters/supabaseSync.ts`. | Se comparte la misma sesión (un único cliente; ajuste mínimo en `adapters/`). |
| Rutas / layout | `HashRouter`, `AppLayout` con cabecera (logo, atajos, sync, copias). | Se añade el selector de modo en la cabecera y una rama de rutas `#/habits/*` cargada en diferido. |
| PWA | `vite-plugin-pwa`, precache de todo `dist` (~1,1 MB). | El juego se precachea igual (funciona offline) pero en un *chunk* aparte: no pesa en el arranque de Proyectos. |
| MCP | Edge Function `tasky-mcp` sobre `core/` y las tablas `projects/tasks/ideas`. | **No se toca.** Las tablas nuevas son independientes y no entran en `TABLES`. |

## 2. Arquitectura propuesta

```
src/
├── core/ adapters/ state/ ui/        ← Tasky actual (Proyectos). Sin cambios salvo los puntos de §2.2
├── shared/                           ← (nuevo, mínimo) selector de modo, cliente Supabase compartido
├── habits/                           ← Módulo Hábitos (tracker + economía)
│   ├── core/       modelo zod, periodos y zona horaria, evaluación, ledger, economía, mejoras
│   ├── state/      store Zustand propio + sync propia (mismo motor de pull/push, otros registros)
│   ├── adapters/   storage (habits.json / IndexedDB) y filas de Supabase
│   └── ui/         pantallas del modo Hábitos (identidad visual propia, pixel art)
└── game/                             ← Videojuego (no conoce React ni Supabase)
    ├── sim/        simulación pura y determinista: entidades, armas, colisiones, oleadas, jefes
    ├── content/    datos: personajes, armas, pasivas, evoluciones, enemigos, escenarios
    ├── render/     PixiJS: sprites, partículas, cámara, números de daño, HUD
    ├── input/      joystick virtual, teclado, gamepad
    └── sprites/    pixel art original definido como matrices de paleta (texto) → texturas en tiempo de ejecución
```

Reglas (se añaden a ESLint como las actuales):
- `game/` no importa `habits/`, `core/` de Proyectos, React ni Supabase. Recibe una **configuración de partida**
  (personaje, escenario, estadísticas finales tras mejoras, semilla) y devuelve un **resultado** (tiempo, oro, kills…).
- `habits/` no importa nada de Proyectos; Proyectos no importa nada de `habits/` ni `game/`.
- La UI de Hábitos monta el juego en un `<canvas>` y solo habla con él por esa interfaz.

### 2.1 Selector de modo
- Control segmentado **Proyectos · Hábitos** en la cabecera (escritorio) y arriba en móvil. El modo elegido se
  recuerda por dispositivo (`localStorage`); por defecto, Proyectos.
- En Hábitos la cabecera cambia de identidad visual; los atajos de Proyectos (`P`, `T`, `I`) se desactivan.
- Cambiar de modo solo cambia la ruta: no toca los datos de ningún módulo.

### 2.2 Cambios en el código actual (los únicos previstos)
1. `AppLayout.tsx` — añadir el selector y ocultar los botones propios de Proyectos en Hábitos.
2. `App.tsx` — ruta `habits/*` con `React.lazy` (el juego y PixiJS no se descargan si no se entra).
3. `adapters/supabaseSync.ts` / `adapters/index.ts` — exponer el cliente Supabase ya creado para que la sync de
   Hábitos use la misma sesión (sin cambiar el comportamiento de la sync de Proyectos).
4. `supabase/schema.sql` — tablas nuevas al final (idempotente, mismas políticas RLS + lista blanca).
5. `vite.config.ts` — nada obligatorio; quizá subir el límite de tamaño de precache del service worker.
6. `DataMenu` (copias) — exportar/importar incluirá el documento de Hábitos como archivo aparte.

### 2.3 Tecnología del juego — recomendación: **PixiJS v8 + simulación propia en TS**
| Opción | Pros | Contras |
|---|---|---|
| **PixiJS + sim propia** (recomendada) | Renderizado WebGL por lotes muy rápido (cientos de enemigos en móvil), ~200 KB gz, la lógica queda en TS puro: **testeable y ejecutable sin pantalla** para simular la economía miles de veces. | Hay que escribir el bucle, colisiones (rejilla espacial) y escenas. |
| Phaser 3/4 | Escenas, física arcade, partículas, tweens incluidos. | Más pesado (~350 KB gz); la física arcade no escala bien a 500 cuerpos; mezcla lógica y render, lo que dificulta la simulación sin pantalla. |
| Canvas 2D a mano | Sin dependencias. | Rendimiento insuficiente en móvil con muchos sprites y partículas. |

Detalles: paso de simulación fijo a 60 Hz con interpolación, *pools* de objetos (cero basura en el bucle),
rejilla espacial para colisiones, resolución lógica fija (p. ej. 480×270 escalada con `nearest`) para que el
pixel art se vea nítido en cualquier pantalla, pausa automática al ocultar la app.

**Arte:** todo original. Los sprites se definen en código como matrices de caracteres con paleta (16×16, 24×24),
se rasterizan a un atlas al cargar y se versionan como texto. Sin assets externos ni de terceros.

## 3. Sistema de hábitos

### 3.1 Modelo
- `Habit` (registro LWW, como las tareas): `id, name, kind: 'build' | 'reduce', period: 'daily' | 'weekly',
  target (≥1), unit (texto libre: «min», «vasos», «veces»), logMode: 'check' | 'counter', step (incremento),
  rank, archivedAt, createdAt, updatedAt, deletedAt`.
- `HabitLog` (**solo se añade, nunca se modifica**): `id, habitId, periodKey, delta (+step / −step para deshacer),
  at`. La cantidad de un periodo = suma de sus `delta`. Así dos dispositivos que registran a la vez **suman**
  en lugar de pisarse (LWW perdería registros).
- Cambiar el objetivo de un hábito solo afecta a periodos abiertos y futuros: cada evaluación guarda el objetivo
  vigente en ese momento.

### 3.2 Periodos, zona horaria y cambios de hora
- Zona horaria IANA guardada en el perfil (p. ej. `Europe/Madrid`), común a todos los dispositivos, para que todos
  calculen los mismos periodos. Se puede cambiar (aplica desde el día siguiente).
- Claves de periodo como texto de calendario, nunca como instantes: diario `2026-11-10`, semanal = lunes de la
  semana `W2026-11-09`. Se calculan con aritmética de fechas de calendario → inmunes a los cambios de hora
  (días de 23 o 25 h incluidos).
- Semana **lunes–domingo**: la semana se cierra al terminar el domingo (00:00 del lunes), y en ese mismo instante se
  cierran también los diarios del domingo. *(Ver decisión abierta D-H1.)*

### 3.3 Cumplimiento
- Positivo: cumplido si `cantidad ≥ objetivo`. Interfaz: barra que se llena.
- Reducción: «restante» = `límite − cantidad`. La barra empieza llena y se vacía; cumplido si `cantidad ≤ límite`
  (agotar el límite y pasarse = no cumplido; *ver D-H2*). Las rachas cuentan periodos cumplidos igual que en los
  positivos.
- Racha actual y mejor racha por hábito; historial en calendario (día) o lista de semanas; un periodo en el que el
  hábito no existía o estaba archivado no rompe la racha.

### 3.4 Cierre de periodos y recompensas
- **Evaluación perezosa y determinista:** al abrir la app (y a las 00:00 si está abierta) se evalúan todos los
  periodos cerrados pendientes desde el último evaluado. No hace falta un servidor despierto a medianoche: cerrar
  la app no pierde nada.
- Diario cumplido = **1 punto + 1 por cada hito de racha superado** (3, 7, 14, 30, 60, 100, 180, 365 días y luego
  cada año; `core/rewards.ts`); semanal cumplido = **3 puntos, +1 por cada 4 semanas seguidas (máx. 6)**; sin
  parciales. Escudo de racha: 1 cada 21 días cumplidos (máx. 1 por hábito) salva un día fallado (sin puntos ese día).
  A partir del 8.º hábito diario, los más nuevos dan la mitad. Ayuda de vuelta (`core/comeback.ts`): ver
  `IDEAS_MEJORAS_JUEGO.md` (C4).
- Cada recompensa es un asiento del ledger con **id determinista** `reward:<habitId>:<periodKey>`. Si dos
  dispositivos lo evalúan, generan el mismo id → el servidor lo inserta una sola vez (`on conflict do nothing`).
- Un periodo cerrado y evaluado queda **bloqueado** (sus registros ya no se editan). Margen de gracia: los registros
  hechos sin conexión antes de medianoche y sincronizados después cuentan si llegan antes de 24 h *(ver D-H3)*.

## 4. Economía segura: ledger de asientos inmutables

En lugar de guardar «saldo = 37» (que dos dispositivos pueden pisar o duplicar), se guardan **hechos** y el saldo
se calcula siempre sumándolos:

| Asiento | Id determinista | Efecto |
|---|---|---|
| Recompensa de hábito | `reward:<habit>:<period>` | +puntos (según racha), `details.streak` |
| Inicio de partida | `run:<nivel>` | −1 partida (consumida); `details` personaje y escenario |
| Resultado de partida | `result:<nivel>` | +oro, récords (`details` tiempo, enemigos, victoria) |
| Compra de mejora | `upgrade:<stat>:<nivel>` | −puntos, +1 nivel |
| Desbloqueo | `unlock:<character\|stage>:<id>` | −oro, contenido desbloqueado |

- Tabla `habit_ledger` en Supabase: **solo INSERT** (sin UPDATE ni DELETE en las políticas), clave primaria = id.
- Saldo, nivel de cada mejora, desbloqueos y partidas disponibles = *replay* ordenado del ledger. Una compra que
  dejaría el saldo en negativo (p. ej. dos dispositivos sin conexión gastando lo mismo) se ignora al reproducir y
  la UI la marca como «no aplicada».
- Los intentos no son asientos: se derivan de las recompensas de los hábitos (§11) y cada partida gasta uno
  (`run:s<temporada>:<n.º de intento>`), así dos dispositivos que juegan a la vez sin conexión generan el mismo id.
  El nivel solo sube con un resultado que lo supera (`result:…` con `won`).
- Implementación: `habits/core/economy.ts` (`economyOf` reproduce el ledger; acciones `buyUpgrade`, `unlock`,
  `startRun`, `finishRun`).
- «Manipulación accidental»: la app es personal, así que el cliente es de confianza; aun así, ids deterministas +
  solo-inserción + validación en el replay evitan duplicados, dobles cobros y saldos negativos.

### 4.1 Partidas iniciadas y cierres inesperados
- Al empezar se escribe `run-start` (la partida queda consumida) y el estado de la simulación se guarda en local
  cada ~10 s (la simulación es datos puros: serializable).
- Si la app se cierra o el móvil la mata: al volver se ofrece **reanudar** exactamente desde el último guardado.
- No se puede terminar una partida a voluntad quedándose el oro: la pausa solo ofrece continuar, ver el equipamiento,
  la tabla de evoluciones y **guardar y salir** (se reanuda después). Si en este dispositivo no hay copia guardada (se empezó en otro o no llegó a guardarse), solo se puede **cerrar sin oro**: el intento
  cuenta como gastado. `result:<n.º de intento>` es único → nunca dos resultados para la misma partida. No se puede
  reiniciar para «repetir la tirada» porque el intento ya está gastado. *(Ver D-G2.)*
- La copia guardada es local (`habits-run.json` / clave `run` de IndexedDB), no se sincroniza.

## 5. Juego

### 5.1 Bucle de partida
Movimiento (joystick virtual flotante: aparece donde se apoya el pulgar, no tapa el escenario; WASD/flechas en
escritorio) · ataque automático · gemas de experiencia con imán · subida de nivel → elegir 1 de 3–4 (armas nuevas,
niveles de arma, pasivas) · cofres de élites y jefes (mejoras, evoluciones, oro) · oleadas guionizadas por minuto
por escenario · jefes en minutos fijos · **minuto 30: llega La Muerte**, imparable, que cierra la partida (llegar a
ella supera el nivel; §11). Máximo 5 armas y 5 pasivas, de 7 niveles (§12).

### 5.2 Contenido inicial (objetivo, por fases)
- **Armas (~16 base + evoluciones):** proyectil que busca, lanza que atraviesa, orbe que orbita, aura de daño
  continuo, rayo encadenado, mortero de área, látigo direccional, bumerán, minas, escudo que repele, torreta,
  llamarada en cono, láser giratorio, lluvia de meteoritos, cuchillas que rebotan, nube venenosa. Cada una con 8
  niveles y una evolución al nivel máximo + una pasiva concreta.
- **Pasivas (~14):** una por estadística de §5.3; son las que combinan con las armas para evolucionar.
- **Personajes (~30):** cada uno con arma inicial propia + un rasgo que cambia la forma de jugar (crece con el
  nivel, convierte oro en daño, más proyectiles pero menos vida, curación al matar, etc.). Se diseñan en grupos de
  6 por fase, probando cada uno; no se generan 30 de golpe.
- **Escenarios (5):** cada uno con paleta, suelo y obstáculos propios, 5–7 enemigos característicos, 2 jefes y
  ritmo distinto (p. ej. uno abierto y lento, otro de pasillos, otro con oleadas masivas, otro con enemigos a
  distancia, otro nocturno con visión reducida).
- **Enemigos:** comportamientos reales (perseguidor, enjambre, cargador, tirador, divisor, invocador, tanque) más
  élites con cofre.

### 5.3 Mejoras permanentes (puntos de hábitos)
- **Constancia** (la primera de la lista): +1 punto por hábito diario y +3 por semanal por nivel, hasta el 4
  (5 y 15 de base). Cuesta 21 / 75 / 200 / 450. Estudio y razones en `ANALISIS_ECONOMIA.md` §13.
Poder · Armadura · Vida máxima · Regeneración · Velocidad de movimiento · Velocidad de ataque · Área · Duración ·
Velocidad de proyectil · Proyectiles extra · Enfriamiento · Crítico (prob.) · Daño crítico · Alcance de recogida ·
Experiencia · Suerte · Codicia (oro) · Hallazgo de objetos especiales · Revivir · Repetir elección de nivel ·
Descartar opción.

Implementadas 16 (`game/content/upgrades.ts`), **sin nivel máximo**: coste `base · n^1,5` (efecto lineal), con
rendimientos decrecientes donde haría falta (velocidad, crítico) y coste exponencial en proyectiles extra. Revivir,
repetir y descartar quedan como propuestas (`IDEAS_MEJORAS_JUEGO.md`). Fórmulas y ritmo: `ANALISIS_ECONOMIA.md` §3.

### 5.4 Dificultad
La dificultad depende del **minuto de partida**, del **nivel** (el último superado + 1) y de la modalidad, nunca de
las mejoras: `game/sim/difficulty.ts`. Desde la Fase 5d la curva por nivel sigue la «frontera» medida de un jugador
constante (§11, `ANALISIS_ECONOMIA.md` §11). Objetivo original de la Fase 1 (como referencia histórica):
| Momento | Supervivencia típica | Oro por partida |
|---|---|---|
| Día 1, sin mejoras | 6–10 min | 80–150 |
| 1 mes de hábitos | 15–20 min | 300–500 |
| 3 meses | 25–30 min (primeras victorias en escenarios iniciales) | 600–900 |
| 6+ meses | victorias habituales; escenarios finales siguen siendo un reto | 900–1 500 |

### 5.5 Oro y desbloqueos
- Oro: enemigos (poco), élites y cofres (bastante), jefes, bonus por sobrevivir cada 5 min y por victoria.
- Precios revisados tras el estudio (aclaraciones del usuario: lo último debe costar meses): personajes de 0 a
  65 000 de oro y escenarios 0 / 5 000 / 15 000 / 35 000 / 70 000 → todo en ~1,5–2 años (`ANALISIS_ECONOMIA.md` §7).

## 6. Datos en Supabase (tablas nuevas, mismo esquema de seguridad)
- `habits` (LWW con `updated_at`, como `tasks`).
- `habit_logs` y `habit_ledger` (solo INSERT, `on conflict do nothing`).
- `habit_profile` (zona horaria, fecha de activación del modo, personaje/escenario elegidos; LWW).
- Mismo cursor `server_seq`, RLS + lista blanca, Realtime. El estado guardado de una partida en curso es local.

## 7. Plan por fases

| Fase | Contenido | Criterio de cierre |
|---|---|---|
| **1. Análisis y diseño** (este documento) | Arquitectura, datos, economía, juego. | Decisiones abiertas respondidas. |
| **2. Selector + habit tracker** | Selector de modo, rutas diferidas, documento local, CRUD de hábitos (positivos y de reducción), registro, historial, rachas, periodos/zona horaria, evaluación y ledger de puntos, tablas y sync. | Tests de periodos (cambios de hora, fin de semana, catch-up de días sin abrir), sin duplicados entre dos dispositivos; Proyectos sin regresiones (64 tests + revisión). |
| **3. Núcleo jugable** | PixiJS, bucle fijo, joystick, 1 escenario, 6 armas, 6 pasivas, 8 enemigos, 1 jefe, subida de nivel, cofres, fin a los 30 min. | Divertido y fluido (60 fps con 300+ enemigos en móvil medio). Se itera aquí antes de añadir contenido. |
| **4. Progresión y economía** | Partidas diarias acumulables, inicio/reanudación/cierre, oro, mejoras permanentes, desbloqueos, simulador de balance. | Tablas de economía validadas con el simulador; replay del ledger probado. |
| **5. Contenido** | Hasta ~16 armas + evoluciones, ~30 personajes, 5 escenarios, enemigos y jefes, por tandas. | Cada tanda jugada y equilibrada. |
| **6. PWA y optimización** | Precache del juego, rendimiento en iPhone, escritorio Tauri. | Offline y fluido en iPhone y Windows. |
| **7. Validación** | Recorrido completo §15 de los requisitos. | Checklist verde. |

## 8. Decisiones (confirmadas por el usuario)
- **D-H1** Semana lunes–domingo, cerrada al terminar el domingo (00:00 del lunes).
- **D-H2** Hábito de reducción: llegar exactamente al límite cuenta como cumplido; falla solo al pasarse.
- **D-H3** Registros hechos sin conexión cuentan para su periodo aunque se sincronicen tarde. Implementación: cada
  registro guarda el periodo en el que se hizo y la evaluación es monótona (si al llegar completan el objetivo,
  la recompensa se concede entonces; una recompensa concedida nunca se retira).
- **D-G1** Motor: PixiJS + simulación propia en TypeScript.
- **D-G2** Partida interrumpida: reanudar desde el último guardado; si no, se cierra con el oro de ese guardado.

## 9. Estado de implementación

| Funcionalidad | Estado |
|---|---|
| Fase 1 — Análisis y diseño | ✅ |
| Fase 2 — Selector de modo (cabecera, recuerda el último modo, en móvil estrecho el sello sustituye a la palabra «tasky»), ruta `#/habits` cargada en diferido, identidad visual propia (`data-mode="habits"` en `<html>` mientras el modo está abierto) | ✅ Navegador (escritorio y móvil 375 px): cambio de modo en ambos sentidos, el tema y los atajos de Proyectos vuelven al salir, restaurar modo al abrir, Proyectos sin cambios de funcionamiento |
| Fase 2 — Hábitos positivos y de reducción, diarios y semanales, objetivo/límite con unidad e incremento, registro rápido (+/−, o un toque si el objetivo es un solo paso), detalle con rachas, historial y menú (editar, archivar, eliminar) | ✅ 20 tests de `habits/core` + navegador |
| Fase 2 — Cierre de periodos y recompensas (1/3 puntos, ledger con ids deterministas), recompensas de días sin abrir la app, cambio de día con la app abierta | ✅ Tests (cambios de hora, cruce de año, idempotencia, dos dispositivos) + navegador simulando el paso a mañana |
| Fase 2 — Persistencia local (`habits.json` en escritorio, IndexedDB `tasky-habits` en web) y sincronización propia con la misma sesión | ✅ Local verificado. **Sync pendiente:** ejecutar `supabase/schema.sql` en el SQL Editor (crea `habit_profile`, `habits`, `habit_logs`, `habit_ledger`); mientras tanto los hábitos funcionan en local y la app avisa de que no se sincronizan |
| Fase 3 — Núcleo jugable (`src/game/`): simulación pura y determinista a 60 Hz (rejilla espacial, 6 armas con comportamientos distintos y 8 niveles, 6 pasivas, 9 enemigos con 5 comportamientos, élites con cofre, jefe con ráfagas e invocaciones, experiencia, subidas de nivel, objetos, victoria a los 30 min), render con PixiJS v8 (atlas de pixel art definido en código, reservas de sprites, números de daño, partículas, rayos, temblor), joystick flotante + teclado, pantalla de juego (HUD, subida de nivel, pausa automática al ocultar la app, resumen final) en la pestaña «Jugar» como **partida de prueba** | ✅ 10 tests (determinismo, todas las armas, sprites válidos, sin mejoras se muere / muy mejorado sobrevive más y gana más oro). Navegador: partida, subida de nivel, cofre, jefe, pausa, abandonar, reiniciar y salir (sin lienzos huérfanos); vista móvil con joystick táctil simulado. Rendimiento: 1 ms de dibujado por fotograma con 419 enemigos; la simulación completa de 30 min tarda ~7 s sin pantalla. **Pendiente de probar en un iPhone real** |
| Fase 4 — Partidas diarias acumulables (una por día desde el inicio), niveles infinitos por orden de partida, dificultad por nivel, puntos por hitos de racha, 16 mejoras permanentes sin máximo (pestaña «Mejoras»), oro y desbloqueo de personajes/escenarios (campamento en «Jugar»), saldos en la cabecera, guardado de la partida cada 10 s y al ocultar la app con reanudación, cierre de partidas sin copia | ✅ 32 tests de `habits/core` (rachas, economía, compras y partidas simultáneas en dos dispositivos) + test de reanudación exacta de la simulación. Navegador: jugar, guardar y salir, recargar, continuar desde el mismo segundo, terminar, nivel 2 sin partidas restantes; móvil 375 px. **Sync pendiente:** volver a ejecutar `supabase/schema.sql` (columnas `character`, `stage`, `details` y tipos de asiento nuevos) |
| Fase 5 — Contenido del juego: 16 personajes (arte propio de 12×14 con 2 fotogramas de paso, 13 armas iniciales distintas, un rasgo con virtud y defecto cada uno; precios 0 → 65 000), 13 armas con 8 niveles (6 nuevas: látigo, búmeran, minas, haz giratorio, meteoritos, nube venenosa y onda de choque, con comportamiento y dibujo propios; estelas en proyectiles) y 12 pasivas (6 nuevas), 5 escenarios (Bosque Marchito 0, Pantano Sombrío 5 000 con enemigos a distancia, Cripta Olvidada 15 000 con enjambres, Cavernas de Cristal 35 000 con enemigos resistentes, Páramo de Ceniza 70 000 con mezcla; cada uno con suelo, decoración, reglas de aparición, jefe propio a los 10/20/28 min y élites), 6 enemigos y 4 jefes nuevos (nuevo comportamiento «volley»: tres flechas en abanico), 5 huecos de armas + 5 de pasivas en la partida, mostrados arriba a la izquierda en dos filas con los vacíos como marcos tenues | ✅ 118 tests (`npx vitest run`) incluyendo: 16 personajes con arma y sprites que existen, el sprite elegido llega a la partida, 5 escenarios (precios, enemigos, jefes a 10/20/28 min, decoración), 120 s de bot en cada escenario sin valores inválidos, jefes en cada escenario, todas las armas hacen daño, y ninguna arma pasa del doble de la mejor original en 5 min de bot. `tsc`, `eslint` y `npm run build` limpios. Navegador (escritorio y móvil 375 px): huecos de armas/pasivas, el sprite del personaje, suelo y enemigos de Páramo y Pantano, haz, minas, látigo, búmeran con estela y nube dibujados sin errores de consola. **No probado:** los 16 sprites solo se han revisado a ojo en una hoja de muestras; el equilibrio de las armas se ha medido solo con el bot (el látigo apunta hacia donde mira el jugador y el bot huye, así que sale infravalorado) y no con partidas humanas; las partidas guardadas antes de la Fase 5 se reanudan con el sprite del héroe base |
| Fase 5b — Motivación: puntos que dará cada hábito hoy (en su tarjeta), resumen «Hoy: +N asegurados · +M si cumples el resto» con la mejora más cercana (en Hábitos y en el campamento), aviso de puntos nuevos al cerrar el día, escudo de racha cada 21 días (también en el historial y el detalle), racha de semanales (+1 cada 4 semanas, máx. 6), mitad de puntos a partir del 8.º diario, ayuda de vuelta gradual y temporal (`core/comeback.ts`) | ✅ 40 tests de `habits/core` (escudo, semanales, límite, lo de hoy, ayuda de vuelta: activación, fuerza, retirada y fin). Navegador con un historial simulado en el perfil de prueba: tarjeta +N, resumen, aviso «+43 puntos», banner de vuelta (+21 % XP, +14 % vida tras 36 días); móvil 375 px. Estudio en `ANALISIS_ECONOMIA.md` §9 |
| Fase 5c — Builds y economía: 16 evoluciones, armas Rebote/Dron/Estela, pasivas Ojo de águila y Colmillo de sangre, mejoras Segunda vida/Repetir/Descartar (con puntos), 4 personajes legendarios hasta 10 M de oro, bonificación de oro por supervivencia, escudo cada 60 días, modo de pruebas (§10), motor gráfico con alternativas para móvil | ✅ 169 tests (36 de builds, economía con temporadas y modo de pruebas, revivir). WebKit con iPhone 14 (WebGL y canvas) y navegador de escritorio con build sin conexión: campamento de pruebas, partida con legendario, pausa y guardado, sin errores. Pendiente: iPhone real |
| Cambios previos a la Fase 6: selector del modo de pruebas (herramienta de desarrollo, por dispositivo, §10), apartado Catálogo (armas, pasivas y evoluciones desde `game/content/catalog.ts`), cabecera opaca con separación bajo la zona segura en móvil | ✅ 176 tests (alternar modos sin crear ni perder nada, catálogo frente a las definiciones). WebKit con iPhone 14 y Chromium de escritorio con la CSP de producción: alternar, partida real, partida de prueba, recarga, catálogo (16 + 14 + 16) y cabecera; sin errores. Pendiente: iPhone real |
| Fase 8 — Escalada dentro de la partida (daño ×4 al minuto 30, veteranos, «Amenaza ×N»), bot que busca evoluciones, curva de niveles y oro recalibrados con Constancia (§17) | ✅ 215 tests, `tsc`, `eslint`, build. Estudios de frontera, progresión, jefes, ritmo y «quedarse quieto» (`ANALISIS_ECONOMIA.md` §14). Navegador: HUD de amenaza, Proyectos sin cambios. **Pendiente:** iPhone real, Tauri, sincronización entre dos dispositivos y MCP en uso real |
| Fase 10 — Logros (22) y estadísticas en la pestaña «Logros», 5 arcanos y 7 aspectos con oro o logros (§18) | ✅ Tests de logros, estadísticas, precios y arcanos (nunca facilitan, registrados en la partida). Navegador escritorio y móvil 375 px: Logros, campamento (arcano, aspecto, bloqueos, diálogo de logro) y partida con aspecto; sin errores de consola |

Notas de la Fase 3:
- **Equilibrio provisional** (bot de `sim/bot.ts`, 4 semillas por perfil): sin mejoras 2–12 min; «1 mes» 11–22 min;
  «3 meses» 20–30 min; «6 meses» gana siempre. Hay mucha varianza entre semillas; el ajuste fino y el oro por
  partida se harán con el simulador de la Fase 4.
- La dificultad (vida, daño y velocidad de los enemigos) depende solo del minuto de partida (`sim/core.ts`).
- El motor (PixiJS) va en un archivo aparte que se descarga al pulsar «Jugar».
- La partida de prueba no gasta partidas diarias ni guarda oro: eso es la Fase 4.

Pruebas locales sin tocar los datos reales: configuración `tasky-web-offline` de `.claude/launch.json`
(puerto 1430, `vite --mode offline`; necesita un `.env.offline` local con `VITE_SUPABASE_URL=` y `VITE_SUPABASE_KEY=` vacíos).

## 10. Modo de pruebas y paso a producción del juego

Configuración en `src/habits/core/release.ts`:

```ts
export const GAME_BUILD = { devTools: true, season: 0, startsOn: null };
```

**Selector «Modo de pruebas»** (solo con `devTools: true`): aparece en el campamento (Jugar) como herramienta de
desarrollo, con borde discontinuo para no confundirlo con la interfaz del juego. Activa o desactiva el modo al
momento, sin desplegar. La elección se guarda **en ese dispositivo** (`localStorage`, clave `tasky-game-test-mode`):
no es un dato de Hábitos, no se sincroniza y no entra en el ledger. Mientras no se elija, se empieza en pruebas.

- **Activado:** partidas ilimitadas en **cualquier nivel** (selector de nivel y botón «Próximo jefe»), todas las
  modalidades (infinito y reflejo) y velocidades, todos los personajes y escenarios sin pagar, y el oro de las
  partidas no se guarda.
- **Cristales infinitos:** en el modo de pruebas se pueden comprar mejoras sin límite. Se guardan aparte (solo en
  este dispositivo, `tasky-game-test-upgrades`) y no tocan las reales; al desactivar el modo vuelven a 0. Las partidas de prueba **no escriben nada en el ledger** (ni partida, ni
  resultado, ni compras). Los hábitos, los puntos y las mejoras permanentes funcionan con normalidad.
- **Desactivado:** progresión real, idéntica a la de producción. Solo el personaje y el escenario iniciales son
  gratis, el resto se ve bloqueado con su precio y sus características, y se compra con oro. Cada partida gasta un
  intento de los ganados con los hábitos, el nivel solo sube al superarlo, los hitos (velocidad, infinito, reflejo)
  se ganan al superar sus niveles y el oro se conserva.
- **Alternar es seguro:** el modo solo cambia cómo se lee el ledger (`economyOf`), nunca lo modifica. Por eso no
  puede crear, duplicar ni borrar oro, partidas, compras, puntos, rachas ni mejoras. Cada modo tiene su propia copia
  de la partida interrumpida (`run` y `test-run` en IndexedDB; `habits-run.json` y `habits-test.json` en el
  escritorio), así que una partida de prueba nunca pisa una real a medias. El selector no se puede usar durante
  una partida. Lo comprueban los tests de `economy.test.ts` («alternar entre pruebas y progresión normal…»).
- **Temporada 0 = desarrollo:** lo que se juegue con la progresión real durante el desarrollo (ids `run:s0:N`,
  `unlock:s0:…`) es solo de prueba y no pasa a la versión publicada.

**Paso a producción** (cuando el usuario lo apruebe), un único cambio en `release.ts`:

```ts
export const GAME_BUILD = { devTools: false, season: 1, startsOn: 'AAAA-MM-DD' /* día del lanzamiento */ };
```

- `devTools: false` quita el selector y fuerza la progresión real: el modo de pruebas no se puede activar de
  ninguna forma, ni aunque el dispositivo tuviera guardada la clave del selector.
- `season: 1` empieza la progresión del juego de cero: se ignoran las partidas, el oro y los desbloqueos de la
  temporada 0 y los asientos antiguos sin temporada (`run:1`, de la Fase 4). Cuentan los intentos ganados con
  hábitos cumplidos desde `startsOn`, y los niveles empiezan en el 1. Para reiniciarla otra vez basta con subir
  `season`.
- Los puntos de hábitos, las rachas y las mejoras permanentes no dependen de la temporada: se conservan.
- No hace falta tocar Supabase ni borrar datos: los asientos antiguos se quedan y el replay los ignora.

## 11. Progresión del juego: intentos, niveles, jefes y modalidades (Fase 5d)

Reglas pedidas por el usuario el 11/11/2026. Todas las fases posteriores deben respetarlas.

**Intentos (se ganan con los hábitos y no caducan).**
- Cada hábito diario cumplido da **+1 intento** (y sus puntos de siempre). Los de construir lo dan al momento, al
  registrar el cumplimiento; los de reducir, al cerrar el día (hasta entonces aún se puede pasar del límite).
- Cada hábito semanal cumplido da **+3 intentos** al cerrarse su semana (sus puntos siguen la racha semanal, sin
  duplicar recompensas).
- Máximo por día = número de hábitos diarios activos. Los intentos se acumulan indefinidamente: no hay reinicio a
  las 00:00 ni se pierden por cambiar de día, cerrar la app o dejar de jugar. Sin intentos no se puede jugar.
- Implementación: `attemptsEarned` en `habits/core/economy.ts`. Se cuentan desde las recompensas del ledger (una por
  hábito y periodo, id fijo) más los diarios de construir cumplidos hoy, así que nunca se cuentan dos veces.
  Disponibles = ganados − partidas empezadas (todas las modalidades).

**Niveles.** Cada intento es una partida completa desde el minuto 0:
- Al minuto 30 aparece **La Muerte** (`content/bosses.ts`, `sim/bosses.ts`): no recibe daño, persigue más rápido de
  lo que se puede huir y acaba la partida (ni revivir ni la invulnerabilidad la evitan).
- **Superar el nivel** = llegar al minuto 30 en modalidad normal (y, en los niveles de jefe, haber vencido al jefe).
  Desbloquea el siguiente, que se puede jugar enseguida si quedan intentos.
- Morir antes (o terminar la partida) no supera el nivel: el siguiente intento vuelve al minuto 0 del mismo nivel,
  sin tiempo, experiencia ni mejoras temporales de la partida anterior. **El oro conseguido se conserva siempre.**
- Las derrotas nunca quitan progreso permanente: puntos, mejoras, oro, desbloqueos y nivel superado se mantienen.

**Ciclos de 7 niveles y jefes.** Niveles 1–6 normales, el 7 es el jefe del ciclo, 8–13 normales, 14 jefe… sin fin.
- 10 jefes de ciclo que se alternan (Guardián del Umbral, Madre de la Nidada, Coloso de Piedra, Mago de las
  Sombras, Hidra del Pantano, Señor de la Plaga, Caballero Espectral, Fauces del Abismo, Tejedora del Tiempo, Dragón
  del Eclipse). Cada uno combina 2–4 ataques de: ráfaga radial, abanico, espiral, embestida, salto tras el jugador,
  invocación, lluvia de zonas marcadas y anillo que se cierra.
- Aparece en el minuto 20 (sustituye al jefe de escenario de ese minuto). Hay que vencerlo antes de que llegue La
  Muerte para superar el nivel.
- Al acabar la rotación vuelven en orden («vuelta» 2, 3…): además de la vida y el daño del nivel, cada vuelta suma
  +25 % de vida y +10 % de daño, más proyectiles y ataques más seguidos. Desde la 2.ª vuelta añaden ataques nuevos
  (`advanced`) y se enfurecen por debajo de la mitad de vida. No es solo multiplicar estadísticas.

**Hitos (al superar el nivel, no al alcanzarlo).**
- Velocidades **×1,5 y ×2** desde el nivel 1 (antes, hito del nivel 20; quitado el 12/11/2026 a petición del usuario) (botón en la partida; la simulación es la misma, solo se dan más pasos por
  fotograma, así que no cambia el equilibrio).
- Nivel 30: **modo infinito**. Sin La Muerte ni final; la dureza sigue subiendo con los minutos y se repiten los
  últimos 10 minutos de apariciones y los eventos del escenario. Gasta un intento y da oro. Desde el 12/11/2026,
  llegar al minuto 30 (y vencer al jefe de ciclo en los niveles de jefe, que también aparece aquí) **supera el
  nivel**; la partida sigue hasta morir o salir. Pasado el minuto 30, «Guardar y salir» pasa a ser «Salir» y termina
  la partida (y una copia guardada pasado el 30 no se reanuda: se cierra con su resultado).
- Nivel 60: **modo reflejo**. El nivel actual con dificultad doble (vida ×2, daño ×1,5, más densidad) y el doble de
  oro. Gasta un intento y no cambia el nivel.
- Ambas modalidades se eligen en el campamento al preparar la partida.

**Equilibrio** (`ANALISIS_ECONOMIA.md` §11): la dureza del nivel L es la frontera medida de un jugador que cumple
~95 % de sus hábitos en su día L. Resultado: quien cumple casi todo supera de media ~1 nivel al día jugando 2
intentos diarios (2 niveles algunos días, 3 muy raramente), y quien cumple menos avanza más despacio porque sus
mejoras crecen más despacio. Los intentos sobran (≈5 al día para un jugador constante): son oportunidades, no una
obligación de jugarlos todos.

**Modo de pruebas** (§10): cualquier nivel, jefe y modalidad sin gastar intentos ni guardar nada.

## 12. Combate: niveles de armas, Purga, oleadas, jefes y muertes (Fase 5e)

Pedido por el usuario el 11/11/2026.

**Capas.** El personaje y su barra de vida se dibujan encima de todo (`render/renderer.ts`, capa `actors` la
última): proyectiles, efectos y enemigos quedan detrás, así que las armas salen desde su espalda y nunca lo tapan.
Vale para cualquier arma futura sin hacer nada más.

**Niveles de armas y pasivas** (`sim/upgrades.ts`, tablas en `content/weapons.ts` y `content/passives.ts`).
- 7 niveles; cada uno se nota y el 7 es un gran salto (un arma al 7 rinde de 4 a 12 veces su nivel 1, algo más que el antiguo nivel 8).
- Al llegar al 7, un objeto deja de ofrecerse. Las pasivas no pasan nunca del 7. Ninguna arma pasa del 7 hasta
  llevar **las 5 armas y las 5 pasivas, todas al 7**.
- Con la build completa (`buildComplete`), las armas siguen subiendo hasta el **999** (`OVERLEVEL`): cada nivel +5 % de
  daño y algo más de área (hasta ×1,6), cadencia, velocidad y duración; +1 proyectil cada 50 niveles (5 como mucho)
  y +1 de perforación cada 30. Las pasivas se quedan en el 7. Vale en todas las modalidades, pensado sobre todo para
  el infinito.
- Las evoluciones siguen igual: arma al 7 + su pasiva + cofre. La evolucionada conserva el nivel del arma.

**Purga** (mejora especial). En ~1 de cada 5 partidas (decidido por la semilla, `PURGE` en `sim/world.ts`) se
ofrece una vez, entre los niveles 8 y 37 del personaje, en lugar de una de las opciones, aunque el inventario esté
lleno. Abre el inventario completo (5 armas y 5 pasivas por separado): se marcan las que se quieren eliminar y se
confirma. Sus huecos quedan libres. No hay red de seguridad: se pueden quitar todas las armas.

**Ritmo y oleadas** (`sim/core.ts` `WAVES`, `sim/world.ts` `SPAWN_RATE`, `XP_SCALE`).
- Apariciones ×1,5 sobre las tablas de cada escenario y más enemigos a la vez (hasta 450).
- Cada minuto: tramo normal; **oleada** del segundo 34 al 50 (×2,6 de apariciones, anillo de enemigos alrededor y
  aviso «¡Oleada!»); y un respiro hasta el minuto siguiente (×0,45).
- La experiencia de cada enemigo se divide por la densidad del nivel y la curva de experiencia está escalada para
  que una partida bien jugada llegue a **~nivel 60** en el minuto 30 (`ANALISIS_ECONOMIA.md` §12).

**Jefes de ciclo** (`content/bosses.ts`, `sim/bosses.ts`). Además de ráfagas, abanicos, espirales, embestidas,
saltos, invocaciones, lluvias y anillos, cada jefe tiene ataques propios avisados con antelación:

| Jefe | Firma | Desde la 2.ª vuelta |
|---|---|---|
| Guardián del Umbral | Ondas sísmicas que hay que cruzar, embestida | Anillo que se cierra, invocación |
| Madre de la Nidada | Huevos que eclosionan si no se rompen, telarañas que ralentizan | Invocación, lluvia |
| Coloso de Piedra | Ondas sísmicas, embestida, rocas | Anillo, torretas |
| Mago de las Sombras | Sombras que disparan, saltos, rayos | Espiral, lluvia |
| Hidra del Pantano | Cabezas que disparan desde el suelo, charcos venenosos | Espiral, invocación |
| Señor de la Plaga | Charcos de plaga, ratas | Lluvia, gravedad |
| Caballero Espectral | Barrido de espada (rayo que gira), embestida, saltos | Sombras, abanico |
| Fauces del Abismo | Gravedad que arrastra hacia su boca, espiral | Charcos, anillo |
| Tejedora del Tiempo | Burbujas de tiempo que ralentizan, rayos, saltos | Espiral, sombras |
| Dragón del Eclipse | Aliento (rayos), barrido, lluvia de fuego, embestida | Huevos, ondas |

**Dos muertes distintas** (`Game.ts`, `render/renderer.ts`).
- **Derrota:** al llegar a 0 de vida se detiene la partida 1,6 s: el personaje se desploma, se tiñe de rojo y se
  apaga entre sangre y humo. Después, la pantalla de derrota.
- **Nivel completado:** en el minuto 30 llega La Muerte (encapuchada, manto rojo y guadaña). Es un enemigo más: se
  acerca y golpea cada 0,8 s quitando el 26 % de la vida máxima (unos 4 tajos visibles), sin que la armadura, la
  invulnerabilidad ni revivir lo eviten. Las armas no le hacen nada; el jugador puede moverse. Al morir, el alma
  asciende con un destello dorado durante 2,4 s y aparece la pantalla de nivel superado.

## 13. Arte del juego (Fase 7)

- Todo el arte está en `src/game/sprites/art/` (personajes, enemigos, jefes, armas, objetos), un archivo por grupo,
  como texto sobre la paleta de `sprites/data.ts`. La guía de estilo (tamaños, contorno, luz, familias de color de
  las armas) está en `ARTE_GUIA.md`.
- Revisión rápida: **Catálogo → Ver todos los sprites** (solo en desarrollo, ruta `/habits/sprites`), con filtro y
  zoom; o `python scripts/render_sprites.py src/game/sprites/art/<grupo>.ts hoja.png`.
- Cada arma pertenece a una familia (fuego, rayo, arcano, veneno, acero) que fija su impacto animado
  (`fx_<familia>_hit_0..2`, `hitFxOf` en `content/weapons.ts`); las explosiones no lo usan para no saturar.
- Cada escenario tiene un suelo propio (hierba, pantano, losas, rocas, ceniza; `buildGroundTile`) y partículas de
  ambiente (hojas, luciérnagas, polvo, destellos, brasas) con tope de 28. Nada del arte cambia la simulación.

## 14. Rendimiento (Fase 6)

- El dibujo ajusta solo la calidad de los efectos (`QUALITY` en `game/render/renderer.ts`): por debajo de ~48 fps
  durante 2 s los topes de partículas, impactos, cifras y ambiente bajan a la mitad; se recuperan tras 8 s fluidos.
  La pausa muestra los fps y «efectos reducidos» cuando está activo.
- Medición: 60 fps con 455 enemigos y con una build de efectos a tope en un móvil simulado (CPU ×4); memoria
  estable en partidas largas; el juego funciona sin conexión. Detalle en `IDEAS_MEJORAS_JUEGO.md` (Fase 6).

## 15. Ajustes previos a la Fase 9 (12/11/2026)

- **Derrota:** la pantalla final dice «Has muerto» (sin mencionar el minuto 30).
- **Pausa:** Continuar · Ver equipamiento (las 5 armas y las 5 pasivas con su nivel y lo que hacen) · Tabla de
  evoluciones (arma + pasiva = evolución; lo que se lleva se ilumina en dorado, lo que falta se ve apagado) ·
  Guardar y salir. Se quitó «Terminar» (`PauseMenu.tsx`).
- **Niveles:** las pasivas tienen un máximo absoluto de 7. Las armas pasan del 7 (hasta el 999) solo con las 5 armas
  y las 5 pasivas equipadas al 7 (`buildComplete`); a partir de ahí las mejoras son solo de armas.
- **Cofres** (`openChest`, `CHEST`): de 1 a 5 mejoras (probabilidades de 5/4/3/2 mejoras: 3/5/10/17 % × suerte) y
  oro que crece con ellas (×0,8 · 1,1 · 1,4 · 1,8 · 2,4 sobre 20 + 1 por cada 30 s). La media es la misma que antes
  (test), así que la economía no cambia. La partida se detiene durante la presentación (`ChestReveal.tsx`): cofre en
  grande que se sacude, se abre con destello, rayos y chispas, y las mejoras aparecen de una en una. El sonido llegará
  con la Fase 9.
- **Arte:** personajes con diseños propios (animales, criaturas y seres fantásticos, de 14×18 a 22×22; solo el
  Errante sigue siendo humano), pasivas sin marco, búmeran nuevo, llamas de la Estela de fuego en vertical y cifras
  de daño de 4×6 con contorno.
- **Campamento:** el legendario elegido se marca con el mismo dorado que los demás; vista previa del escenario
  elegido y miniaturas, dibujadas con su suelo, adornos, enemigos y jefe reales (`sprites/preview.ts`).
- **Proyectos:** la barra superior usa la misma posición, separación de la zona segura y fondo opaco (sin
  desenfoque) que la de Hábitos.

## 16. Sonido (Fase 9)

- `src/game/audio/`: `engine.ts` (contexto Web Audio, buses de efectos y música, limitador, ajustes guardados en
  `tasky-game-sound`; silencio por defecto en pantallas táctiles), `sfx.ts` (efectos sintetizados con intervalo
  mínimo), `music.ts` (música por escenario con 3 intensidades) y `listener.ts` (deduce los sonidos del estado del
  mundo; la simulación no cambia).
- La interfaz toca los sonidos de los cofres (`ChestReveal.tsx`) y de elegir mejora. Controles en
  `SoundControls.tsx`: botón en el HUD y apartado «Sonido» del campamento.
- iOS: el contexto se desbloquea con el primer toque; si el móvil está en modo silencio, el sistema puede no
  reproducir Web Audio.

## 17. Escalada dentro de la partida y validación global (Fase 8)

- `sim/core.ts` → `RAMP`: vida de los enemigos `1 + 0,12·m + 0,014·m²` (×17 al minuto 30), daño `1 + 0,055·m +
  0,0015·m²` (×4) y **veteranos** (`championChance`, desde el minuto 5 hasta 1 de cada 6 apariciones normales en el
  30; ×3 de vida, ×1,3 de daño, ×3 de experiencia). Todo se multiplica por la dureza del nivel (`sim/difficulty.ts`),
  así cada nivel empieza más arriba y vuelve a escalar.
- HUD: «Amenaza ×N» = la vida de los enemigos respecto al minuto 0 (`timeHpScale`).
- `sim/bot.ts`: `botPick` elige como una persona (evoluciones primero); `firstPick` queda para medir armas sin
  favorecer ninguna.
- Curva de niveles `DIFFICULTY`: `0,716·(1 + L/47,2)^0,84`, `goldA` 0,013. Estudios en `ANALISIS_ECONOMIA.md` §14; el
  de progresión cuenta ya la mejora Constancia (`PROG_BOUNTY`, por defecto como una mejora más).

## 18. Largo plazo (Fase 10)

- **Logros y estadísticas:** `core/records.ts` (`recordsOf`, `ACHIEVEMENTS`, `achieved`) y la pestaña «Logros»
  (`ui/RecordsPage.tsx`). Se deducen del ledger; no hay datos nuevos ni cambios en Supabase.
- **Arcanos:** `game/content/arcana.ts`. Se desbloquean con oro (`unlock:<temporada>:arcana:<id>`), se eligen en el
  campamento y `startRun` guarda el elegido en `details.arcana` (y lo rechaza si no está desbloqueado).
  `buildRunConfig` aplica sus cambios: personaje (`stats`), dureza (`difficultyScale`) y oro (`goldScale`, que usan
  `runGold` y `survivalBonus`).
- **Aspectos:** `game/content/skins.ts`. Con oro (`unlock:…:skin:<id>`) o por un logro (no se pueden comprar). Solo
  visuales: `config.skin` (tinte y aura) lo dibuja el renderizador.
- La elección de arcano y aspecto se guarda en el dispositivo (`tasky-game-extras`).

## 19. Progreso (antes «Recompensas», 12/11/2026)

- Pestaña «Progreso» (`ui/ProgressPage.tsx`, ruta `/habits/progress`; `/habits/rewards` redirige). Dos vistas:
  - **Resumen:** puntos e intentos ganados esta semana y este mes, % de días cumplidos en los últimos 30 días, mejor
    racha actual y cada hábito con su racha, su mejor racha, su cumplimiento y una tira de los últimos 14 días (u 8
    semanas). Tocar un hábito abre su ficha.
  - **Movimientos:** el historial de puntos de antes, día a día.
- La ficha del hábito (`HabitPage.tsx`) añade «Evolución»: los últimos 6 meses con % cumplido y media registrada por
  día o semana frente al objetivo o límite.

## 20. Jefes y élites más resistentes (12/11/2026)

- `sim/core.ts` → `TOUGHNESS`: los jefes (de escenario y de ciclo) tienen ×10 de vida y las élites que sueltan cofre
  ×60 (antes ×6), a petición del usuario porque eran demasiado blandos.
- El estudio de jefes del `ANALISIS_ECONOMIA.md` §14.6 (34 % de niveles de jefe superados) se hizo antes de este
  cambio: con ×10 de vida, los niveles de jefe serán bastante más difíciles; si cuesta demasiado, se ajusta
  `TOUGHNESS.boss` o `BOSS_TUNING.hp`.
