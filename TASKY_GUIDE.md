# TASKY_GUIDE.md

> Documento de referencia del proyecto. Se consulta antes de cada fase y se actualiza al terminarla.
> Última actualización: 2026-11-05 — Fases 1 y 2 completadas. Siguiente: Fase 3 (core + persistencia + proyectos).

---

## 1. Objetivo

**Tasky** es el centro personal de organización de un único usuario: un gestor de **proyectos**, **tareas** e **ideas** inspirado en GitHub Projects y Linear, pensado para usarse a diario durante años.

**Prioridad actual:** una aplicación de escritorio para Windows (Tauri) excelente, sencilla, estable y completa.
**Futuro (no se implementa ahora):** versión Android/iOS y sincronización entre dispositivos. La arquitectura se prepara para ello sin construir infraestructura que aún no se necesita (ver §7).

Principios que guían todas las decisiones:

1. **Datos seguros y persistentes.** Nada se pierde al cerrar la app o apagar el equipo.
2. **Offline siempre.** Tasky funciona completo sin Internet; la futura sincronización será un añadido, nunca un requisito.
3. **Rapidez y comodidad.** Abrir, mirar, actuar. Pocos clics, atajos claros, animaciones que no estorban.
4. **Calidad visual.** Identidad propia, oscura, minimalista y premium, con el naranja como color de marca.
5. **Simplicidad técnica.** Sin servidores, sin cuentas, sin servicios de pago. Solo la complejidad que se usa hoy, más las decisiones baratas que evitan rehacer trabajo mañana.

### Fuera de alcance (salvo que se decida lo contrario)

Autenticación, multiusuario, sincronización (por ahora), versión móvil (por ahora), etiquetas, fechas límite, prioridades, subtareas, búsqueda global, notificaciones.

---

## 2. Funcionamiento general

```
Pantalla principal (Inicio)
├── Activos      (tarjetas grandes, protagonistas)
├── En espera    (tarjetas compactas)
└── Finalizados  (tarjetas compactas / atenuadas)
        │
        ▼  clic en una tarjeta
Página de proyecto
├── Cabecera: nombre, descripción, estado, menú (editar · cambiar estado · eliminar)
├── Pestaña «Tareas»  ← apartado principal
│     ├── Lista ordenada de tareas abiertas (drag & drop = secuencia de trabajo)
│     └── Sección «Completadas» (plegable)
└── Pestaña «Ideas»
      └── Cuadrícula de ideas (estilo nota, visualmente distinta a las tareas)
```

---

## 3. Requisitos funcionales

### 3.1 Proyectos
| Requisito | Detalle |
|---|---|
| Crear | Nombre (obligatorio) y descripción (opcional). Estado inicial elegible (por defecto *Activo*). |
| Editar | Nombre y descripción. |
| Cambiar estado | `active` · `on_hold` · `done` (Activo · En espera · Finalizado). |
| Eliminar | Con diálogo de confirmación. Elimina en cascada sus tareas e ideas. |
| Listar | Agrupados por estado en la pantalla principal (más recientes primero). |
| Página propia | Ruta `/project/:id`. |

### 3.2 Tareas
| Requisito | Detalle |
|---|---|
| Campos | Título (obligatorio), descripción (opcional), estado, orden, fecha de creación. |
| Crear / editar / eliminar | Creación rápida inline (escribir + Enter); edición en panel/modal; eliminar con confirmación ligera (o deshacer). |
| Estados | `todo` (Pendiente) · `in_progress` (En curso) · `done` (Completada). *(D3, por defecto)* |
| Completar | Checkbox de un clic con animación de feedback. |
| Reordenar | Drag & drop (ratón y teclado). El orden define la secuencia de trabajo. |
| Visualización | Lista única: abiertas arriba en su orden; completadas en una sección plegable. *(D4, por defecto)* |

### 3.3 Ideas
| Requisito | Detalle |
|---|---|
| Campos | Título (obligatorio), descripción (opcional), fecha de creación. |
| Crear / editar / eliminar | Igual que las tareas, sin estado ni orden manual (más recientes primero). |
| Diferenciación visual | Tarjetas tipo nota en cuadrícula, icono de bombilla, acento ámbar suave, sin checkbox. |

