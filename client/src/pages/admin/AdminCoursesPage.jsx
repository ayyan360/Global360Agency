import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { ButtonLink, PageHeader, StatusBadge, Badge } from '../../components/common/ui.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { FilterBar, FilterSelect, SearchInput } from '../../components/admin/AdminKit.jsx';
import { CourseThumbnail } from '../../components/courses/CourseThumbnail.jsx';
import { formatDate } from '../../utils/format.js';
import { LEVEL_LABELS } from '../../constants/status.js';

export default function AdminCoursesPage() {
  useDocumentTitle('Manage Courses');
  const navigate = useNavigate();
  const [q, setQ] = useQueryState({ search: '', status: '', page: 1 });
  const { data, meta, loading, error, reload } = useApi('/admin/courses', { params: { ...q, search: q.search || undefined, status: q.status || undefined, pageSize: 15 } });

  return (
    <div>
      <PageHeader title="Courses" description="Create, edit, publish and organise courses." actions={<ButtonLink to="/admin/courses/new" icon={Plus}>New course</ButtonLink>} />
      <FilterBar>
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search courses by title" />
        <FilterSelect label="Status" value={q.status} onChange={(status) => setQ({ status })} options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }]} />
      </FilterBar>
      <DataTable
        caption="Courses"
        loading={loading}
        error={error}
        onRetry={reload}
        rows={data}
        meta={meta}
        onPage={(page) => setQ({ page }, { resetPage: false })}
        onRowClick={(row) => navigate(`/admin/courses/${row.id}`)}
        columns={[
          {
            key: 'title',
            header: 'Course',
            render: (c) => (
              <div className="flex items-center gap-3">
                <div className="hidden w-16 shrink-0 sm:block"><CourseThumbnail src={c.thumbnailUrl} title={c.title} category={c.category} rounded="rounded-md" /></div>
                <div className="min-w-0">
                  <Link to={`/admin/courses/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:text-primary">{c.title}</Link>
                  <p className="text-xs text-muted">{c.category} · {LEVEL_LABELS[c.level]} {c.isSample && <Badge tone="outline" className="ml-1">Sample</Badge>}</p>
                </div>
              </div>
            ),
          },
          { key: 'instructor', header: 'Instructor', render: (c) => c.instructor?.name || <span className="text-muted">—</span>, hideOnMobile: true },
          { key: 'content', header: 'Content', render: (c) => <span className="text-muted">{c.moduleCount} modules · {c.lessonCount} lessons</span> },
          { key: 'enrollmentCount', header: 'Enrollments' },
          { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
          { key: 'updatedAt', header: 'Updated', render: (c) => <span className="text-muted">{formatDate(c.updatedAt)}</span>, hideOnMobile: true },
        ]}
      />
    </div>
  );
}
