import { useRef, useState, type ReactNode } from 'react';
import { DatabaseBackup, Download, Upload } from 'lucide-react';
import { now } from '../../core/clock';
import { DataError, parseData } from '../../core/data';
import type { TaskyData } from '../../core/model';
import { useTasky } from '../../state/store';
import { useSync } from '../../state/sync';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Menu, type MenuItem } from '../components/Menu';
import { toast } from '../components/Toaster';

const count = <T extends { deletedAt: string | null }>(items: T[], one: string, many: string) => {
  const n = items.filter((i) => !i.deletedAt).length;
  return `${n} ${n === 1 ? one : many}`;
};
const summary = (d: TaskyData) =>
  `${count(d.projects, 'proyecto', 'proyectos')}, ${count(d.tasks, 'tarea', 'tareas')} y ${count(d.ideas, 'idea', 'ideas')}`;

/**
 * Copias de seguridad manuales: exportar todos los datos a un archivo e importarlos desde uno. Devuelve las opciones del
 * menú y los elementos que necesitan (selector de archivo y confirmación), que hay que dibujar junto al menú.
 */
export function useBackupMenu(): { items: MenuItem[]; extra: ReactNode } {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<TaskyData | null>(null);
  const current = useTasky((s) => s.data);

  const exportData = async () => {
    try {
      toast(`Copia guardada en ${await useTasky.getState().exportData()}`);
    } catch (e) {
      console.error(e);
      toast('No se pudo exportar la copia.', 'error');
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending(parseData(JSON.parse(await file.text()), now()));
    } catch (e) {
      toast(e instanceof DataError ? e.message : 'Ese archivo no es una copia de Tasky válida.', 'error');
    }
  };

  const items: MenuItem[] = [
    { label: 'Exportar copia', icon: <Download />, onSelect: exportData },
    { label: 'Importar copia…', icon: <Upload />, onSelect: () => fileInput.current?.click() },
  ];

  const extra = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <ConfirmDialog
        open={pending !== null}
        title="¿Reemplazar todos tus datos?"
        description={
          pending &&
          `La copia contiene ${summary(pending)}. Sustituirá a lo que tienes ahora (${summary(current)}). Antes se guardará una copia de seguridad de tus datos actuales.`
        }
        confirmLabel="Importar copia"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          const data = pending;
          setPending(null);
          if (!data) return;
          await useTasky.getState().importData(data);
          toast('Copia importada.');
        }}
      />
    </>
  );
  return { items, extra };
}

/** Sin sincronización (build sin Supabase) las copias tienen su propio botón; con ella van dentro del menú de la nube. */
export function DataMenu() {
  const { items, extra } = useBackupMenu();
  const syncEnabled = useSync((s) => s.status !== 'disabled');
  if (syncEnabled) return null;
  return (
    <>
      <Menu label="Copias de seguridad" trigger={<DatabaseBackup />} items={items} />
      {extra}
    </>
  );
}