### 3.4 Pantalla principal
- Sin login. Es la primera pantalla al abrir.
- Tres secciones: Activos (mayor protagonismo), En espera, Finalizados.
- Tarjeta de proyecto: nombre, descripción breve (truncada), estado, nº tareas pendientes, nº completadas, barra de progreso sutil.
- Botón «Nuevo proyecto» siempre visible (cabecera) + atajo de teclado `N`.
- Estados vacíos diseñados para cada sección.

### 3.5 Persistencia
- Todo (proyectos, tareas, ideas, estados y órdenes) se guarda automáticamente tras cada cambio, en local.
- Copias de seguridad: automáticas rotativas + exportar/importar JSON. *(D2, por defecto)*

### 3.6 Acceso desde Windows
- App de escritorio **Tauri 2** con instalador propio: aparece en el buscador de Windows, se ancla a la barra de tareas, icono propio. *(D1, confirmada)*

---

## 4. Requisitos visuales

### 4.1 Estilo
Dark mode, minimalista y premium (referencias: Linear, GitHub Projects). Jerarquía clara, espaciado generoso, bordes finos de 1px, radios suaves, sombras mínimas, animaciones cortas (150–250 ms).

### 4.2 Paleta (tokens CSS)
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0A0A0B` | Fondo de la app |
| `--surface-1` | `#111113` | Paneles, barra lateral |
| `--surface-2` | `#18181B` | Tarjetas |
| `--surface-3` | `#202024` | Hover, inputs |
| `--border` | `#27272A` | Separadores, bordes |
| `--border-strong` | `#3A3A40` | Bordes en foco/hover |
| `--text` | `#EDEDEF` | Texto principal |
| `--text-muted` | `#A1A1AA` | Texto secundario |
| `--text-faint` | `#6B6B74` | Metadatos, placeholders |
| `--orange-300` | `#FDBA74` | Detalles, texto sobre oscuro |
| `--orange-400` | `#FB923C` | Hover de acento |
| `--orange-500` | `#F97316` | Color de marca, botón primario |
| `--orange-600` | `#EA580C` | Pulsado |
| `--orange-glow` | `rgba(249,115,22,.15)` | Halos, selección, foco |
| `--idea` | `#E5B567` | Acento de ideas (ámbar apagado) |
| `--success` | `#4ADE80` (desaturado) | Solo para confirmaciones puntuales |
| `--danger` | `#F87171` (desaturado) | Acciones destructivas |

Los naranjas se usan con moderación: logotipo, botón primario, elemento seleccionado, foco, progreso y microanimaciones.

### 4.3 Tipografía
**Inter** (variable, empaquetada localmente). Tamaños: 12 / 13 / 14 (base) / 16 / 20 / 28. Números tabulares en contadores.

### 4.4 Logotipo — «Sello» (aprobado)
Un **único trazo continuo** escribe «tsk» en cursiva y, sin levantarse, sale de la «k» para rodear la palabra y cerrar un círculo, como un sello. Degradado naranja `#FDBA74 → #EA580C`, sin fondo (el icono es la propia silueta del anillo).
- Trazado canónico: `LOGO_PATH` en `src/ui/components/Logo.tsx` (espacio 64×64). El grosor se adapta al tamaño (más grueso en pequeño).
- Favicon: `public/tasky.svg`. Fuente de iconos de la app: `src-tauri/icons/source/tasky-icon.svg` → `npx tauri icon src-tauri/icons/source/tasky-icon.svg` (borrar después `icons/android` e `icons/ios` hasta que exista la versión móvil).
- Al ser un solo trazo, se puede animar dibujándose (`stroke-dashoffset`) en el splash de la Fase 6.
- Descartados: monograma «t» con check, «Secuencia», «Progreso», «tsk» como texto lineal (cursiva, neón, firma, onda), «Tarea cumplida» y «Tarjeta».

### 4.5 Movimiento
- Splash de entrada ≤ 700 ms (el logotipo se «dibuja» y se desvanece). Se omite con `prefers-reduced-motion`.
- Transiciones de página: fundido + desplazamiento de 8px, 200 ms.
- Completar tarea: el check se dibuja, la fila se atenúa y pasa a «Completadas».
- Listas: animación de layout al reordenar/insertar/eliminar.

---

## 5. Arquitectura

### 5.1 Capas

