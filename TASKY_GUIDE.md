# TASKY_GUIDE.md

> Documento de referencia del proyecto. Se consulta antes de cada fase y se actualiza al terminarla.
> Última actualización: 2026-11-05 — Fases 1–7 completadas: Tasky instalada en Windows. Siguiente: Fase 8 (web móvil + PWA). Incluye los requisitos de rapidez/atajos/fechas límite y de plataforma Windows + iPhone (PWA) con Supabase.

---

## 1. Objetivo

**Tasky** es el centro personal de organización de un único usuario: un gestor de **proyectos**, **tareas** e **ideas** inspirado en GitHub Projects y Linear, pensado para usarse a diario durante años.

**Plataformas (objetivo final):**
- **Windows:** aplicación de escritorio Tauri 2 (instalador, icono, buscador de Windows, barra de tareas, datos locales, offline). Es la aplicación principal y la prioridad actual.
- **iPhone:** la misma aplicación como **web móvil instalable (PWA)** desde Safari, con interfaz adaptada a móvil. Sin App Store ni cuenta de Apple Developer. *(Fase 8)*
- **Sincronización** entre ambos mediante **Supabase**, con acceso privado exclusivo para el usuario. *(Fase 9)*

Principios que guían todas las decisiones, por orden:

1. **Rapidez antes que complejidad.** Cada acción habitual con el mínimo esfuerzo: una tecla, escribir, Enter. Sin menús profundos ni formularios largos; los campos opcionales se pueden dejar vacíos sin fricción (§3.6).
2. **Datos seguros y persistentes.** Nada se pierde al cerrar la app o apagar el equipo.
3. **Offline siempre.** Tasky funciona completo sin Internet; la sincronización es un añadido, nunca un requisito.
4. **Calidad visual.** Identidad propia, oscura, minimalista y premium, con el naranja como color de marca. Animaciones fluidas que nunca ralentizan.
5. **Simplicidad técnica.** Solo la complejidad que se usa hoy, más las decisiones baratas que evitan rehacer trabajo mañana.

### Fuera de alcance (salvo que se decida lo contrario)
Multiusuario, registro público, etiquetas, prioridades, subtareas, búsqueda global, notificaciones, publicación en tiendas de aplicaciones.

---

## 2. Funcionamiento general

