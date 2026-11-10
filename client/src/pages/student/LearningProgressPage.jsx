import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Eye, Hourglass } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { ButtonLink, Card, EmptyState, ErrorState, PageHeader, PageLoader, ProgressBar, ProgressRing, SectionHeader, StatCard } from '../../components/common/ui.jsx';
import { formatDateTime } from '../../utils/format.js';

export default function LearningProgressPage() {
  useDocumentTitle('Learning Progress');
  const { data, loading, error, reload } = useApi('/student/progress');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;
  const { overall, courses, recentActivity } = data;

  return (
    <div className="space-y-6">
      <PageHeader title="Learning Progress" description="Your progress across all enrolled courses, calculated from completed lessons." />
      {courses.length === 0 ? (
        <EmptyState icon={BookOpen} title="No progress to show yet" description="Enrol in a course and complete lessons to see your progress here." action={<ButtonLink to="/courses">Browse courses</ButtonLink>} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Card className="flex flex-col items-center justify-center text-center">
              <ProgressRing value={overall.progress} label="Overall progress" sublabel="overall" />
              <p className="mt-3 text-sm text-muted">{overall.completedLessons} of {overall.totalLessons} lessons completed</p>
            </Card>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={CheckCircle2} label="Completed lessons" value={overall.completedLessons} tone="success" />
              <StatCard icon={Hourglass} label="Remaining lessons" value={overall.remainingLessons} tone="warning" />
              <StatCard icon={BookOpen} label="Courses" value={courses.length} />
            </div>
          </div>

          <Card>
            <SectionHeader title="Progress by course" />
            <ul className="space-y-5">
              {courses.map((c) => (
                <li key={c.enrollmentId}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <Link to={`/courses/${c.course.slug}`} className="font-semibold hover:text-primary">{c.course.title}</Link>
                    <span className="text-xs text-muted">{c.completedLessons}/{c.totalLessons} lessons · {c.remainingLessons} remaining · <b className="text-ink">{c.progress}%</b></span>
                  </div>
                  <ProgressBar value={c.progress} label={`${c.course.title} progress`} />
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionHeader title="Recent learning activity" />
            {recentActivity.length ? (
              <ul className="divide-y divide-line">
                {recentActivity.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 py-3 text-sm">
                    {a.type === 'lesson_completed' ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" /> : <Eye className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                    <span className="min-w-0 flex-1 truncate">{a.type === 'lesson_completed' ? 'Completed' : 'Viewed'} “{a.lesson?.title}” in {a.course?.title}</span>
                    <span className="shrink-0 text-xs text-muted">{formatDateTime(a.at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No activity recorded yet.</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
