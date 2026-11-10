import { useState } from 'react';
import { BookOpen, Heart } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { downloadFile } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ButtonLink, Card, CardSkeleton, EmptyState, ErrorState, PageHeader, Tabs } from '../../components/common/ui.jsx';
import { CourseProgressRow } from '../../components/dashboard/CourseProgressRow.jsx';
import { CourseCard } from '../../components/courses/CourseCard.jsx';

export default function MyCoursesPage() {
  useDocumentTitle('My Courses');
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [downloadingCourseId, setDownloadingCourseId] = useState(null);
  const { data, loading, error, reload } = useApi('/student/courses');
  const { data: wishlist, loading: wLoading } = useApi(tab === 'wishlist' ? '/student/wishlist' : null);

  const filtered = (data || []).filter((c) => (tab === 'in_progress' ? c.status !== 'completed' : tab === 'completed' ? c.status === 'completed' : true));

  const downloadCertificate = async (courseId, courseTitle) => {
    setDownloadingCourseId(courseId);
    try {
      await downloadFile(`/student/courses/${courseId}/certificate/download`, `Course Completion - ${courseTitle} - Global360.pdf`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloadingCourseId(null);
    }
  };

  return (
    <div>
      <PageHeader title="My Courses" description="All the courses you're enrolled in, with your progress." actions={<ButtonLink to="/courses" variant="outline">Browse courses</ButtonLink>} />
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-5"
        tabs={[
          { value: 'all', label: 'All', count: data?.length },
          { value: 'in_progress', label: 'In progress', count: data?.filter((c) => c.status !== 'completed').length },
          { value: 'completed', label: 'Completed', count: data?.filter((c) => c.status === 'completed').length },
          { value: 'wishlist', label: 'Wishlist' },
        ]}
      />
      {tab === 'wishlist' ? (
        wLoading ? <CardSkeleton /> : wishlist?.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{wishlist.map((c) => <CourseCard key={c.id} course={c} />)}</div>
        ) : (
          <EmptyState icon={Heart} title="Your wishlist is empty" description="Save courses you're interested in from any course page." action={<ButtonLink to="/courses">Explore courses</ButtonLink>} />
        )
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <CardSkeleton count={3} />
      ) : filtered.length ? (
        <Card className="py-2">
          <ul className="divide-y divide-line">{filtered.map((c) => <CourseProgressRow key={c.enrollmentId} item={c} showMeta onDownloadCertificate={downloadCertificate} downloadingCertificate={downloadingCourseId === c.course.id} />)}</ul>
        </Card>
      ) : (
        <EmptyState icon={BookOpen} title={tab === 'all' ? 'No enrolled courses yet' : 'Nothing in this list'} description={tab === 'all' ? 'Enrol in a free course to start learning.' : 'Courses will appear here as you progress.'} action={tab === 'all' && <ButtonLink to="/courses">Browse courses</ButtonLink>} />
      )}
    </div>
  );
}