```
Pantalla principal (Inicio)                         Atajos: P nuevo proyecto · ? ayuda
├── Activos      (tarjetas grandes, protagonistas)
├── En espera    (tarjetas compactas)
└── Finalizados  (tarjetas compactas / atenuadas)
        │
        ▼  clic en una tarjeta
Página de proyecto                                  Atajos: T nueva tarea · I nueva idea · Esc volver
├── Cabecera: nombre, descripción, estado (1 clic), menú (editar · eliminar)
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
| Crear | Tecla **P** o botón → diálogo pequeño con el foco ya en el nombre. Nombre (obligatorio) y descripción (opcional). Enter crea. Estado inicial *Activo*. |
| Editar | Nombre y descripción (mismo diálogo). |
| Cambiar estado | `active` · `on_hold` · `done` (Activo · En espera · Finalizado), con un clic desde la cabecera del proyecto. |
| Eliminar | Con diálogo de confirmación. Elimina en cascada sus tareas e ideas. |
| Listar | Agrupados por estado en Inicio (más recientes primero). |
| Página propia | Ruta `/project/:id`. |

### 3.2 Tareas
| Requisito | Detalle |
|---|---|
| Campos | Título (obligatorio), descripción (opcional), estado, **fecha límite (opcional)**, orden, fecha de creación. |
| Crear | Tecla **T** (dentro de un proyecto) o botón → diálogo con foco en el título; descripción y fecha límite opcionales. Enter crea. |
| Editar / eliminar | Clic en la tarea → mismo diálogo; eliminar con confirmación ligera. |
| Estados | `todo` (Pendiente) · `in_progress` (En curso) · `done` (Completada). |
| Completar | Checkbox de un clic en la propia fila: el check se dibuja (~260 ms) y la tarea pasa a «Completadas». Botón ▶ en la fila para marcar/quitar «En curso» con un clic. |
| Reordenar | Drag & drop: con el ratón desde cualquier punto de la fila; con teclado desde el asa (`Espacio` para coger, flechas para mover, `Espacio` para soltar); en táctil desde el asa. El orden define la secuencia de trabajo. |
| Visualización | Lista única: abiertas arriba en su orden; completadas en una sección plegable. Cada fila: título, descripción (si existe), estado y fecha límite (si existe). |

### 3.3 Fechas límite
- Opcionales, solo en tareas. Representan **el día máximo** para terminar la tarea (no inicio ni creación).
- Indicadores discretos, sin abusar del color:
  | Situación | Indicación |
  |---|---|
  | Vencida (antes de hoy, no completada) | Texto y icono en rojo apagado (`--danger`), «Venció hace N días». |
  | Hoy / mañana | Naranja (`--orange-300`), «Hoy» / «Mañana». |
  | Próxima (≤ 7 días) | Gris claro, día de la semana («vie 13»). |
  | Más adelante | Gris tenue, fecha corta («13 dic»). |
  | Tarea completada | Fecha atenuada, sin alerta. |
- En Inicio, cada tarjeta de proyecto muestra la **próxima fecha límite** y, si las hay, cuántas tareas están **vencidas**, para identificar qué proyectos requieren atención.

### 3.4 Ideas
| Requisito | Detalle |
|---|---|
| Campos | Título (obligatorio), descripción (opcional), fecha de creación. |
| Crear | Tecla **I** (dentro de un proyecto) o botón → diálogo con foco en el título. Enter crea. |
| Editar / eliminar | Clic en la idea → mismo diálogo. Sin estado ni orden manual (más recientes primero). |
| Diferenciación visual | Tarjetas tipo nota en cuadrícula, icono de bombilla, acento ámbar suave, sin checkbox. |

### 3.5 Pantalla principal
- Sin login en escritorio. Es la primera pantalla al abrir.
- Tres secciones: Activos (mayor protagonismo), En espera, Finalizados.
- Tarjeta de proyecto: nombre, descripción breve, estado, nº tareas pendientes, nº completadas, barra de progreso, próxima fecha límite y nº de vencidas (si existen).
- Botón «Nuevo proyecto» siempre visible con su atajo (`P`).
- Estados vacíos diseñados para cada sección.

### 3.6 Rapidez y atajos de teclado
Flujos objetivo:
- Crear proyecto: `P` → escribir → `Enter`.
- Crear tarea: entrar en el proyecto → `T` → escribir → `Enter`.
- Crear idea: entrar en el proyecto → `I` → escribir → `Enter`.
- Completar tarea: clic en su checkbox. Reordenar: arrastrar y soltar.

**Atajos (mantener esta tabla actualizada):**

| Tecla | Dónde | Acción |
|---|---|---|
| `P` | Inicio | Nuevo proyecto |
| `T` | Página de proyecto | Nueva tarea (abre la pestaña Tareas si hace falta) |
| `I` | Página de proyecto | Nueva idea (abre la pestaña Ideas si hace falta) |
| `Enter` | Diálogo de creación/edición (campo de una línea) | Confirmar |
| `Ctrl` + `Enter` | Diálogo, dentro de la descripción | Confirmar (Enter solo hace salto de línea) |
| `Esc` | Diálogo / menú abierto | Cerrar sin guardar |
| `Esc` | Página de proyecto (sin nada abierto) | Volver a Inicio |
| `?` | Cualquier pantalla | Mostrar la ayuda de atajos |

**Reglas:**
- Los atajos de una letra **no se activan** mientras se escribe en un campo de texto, ni si se pulsan con `Ctrl`, `Alt`, `Shift`(salvo `?`) o `Win`/`Cmd`, ni con un diálogo abierto. Así no interfieren con atajos de Windows ni del navegador.
- Son contextuales: `T` e `I` solo existen dentro de un proyecto; `P` en Inicio.
- Toda acción con atajo tiene también un botón visible, con el atajo indicado (`<kbd>`).
- Ayuda visual: botón «Atajos» (icono de teclado) en la cabecera y tecla `?`.
- Las funciones principales son accesibles con teclado y con ratón (foco visible, orden de tabulación lógico, `aria-*` en diálogos y menús).
- Implementación: un único hook `useShortcut` en `ui/shortcuts/` registra atajos por pantalla; la tabla de ayuda se genera desde la misma definición para que nunca se desincronice.

### 3.7 Persistencia
- Todo (proyectos, tareas, ideas, estados, fechas y órdenes) se guarda automáticamente tras cada cambio, en local.
- Copias de seguridad: automáticas rotativas + exportar/importar JSON (Fase 6).

---

## 4. Requisitos visuales

### 4.1 Estilo
Dark mode, minimalista y premium (referencias: Linear, GitHub Projects). Jerarquía clara, espaciado generoso, bordes finos de 1px, radios suaves, sombras mínimas.

### 4.2 Paleta (tokens CSS, `src/styles/tokens.css`)
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0A0A0B` | Fondo de la app |
| `--surface-1` | `#111113` | Paneles, tarjetas |
| `--surface-2` | `#18181B` | Hover de tarjetas, botones secundarios |
| `--surface-3` | `#202024` | Hover, inputs |
| `--border` | `#27272A` | Separadores, bordes |
| `--border-strong` | `#3A3A40` | Bordes en foco/hover |
| `--text` | `#EDEDEF` | Texto principal |
| `--text-muted` | `#A1A1AA` | Texto secundario |
| `--text-faint` | `#7C7C86` | Metadatos, placeholders (contraste ≥ 4,5:1) |
| `--orange-300…600` | `#FDBA74` `#FB923C` `#F97316` `#EA580C` | Marca: logo, primario, selección, foco, progreso |
| `--orange-glow` | `rgba(249,115,22,.15)` | Halos, selección, foco |
| `--idea` | `#E5B567` | Acento de ideas (ámbar apagado) |
| `--success` | `#6FCF97` | Completado, confirmaciones puntuales |
| `--danger` | `#F87171` | Acciones destructivas, fechas vencidas |

