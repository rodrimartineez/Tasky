/** Atajos disponibles, agrupados por contexto. Fuente única de la ayuda (y de TASKY_GUIDE §3.6). */
export const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'Inicio',
    items: [{ keys: ['P'], label: 'Nuevo proyecto' }],
  },
  {
    title: 'Proyecto',
    items: [
      { keys: ['T'], label: 'Nueva tarea (dentro de una fase, en esa fase)' },
      { keys: ['F'], label: 'Nueva fase' },
      { keys: ['I'], label: 'Nueva idea' },
      { keys: ['Esc'], label: 'Volver a Inicio (desde una fase, al proyecto)' },
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
