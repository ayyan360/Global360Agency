import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Hourglass, CheckCircle2, XCircle } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { PageHeader, StatusBadge, Tabs } from '../../components/common/ui.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { FilterBar, FilterSelect, SearchInput } from '../../components/admin/AdminKit.jsx';
import { formatDate } from '../../utils/format.js';

export default function AdminApplicationsPage() {
  useDocumentTitle('Internship Applications');
  const navigate = useNavigate();
  const [q, setQ] = useQueryState({ search: '', status: '', programId: '', page: 1 });
  const { data: programs } = useApi('/admin/internships', { params: { pageSize: 50 } });
  const { data, meta, loading, error, reload } = useApi('/admin/internship-applications', { params: { search: q.search || undefined, status: q.status || undefined, programId: q.programId || undefined, page: q.page, pageSize: 15 } });

  return (
    <div>
      <PageHeader title="Internship Applications" description="Review applications and approve, waitlist or reject them. Approval creates the participant's enrollment." />
      <Tabs
        className="mb-4"
        value={q.status}
        onChange={(status) => setQ({ status })}
        tabs={[
          { value: '', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'under_review', label: 'Under review' },
          { value: 'waitlisted', label: 'Waitlisted' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'withdrawn', label: 'Withdrawn' },
        ]}
      />
      <FilterBar>
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search applicant name or email" />
        <FilterSelect label="Program" className="w-72" value={q.programId} onChange={(programId) => setQ({ programId })} options={(programs || []).map((p) => ({ value: p.id, label: p.title }))} />
      </FilterBar>
      <DataTable
        caption="Applications"
        loading={loading}
        error={error}
        onRetry={reload}
        rows={data}
        meta={meta}
        onPage={(page) => setQ({ page }, { resetPage: false })}
        onRowClick={(a) => navigate(`/admin/internship-applications/${a.id}`)}
        empty={<div className="py-10 text-center text-sm text-muted"><ClipboardList className="mx-auto mb-2 size-8 text-primary" />No applications match these filters.</div>}
        columns={[
          { key: 'fullName', header: 'Applicant', render: (a) => <div><Link to={`/admin/internship-applications/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:text-primary">{a.fullName}</Link><p className="text-xs text-muted">{a.email}</p></div> },
          { key: 'program', header: 'Program / track', render: (a) => <span>{a.program?.title}<br /><span className="text-xs text-muted">{a.program?.track}</span></span> },
          { key: 'createdAt', header: 'Applied on', render: (a) => <span className="text-muted">{formatDate(a.createdAt)}</span> },
          { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
        ]}
      />
      <p className="mt-3 flex flex-wrap gap-4 text-xs text-muted"><span className="inline-flex items-center gap-1"><Hourglass className="size-3.5" /> Pending applications wait for a decision</span><span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Approval checks capacity and creates the enrollment</span><span className="inline-flex items-center gap-1"><XCircle className="size-3.5" /> Rejections can include public feedback</span></p>
    </div>
  );
}
