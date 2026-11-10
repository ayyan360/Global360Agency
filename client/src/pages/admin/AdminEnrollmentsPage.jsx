import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { PageHeader, ProgressBar, StatusBadge } from '../../components/common/ui.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { FilterBar, FilterSelect, SearchInput } from '../../components/admin/AdminKit.jsx';
import { formatDate } from '../../utils/format.js';

export default function AdminEnrollmentsPage() {
  useDocumentTitle('Enrollments');
  const [q, setQ] = useQueryState({ search: '', courseId: '', status: '', page: 1 });
  const { data: courses } = useApi('/admin/courses', { params: { pageSize: 50 } });
  const { data, meta, loading, error, reload } = useApi('/admin/enrollments', { params: { search: q.search || undefined, courseId: q.courseId || undefined, status: q.status || undefined, page: q.page, pageSize: 15 } });
  return (
    <div>
      <PageHeader title="Course Enrollments" description="Every course enrollment with live progress." />
      <FilterBar>
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search student name or email" />
        <FilterSelect label="Course" className="w-64" value={q.courseId} onChange={(courseId) => setQ({ courseId })} options={(courses || []).map((c) => ({ value: c.id, label: c.title }))} />
        <FilterSelect label="Status" value={q.status} onChange={(status) => setQ({ status })} options={[{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} />
      </FilterBar>
      <DataTable
        caption="Enrollments"
        loading={loading}
        error={error}
        onRetry={reload}
        rows={data}
        meta={meta}
        onPage={(page) => setQ({ page }, { resetPage: false })}
        columns={[
          { key: 'user', header: 'Student', render: (e) => <div><Link to={`/admin/students/${e.user.id}`} className="font-semibold hover:text-primary">{e.user.name}</Link><p className="text-xs text-muted">{e.user.email}</p></div> },
          { key: 'course', header: 'Course', render: (e) => <Link to={`/admin/courses/${e.course.id}`} className="hover:text-primary">{e.course.title}</Link> },
          { key: 'progress', header: 'Progress', render: (e) => <div className="flex min-w-32 items-center gap-2"><ProgressBar value={e.progress} size="sm" /><span className="text-xs">{e.progress}%</span></div> },
          { key: 'enrolledAt', header: 'Enrolled', render: (e) => <span className="text-muted">{formatDate(e.enrolledAt)}</span> },
          { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
        ]}
      />
    </div>
  );
}