### 4.3 Tipografía
**Inter** (variable, empaquetada localmente). Tamaños: 12 / 13 / 14 (base) / 16 / 20 / 28. Números tabulares en contadores.

### 4.4 Logotipo — «Sello» (aprobado)
Un **único trazo continuo** escribe «tsk» en cursiva y, sin levantarse, sale de la «k» para rodear la palabra y cerrar un círculo, como un sello. Degradado naranja `#FDBA74 → #EA580C`, sin fondo.
- Trazado canónico: `LOGO_PATH` en `src/ui/components/Logo.tsx` (espacio 64×64). El grosor se adapta al tamaño.
- Favicon: `public/tasky.svg`. Iconos de la app: `src-tauri/icons/source/tasky-icon.svg` → `npx tauri icon src-tauri/icons/source/tasky-icon.svg` (borrar después `icons/android` e `icons/ios`; los iconos de la PWA se generarán en la Fase 8 desde el mismo SVG).
- Al ser un solo trazo, se anima dibujándose (`stroke-dashoffset`) en el splash.
- Descartados: monograma «t» con check, «Secuencia», «Progreso», «tsk» como texto lineal, «Tarea cumplida» y «Tarjeta».

### 4.5 Movimiento
Fluido y rápido: la interacción nunca espera a una animación. Duraciones 120–250 ms, curvas suaves (`--ease`), sin rebotes llamativos. Todo respeta `prefers-reduced-motion`. Librería: **Motion**.

| Elemento | Animación |
|---|---|
| Apertura de la app | Splash ≤ 700 ms: el logotipo se dibuja y se desvanece. |
| Cambio de pantalla | Fundido + desplazamiento de 8 px, ~200 ms. |
| Diálogos y menús | Aparición con fundido + escala 0,97 → 1 (~160 ms); en móvil, hoja que sube desde abajo. |
| Crear / eliminar elementos | Entrada con fundido y altura; salida colapsando. |
| Cambio de estado | La tarjeta se recoloca en su sección con animación de layout; el check se dibuja al completar. |
| Reordenación | Animación de layout de @dnd-kit/Motion. |
| Secciones plegables | Altura animada + giro del chevron. |
| Botones y tarjetas | Hover/pulsado sutiles (elevación de 2 px, halo naranja en el primario). |

---

## 5. Arquitectura

### 5.1 Capas

```
┌───────────────────────────────────────────────────────────────┐
│ ui/        React: páginas, componentes, atajos, animaciones   │  ← compartida por escritorio y PWA
│            (layouts específicos de móvil donde haga falta)    │
├───────────────────────────────────────────────────────────────┤
│ state/     Store (Zustand): conecta UI ↔ core ↔ storage       │
├───────────────────────────────────────────────────────────────┤
│ core/      TypeScript puro: modelo, validación, reglas,       │  ← sin React, sin Tauri, sin navegador
│            casos de uso, fechas límite, interfaces (puertos)  │     100 % testeable y reutilizable
├───────────────────────────────────────────────────────────────┤
│ adapters/  Implementaciones de los puertos por plataforma:    │  ← ÚNICO sitio que importa @tauri-apps/*
│            · Tauri: archivo JSON en AppData (escritorio)      │
│            · Web: localStorage hoy → IndexedDB (PWA, Fase 8)  │
│            · Supabase: auth + sync (Fase 9)                   │
└───────────────────────────────────────────────────────────────┘
```

