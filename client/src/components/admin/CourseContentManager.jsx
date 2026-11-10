import { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, Lock, Pencil, Plus, Trash2, Video } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Badge, Button, Checkbox, EmptyState, Input, Textarea } from '../common/ui.jsx';
import { Modal, ConfirmDialog } from '../common/Modal.jsx';
import { formatDuration } from '../../utils/format.js';

function ModuleModal({ open, onClose, courseId, module, onSaved }) {
  const toast = useToast();
  const [title, setTitle] = useState(module?.title || '');
  const [description, setDescription] = useState(module?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (module) await api.patch(`/admin/modules/${module.id}`, { title, description });
      else await api.post(`/admin/courses/${courseId}/modules`, { title, description });
      toast.success(module ? 'Module updated.' : 'Module added.');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.fieldErrors?.().title || err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={module ? 'Edit module' : 'Add module'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save module</Button></>}>
      <div className="space-y-4">
        <Input label="Module title" required value={title} onChange={(e) => setTitle(e.target.value)} error={error} />
        <Textarea label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </Modal>
  );
}

function LessonModal({ open, onClose, moduleId, lesson, modules, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: lesson?.title || '',
    description: lesson?.description || '',
    videoUrl: lesson?.videoUrl || '',
    minutes: lesson ? Math.round(lesson.durationSeconds / 60) : 10,
    isPreview: lesson?.isPreview || false,
    moduleId: lesson?.moduleId || moduleId,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const save = async () => {
    setSaving(true);
    setErrors({});
    const body = { title: form.title, description: form.description, videoUrl: form.videoUrl || null, durationSeconds: Math.max(0, Number(form.minutes) || 0) * 60, isPreview: form.isPreview };
    try {
      if (lesson) await api.patch(`/admin/lessons/${lesson.id}`, { ...body, moduleId: form.moduleId });
      else await api.post(`/admin/modules/${moduleId}/lessons`, body);
      toast.success(lesson ? 'Lesson updated.' : 'Lesson added.');
      onSaved();
      onClose();
    } catch (err) {
      setErrors({ ...(err.fieldErrors?.() || {}), form: err.message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={lesson ? 'Edit lesson' : 'Add lesson'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save lesson</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {errors.form && <p className="text-sm text-danger sm:col-span-2" role="alert">{errors.form}</p>}
        <Input label="Lesson title" required className="sm:col-span-2" value={form.title} onChange={set('title')} error={errors.title} />
        <Input label="Video URL (YouTube or Vimeo)" placeholder="https://www.youtube.com/watch?v=…" value={form.videoUrl} onChange={set('videoUrl')} error={errors.videoUrl} hint="Videos are embedded from the provider; they are not downloaded or rehosted." />
        <Input label="Duration (minutes)" type="number" min={0} value={form.minutes} onChange={set('minutes')} error={errors.durationSeconds} />
        {lesson && modules?.length > 1 && (
          <label className="space-y-1.5 text-[13px] font-medium sm:col-span-2">
            Module
            <select value={form.moduleId} onChange={set('moduleId')} className="block h-11 w-full rounded-[10px] border border-line bg-white px-3 text-sm">
              {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </label>
        )}
        <Textarea label="Lesson notes / description" className="sm:col-span-2" rows={5} value={form.description} onChange={set('description')} />
        <Checkbox className="sm:col-span-2" label="Free preview" description="Anyone can open this lesson without enrolling." checked={form.isPreview} onChange={set('isPreview')} />
      </div>
    </Modal>
  );
}

/** Module & lesson CRUD with ordering for a single course. */
export function CourseContentManager({ course, onChanged }) {
  const toast = useToast();
  const [moduleModal, setModuleModal] = useState(null); // {module?}
  const [lessonModal, setLessonModal] = useState(null); // {moduleId, lesson?}
  const [confirm, setConfirm] = useState(null); // {type, item}
  const [busy, setBusy] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [locking, setLocking] = useState(false);
  const modules = course.modules || [];
  const isLocked = Boolean(course.curriculumLocked);
  const lessonCount = modules.reduce((count, module) => count + module.lessons.length, 0);

  const move = async (list, index, dir, url) => {
    if (isLocked) return;
    const ids = list.map((x) => x.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    try {
      await api.put(url, { orderedIds: ids });
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(confirm.type === 'module' ? `/admin/modules/${confirm.item.id}` : `/admin/lessons/${confirm.item.id}`);
      toast.success(`${confirm.type === 'module' ? 'Module' : 'Lesson'} deleted.`);
      setConfirm(null);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const lockCurriculum = async () => {
    setLocking(true);
    try {
      const response = await api.post(`/admin/courses/${course.id}/lock-curriculum`);
      const count = response.data.data.certificatesIssued;
      toast.success(`Course curriculum locked. ${count} course certificate${count === 1 ? '' : 's'} automatically issued.`);
      setConfirmLock(false);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLocking(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{modules.length} modules · {lessonCount} lessons</p>
        {!isLocked && <Button icon={Plus} size="sm" onClick={() => setModuleModal({})}>Add module</Button>}
      </div>
      {isLocked ? (
        <Alert tone="success" title="Course curriculum locked">
          Modules and lessons can no longer be added, edited, deleted, or reordered. Course certificates are issued automatically when learners complete every lesson.
        </Alert>
      ) : (
        <Alert tone="warning" title="Lock the curriculum when it is final">
          Locking prevents any further module or lesson changes. Learners who have completed every lesson will receive their certificates automatically.
          <Button className="ml-3 mt-3" icon={Lock} size="sm" variant="outline" disabled={!lessonCount} onClick={() => setConfirmLock(true)}>Lock course curriculum</Button>
          {!lessonCount && <p className="mt-2 text-xs">Add at least one lesson before locking the curriculum.</p>}
        </Alert>
      )}
      <div className="mt-4">
      {modules.length === 0 ? (
        <EmptyState title="No modules yet" description={isLocked ? 'This curriculum is locked and has no modules.' : 'Add a module, then add lessons to it.'} action={!isLocked && <Button icon={Plus} onClick={() => setModuleModal({})}>Add first module</Button>} />
      ) : (
        <ol className="space-y-4">
          {modules.map((m, mi) => (
            <li key={m.id} className="rounded-xl border border-line bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <span className="grid size-7 place-items-center rounded-lg bg-primary-light text-xs font-bold text-primary">{mi + 1}</span>
                <p className="min-w-0 flex-1 font-semibold">{m.title}</p>
                <div className="flex items-center gap-1">
                  <IconBtn label="Move module up" onClick={() => move(modules, mi, -1, `/admin/courses/${course.id}/modules/order`)} disabled={isLocked || mi === 0}><ArrowUp className="size-4" /></IconBtn>
                  <IconBtn label="Move module down" onClick={() => move(modules, mi, 1, `/admin/courses/${course.id}/modules/order`)} disabled={isLocked || mi === modules.length - 1}><ArrowDown className="size-4" /></IconBtn>
                  <IconBtn label="Edit module" onClick={() => setModuleModal({ module: m })} disabled={isLocked}><Pencil className="size-4" /></IconBtn>
                  <IconBtn label="Delete module" danger onClick={() => setConfirm({ type: 'module', item: m })} disabled={isLocked}><Trash2 className="size-4" /></IconBtn>
                </div>
              </div>
              <ul className="divide-y divide-line">
                {m.lessons.map((l, li) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                    <span className="w-6 text-xs text-muted">{li + 1}.</span>
                    <span className="min-w-0 flex-1">{l.title}</span>
                    {l.videoUrl && <Video className="size-4 text-primary" aria-label="Has video" />}
                    {l.isPreview && <Badge icon={Eye}>Preview</Badge>}
                    <span className="text-xs text-muted">{formatDuration(l.durationSeconds)}</span>
                    <IconBtn label="Move lesson up" onClick={() => move(m.lessons, li, -1, `/admin/modules/${m.id}/lessons/order`)} disabled={isLocked || li === 0}><ArrowUp className="size-4" /></IconBtn>
                    <IconBtn label="Move lesson down" onClick={() => move(m.lessons, li, 1, `/admin/modules/${m.id}/lessons/order`)} disabled={isLocked || li === m.lessons.length - 1}><ArrowDown className="size-4" /></IconBtn>
                    <IconBtn label="Edit lesson" onClick={() => setLessonModal({ moduleId: m.id, lesson: l })} disabled={isLocked}><Pencil className="size-4" /></IconBtn>
                    <IconBtn label="Delete lesson" danger onClick={() => setConfirm({ type: 'lesson', item: l })} disabled={isLocked}><Trash2 className="size-4" /></IconBtn>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-2.5">
                {!isLocked && <button type="button" onClick={() => setLessonModal({ moduleId: m.id })} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Plus className="size-4" /> Add lesson</button>}
              </div>
            </li>
          ))}
        </ol>
      )}
      </div>
      {moduleModal && <ModuleModal open onClose={() => setModuleModal(null)} courseId={course.id} module={moduleModal.module} onSaved={onChanged} />}
      {lessonModal && <LessonModal open onClose={() => setLessonModal(null)} moduleId={lessonModal.moduleId} lesson={lessonModal.lesson} modules={modules} onSaved={onChanged} />}
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        loading={busy}
        title={`Delete ${confirm?.type}?`}
        confirmLabel="Delete"
        message={confirm?.type === 'module' ? `"${confirm?.item.title}" and all of its lessons (and learners' progress on them) will be permanently deleted.` : `"${confirm?.item.title}" and learners' progress on it will be permanently deleted.`}
      />
      <ConfirmDialog
        open={confirmLock}
        onClose={() => setConfirmLock(false)}
        onConfirm={lockCurriculum}
        loading={locking}
        title="Lock this course curriculum?"
        confirmLabel="Lock curriculum"
        message="This cannot be undone. No modules or lessons can be added, edited, deleted, or reordered after locking. Learners who have completed every lesson will receive a course certificate automatically."
      />
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`grid size-8 place-items-center rounded-lg text-muted disabled:opacity-30 ${danger ? 'hover:bg-danger-light hover:text-danger' : 'hover:bg-primary-light hover:text-primary'}`}>
      {children}
    </button>
  );
}
