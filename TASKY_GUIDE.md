# TASKY_GUIDE.md

> Documento de referencia del proyecto. Se consulta antes de cada fase y se actualiza al terminarla.
> Última actualización: 2026-11-06 — **Fases 1–9 completadas + integración con Claude (MCP, §7.7) + franja horaria, «Hoy», siguiente tarea y orden manual de proyectos (§3.2, §3.5) + programación de tareas, vista de detalle y estado «Próximos» (2026-11-10).** Tasky instalada en Windows y publicada como PWA en https://tasky-2dd.pages.dev (iPhone), sincronizada con Supabase, privada y con funcionamiento sin conexión.

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
├── Hoy          (solo si hay algo programado o que vence hoy)
├── Activos      (tarjetas grandes, protagonistas)
├── En espera    (tarjetas compactas)
├── Próximos     (tarjetas compactas)
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
| Crear | Tecla **P** o botón → diálogo pequeño con el foco ya en el nombre. Nombre (obligatorio), descripción (opcional) y estado (por defecto *Activo*). Enter crea. |
| Editar | Nombre, descripción y estado (mismo diálogo). |
| Cambiar estado | `active` · `on_hold` · `upcoming` · `done` (Activo · En espera · Próximo · Finalizado), con un clic desde la cabecera del proyecto. «Próximo» = previsto para más adelante, aún sin empezar. |
| Eliminar | Con diálogo de confirmación. Elimina en cascada sus tareas e ideas. |
| Listar | Agrupados por estado en Inicio (más recientes primero). |
| Página propia | Ruta `/project/:id`. |

### 3.2 Tareas
| Requisito | Detalle |
|---|---|
| Campos | Título (obligatorio), descripción (opcional), estado, **programación** («¿Cuándo lo harás?»: uno o varios días elegidos en el calendario, **franja horaria** —Mañana · Tarde · Noche · Día completo, por defecto «Día completo»— y **repetición semanal**), **fecha límite (opcional e independiente de la programación**: cuándo debe estar terminada; atajos Hoy · Mañana · Esta semana —domingo— o fecha del calendario nativo), orden, fecha de creación. Con repetición semanal la tarea aparece cada semana en los días de la semana elegidos, a partir del primero. |
| Crear | Tecla **T** (dentro de un proyecto) o botón → diálogo con foco en el título; descripción y fecha límite opcionales. Enter crea. |
| Ver / editar / eliminar | Tocar la tarea abre su **vista de detalle** (proyecto, estado, programación, franja, fecha límite, fechas; botón «Editar»). Editar y eliminar (con confirmación) están en el menú **«···»** de la fila. En táctil, **deslizar la fila a la izquierda**: un poco deja ver una franja roja con papelera (pulsarla borra; tocar la fila la cierra); más de la mitad del ancho borra al soltar. No se activa con el ratón (allí se arrastra para ordenar) ni desde el asa. Componente común `ui/components/SwipeToDelete`. |
| Estados | `todo` (Pendiente) · `in_progress` (En curso) · `done` (Completada). |
| Completar | Checkbox de un clic en la propia fila: el check se dibuja (~260 ms) y la tarea pasa a «Completadas». Botón ▶ en la fila para marcar/quitar «En curso» con un clic. |
| Reordenar | Drag & drop: con el ratón desde cualquier punto de la fila; con teclado desde el asa (`Espacio` para coger, flechas para mover, `Espacio` para soltar); en táctil desde el asa. El orden define la secuencia de trabajo. |
| Visualización | Lista única: abiertas arriba en su orden; completadas en una sección plegable. Cada fila: título, descripción (si existe), estado, franja (si no es «Día completo») y fecha límite (si existe). |

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
| Editar / eliminar | Clic en la idea → mismo diálogo. Sin estado ni orden manual (más recientes primero). En táctil, deslizar a la izquierda para borrar, igual que las tareas. |
| Diferenciación visual | Tarjetas tipo nota en cuadrícula, icono de bombilla, acento ámbar suave, sin checkbox. |

