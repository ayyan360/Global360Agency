import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { PageHeader, ProgressBar, StatusBadge, Tabs } from '../../components/common/ui.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { FilterBar, FilterSelect, SearchInput } from '../../components/admin/AdminKit.jsx';
import { pct } from '../../utils/format.js';

export default function AdminParticipantsPage() {
  useDocumentTitle('Internship Participants');
  const navigate = useNavigate();
  const [q, setQ] = useQueryState({ search: '', status: '', programId: '', page: 1 });
  const { data: programs } = useApi('/admin/internships', { params: { pageSize: 50 } });
  const { data, meta, loading, error, reload } = useApi('/admin/internship-enrollments', { params: { search: q.search || undefined, status: q.status || undefined, programId: q.programId || undefined, page: q.page, pageSize: 15 } });
  return (
    <div>
      <PageHeader title="Internship Participants" description="Monitor progress, scores and certificate eligibility. All values are calculated on the server from finalized assessments." />
      <Tabs className="mb-4" value={q.status} onChange={(status) => setQ({ status })} tabs={[{ value: '', label: 'All' }, { value: 'in_progress', label: 'Active' }, { value: 'approved', label: 'Not started' }, { value: 'completed_qualified', label: 'Qualified' }, { value: 'completed_not_qualified', label: 'Not qualified' }, { value: 'withdrawn', label: 'Withdrawn' }, { value: 'suspended', label: 'Suspended' }]} />
      <FilterBar>
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search participant name or email" />
        <FilterSelect label="Program" className="w-72" value={q.programId} onChange={(programId) => setQ({ programId })} options={(programs || []).map((p) => ({ value: p.id, label: p.title }))} />
      </FilterBar>
      <DataTable
        caption="Participants"
        loading={loading}
        error={error}
        onRetry={reload}
        rows={data}
        meta={meta}
        onPage={(page) => setQ({ page }, { resetPage: false })}
        onRowClick={(e) => navigate(`/admin/internship-participants/${e.id}`)}
        columns={[
          { key: 'participant', header: 'Participant', render: (e) => <div><Link to={`/admin/internship-participants/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="font-semibold hover:text-primary">{e.participant.name}</Link><p className="text-xs text-muted">{e.participant.email}</p></div> },
          { key: 'program', header: 'Program', render: (e) => <span className="text-sm">{e.program.title}</span>, hideOnMobile: true },
          { key: 'completion', header: 'Completion', render: (e) => <div className="flex min-w-28 items-center gap-2"><ProgressBar value={e.completionProgress || 0} size="sm" /><span className="text-xs">{pct(e.completionProgress)}</span></div> },
          { key: 'score', header: 'Score', render: (e) => (e.finalScore !== null ? <b>{pct(e.finalScore, 2)}</b> : <span className="text-muted" title="Provisional score on assessed work">{pct(e.provisionalScore, 1)} <span className="text-[10px]">prov.</span></span>) },
          { key: 'pending', header: 'Pending', render: (e) => e.counts.pendingReview + e.counts.revisionRequired },
          { key: 'outcome', header: 'Eligibility', render: (e) => <StatusBadge status={e.outcome} /> },
          { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
        ]}
      />
    </div>
  );
}