Reglas:
- `core/` no importa nada de `ui/`, `state/`, `adapters/`, React ni Tauri.
- Solo `adapters/` importa `@tauri-apps/*` (y en el futuro `@supabase/*`). Se refuerza con ESLint (`no-restricted-imports`).
- La plataforma se detecta **una sola vez** en `adapters/index.ts` (`isTauri()`), que devuelve el `Storage` adecuado. El resto de la app no sabe en qué plataforma corre.
- La UI nunca accede al almacenamiento directamente: llama acciones del store, que aplican casos de uso de `core/` y persisten mediante el puerto `Storage`.

### 5.2 Estructura de carpetas
```
src/
├── core/
│   ├── model.ts        # Esquemas zod + tipos inferidos + versión de esquema
│   ├── ids.ts          # newId() → UUID v7
│   ├── clock.ts        # now() (UTC) y today() (fecha local)
│   ├── data.ts         # emptyData(), parseData() (validación + migraciones + purga de lápidas)
│   ├── projects.ts     # casos de uso puros: (datos, comando) → nuevos datos
│   ├── tasks.ts  ideas.ts  rank.ts  dueDates.ts   (Fases 4–5)
│   ├── selectors.ts    # consultas: proyectos por estado, contadores, próximas fechas
│   └── ports.ts        # interface Storage { load(); save() }
├── adapters/
│   ├── index.ts        # createStorage(): elige la implementación por plataforma
│   ├── tauriStorage.ts # %APPDATA%\com.tasky.app\tasky.json, escritura atómica
│   └── webStorage.ts   # navegador (desarrollo; IndexedDB en la Fase 8)
├── state/store.ts
├── ui/
│   ├── app/            # App, rutas, layout, splash
│   ├── shortcuts/      # useShortcut, definición de atajos, ayuda
│   ├── projects/  tasks/  ideas/
│   └── components/     # Button, Dialog, ConfirmDialog, Field, Form (estilos comunes), Menu, Segmented, EmptyState, Kbd, Logo…
└── styles/             # tokens.css, global.css
src-tauri/              # configuración Tauri, iconos, plugin fs (sin código Rust propio)
```

### 5.3 Stack
| Capa | Tecnología | Motivo |
|---|---|---|
| UI | **React 19 + TypeScript** | Maduro, tipado; la misma UI sirve en escritorio y PWA. |
| Build | **Vite** | Rápido; plantilla oficial de Tauri; plugin PWA disponible. |
| Escritorio | **Tauri 2** + `plugin-fs` | Instalador ligero, WebView2 nativo, acceso al archivo de datos. |
| Móvil | **PWA** (Fase 8) | Se instala desde Safari sin App Store ni Apple Developer. |
| Sync / auth | **Supabase** (Fase 9) | Postgres + Auth + RLS, plan gratuito. |
| Estilos | **CSS Modules + variables CSS** | Control total del diseño. |
| Estado | **Zustand** | Store mínimo. |
| Rutas | **React Router** (`HashRouter`) | Igual en escritorio, PWA y navegador. |
| Drag & drop | **@dnd-kit** (+ `modifiers`) | Accesible (teclado) y táctil. |
| Animación | **Motion** | Presencia, layout y transiciones. |
| Iconos | **lucide-react** | Línea fina, coherente. |
| Validación | **zod** | Valida datos al cargar/importar y, en el futuro, al recibir del servidor. |
| IDs | **uuid** (v7) | Ver §6.2. |
| Orden | **fractional-indexing** | Ver §6.4. |
| Tests | **Vitest** | Lógica de `core/` y adaptadores. |

> Las dependencias se instalan en la fase que las usa (Zustand, zod, uuid, Motion y plugin-fs en la 3; @dnd-kit y fractional-indexing en la 4; plugin PWA en la 8; Supabase en la 9).

---

## 6. Modelo de datos

### 6.1 Entidades

