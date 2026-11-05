import { useState } from 'react';
import type { Project } from '../../core/model';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { TextArea, TextField } from '../components/Field';

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
  const createProject = useTasky((s) => s.createProject);
  const updateProject = useTasky((s) => s.updateProject);
  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    if (project) updateProject(project.id, { name, description });
    else createProject({ name, description });
    onDone();
  };

  return (
    <form
      style={{ display: 'contents' }}
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '4px 0 20px' }}>
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
