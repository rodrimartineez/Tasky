/** Atajos disponibles, agrupados por contexto. Fuente única de la ayuda (y de TASKY_GUIDE §3.6). */
export const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'Inicio',
    items: [{ keys: ['P'], label: 'Nuevo proyecto' }],
  },
  {
    title: 'Proyecto',
    items: [
      { keys: ['T'], label: 'Nueva tarea' },
      { keys: ['I'], label: 'Nueva idea' },
      { keys: ['Esc'], label: 'Volver a Inicio' },
    ],
  },
  {
    title: 'Formularios',
    items: [
      { keys: ['Enter'], label: 'Confirmar' },
      { keys: ['Ctrl', 'Enter'], label: 'Confirmar desde la descripción' },
      { keys: ['Esc'], label: 'Cerrar sin guardar' },
    ],
  },
  {
    title: 'General',
    items: [{ keys: ['?'], label: 'Mostrar esta ayuda' }],
  },
];
