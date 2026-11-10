# HABITS_GUIDE.md — Modo Hábitos (habit tracker + videojuego)

> Documento de diseño de la Fase 1 (análisis). Complementa a [TASKY_GUIDE.md](TASKY_GUIDE.md), que sigue
> siendo la referencia del modo Proyectos. **Estado: diseño aprobado; Fase 2 implementada (ver §9).**

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
- Diario cumplido = **1 punto**; semanal cumplido = **3 puntos**; sin parciales.
- Cada recompensa es un asiento del ledger con **id determinista** `reward:<habitId>:<periodKey>`. Si dos
  dispositivos lo evalúan, generan el mismo id → el servidor lo inserta una sola vez (`on conflict do nothing`).
- Un periodo cerrado y evaluado queda **bloqueado** (sus registros ya no se editan). Margen de gracia: los registros
  hechos sin conexión antes de medianoche y sincronizados después cuentan si llegan antes de 24 h *(ver D-H3)*.

## 4. Economía segura: ledger de asientos inmutables

En lugar de guardar «saldo = 37» (que dos dispositivos pueden pisar o duplicar), se guardan **hechos** y el saldo
se calcula siempre sumándolos:

| Asiento | Id determinista | Efecto |
|---|---|---|
| Recompensa de hábito | `reward:<habit>:<period>` | +1 / +3 puntos |
| Partida diaria | `run-grant:<fecha>` | +1 partida disponible |
| Inicio de partida | `run-start:<fecha de la partida usada>` | −1 partida (la partida queda consumida) |
| Resultado de partida | `run-result:<fecha de la partida>` | +oro, récords |
| Compra de mejora | `upgrade:<stat>:<nivel>` | −puntos, +1 nivel |
| Desbloqueo | `unlock:<character\|stage>:<id>` | −oro, contenido desbloqueado |

- Tabla `habit_ledger` en Supabase: **solo INSERT** (sin UPDATE ni DELETE en las políticas), clave primaria = id.
- Saldo, nivel de cada mejora, desbloqueos y partidas disponibles = *replay* ordenado del ledger. Una compra que
  dejaría el saldo en negativo (p. ej. dos dispositivos sin conexión gastando lo mismo) se ignora al reproducir y
  la UI la marca como «no aplicada».
- Las partidas se generan desde el día de activación del modo, una por día de calendario, con id por fecha:
  imposible duplicarlas o perderlas. Se acumulan sin límite (según requisito).
- «Manipulación accidental»: la app es personal, así que el cliente es de confianza; aun así, ids deterministas +
  solo-inserción + validación en el replay evitan duplicados, dobles cobros y saldos negativos.

### 4.1 Partidas iniciadas y cierres inesperados
- Al empezar se escribe `run-start` (la partida queda consumida) y el estado de la simulación se guarda en local
  cada ~10 s (la simulación es datos puros: serializable).
- Si la app se cierra o el móvil la mata: al volver se ofrece **reanudar** exactamente desde el último guardado.
- Si se descarta, o pasan 24 h, o se abre en otro dispositivo: la partida se **cierra con el oro del último guardado**
  (`run-result` con el mismo id → nunca dos resultados para la misma partida). No se puede reiniciar para «repetir
  la tirada» porque la partida ya está consumida. *(Ver D-G2.)*

## 5. Juego

### 5.1 Bucle de partida
Movimiento (joystick virtual flotante: aparece donde se apoya el pulgar, no tapa el escenario; WASD/flechas en
escritorio) · ataque automático · gemas de experiencia con imán · subida de nivel → elegir 1 de 3–4 (armas nuevas,
niveles de arma, pasivas) · cofres de élites y jefes (mejoras, evoluciones, oro) · oleadas guionizadas por minuto
por escenario · jefes en minutos fijos · **minuto 30: llega un ente final imparable** que cierra la partida (victoria
si se sobrevive hasta él). Máximo 6 armas y 6 pasivas.

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
Poder · Armadura · Vida máxima · Regeneración · Velocidad de movimiento · Velocidad de ataque · Área · Duración ·
Velocidad de proyectil · Proyectiles extra · Enfriamiento · Crítico (prob.) · Daño crítico · Alcance de recogida ·
Experiencia · Suerte · Codicia (oro) · Hallazgo de objetos especiales · Revivir · Repetir elección de nivel ·
Descartar opción.

Fórmulas (a validar con simulación en la Fase 4):
- **Coste** de un nivel: `round(base · (n+1)^1.6)` — p. ej. Poder: 3, 9, 17, 27, 40… puntos.
- **Efecto** sin límite pero con rendimientos decrecientes: `efecto(n) = a · ln(1 + n / k)`. Ejemplo Poder
  (a = 0,6; k = 4): nivel 4 → +42 %, 10 → +75 %, 20 → +107 %, 40 → +144 %. Nunca se «completa», nunca se dispara.
- Mejoras discretas (proyectiles extra, revivir) con tope pequeño y coste muy alto.
- Ritmo esperado: con 5 diarios + 2 semanales al 80 % ≈ **33 puntos/semana**: 1–3 niveles por semana, siempre
  hay algo que comprar al cumplir el día.

### 5.4 Dificultad
La dificultad depende del **tiempo de partida**, no de las mejoras: los enemigos ganan vida y densidad minuto a
minuto. Así las mejoras se notan directamente como «sobrevivo más y gano más oro». Objetivo:
| Momento | Supervivencia típica | Oro por partida |
|---|---|---|
| Día 1, sin mejoras | 6–10 min | 80–150 |
| 1 mes de hábitos | 15–20 min | 300–500 |
| 3 meses | 25–30 min (primeras victorias en escenarios iniciales) | 600–900 |
| 6+ meses | victorias habituales; escenarios finales siguen siendo un reto | 900–1 500 |

### 5.5 Oro y desbloqueos
- Oro: enemigos (poco), élites y cofres (bastante), jefes, bonus por sobrevivir cada 5 min y por victoria.
- Personajes: de 300 a ~8 000 de oro; escenarios: 0 / 2 000 / 6 000 / 15 000 / 30 000 + condición (p. ej.
  sobrevivir 15 min en el anterior).
- Objetivo: el contenido inicial completo en **~5–6 meses** jugando una partida diaria; algo antes si se acumulan y
  se juegan con buenas mejoras. El simulador sin pantalla (§2.3) estima estas cifras con distintos perfiles
  (cumplidor, irregular, abandono) y se ajustan las tablas antes de dar la fase por cerrada.

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
| Fase 3 — Núcleo jugable | Pendiente |

Pruebas locales sin tocar los datos reales: configuración `tasky-web-offline` de `.claude/launch.json`
(puerto 1430, `vite --mode offline`; necesita un `.env.offline` local con `VITE_SUPABASE_URL=` y `VITE_SUPABASE_KEY=` vacíos).