```
┌──────────────────────────────────────────────────────────┐
│ ui/        React: páginas, componentes, animaciones      │  ← reutilizable en móvil (Tauri/Capacitor)
├──────────────────────────────────────────────────────────┤
│ state/     Store (Zustand): conecta UI ↔ core ↔ storage  │
├──────────────────────────────────────────────────────────┤
│ core/      TypeScript puro: modelo, validación, reglas,  │  ← sin React, sin Tauri, sin navegador
│            casos de uso, interfaces (puertos)            │     100 % testeable y reutilizable
├──────────────────────────────────────────────────────────┤
│ adapters/  Implementaciones concretas de los puertos:    │  ← ÚNICO sitio que importa @tauri-apps/*
│            storage Tauri (archivo), memoria (tests/dev)  │     aquí se añadirán móvil y sync
└──────────────────────────────────────────────────────────┘
```

Reglas:
- `core/` no importa nada de `ui/`, `state/`, `adapters/`, React ni Tauri.
- Solo `adapters/` importa `@tauri-apps/*`. Se refuerza con una regla ESLint (`no-restricted-imports`).
- La UI nunca accede al almacenamiento directamente: llama acciones del store, que aplican casos de uso de `core/` y persisten mediante el puerto `Storage`.

### 5.2 Estructura de carpetas
```
src/
├── core/
│   ├── model.ts        # Tipos + esquemas zod + versión de esquema
│   ├── ids.ts          # newId() → UUID v7
│   ├── clock.ts        # now() → marca temporal UTC (inyectable en tests)
│   ├── rank.ts         # orden fraccional (rankBetween)
│   ├── projects.ts     # casos de uso puros: (estado, comando) → nuevo estado
│   ├── tasks.ts
│   ├── ideas.ts
│   ├── selectors.ts    # consultas: proyectos por estado, contadores, tareas ordenadas
│   ├── migrations.ts
│   └── ports.ts        # interface Storage { load(); save(); backup() }
├── adapters/
│   ├── tauriStorage.ts # archivo en %APPDATA%\Tasky (plugin-fs), escritura atómica, backups
│   └── memoryStorage.ts# tests y desarrollo en navegador (localStorage)
├── state/store.ts
├── ui/
│   ├── app/            # App, rutas, layout, splash
│   ├── projects/  tasks/  ideas/
│   └── components/     # Button, Dialog, ConfirmDialog, Input, Menu, Tabs, EmptyState, Toast, Logo
└── styles/             # tokens.css, global.css
src-tauri/              # configuración Tauri, iconos, (casi) sin código Rust propio
```

### 5.3 Stack
| Capa | Tecnología | Motivo |
|---|---|---|
| UI | **React 19 + TypeScript** | Maduro, tipado; la misma UI sirve en móvil. |
| Build | **Vite** | Rápido; plantilla oficial de Tauri. |
| Escritorio | **Tauri 2** | Instalador ligero (~5–10 MB), WebView2 nativo de Windows, soporta Android/iOS. |
| Estilos | **CSS Modules + variables CSS** | Control total del diseño, sin kits de UI genéricos. |
| Estado | **Zustand** | Store mínimo. |
| Rutas | **React Router** (`HashRouter`) | Funciona igual en escritorio, móvil y navegador. |
| Drag & drop | **@dnd-kit** | Accesible (teclado), compatible con táctil. |
| Animación | **Motion** | Transiciones de layout y presencia. |
| Iconos | **lucide-react** | Línea fina, coherente. |
| Validación | **zod** | Valida datos al cargar/importar (y en el futuro, al recibir del servidor). |
| IDs | **uuid** (v7) | Ver §6.2. |
| Orden | **fractional-indexing** | Ver §6.4. |
| Tests | **Vitest** | Lógica de `core/` y adaptadores. |

> Las dependencias se instalan en la fase que las usa (Zustand y zod en la 3, @dnd-kit y fractional-indexing en la 4, Motion en la 6), para no arrastrar paquetes sin uso.

---

## 6. Modelo de datos

### 6.1 Entidades