### 3.5 Pantalla principal
- Sin login en escritorio. Es la primera pantalla al abrir.
- Sección **Hoy** antes de los proyectos, **solo si hay alguna tarea para hoy**: tareas pendientes y en curso programadas para hoy (también por repetición semanal) o que vencen hoy, agrupadas por franja (Mañana, Tarde, Noche, Día completo; solo las franjas con tareas). Cada fila: punto con el color del proyecto, título, «En curso» si lo está y nombre del proyecto; al pulsarla se abre el proyecto. Las completadas no aparecen. En móvil, las franjas van en un solo bloque.
- Cuatro secciones, en este orden: Activos (mayor protagonismo), En espera, Próximos, Finalizados. Cada una se pliega o despliega por separado pulsando su cabecera; lo plegado se recuerda en cada dispositivo (`localStorage`, no se sincroniza).
- **Orden manual de proyectos:** mantener pulsada una tarjeta (~250 ms, ratón o dedo) y arrastrarla; las demás se apartan en tiempo real. Se ordena dentro de cada sección. Un clic normal sigue abriendo el proyecto y soltar no lo abre. Los proyectos nuevos aparecen los primeros; los que nunca se han ordenado van detrás, del más reciente al más antiguo. El orden se guarda en `Project.rank` (índice fraccional, como las tareas) y se sincroniza.
- Tarjeta de proyecto: punto de color, nombre, descripción breve, **siguiente tarea** (la primera no completada según el orden manual; sin tareas pendientes no se muestra), estado, nº tareas pendientes, nº completadas, barra de progreso, próxima fecha límite y nº de vencidas (si existen).
- **Color de proyecto:** se deriva del id (paleta fija de 10 colores, `ui/projects/projectColor.ts`); no se guarda, así que es el mismo en todos los dispositivos.
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
| `T` | Página de proyecto o de fase | Nueva tarea (abre la pestaña Tareas si hace falta; dentro de una fase, en esa fase) |
| `F` | Página de proyecto | Nueva fase (puede incorporar tareas existentes) |
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
type ProjectStatus = 'active' | 'on_hold' | 'upcoming' | 'done';
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
  rank: string | null;        // orden manual en Inicio (null = aún sin ordenar)
}

