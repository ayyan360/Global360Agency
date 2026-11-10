import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { Card, EmptyState, ErrorState, PageHeader, PageLoader, Select } from '../../components/common/ui.jsx';
import { CourseContentManager } from '../../components/admin/CourseContentManager.jsx';
import { Layers } from 'lucide-react';

/** Modules & lessons for one course at a time (shared by the Modules and Lessons sections). */
export function CourseContentPicker({ title, description }) {
  const [q, setQ] = useQueryState({ course: '' });
  const { data: courses, loading } = useApi('/admin/courses', { params: { pageSize: 50 } });
  const { data: course, error, reload, loading: cLoading } = useApi(q.course ? `/admin/courses/${q.course}` : null);
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card className="mb-5">
        <Select label="Course" placeholder={loading ? 'Loading courses…' : 'Choose a course'} value={q.course} onChange={(e) => setQ({ course: e.target.value })} options={(courses || []).map((c) => ({ value: c.id, label: `${c.title} (${c.status})` }))} className="max-w-xl" />
      </Card>
      {!q.course ? (
        <EmptyState icon={Layers} title="Choose a course" description="Select a course to manage its modules and lessons." />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : cLoading || !course ? (
        <PageLoader />
      ) : (
        <Card><CourseContentManager course={course} onChanged={reload} /></Card>
      )}
    </div>
  );
}

export default function AdminModulesPage() {
  useDocumentTitle('Modules');
  return <CourseContentPicker title="Modules" description="Add, edit, reorder and delete course modules." />;
}