```ts
type ProjectStatus = 'active' | 'on_hold' | 'done';
type TaskStatus    = 'todo' | 'in_progress' | 'done';
type Timestamp     = string;  // ISO 8601 UTC con milisegundos: "2026-11-05T18:04:12.345Z"

interface BaseRecord {
  id: string;                 // UUID v7, generado en el dispositivo
  createdAt: Timestamp;
  updatedAt: Timestamp;       // se actualiza en CADA cambio del registro
  deletedAt: Timestamp | null;// borrado lógico («lápida»)
}

interface Project extends BaseRecord {
  name: string;
  description: string;        // '' si no hay
  status: ProjectStatus;
}

interface Task extends BaseRecord {
  projectId: string;          // → Project.id
  title: string;
  description: string;
  status: TaskStatus;
  rank: string;               // orden fraccional dentro del proyecto
  completedAt: Timestamp | null;
}

interface Idea extends BaseRecord {
  projectId: string;          // → Project.id
  title: string;
  description: string;
}

interface TaskyData {
  schemaVersion: number;      // para migraciones
  projects: Project[];
  tasks: Task[];
  ideas: Idea[];
}
```

**Relaciones:** `Project 1 ─ N Task`, `Project 1 ─ N Idea`. Los contadores (pendientes/completadas) se **calculan**, no se almacenan.

### 6.2 Identificadores — UUID v7
Generados en el propio dispositivo, sin servidor. Únicos globalmente → dos dispositivos nunca crean el mismo id, así que no hay duplicados al sincronizar. A diferencia de v4, v7 está ordenado por tiempo (mejor rendimiento en índices de bases de datos y orden natural de creación).

### 6.3 Fechas y marcas temporales
- Todas en **UTC**, formato ISO 8601 con milisegundos, generadas por una única función `clock.now()`. Se muestran en hora local solo en la UI.
- `createdAt` nunca cambia; `updatedAt` cambia en cada modificación; `completedAt` al completar; `deletedAt` al borrar.
- `updatedAt` es la base de la futura resolución de conflictos (§7.3).

### 6.4 Orden de tareas — índice fraccional
Cada tarea tiene un `rank` de texto (`"a0"`, `"a0V"`, `"a1"`…). Mover una tarea entre otras dos solo cambia **su** `rank` (se calcula uno intermedio); el resto no se toca.

*Alternativa descartada:* posiciones enteras renumeradas (0..n). Más intuitivo, pero cada movimiento modifica muchas tareas → en una sincronización futura, dos reordenaciones en distintos dispositivos chocarían en casi todos los registros. El índice fraccional cuesta lo mismo hoy (una librería de ~1 KB) y evita una migración después. Empates (posibles tras sincronizar) se resuelven por `id`.

### 6.5 Borrado lógico
Eliminar marca `deletedAt` en lugar de quitar el registro (en cascada: el proyecto y sus tareas e ideas). Los selectores lo filtran, la UI nunca ve registros borrados. Necesario para que un borrado pueda propagarse a otros dispositivos en el futuro. Mientras no haya sync, las lápidas de más de 30 días se purgan al arrancar para que el archivo no crezca.

---

## 7. Preparación para móvil y sincronización (diseño, NO implementación)

### 7.1 Qué se hace ya (coste casi nulo)
| Decisión | Por qué ayuda después |
|---|---|
| Capas `core/` / `adapters/` / `ui/` | Móvil y sync se añaden como adaptadores nuevos. |
| UUID v7 en cliente | Sin duplicados entre dispositivos. |
| `createdAt/updatedAt/deletedAt` UTC | Detección de cambios y resolución de conflictos. |
| Borrado lógico | Los borrados se propagan. |
| Orden fraccional | Reordenar no genera conflictos masivos. |
| Validación zod en la frontera | Los datos remotos se validarán igual que los locales. |
| UI responsive, drag & drop táctil, `HashRouter` | La UI es reutilizable en pantallas pequeñas. |

### 7.2 Qué NO se hace ahora
Servidor, cuentas/autenticación, cola de cambios, cursores de sync, detección de red, proyectos de Android/iOS. Nada de esto existe en el código hasta que se decida empezar.

### 7.3 Propuesta de sincronización futura
**Modelo:** *local-first*. El almacenamiento local sigue siendo la fuente de verdad del dispositivo; la app nunca espera a la red.

