import { Link, useNavigate } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Badge, Checkbox, Input, PageHeader, StatusBadge, Tabs } from '../../components/common/ui.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { FilterBar, FilterSelect, SearchInput } from '../../components/admin/AdminKit.jsx';
import { formatDateTime, relativeTime } from '../../utils/format.js';

export default function AdminReviewsPage() {
  useDocumentTitle('Submission Reviews');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useQueryState({ status: '', programId: '', taskId: '', participant: '', submittedFrom: '', submittedTo: '', dueBefore: '', assignedToMe: '', sort: 'oldest', page: 1 });
  const { data: programs } = useApi('/admin/internship-submissions/programs');
  const { data: tasks } = useApi(q.programId && user.role === 'admin' ? '/admin/internship-tasks' : null, { params: { programId: q.programId, pageSize: 100 } });
  const params = Object.fromEntries(Object.entries({ ...q, pageSize: 15 }).filter(([, v]) => v !== '' && v !== undefined));
  const { data, meta, loading, error, reload } = useApi('/admin/internship-submissions', { params });

  return (
    <div>
      <PageHeader title="Submission Reviews" description={user.role === 'admin' ? 'All submissions across programs. Reviewers only see participants they are assigned to.' : 'Submissions from participants you are assigned to review.'} />
      <Tabs className="mb-4" value={q.status} onChange={(status) => setQ({ status })} tabs={[{ value: '', label: 'Awaiting review' }, { value: 'submitted', label: 'Submitted' }, { value: 'under_review', label: 'Under review' }, { value: 'revision_required', label: 'Revision requested' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
      <FilterBar>
        <SearchInput value={q.participant} onChange={(participant) => setQ({ participant })} placeholder="Participant name or email" label="Search participant" />
        <FilterSelect label="Program" className="w-64" value={q.programId} onChange={(programId) => setQ({ programId, taskId: '' })} options={(programs || []).map((p) => ({ value: p.id, label: p.title }))} />
        {tasks && <FilterSelect label="Task" className="w-64" value={q.taskId} onChange={(taskId) => setQ({ taskId })} options={tasks.map((t) => ({ value: t.id, label: `W${t.weekNumber} · ${t.title}` }))} />}
        <FilterSelect label="Order" allLabel="Oldest first" className="w-44" value={q.sort === 'newest' ? 'newest' : ''} onChange={(v) => setQ({ sort: v || 'oldest' })} options={[{ value: 'newest', label: 'Newest first' }]} />
      </FilterBar>
      <FilterBar className="-mt-1">
        <Input aria-label="Submitted from" type="date" value={q.submittedFrom} onChange={(e) => setQ({ submittedFrom: e.target.value })} className="w-44" hint="Submitted from" />
        <Input aria-label="Submitted to" type="date" value={q.submittedTo} onChange={(e) => setQ({ submittedTo: e.target.value })} className="w-44" hint="Submitted to" />
        <Input aria-label="Deadline before" type="date" value={q.dueBefore} onChange={(e) => setQ({ dueBefore: e.target.value })} className="w-44" hint="Task deadline before" />
        {user.role === 'admin' && <Checkbox label="Only my reviewer assignments" checked={q.assignedToMe === 'true'} onChange={(e) => setQ({ assignedToMe: e.target.checked ? 'true' : '' })} />}
      </FilterBar>
      <DataTable
        caption="Submissions"
        loading={loading}
        error={error}
        onRetry={reload}
        rows={data}
        meta={meta}
        onPage={(page) => setQ({ page }, { resetPage: false })}
        onRowClick={(s) => navigate(`/admin/reviews/${s.id}`)}
        empty={<div className="py-10 text-center text-sm text-muted"><ListChecks className="mx-auto mb-2 size-8 text-primary" />Nothing to review with these filters.</div>}
        columns={[
          { key: 'participant', header: 'Participant', render: (s) => <div><Link to={`/admin/reviews/${s.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:text-primary">{s.participant.name}</Link><p className="text-xs text-muted">{s.program.title}</p></div> },
          { key: 'task', header: 'Task', render: (s) => <div><p>{s.task.title}</p><p className="text-xs text-muted">Week {s.task.weekNumber} · max {s.task.maxMarks}</p></div> },
          { key: 'version', header: 'Version', render: (s) => <span>v{s.version}{s.isLate && <Badge tone="warning" className="ml-1">Late</Badge>}</span> },
          { key: 'submittedAt', header: 'Submitted', render: (s) => <span title={formatDateTime(s.submittedAt)} className="text-muted">{relativeTime(s.submittedAt)}</span> },
          { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
        ]}
      />
    </div>
  );
}
