import { useState } from 'react';
import type { Project, ProjectStatus } from '../../core/model';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { TextArea, TextField } from '../components/Field';
import { Segmented } from '../components/Segmented';
import { PROJECT_STATUS_OPTIONS } from '../components/StatusBadge';
import styles from '../components/Form.module.css';

interface ProjectFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Si se pasa, el diálogo edita este proyecto; si no, crea uno nuevo. */
  project?: Project;
}

export function ProjectFormDialog({ open, onClose, project }: ProjectFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={project ? 'Editar proyecto' : 'Nuevo proyecto'}>
      {/* Se monta al abrir: el formulario empieza siempre con los valores actuales. */}
      {open && <ProjectForm project={project} onDone={onClose} />}
    </Dialog>
  );
}

function ProjectForm({ project, onDone }: { project?: Project; onDone: () => void }) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'active');
  const createProject = useTasky((s) => s.createProject);
  const updateProject = useTasky((s) => s.updateProject);
  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    if (project) updateProject(project.id, { name, description, status });
    else createProject({ name, description, status });
    onDone();
  };

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextField
        label="Nombre"
        data-autofocus
        placeholder="¿En qué vas a trabajar?"
        value={name}
        maxLength={120}
        onChange={(e) => setName(e.target.value)}
      />
      <TextArea
        label="Descripción"
        optional
        placeholder="Una línea para recordar de qué va"
        value={description}
        maxLength={1000}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className={styles.field}>
        <span className={styles.label}>Estado</span>
        <Segmented label="Estado del proyecto" value={status} options={PROJECT_STATUS_OPTIONS} onChange={setStatus} />
      </div>
      <div className={styles.footer}>
        <span className={styles.spacer} />
        <Button variant="ghost" onClick={onDone} shortcut="Esc">
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit} shortcut="Enter">
          {project ? 'Guardar' : 'Crear proyecto'}
        </Button>
      </div>
    </form>
  );
}