**Flujo:**
1. **Push:** el dispositivo envía los registros con `updatedAt` posterior a su último envío confirmado (upsert por `id`, incluye lápidas).
2. **Pull:** pide al servidor los registros cambiados desde su último cursor (el servidor asigna a cada escritura un número de secuencia creciente, así el cursor no depende del reloj del dispositivo).
3. **Merge:** por registro, gana el `updatedAt` más reciente (*last-write-wins*); empate → mayor `id`. Las lápidas ganan igual que cualquier cambio.
4. **Offline:** si no hay conexión, simplemente no se sincroniza; los cambios quedan en local y se envían al volver la red (al arrancar, al recuperar conexión y periódicamente).

**Casos límite previstos:**
- Mismo registro editado en dos dispositivos → gana la última edición. Para un único usuario es aceptable. Si molesta, se refina a *LWW por campo* (un `updatedAt` por campo) sin cambiar el resto.
- Reordenaciones simultáneas → cada tarea conserva el `rank` de su último movimiento; el orden resultante es coherente aunque no idéntico a ninguno.
- Tarea creada en un proyecto que otro dispositivo borró → la cascada se reaplica tras el merge (queda borrada).
- Relojes desajustados → riesgo bajo con un solo usuario; si fuese necesario, se sustituye `clock.now()` por un reloj lógico híbrido (HLC) en un único archivo.

**Alternativas de backend (se decidirá cuando toque):**
| Opción | Ventajas | Consecuencias |
|---|---|---|
| **Supabase** (Postgres gestionado, plan gratuito) | Auth y API listos; el esquema replica el modelo de §6. | Dependencia de un servicio externo (opcional: la app funciona sin él). |
| **PocketBase autoalojado** | Un único ejecutable, datos en tu poder. | Hay que alojarlo y mantenerlo accesible (VPS/NAS). |
| **API propia mínima** (Node + SQLite) | Control total. | Más código y mantenimiento. |
| **Motor de sync** (PowerSync, ElectricSQL…) | Menos código de sync. | Acoplamiento a un proveedor; normalmente exige SQLite en cliente. |
| **CRDT** (Automerge/Yjs) | Fusión perfecta de ediciones concurrentes. | Complejidad y formato de datos opaco; excesivo para un usuario. |
| **Carpeta OneDrive/Dropbox** | Sin servidor. | Conflictos a nivel de archivo completo; mal soporte en iOS. |

Recomendación provisional: LWW por registro + Supabase o PocketBase. Se reevaluará antes de implementar.

**Cambios necesarios cuando llegue:** un adaptador `SyncClient`, guardar en el archivo local los metadatos de sync (`lastPushAt`, `pullCursor`), un indicador de estado de sync en la UI y pantalla de inicio de sesión. `core/` y la UI de proyectos/tareas/ideas no cambian.

### 7.4 Propuesta de versión móvil futura
| Opción | Reutilización | Consecuencias |
|---|---|---|
| **Tauri 2 móvil** (recomendada) | ~100 %: misma UI, `core/` y adaptadores; un solo proyecto. | Soporte móvil de Tauri más joven que el de escritorio; compilar iOS requiere un Mac. |
| **Capacitor** | ~95 %: misma UI y `core/`, adaptador de almacenamiento nuevo. | Segundo empaquetador que mantener. |
| **React Native** | Solo `core/` (~30 %). | Reescribir toda la UI; mejor sensación nativa. |

Trabajo previsto: ajustes de layout táctil (gestos, áreas de toque), adaptador de almacenamiento si cambia la ruta de datos, iconos/splash móviles y, casi seguro, la sincronización (sin ella, cada dispositivo tendría datos independientes).

---

## 8. Persistencia local (escritorio)

Decisión **D5** (§10): **documento JSON** único en `%APPDATA%\com.tasky.app\tasky.json`.
- Carga completa al arrancar, validación zod y migraciones por `schemaVersion`.
- Guardado automático tras cada cambio (*debounce* ~300 ms + guardado forzado al cerrar la ventana).
- Escritura atómica: se escribe `tasky.json.tmp` y se renombra (un corte de luz nunca deja el archivo a medias).
- Copias automáticas rotativas en `backups/` (una por día, últimas 14) + exportar/importar manual.
- Si el archivo principal está corrupto, se ofrece restaurar la última copia válida.

---

## 9. Plan de desarrollo por fases

Cada fase termina con verificación real (app en ejecución + tests de `core/`) y actualización de esta guía.

