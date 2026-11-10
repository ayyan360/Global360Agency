import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { Badge, ButtonLink, PageHeader, StatusBadge } from '../../components/common/ui.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { FilterBar, FilterSelect, SearchInput } from '../../components/admin/AdminKit.jsx';
import { formatDate } from '../../utils/format.js';

export default function AdminProgramsPage() {
  useDocumentTitle('Internship Programs');
  const navigate = useNavigate();
  const [q, setQ] = useQueryState({ search: '', status: '', page: 1 });
  const { data, meta, loading, error, reload } = useApi('/admin/internships', { params: { search: q.search || undefined, status: q.status || undefined, page: q.page, pageSize: 15 } });
  return (
    <div>
      <PageHeader title="Internship Programs" description="Configure programs, schedules, tasks, reviewers and certificate rules." actions={<ButtonLink to="/admin/internships/new" icon={Plus}>New program</ButtonLink>} />
      <FilterBar>
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search by title or track" />
        <FilterSelect label="Status" value={q.status} onChange={(status) => setQ({ status })} options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }]} />
      </FilterBar>
      <DataTable
        caption="Internship programs"
        loading={loading}
        error={error}
        onRetry={reload}
        rows={data}
        meta={meta}
        onPage={(page) => setQ({ page }, { resetPage: false })}
        onRowClick={(p) => navigate(`/admin/internships/${p.id}`)}
        columns={[
          { key: 'title', header: 'Program', render: (p) => <div><Link to={`/admin/internships/${p.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:text-primary">{p.title}</Link><p className="text-xs text-muted">{p.track}{p.isSample && <Badge tone="outline" className="ml-2">Sample</Badge>}</p></div> },
          { key: 'dates', header: 'Dates', render: (p) => <span className="whitespace-nowrap text-muted">{formatDate(p.startDate)} – {formatDate(p.endDate)}</span> },
          { key: 'pendingApplications', header: 'Pending apps' },
          { key: 'activeParticipants', header: 'Active' },
          { key: 'publishedTasks', header: 'Tasks' },
          { key: 'certificateThreshold', header: 'Threshold', render: (p) => `${p.certificateThreshold}%` },
          { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
        ]}
      />
    </div>
  );
}
