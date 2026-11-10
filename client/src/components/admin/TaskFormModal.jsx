import { useMemo, useState } from 'react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Button, Checkbox, Input, Select, Textarea } from '../common/ui.jsx';
import { Modal } from '../common/Modal.jsx';
import { linesToList, listToLines } from './AdminKit.jsx';
import { formatDate } from '../../utils/format.js';

const TYPES = [['text', 'Written explanation'], ['repository', 'Repository URL'], ['live', 'Live project URL'], ['file', 'File upload']];

/**
 * Create/edit an internship task. Dates are chosen from the program's working days; a non-working
 * day requires an explicit exception. Changing a released task's schedule or marks requires a reason.
 */
export function TaskFormModal({ open, onClose, program, task, defaultDate, onSaved }) {
  const toast = useToast();
  const days = useMemo(() => program?.schedule?.days || [], [program]);
  const [form, setForm] = useState(() => ({
    title: task?.title || '',
    description: task?.description || '',
    instructions: task?.instructions || '',
    requirements: listToLines(task?.requirements),
    acceptanceCriteria: listToLines(task?.acceptanceCriteria),
    skills: (task?.skills || []).join(', '),
    resources: (task?.resources || []).map((r) => `${r.label} | ${r.url}`).join('\n'),
    submissionTypes: task?.submissionTypes || ['text', 'repository', 'live', 'file'],
    maxMarks: task?.maxMarks ?? 10,
    isRequired: task?.isRequired ?? true,
    scheduledDate: task?.scheduledDate || defaultDate || days.find((d) => d.isWorkingDay)?.date || '',
    allowNonWorkingDay: false,
    status: task?.status === 'published' ? 'published' : 'draft',
    changeReason: '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const released = task && task.status === 'published' && new Date(task.availableAt) <= new Date();
  const selectedDay = days.find((d) => d.date === form.scheduledDate);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const resources = linesToList(form.resources).map((line) => {
      const [label, url] = line.includes('|') ? line.split('|').map((s) => s.trim()) : [line.trim(), line.trim()];
      return { label, url };
    });
    const body = {
      title: form.title,
      description: form.description,
      instructions: form.instructions,
      requirements: linesToList(form.requirements),
      acceptanceCriteria: linesToList(form.acceptanceCriteria),
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      resources,
      submissionTypes: form.submissionTypes,
      maxMarks: Number(form.maxMarks),
      isRequired: form.isRequired,
      ...(task && form.scheduledDate === task.scheduledDate ? {} : { scheduledDate: form.scheduledDate }),
      ...(form.allowNonWorkingDay ? { allowNonWorkingDay: true } : {}),
    };
    try {
      if (task) {
        await api.patch(`/admin/internship-tasks/${task.id}`, { ...body, changeReason: form.changeReason || undefined });
        if (form.status !== task.status && !(task.status === 'archived')) await api.post(`/admin/internship-tasks/${task.id}/status`, { status: form.status });
      } else {
        await api.post(`/admin/internships/${program.id}/tasks`, { ...body, status: form.status });
      }
      toast.success(task ? 'Task updated.' : 'Task created.');
      onSaved();
      onClose();
    } catch (err) {
      setErrors({ ...(err.fieldErrors?.() || {}), form: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={task ? 'Edit task' : 'New task'} description={program?.title} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>{task ? 'Save task' : 'Create task'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {errors.form && <Alert tone="danger" className="sm:col-span-2">{errors.form}</Alert>}
        <Input label="Title" required className="sm:col-span-2" value={form.title} onChange={set('title')} error={errors.title} />
        <Select label="Scheduled date" value={form.scheduledDate} onChange={set('scheduledDate')} error={errors.scheduledDate}>
          {days.map((d) => (
            <option key={d.date} value={d.date}>
              W{d.weekNumber} · {d.weekdayName.slice(0, 3)} {formatDate(d.date, { day: 'numeric', month: 'short' })}{d.isWorkingDay ? '' : d.dayType === 'holiday' ? ` — holiday (${d.holidayName})` : ' — day off'}
            </option>
          ))}
        </Select>
        <Input label="Maximum marks" type="number" min={1} max={1000} value={form.maxMarks} onChange={set('maxMarks')} error={errors.maxMarks} />
        {selectedDay && !selectedDay.isWorkingDay && (
          <div className="sm:col-span-2">
            <Alert tone="warning" title="Not a working day">{selectedDay.date} is a {selectedDay.dayType === 'holiday' ? `holiday (${selectedDay.holidayName})` : 'day off'}. Tasks are normally only scheduled on working days.</Alert>
            <Checkbox className="mt-2" label="Allow this exception" checked={form.allowNonWorkingDay} onChange={set('allowNonWorkingDay')} />
          </div>
        )}
        <p className="text-xs text-muted sm:col-span-2">Release and due times are set from the program schedule ({program?.scheduleConfig?.releaseTime}–{program?.scheduleConfig?.dueTime}, {program?.timezone}).</p>
        <Textarea label="Short description" required className="sm:col-span-2" rows={2} value={form.description} onChange={set('description')} error={errors.description} />
        <Textarea label="Instructions" required className="sm:col-span-2" rows={5} value={form.instructions} onChange={set('instructions')} error={errors.instructions} />
        <Textarea label="Requirements (one per line)" rows={3} value={form.requirements} onChange={set('requirements')} />
        <Textarea label="Acceptance criteria (one per line)" rows={3} value={form.acceptanceCriteria} onChange={set('acceptanceCriteria')} />
        <Input label="Skills (comma-separated)" value={form.skills} onChange={set('skills')} />
        <Textarea label="Reference materials (Label | URL per line)" rows={2} value={form.resources} onChange={set('resources')} error={errors.resources} />
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-[13px] font-medium">Accepted submission types</legend>
          <div className="flex flex-wrap gap-4">
            {TYPES.map(([v, l]) => (
              <Checkbox key={v} label={l} checked={form.submissionTypes.includes(v)} onChange={(e) => setForm((f) => ({ ...f, submissionTypes: e.target.checked ? [...f.submissionTypes, v] : f.submissionTypes.filter((x) => x !== v) }))} />
            ))}
          </div>
        </fieldset>
        <Checkbox label="Required task" description="Required tasks count toward completion and the final score." checked={form.isRequired} onChange={set('isRequired')} />
        <Select label="Status" value={form.status} onChange={set('status')} options={[{ value: 'draft', label: 'Draft (hidden from participants)' }, { value: 'published', label: 'Published' }, ...(task ? [{ value: 'archived', label: 'Archived' }] : [])]} />
        {released && (
          <Textarea label="Reason for change (required if you change the date, marks or required status)" className="sm:col-span-2" rows={2} value={form.changeReason} onChange={set('changeReason')} hint="Released tasks: changes are audited and participants are notified of deadline changes." />
        )}
      </div>
    </Modal>
  );
}