| Fase | Contenido | Criterio de cierre |
|---|---|---|
| **1. Planificación** | Requisitos, arquitectura, modelo de datos, preparación móvil/sync, esta guía. | Decisiones confirmadas. |
| **2. Base + identidad visual** | Instalar Rust, scaffold Tauri + Vite + React + TS, ESLint, tokens, tipografía, logotipo, componentes UI usados por Inicio, layout, Inicio con datos de ejemplo. (Diálogos, menús, inputs y pestañas se crean en la fase que los usa, para no dejar código muerto.) | Inicio se ve completo dentro de la ventana Tauri; logotipo aprobado. |
| **3. Core + persistencia + proyectos** | `core/` (modelo, ids, clock, migraciones), adaptador de almacenamiento, store, CRUD de proyectos, estados, navegación, confirmaciones. | CRUD verificado; datos sobreviven a reinicios; tests verdes. |
| **4. Tareas** | CRUD, estados, completar, drag & drop con `rank`, sección de completadas. | CRUD + orden verificados y persistentes. |
| **5. Ideas** | CRUD, cuadrícula, diferenciación visual, estados vacíos. | CRUD verificado y persistente. |
| **6. Acabado UX** | Splash, transiciones, feedback, atajos, responsive, accesibilidad, backups e importación/exportación, revisión general. | Revisión visual completa. |
| **7. Instalación Windows** | Build del instalador, iconos, instalación, búsqueda en Inicio, anclaje, instrucciones paso a paso. | Instalada y anclada en este PC. |

---

## 10. Decisiones

### Confirmadas
- **D1 — Plataforma:** app de escritorio con **Tauri 2** (confirmada por el usuario).
- Móvil y sincronización: **diseñadas, no implementadas** (§7).
- Idioma de la interfaz: español. Sin autenticación ni backend.
- Arquitectura en capas `core/` · `adapters/` · `state/` · `ui/`; solo `adapters/` conoce Tauri.
- UUID v7, marcas temporales UTC ISO 8601, borrado lógico, orden fraccional.
- `HashRouter`, fuentes e iconos locales (100 % offline).

### Por defecto (se aplican salvo que se indique lo contrario)
- **D2 — Copias de seguridad:** automáticas rotativas + exportar/importar JSON.
- **D3 — Estados de tarea:** Pendiente / En curso / Completada.
- **D4 — Vista de tareas:** lista ordenada única con completadas plegables.

### Almacenamiento
- **D5 — Almacenamiento local: documento JSON** (confirmada por el usuario, §8).
  - Motivo: simplicidad máxima, fácil de inspeccionar y respaldar copiando un archivo, migraciones triviales. Reescribe el archivo entero en cada guardado (irrelevante por debajo de unos pocos MB).
  - Alternativa descartada: SQLite (`tauri-plugin-sql`) — escrituras incrementales y esquema paralelo a un futuro Postgres, pero más código desde el día uno.
  - Gracias al puerto `Storage`, migrar a SQLite más adelante solo afectaría a `adapters/` y a una migración única de datos.

---

## 11. Estado de implementación

| Funcionalidad | Estado |
|---|---|
| Fase 1 — Guía y planificación | ✅ Completada (D1–D5 cerradas) |
| Fase 2 — Scaffold Tauri 2 + React 19 + Vite, ESLint (reglas de capas), Vitest | ✅ Hecho |
| Fase 2 — Tokens, tipografía Inter local, estilos globales | ✅ Hecho |
| Fase 2 — Componentes: Logo, Button, StatusBadge, EmptyState; AppLayout | ✅ Hecho |
| Fase 2 — Pantalla principal con datos de ejemplo (`ui/app/sampleData.ts`, se elimina en Fase 3) | ✅ Hecho |
| Identidad visual / logotipo «Sello» + iconos de Windows (`src-tauri/icons`) | ✅ Hecho |
| Core + persistencia | ⏳ Pendiente |
| Proyectos (CRUD, estados, navegación) | ⏳ Pendiente |
| Tareas (CRUD, estados, drag & drop) | ⏳ Pendiente |
| Ideas (CRUD) | ⏳ Pendiente |
| Animaciones, feedback, responsive | ⏳ Pendiente |
| Copias de seguridad | ⏳ Pendiente |
| Instalación en Windows | ⏳ Pendiente |
| Versión móvil | 🔒 Futuro (diseñada, §7.4) |
| Sincronización | 🔒 Futuro (diseñada, §7.3) |