interface Task extends BaseRecord {
  projectId: string;          // → Project.id
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: LocalDate | null;  // fecha límite opcional
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'all_day';  // franja; los datos anteriores se leen como 'all_day'
  scheduledDays: LocalDate[]; // programación: días en que se hará (ordenados); los datos anteriores se leen como []
  repeatWeekly: boolean;      // repetir cada semana en esos días de la semana; por defecto false
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

### 7.2 Estado
Todo lo previsto está implementado (Fases 1–9). Posibles mejoras futuras, no planificadas: Cloudflare Access delante del sitio, Supabase Realtime, LWW por campo. Integración con Claude por MCP: implementada (§7.7).

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
- **Implementado (Fase 8):**
  - `adapters/webStorage.ts`: el documento JSON en **IndexedDB** (base `tasky`, almacén `documents`, clave `data`). Migra solo los datos que hubiera en `localStorage` (`tasky:data`) y pide almacenamiento persistente (`navigator.storage.persist`).
  - `vite-plugin-pwa` (`vite.config.ts`): manifest (`standalone`, vertical, colores `#0A0A0B`), service worker Workbox que precachea la app completa (JS, CSS, fuentes, iconos) → funciona sin conexión. El registro lo hace `adapters/index.ts` solo en navegador y solo en el build (nunca en Tauri ni en `npm run dev`). Versión nueva: se activa al abrir la app y recarga una vez (`skipWaiting` + `clientsClaim`).
  - Iconos en `public/icons/` (180 `apple-touch-icon`, 192, 512, 512 *maskable*), generados con `tauri icon` desde `src-tauri/icons/source/tasky-icon-pwa.svg` (sello sobre fondo gris carbón `#27272A`, más claro que el de la app, con margen para recortes).
  - `index.html`: `viewport-fit=cover`, `theme-color`, metas `apple-mobile-web-app-*` (barra de estado translúcida). La cabecera respeta `safe-area-inset-top`; la barra inferior, las hojas y el botón «+», `safe-area-inset-bottom`.
  - Interfaz móvil (≤ 640 px, `useMediaQuery`): en Inicio, «Nuevo proyecto» pasa al botón flotante «+»; en un proyecto, las pestañas Tareas/Ideas pasan a una **barra inferior** fija y «Nueva tarea/idea» al «+». Barra y «+» se montan en `body` (portal) para que la transición de página no altere su posición fija. Los avisos se muestran arriba. En pantallas táctiles se ocultan los atajos y «Atajos».
  - Arrastre: ratón desde cualquier punto de la fila (`MouseSensor`); táctil solo desde el asa con pulsación de 150 ms (`TouchSensor`), así deslizar la lista nunca mueve tareas.
- **Probar en el iPhone (red local):** `npm run build` y `npx vite preview --host --port 4173` → en el iPhone (misma Wi-Fi) abrir `http://<IP del PC>:4173`. Por HTTP el iPhone no permite service worker (exige HTTPS), así que el modo sin conexión en el iPhone se comprueba en la Fase 9 con el hosting HTTPS; en el PC se verificó con `localhost`.
- **Limitaciones conocidas de iOS:** el almacenamiento de una PWA puede borrarse si no se usa durante semanas → con Supabase (Fase 9) el servidor es la copia de seguridad y el móvil se rehidrata al abrir. Sin sync, la PWA en iPhone no tendría sentido como segundo dispositivo, por eso las Fases 8 y 9 se publican juntas.

### 7.5 Sincronización con Supabase (Fase 9)
**Modelo *local-first*:** cada dispositivo trabaja contra su almacenamiento local; la app nunca espera a la red.

**Esquema:** tablas `projects`, `tasks`, `ideas` que replican §6.1 (`snake_case`), más `user_id uuid` y `server_seq bigint` (asignado por un trigger con una secuencia en cada insert/update).

**Flujo implementado** (`core/sync.ts` puro + `state/sync.ts` + `adapters/supabaseSync.ts`; esquema en `supabase/schema.sql`):
1. **Al iniciar sesión o abrir la app: descarga completa** (`server_seq > 0`). Con un solo usuario son pocos KB, y así ningún dispositivo necesita guardar metadatos de sync: el mapa «id → versión que tiene el servidor» vive en memoria y se reconstruye en cada arranque.
2. **Merge** (`mergeRemote`): por registro gana el `updatedAt` más reciente; en empate, la versión del servidor. Después se reaplica la cascada (tarea o idea viva de un proyecto borrado en otro dispositivo → borrada).
3. **Push** (`pendingChanges`): se envían los registros cuya versión local no coincide con la del servidor (no depende de relojes). `upsert` por `id`; el trigger del servidor **ignora una versión igual o más antigua** que la suya (última escritura gana también en el servidor) y la app descarga la versión ganadora de esos registros.
4. **Pull incremental:** después, solo filas con `server_seq` mayor que el cursor (secuencia del servidor, independiente de los relojes). Se descartan los ecos de los propios envíos.
5. **Cuándo:** al iniciar sesión y al arrancar; 1,5 s después de un cambio local; **al momento cuando cambia algo en el servidor** (aviso de Supabase Realtime, agrupado 300 ms, también para los cambios de Claude por MCP); al volver a la app (`visibilitychange`, `focus`); al recuperar la red; y cada 60 s mientras está visible como respaldo por si se pierde un aviso. El aviso no trae datos: solo dispara la descarga incremental habitual, así que la lógica de mezcla es siempre la misma. Requiere las tablas en la publicación `supabase_realtime` (bloque final de `schema.sql`); los avisos respetan RLS.
6. **Sin conexión:** los cambios quedan en local; el indicador de la cabecera muestra «Sin conexión» y se envían al volver la red. Con un token caducado y sin red, la sesión guardada sigue permitiendo trabajar en local.
7. **Indicador** (`ui/sync/SyncButton.tsx`): nube con ✓ (sincronizado), girando (sincronizando), tachada (sin conexión / desactivada), alerta (error). Menú: «Sincronizar ahora», «Cerrar sesión»; en escritorio sin sesión, «Activar sincronización…».

**Casos límite:** misma tarea editada en dos dispositivos → gana la última edición; reordenaciones simultáneas → cada tarea conserva su último `rank`; tarea creada en un proyecto borrado en otro dispositivo → borrada por la cascada; relojes desajustados → riesgo bajo con un usuario (sustituible por HLC en `clock.ts`). Las lápidas se purgan en local a los 30 días pero el servidor las conserva (vuelven como borradas en la descarga completa: inofensivo).

**Configuración:** `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` (clave *publishable*, pública por diseño; se versiona porque la necesita el build de Cloudflare). Sin `.env`, la app funciona solo en local, como antes.

### 7.6 Privacidad y acceso restringido (Fase 9)
- **Autenticación obligatoria** en la web: sin sesión válida solo se muestra la pantalla de acceso; no se carga ni se muestra ningún dato.
- **Sin registro público:** en Supabase se desactiva *Allow new users to sign up*; la única cuenta se crea manualmente desde el panel. La UI no tiene pantalla de registro.
- **RLS en todas las tablas** (`enable` + `force row level security`): políticas `using`/`with check (user_id = auth.uid() and private.is_allowed())` para select/insert/update, solo para `authenticated`. `anon` no tiene permisos sobre las tablas. **Sin DELETE**: el borrado es lógico, así que ni la propia cuenta puede destruir filas.
- **Lista blanca:** tabla `private.allowed_users` (esquema no expuesto por la API) + función `private.is_allowed()`; aunque alguien consiguiera crear una cuenta, no vería ni escribiría nada.
- **Verificado (2026-11-06):** sin sesión, leer o escribir `projects`/`tasks`/`ideas` → `permission denied`; `allowed_users` e `is_allowed` no son accesibles por la API; `disable_signup: true`; credenciales incorrectas → «Email o contraseña incorrectos.».
- **Cerrar sesión en la web** borra los datos del dispositivo (antes intenta enviar lo pendiente y, si no puede, pide confirmación). En escritorio, cerrar sesión solo desactiva la sync y conserva los datos.
- **Claves:** en el cliente solo la *anon/publishable key* (pública por diseño; la protección es RLS). La *service role key* nunca sale del panel de Supabase.
- **Hosting de la PWA:** sitio estático gratuito (Cloudflare Pages, Netlify o Vercel) con HTTPS. Los archivos de la app son públicos pero no contienen datos. Opcional: Cloudflare Access delante del sitio para que ni siquiera la pantalla de acceso sea visible a terceros.
- **Sesión:** Supabase Auth con **email + contraseña** (el enlace mágico se descartó: en iPhone abre Safari y no la PWA instalada). La sesión se guarda en el dispositivo, se renueva sola y se cierra desde el indicador de sincronización. En escritorio es opcional (activa la sync).
- **Plan gratuito de Supabase:** el proyecto se pausa tras 7 días sin uso; Tasky sigue funcionando en local y la sync vuelve al reactivarlo desde el panel.

### 7.7 Integración con Claude (MCP)
Permite gestionar Tasky conversando con la app oficial de Claude (también desde el iPhone con dictado, con el ordenador apagado) y desde **Claude Code**, que puede crear la estructura de trabajo de un proyecto y actualizar su progreso mientras lo desarrolla. Solo requiere la suscripción Claude Pro (conectores personalizados); **no** usa la API de Anthropic.

```
Claude (nube de Anthropic) ──OAuth──▶ Supabase Auth (servidor OAuth 2.1, beta) ◀── /oauth/consent en la PWA
        │ token del usuario
        ▼
Edge Function tasky-mcp (Supabase, plan gratuito) ──RLS──▶ projects / tasks / ideas
                                                             │ sincronización existente
                                                             ▼
                                   Tasky Windows y PWA (al momento por Realtime; respaldo cada 60 s)
```

- **Código:** `src/mcp/service.ts` (operaciones sobre las funciones de `core/`: `createTask`, `updateTask`, `deleteTask`, `createIdea`…, y `pendingChanges` para guardar solo lo que cambia), `src/mcp/server.ts` (16 herramientas MCP con anotaciones e instrucciones), `src/mcp/edge.ts` (repositorio sobre `adapters/supabaseRows.ts`, el mismo módulo de filas que usa la sincronización de la app). `supabase/functions/tasky-mcp/index.ts` envuelve todo con `@supabase/server`.
- **Herramientas (16):**
  - Proyectos: `get_projects` (incluye `next_task`), `get_project`, `get_project_by_name` (sin mayúsculas ni acentos; `certain=false` → Claude debe preguntar), `create_project` (solo si el usuario lo pide; estado opcional), `update_project` (nombre, descripción, estado). No hay herramienta para borrar proyectos: se finalizan o se ponen en espera.
  - Tareas: `get_tasks`, `create_task`, `create_tasks` (hasta 50 de una vez, en orden y en una sola escritura: para desglosar un proyecto), `update_task` (título, descripción, fecha límite, programación —`scheduled_days`, `repeat_weekly`—, franja, estado), `move_task` (posición en el orden de trabajo; 1 = la siguiente), `complete_task`, `delete_task`.
  - Ideas: `get_ideas`, `create_idea`, `update_idea`, `delete_idea`.
  - Crear tareas o ideas exige el id real de un proyecto vivo.
- **Sin duplicados al repetir:** `create_project` devuelve el proyecto existente si ya hay uno con ese nombre (sin mayúsculas ni acentos); `create_task(s)` no duplica una tarea **abierta** con el mismo título en el proyecto (sí permite repetir el título de una completada); `create_idea` no duplica una idea con el mismo título. Lo existente vuelve en `already_existed`. Así un reintento tras un corte es seguro. `update_project` impide renombrar a un nombre ya usado.
- **Errores:** los de negocio vuelven como mensaje legible (`ToolError`); los de red o de Supabase como «Sin conexión.» / «Error del servidor: …» + «Reintenta la operación: repetirla no duplica nada». Si otro dispositivo cambió el mismo elemento a la vez, se avisa en vez de pisarlo.
- **Instrucciones del servidor:** consultar antes de actuar, preguntar si el proyecto es dudoso o si no está claro si es tarea o idea, crear proyectos solo si el usuario lo pide, desglosar con `create_tasks` en orden de trabajo, marcar `in_progress` al empezar y `done` **solo cuando el trabajo esté terminado y verificado** (si no, dejarla en curso explicando qué falta), títulos accionables sin inventar detalles, confirmar al final qué se ha hecho.
- **Seguridad:** el servidor usa el token OAuth del usuario (ES256, verificado con el JWKS del proyecto): todas las operaciones pasan por RLS (dueño + lista blanca). Nunca usa la clave service_role. Sin token → 401 con `WWW-Authenticate` (descubrimiento RFC 9728). La autorización se aprueba en `/oauth/consent` (muestra la aplicación, la cuenta y el destino de vuelta). El borrado sigue siendo lógico. Lecturas marcadas `readOnlyHint`; eliminaciones `destructiveHint` (en Claude: «Needs approval»).
- **Configuración en Supabase:** Authentication → URL Configuration → Site URL `https://tasky-2dd.pages.dev`; Authentication → OAuth Server activado, Authorization path `/oauth/consent`, registro dinámico de clientes activado. Claves de firma asimétricas (ES256, ya activas).
- **Desplegar:** `npm run mcp:deploy` (empaqueta `src/mcp/edge.ts` con `vite.mcp.config.ts` en `supabase/functions/tasky-mcp/dist/` y publica con la CLI de Supabase, `--no-verify-jwt`). Requiere `npx supabase@latest login` una vez. Tras cambiar `core/` o `src/mcp/` hay que volver a desplegar.
- **En Claude:** claude.ai → Customize → Connectors → Add custom connector → URL `https://yfcidccclkndbqhqpmzp.supabase.co/functions/v1/tasky-mcp`, OAuth client «Register automatically». Se añade desde la web; en la app del iPhone se usa ya configurado. Usar el **dictado** (no el modo voz, que no garantiza llamar a herramientas).
- **En Claude Code:** registrado a nivel de usuario (todas las sesiones y proyectos) con `claude mcp add --transport http --scope user tasky https://yfcidccclkndbqhqpmzp.supabase.co/functions/v1/tasky-mcp`. La primera vez hay que iniciar sesión: `/mcp` → tasky → Authenticate (abre `/oauth/consent` en la web; hay que tener la sesión de Tasky iniciada en ese navegador). Ejemplo: «Vamos a desarrollar este proyecto, crea su estructura de trabajo en Tasky» → `get_project_by_name` → `create_project` → `create_tasks` → `update_task`/`complete_task` según avanza y se verifica.
- **Nunca editar `tasky.json` desde Claude Code:** en este PC Claude Code se ejecuta dentro del paquete MSIX de la app de Claude y Windows desvía sus escrituras en `%APPDATA%` a una copia privada (`%LOCALAPPDATA%\Packages\Claude_…\LocalCache`) que Tasky no lee; además, Supabase es la fuente de verdad. Todo cambio va por MCP.
- **Límites:** Edge Functions gratis: 500.000 invocaciones/mes y 2 s de CPU por petición; OAuth sin coste (cuenta como MAU). El servidor OAuth de Supabase está en **beta**. Si el proyecto se pausa (7 días sin uso), el conector falla hasta reactivarlo. Los mensajes con herramientas consumen más cuota de Claude Pro.
- **Actualización en las apps:** los cambios de Claude llegan al momento por Supabase Realtime a todas las apps abiertas (Windows, web, iPhone), sin reiniciar ni recargar. Una app en segundo plano o cerrada (p. ej. la PWA en iOS, que se suspende) los recibe al volver a primer plano (`visibilitychange`). Sin conexión, al recuperar la red.

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

**Navegador y PWA:** mismo documento JSON en IndexedDB (§7.4). Sin copias automáticas; exportar/importar funciona igual que en escritorio (descarga y selector de archivo).

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
| **8. Web móvil + PWA** ✅ | Adaptador IndexedDB, manifest, service worker, iconos iOS, interfaz móvil específica (barra inferior, botón «+», hojas, táctil). Probada en local, sin publicar. | Funciona en Safari de iPhone en red local. |
| **9. Supabase: privacidad + sync + hosting** ✅ | Proyecto Supabase, esquema, RLS y lista blanca, registro desactivado, login, sync local-first, hosting estático con HTTPS, instalación en iPhone. | Mismos datos en Windows e iPhone, offline y privado. |

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
| Fase 8 — IndexedDB, manifest + service worker (offline), iconos iOS, zonas seguras, interfaz móvil (barra inferior, botón «+», avisos arriba), arrastre táctil desde el asa | ✅ PC: vista móvil, IndexedDB con migración, offline con el servidor apagado, actualización automática, escritorio sin cambios. iPhone (Safari, red local): interfaz, «+», barra, hojas, arrastre y «Añadir a pantalla de inicio» confirmados por el usuario. Offline en iPhone pendiente de HTTPS (Fase 9) |
| Fase 9 — Supabase (esquema con RLS, lista blanca, sin DELETE, LWW en servidor), registro desactivado, login email + contraseña (obligatorio en web, opcional en escritorio), sync local-first, indicador de estado; hosting en Cloudflare Pages (`tasky-2dd.pages.dev`, publica solo al subir a `main`) con CSP y cabeceras de seguridad | ✅ Verificado: acceso anónimo denegado, registro cerrado, sync Windows ↔ navegador en ambos sentidos (crear y borrar), web publicada sin errores de CSP. iPhone: instalación, sincronización y modo sin conexión confirmados por el usuario |
| Integración con Claude (MCP) — Edge Function `tasky-mcp` con 12 herramientas sobre `core/`, OAuth 2.1 de Supabase, página `/oauth/consent` | ✅ 10 tests (servicio y protocolo HTTP); desplegada: sin token → 401 con metadatos OAuth; conector añadido en claude.ai y funcionando (confirmado por el usuario) |
| Franja horaria, sección «Hoy» y siguiente tarea en las tarjetas — `timeSlot` en core (zod con valor por defecto, sin cambio de versión de esquema), columna `time_slot` en Supabase, `time_slot` en `create_task`/`update_task` y `next_task` en `get_projects` del MCP | ✅ 48 tests; navegador (escritorio y móvil): crear con franja, editar conservándola, reordenar actualiza la siguiente tarea, completadas excluidas de «Hoy» |
| Orden manual de proyectos en Inicio — `rank` en `Project` (core + columna `rank` en Supabase), mantener pulsado y arrastrar con dnd-kit (ratón y táctil), el MCP devuelve los proyectos en el mismo orden | ✅ 50 tests; navegador: arrastre con ratón y con toque simulado, movimiento en tiempo real, el orden persiste, soltar no abre el proyecto y el clic normal sí |
| Secciones de proyectos plegables por separado en Inicio (estado recordado por dispositivo) | ✅ Navegador: plegar y desplegar cada sección, se mantiene al recargar, sin recorte de tarjetas al desplegar |
| Programación de tareas («¿Cuándo lo harás?»: días del calendario, franja, repetición semanal) separada de la fecha límite; «Hoy» solo si hay tareas; vista de detalle de tareas e ideas con menú «···»; estado de proyecto «Próximos»; hoja inferior que sigue al teclado en móvil (`visualViewport`) — columnas `scheduled_days`, `repeat_weekly` y estado `upcoming` en Supabase; MCP con `scheduled_days`/`repeat_weekly` y estado `upcoming` | ✅ 64 tests; navegador (vista móvil): crear con varios días + franja + repetición + fecha límite, editar sin cambios no modifica la tarea, detalle, menú «···» (editar, eliminar con confirmación) en tareas e ideas, deslizar sigue borrando, «Hoy» desaparece sin tareas, orden Activos · En espera · Próximos · Finalizados, campo enfocado visible con el área visible reducida a 420 px. Teclado real del iPhone pendiente de confirmar por el usuario |
| Deslizar a la izquierda para borrar tareas e ideas (táctil) + icono del iPhone con fondo más claro | ✅ Vista móvil con toques simulados: abrir la papelera, cerrar tocando, borrar deslizando del todo (tarea e idea); el asa no inicia el gesto; con ratón se sigue reordenando |
