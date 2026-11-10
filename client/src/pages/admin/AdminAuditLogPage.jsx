import { useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { PageHeader } from '../../components/common/ui.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { FilterBar, FilterSelect, SearchInput } from '../../components/admin/AdminKit.jsx';
import { formatDateTime } from '../../utils/format.js';

const ENTITIES = ['InternshipApplication', 'InternshipProgram', 'InternshipTask', 'InternshipEnrollment', 'TaskSubmission', 'TaskAssessment', 'InternshipCertificate', 'User', 'Course', 'SiteSetting'];

export default function AdminAuditLogPage() {
  useDocumentTitle('Audit Log');
  const [q, setQ] = useQueryState({ action: '', entityType: '', page: 1 });
  const [expanded, setExpanded] = useState(null);
  const { data, meta, loading, error, reload } = useApi('/admin/audit-logs', { params: { action: q.action || undefined, entityType: q.entityType || undefined, page: q.page } });
  return (
    <div>
      <PageHeader title="Audit Log" description="Privileged actions: application decisions, configuration changes, assessments, certificates and role changes." />
      <FilterBar>
        <SearchInput value={q.action} onChange={(action) => setQ({ action })} placeholder="Filter by action, e.g. certificate" />
        <FilterSelect label="Entity" className="w-60" value={q.entityType} onChange={(entityType) => setQ({ entityType })} options={ENTITIES.map((e) => ({ value: e, label: e }))} />
      </FilterBar>
      <DataTable
        caption="Audit log"
        loading={loading}
        error={error}
        onRetry={reload}
        rows={data}
        meta={meta}
        onPage={(page) => setQ({ page }, { resetPage: false })}
        onRowClick={(r) => setExpanded(expanded === r.id ? null : r.id)}
        columns={[
          { key: 'createdAt', header: 'When', render: (r) => <span className="whitespace-nowrap text-muted">{formatDateTime(r.createdAt)}</span> },
          { key: 'actor', header: 'Actor', render: (r) => r.actor?.name || <span className="text-muted">System</span> },
          { key: 'action', header: 'Action', render: (r) => <code className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary">{r.action}</code> },
          { key: 'entity', header: 'Entity', render: (r) => <span className="text-xs text-muted">{r.entityType}</span> },
          { key: 'metadata', header: 'Details', render: (r) => <pre className={`max-w-md whitespace-pre-wrap break-words text-[11px] text-muted ${expanded === r.id ? '' : 'line-clamp-2'}`}>{JSON.stringify(r.metadata)}</pre> },
        ]}
      />
    </div>
  );
}