```ts
type ProjectStatus = 'active' | 'on_hold' | 'done';
type TaskStatus    = 'todo' | 'in_progress' | 'done';
type Timestamp     = string;  // ISO 8601 UTC con milisegundos: "2026-11-05T18:04:12.345Z"
type LocalDate     = string;  // Día del calendario sin hora ni zona: "2026-11-13"

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
  dueDate: LocalDate | null;  // fecha límite opcional
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

**Relaciones:** `Project 1 ─ N Task`, `Project 1 ─ N Idea`. Contadores, progreso y próximas fechas se **calculan**, no se almacenan.

### 6.2 Identificadores — UUID v7
Generados en el dispositivo, sin servidor. Únicos globalmente → sin duplicados al sincronizar. Ordenados por tiempo (mejor rendimiento en índices de Postgres).

### 6.3 Fechas y marcas temporales
- **Marcas temporales** (`createdAt`, `updatedAt`, `deletedAt`, `completedAt`): UTC, ISO 8601 con milisegundos, generadas solo por `clock.now()`. Se muestran en hora local en la UI. `updatedAt` es la base de la resolución de conflictos (§7.3).
- **Fecha límite** (`dueDate`): `LocalDate` (`YYYY-MM-DD`), **sin hora ni zona horaria**. Es un día del calendario del usuario: guardarla como instante UTC haría que «13 de noviembre» se viese como «12» en otra zona o con el cambio de horario. «Hoy» se calcula con `clock.today()` en la zona local del dispositivo. En Postgres se mapeará a `date`.

### 6.4 Orden de tareas — índice fraccional
Cada tarea tiene un `rank` de texto (`"a0"`, `"a0V"`, `"a1"`…). Mover una tarea solo cambia **su** `rank`. Evita conflictos masivos al sincronizar reordenaciones. Empates se resuelven por `id`.

### 6.5 Borrado lógico
Eliminar marca `deletedAt` (en cascada: proyecto → tareas e ideas). Los selectores lo filtran. Permite propagar borrados. Mientras no haya sync, las lápidas de más de 30 días se purgan al cargar; con sync, solo se purgarán las ya confirmadas por el servidor.

---

## 7. Multiplataforma y sincronización

### 7.1 Qué se hace ya (coste casi nulo)
| Decisión | Por qué ayuda después |
|---|---|
| Capas `core/` / `adapters/` / `ui/` | PWA y Supabase se añaden como adaptadores nuevos. |
| Detección de plataforma en un solo punto | El mismo build web sirve para Tauri y para la PWA. |
| UUID v7, marcas UTC, `LocalDate` para fechas límite | Sin duplicados ni desfases de zona horaria entre dispositivos. |
| Borrado lógico y orden fraccional | Borrados y reordenaciones se sincronizan sin conflictos masivos. |
| Validación zod en la frontera | Los datos remotos se validarán igual que los locales. |
| UI responsive, drag & drop táctil, `HashRouter`, diálogos que en móvil son hojas | La interfaz móvil parte de los mismos componentes. |

### 7.2 Qué NO se hace todavía
Hosting, autenticación, Supabase, cola de sync, service worker, IndexedDB. Nada de esto existe en el código hasta su fase.

### 7.3 Windows — escritorio (Tauri 2)
Aplicación principal. Instalador propio, icono, buscador de Windows, anclaje a la barra de tareas. Datos en `%APPDATA%\com.tasky.app\tasky.json`. Funciona sin conexión y sin iniciar sesión; si se activa la sync (Fase 9), inicia sesión una vez y guarda la sesión.

- **Instalador:** NSIS (`npm run tauri build` → `src-tauri\target\release\bundle\nsis\`), en español, **por usuario** (sin permisos de administrador, en `%LOCALAPPDATA%\Tasky`). Crea el acceso del menú Inicio, que es lo que lo hace aparecer en el buscador de Windows. Sin firma de código (gratuito) → SmartScreen avisa la primera vez. Se descartó MSI: exige permisos de administrador y no aporta nada para un único usuario.
- **Ventana:** se abre **maximizada** (ocupa la pantalla y deja visible la barra de tareas); al restaurarla vuelve a 1280×820.
- **Instancia única** (`tauri-plugin-single-instance`): abrir Tasky de nuevo enfoca la ventana existente en vez de crear otra; dos ventanas mantendrían versiones distintas del mismo archivo y una pisaría a la otra.
- **Actualizar:** ejecutar un instalador nuevo encima; los datos (en `%APPDATA%`, fuera de la carpeta de instalación) se conservan.
- Instrucciones paso a paso para el usuario: [README.md](README.md).

### 7.4 iPhone — PWA (Fase 8)
- **Por qué PWA y no app nativa:** una app iOS nativa (Tauri móvil, Capacitor, React Native) exige cuenta de Apple Developer (de pago) o reinstalar cada 7 días. La PWA se añade a la pantalla de inicio desde Safari, se abre a pantalla completa con su icono y funciona offline.
- **Mismo código:** el build web de Vite es la PWA; solo cambian el adaptador de almacenamiento (IndexedDB) y lo específico de PWA (manifest, service worker con `vite-plugin-pwa`, iconos `apple-touch-icon`, `viewport-fit=cover` y zonas seguras).
- **Interfaz adaptada, no reducida:** barra inferior con pestañas Tareas/Ideas, botón flotante «+» (no hay teclado físico para atajos), formularios como hojas inferiores, objetivos táctiles ≥ 44 px, arrastre con pulsación larga mediante un asa visible, sin estados de hover imprescindibles.
- **Limitaciones conocidas de iOS:** el almacenamiento de una PWA puede borrarse si no se usa durante semanas → con Supabase (Fase 9) el servidor es la copia de seguridad y el móvil se rehidrata al abrir. Sin sync, la PWA en iPhone no tendría sentido como segundo dispositivo, por eso las Fases 8 y 9 se publican juntas.

### 7.5 Sincronización con Supabase (Fase 9)
**Modelo *local-first*:** cada dispositivo trabaja contra su almacenamiento local; la app nunca espera a la red.

**Esquema:** tablas `projects`, `tasks`, `ideas` que replican §6.1 (`snake_case`), más `user_id uuid` y `server_seq bigint` (asignado por un trigger con una secuencia en cada insert/update).

**Flujo:**
1. **Push:** se envían los registros con `updatedAt` posterior al último envío confirmado (`upsert` por `id`, incluye lápidas). El servidor solo acepta el cambio si su `updated_at` es más reciente que el guardado (*last-write-wins* aplicado también en el servidor).
2. **Pull:** se piden los registros con `server_seq` mayor que el último cursor del dispositivo (cursor independiente del reloj local).
3. **Merge:** por registro gana el `updatedAt` más reciente; empate → mayor `id`. Tras el merge se reaplica la cascada de borrados.
4. **Cuándo:** al arrancar, al recuperar conexión, tras cada cambio local (agrupado unos segundos) y periódicamente; opcionalmente Supabase Realtime para recibir cambios al instante.
5. **Offline:** los cambios quedan en local y se envían al volver la red.

**Casos límite:** misma tarea editada en dos dispositivos → gana la última edición (refinable a LWW por campo); reordenaciones simultáneas → cada tarea conserva su último `rank`; tarea creada en un proyecto borrado en otro dispositivo → queda borrada por la cascada; relojes desajustados → riesgo bajo con un usuario, sustituible por un reloj híbrido (HLC) en `clock.ts`.

**Cambios necesarios en el código:** adaptador `adapters/supabase/` (cliente, auth, sync), metadatos de sync en el almacenamiento local (`lastPushAt`, `pullCursor`), pantalla de inicio de sesión e indicador de estado de sync. `core/` y la UI de proyectos/tareas/ideas no cambian.

### 7.6 Privacidad y acceso restringido (Fase 9)
- **Autenticación obligatoria** en la web: sin sesión válida solo se muestra la pantalla de acceso; no se carga ni se muestra ningún dato.
- **Sin registro público:** en Supabase se desactiva *Allow new users to sign up*; la única cuenta se crea manualmente desde el panel. La UI no tiene pantalla de registro.
- **RLS en todas las tablas:** `enable row level security` + políticas `using (user_id = auth.uid())` y `with check (user_id = auth.uid())` para select/insert/update/delete. Sin políticas para `anon`.
- **Lista blanca:** las políticas comprueban además que `auth.uid()` es el id de la cuenta autorizada (o un `email` concreto), de modo que aunque alguien consiguiera crear una cuenta no vería ni escribiría nada.
- **Claves:** en el cliente solo la *anon/publishable key* (pública por diseño; la protección es RLS). La *service role key* nunca sale del panel de Supabase.
- **Hosting de la PWA:** sitio estático gratuito (Cloudflare Pages, Netlify o Vercel) con HTTPS. Los archivos de la app son públicos pero no contienen datos. Opcional: Cloudflare Access delante del sitio para que ni siquiera la pantalla de acceso sea visible a terceros.
- **Sesión:** Supabase Auth con email + contraseña (o enlace mágico); la sesión se renueva sola y se puede cerrar desde ajustes.

---

## 8. Persistencia local

**Escritorio** — decisión **D5**: **documento JSON** único en `%APPDATA%\com.tasky.app\tasky.json`.
- Carga completa al arrancar; validación zod, migraciones por `schemaVersion` y purga de lápidas antiguas.
- **Guardado inmediato tras cada cambio**, serializado (si hay una escritura en curso, se encola solo la última versión). Sin *debounce*: con un archivo de pocos KB es instantáneo y no existe ventana en la que cerrar la app pierda cambios.
- Escritura atómica: se escribe `tasky.json.tmp` y se renombra sobre `tasky.json`.
- Si el archivo no es válido, **no se sobrescribe**: se muestra una pantalla de error con «Restaurar la última copia». Al restaurar, el archivo ilegible se aparta como `tasky.ilegible-<fecha>.json` (nunca se borra) y se usa la copia válida más reciente.
- **Copias automáticas** en `backups/`: antes del primer cambio de cada día se copia el `tasky.json` existente a `backups/tasky-AAAA-MM-DD.json`; se conservan las 14 más recientes. Un fallo al copiar nunca bloquea el guardado.
- **Exportar** (menú «Copias de seguridad» de la cabecera): escribe `tasky-copia-AAAA-MM-DD.json` en la carpeta Descargas (en el navegador, descarga normal).
- **Importar**: se elige un archivo, se valida igual que al arrancar y se pide confirmación mostrando lo que contiene y lo que se va a sustituir. Antes de reemplazar se guarda `backups/tasky-antes-de-importar-<fecha>.json`.

**Navegador** (desarrollo y, en la Fase 8, PWA): mismo documento en `localStorage` mientras se desarrolla; IndexedDB en la PWA.

---

## 9. Plan de desarrollo por fases

Cada fase termina con verificación real (app en ejecución + tests de `core/`), actualización de esta guía y commit.

| Fase | Contenido | Criterio de cierre |
|---|---|---|
| **1. Planificación** ✅ | Requisitos, arquitectura, modelo de datos, esta guía. | Decisiones confirmadas. |
| **2. Base + identidad visual** ✅ | Scaffold Tauri + Vite + React + TS, ESLint, tokens, tipografía, logotipo, Inicio con datos de ejemplo. | Inicio en la ventana Tauri; logotipo aprobado. |
| **3. Core + persistencia + proyectos + atajos** ✅ | `core/` (modelo zod, ids, reloj, carga/validación), adaptadores Tauri y navegador, store, CRUD de proyectos, cambio de estado con un clic, página de proyecto (cabecera + pestañas), diálogos, confirmación de borrado, sistema de atajos (`P`, `Esc`, `Enter`, `?`) con ayuda visual, transiciones básicas. | CRUD verificado; datos sobreviven a reinicios; atajos funcionando; tests verdes. |
| **4. Tareas + fechas límite** ✅ | CRUD, `T`, estados, completar, fecha límite e indicadores, drag & drop con `rank`, completadas plegables, próxima fecha y vencidas en las tarjetas de Inicio. | CRUD, orden y fechas verificados y persistentes. |
| **5. Ideas** ✅ | CRUD, `I`, cuadrícula, diferenciación visual, estados vacíos. | CRUD verificado y persistente. |
| **6. Acabado UX** ✅ | Splash, pulido de animaciones, feedback, accesibilidad, backups e importación/exportación, revisión general. | Revisión visual y de teclado completa. |
| **7. Instalación Windows** ✅ | Build del instalador, instalación, buscador de Windows, anclaje, instrucciones paso a paso. | Instalada y anclada en este PC. |
| **8. Web móvil + PWA** | Adaptador IndexedDB, manifest, service worker, iconos iOS, interfaz móvil específica (barra inferior, botón «+», hojas, táctil). Probada en local, sin publicar. | Funciona en Safari de iPhone en red local. |
| **9. Supabase: privacidad + sync + hosting** | Proyecto Supabase, esquema, RLS y lista blanca, registro desactivado, login, sync local-first, hosting estático con HTTPS, instalación en iPhone. | Mismos datos en Windows e iPhone, offline y privado. |

---

## 10. Decisiones

### Confirmadas por el usuario
- **D1 — Windows:** app de escritorio con **Tauri 2**.
- **D5 — Almacenamiento local de escritorio:** documento JSON (alternativa descartada: SQLite; migrable más adelante cambiando solo `adapters/`).
- **D6 — iPhone:** **PWA** instalable desde Safari (sustituye la propuesta anterior de Tauri móvil, que exigiría Apple Developer). Interfaz móvil específica.
- **D7 — Sincronización:** **Supabase**, *local-first*, LWW por registro.
- **D8 — Acceso:** exclusivamente personal: autenticación obligatoria en la web, registro desactivado, RLS + lista blanca.
- **D9 — Fechas límite** opcionales en tareas, como `LocalDate`.
- **D10 — Atajos de una letra** contextuales (`P`, `T`, `I`) + `Enter`, `Esc`, `?` (§3.6). Sustituye al atajo `N` previsto antes.

### Técnicas (tomadas)
- Arquitectura en capas `core/` · `adapters/` · `state/` · `ui/`; solo `adapters/` conoce Tauri/Supabase.
- UUID v7, marcas UTC ISO 8601, borrado lógico, orden fraccional.
- `HashRouter`, fuentes e iconos locales (100 % offline).
- Guardado inmediato serializado y atómico (§8).
- Idioma de la interfaz: español.

### Por defecto (se aplican salvo que se indique lo contrario)
- **D2 — Copias de seguridad:** automáticas rotativas + exportar/importar JSON.
- **D3 — Estados de tarea:** Pendiente / En curso / Completada.
- **D4 — Vista de tareas:** lista ordenada única con completadas plegables.

---

## 11. Estado de implementación

| Funcionalidad | Estado |
|---|---|
| Fase 1 — Guía y planificación | ✅ |
| Fase 2 — Scaffold Tauri 2 + React 19 + Vite, ESLint (reglas de capas), Vitest | ✅ |
| Fase 2 — Tokens, tipografía Inter local, estilos globales | ✅ |
| Fase 2 — Logotipo «Sello» + iconos de Windows | ✅ |
| Fase 2 — Inicio (datos de ejemplo eliminados en la Fase 3) | ✅ |
| Fase 3 — Core (modelo zod, UUID v7, carga/validación/purga) + store con guardado inmediato serializado + adaptadores Tauri/navegador | ✅ Verificado en navegador, tests y app de escritorio (tasky.json escrito en AppData, sin restos de .tmp) |
| Fase 3 — Proyectos: crear (`P`), editar, estado con un clic, eliminar con confirmación, página con pestañas; atajos `P`, `Esc`, `Enter`, `Ctrl+Enter`, `?` y ayuda visual | ✅ |
| Fase 4 — Tareas: crear (`T`), editar, eliminar, estados (casilla y «En curso» en la fila), fecha límite con atajos Hoy/Mañana/En una semana, drag & drop con `rank`, completadas plegables, próxima fecha y vencidas en Inicio | ✅ |
| Fase 5 — Ideas: crear (`I`, cambia a la pestaña Ideas), editar, eliminar con confirmación; cuadrícula tipo nota con acento ámbar y fecha de creación relativa | ✅ |
| Fase 6 — Splash (trazo del sello, ~0,7 s, se omite con «reducir movimiento»), avisos (toasts), copias diarias rotativas, restaurar copia desde la pantalla de error, exportar/importar con confirmación; accesibilidad: contraste de `--text-faint`, flechas en las pestañas, títulos en botones de icono | ✅ Verificado en navegador y tests; compilación Rust correcta |
| Fase 7 — Instalador NSIS por usuario en español (1,8 MB), instancia única, instrucciones en README | ✅ Instalada en este PC: acceso en el menú Inicio (buscador), entrada en Aplicaciones, datos existentes cargados sin modificar, segunda apertura no crea otra instancia. Anclada a la barra de tareas por el usuario (Windows no permite anclar por programa); el usuario confirmó que se ve bien y que exportar a Descargas funciona. Se abre maximizada |
| Fase 8 — Web móvil + PWA | 🔒 Diseñada (§7.4) |
| Fase 9 — Supabase: privacidad + sync + hosting | 🔒 Diseñada (§7.5–7.6) |
