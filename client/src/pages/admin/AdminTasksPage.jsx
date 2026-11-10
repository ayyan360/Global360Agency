import { useState } from 'react';
import { Archive, Pencil, Send, Trash2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, EmptyState, PageHeader, StatusBadge } from '../../components/common/ui.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { ConfirmDialog } from '../../components/common/Modal.jsx';
import { FilterBar, FilterSelect, SearchInput } from '../../components/admin/AdminKit.jsx';
import { TaskFormModal } from '../../components/admin/TaskFormModal.jsx';
import { formatDate, formatDateTime, WEEKDAYS_SHORT } from '../../utils/format.js';

export default function AdminTasksPage() {
  useDocumentTitle('Internship Tasks');
  const toast = useToast();
  const [q, setQ] = useQueryState({ programId: '', status: '', week: '', search: '', page: 1 });
  const { data: programs } = useApi('/admin/internships', { params: { pageSize: 50 } });
  const programId = q.programId || programs?.[0]?.id || '';
  const { data: program, reload: reloadProgram } = useApi(programId ? `/admin/internships/${programId}` : null);
  const { data, meta, loading, error, reload } = useApi(programId ? '/admin/internship-tasks' : null, { params: { programId, status: q.status || undefined, week: q.week || undefined, search: q.search || undefined, page: q.page, pageSize: 25 } });
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const setStatus = async (t, status) => {
    try {
      await api.post(`/admin/internship-tasks/${t.id}/status`, { status });
      toast.success(`Task ${status === 'published' ? 'published' : status}.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/internship-tasks/${confirm.id}`);
      toast.success('Task deleted.');
      setConfirm(null);
      reload();
    } catch (err) {
      toast.error(err.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Internship Tasks" description="Create, schedule and publish daily tasks. Use a program's Schedule tab for a calendar view." />
      <FilterBar>
        <FilterSelect label="Program" allLabel="Choose" className="w-72" value={programId} onChange={(v) => setQ({ programId: v })} options={(programs || []).map((p) => ({ value: p.id, label: p.title }))} />
        <FilterSelect label="Week" className="w-32" value={String(q.week || '')} onChange={(week) => setQ({ week })} options={Array.from({ length: program?.schedule?.totalWeeks || 12 }, (_, i) => ({ value: String(i + 1), label: `Week ${i + 1}` }))} />
        <FilterSelect label="Status" value={q.status} onChange={(status) => setQ({ status })} options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }]} />
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search task titles" />
      </FilterBar>
      {!programId ? <EmptyState title="No programs yet" description="Create an internship program first." /> : (
        <DataTable
          caption="Tasks"
          loading={loading}
          error={error}
          onRetry={reload}
          rows={data}
          meta={meta}
          onPage={(page) => setQ({ page }, { resetPage: false })}
          columns={[
            { key: 'when', header: 'Scheduled', render: (t) => <span className="whitespace-nowrap">W{t.weekNumber} · {WEEKDAYS_SHORT[t.scheduledDay]} {formatDate(t.scheduledDate, { day: 'numeric', month: 'short' })}</span> },
            { key: 'title', header: 'Task', render: (t) => <div><p className="font-medium">{t.title}</p><p className="text-xs text-muted">Due {formatDateTime(t.dueAt, t.program?.timezone)}</p></div> },
            { key: 'maxMarks', header: 'Marks', render: (t) => <span>{t.maxMarks}{!t.isRequired && <Badge tone="outline" className="ml-1">Optional</Badge>}</span> },
            { key: 'submissionCount', header: 'Submitted by' },
            { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
            {
              key: 'actions',
              header: 'Actions',
              render: (t) => (
                <div className="flex justify-end gap-1">
                  <IconBtn label="Edit" onClick={() => setEditing(t)}><Pencil className="size-4" /></IconBtn>
                  {t.status === 'draft' && <IconBtn label="Publish" onClick={() => setStatus(t, 'published')}><Send className="size-4" /></IconBtn>}
                  {t.status !== 'archived' && t.submissionCount > 0 && <IconBtn label="Archive" onClick={() => setStatus(t, 'archived')}><Archive className="size-4" /></IconBtn>}
                  {t.submissionCount === 0 && <IconBtn label="Delete" danger onClick={() => setConfirm(t)}><Trash2 className="size-4" /></IconBtn>}
                </div>
              ),
            },
          ]}
        />
      )}
      {editing && program && <TaskFormModal open onClose={() => setEditing(null)} program={program} task={editing} onSaved={() => { reload(); reloadProgram(); }} />}
      <ConfirmDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={remove} loading={busy} title="Delete task?" confirmLabel="Delete" message={confirm && `"${confirm.title}" will be permanently deleted. Tasks with submissions cannot be deleted.`} />
    </div>
  );
}

function IconBtn({ label, onClick, danger, children }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={`grid size-8 place-items-center rounded-lg text-muted ${danger ? 'hover:bg-danger-light hover:text-danger' : 'hover:bg-primary-light hover:text-primary'}`}>{children}</button>;
}
