import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Briefcase, CheckCircle2, Eye, GraduationCap, PlayCircle, TrendingUp } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ButtonLink, Card, EmptyState, ErrorState, PageLoader, ProgressRing, SectionHeader, StatCard, StatusBadge } from '../../components/common/ui.jsx';
import { CourseProgressRow } from '../../components/dashboard/CourseProgressRow.jsx';
import { relativeTime } from '../../utils/format.js';

export default function StudentDashboardPage() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/student/dashboard');
  const { data: internship } = useApi('/student/internship');

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;
  const { stats, courses, recentActivity } = data;
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-muted">Keep going — here's where you left off.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={BookOpen} label="Enrolled courses" value={stats.enrolledCourses} />
        <StatCard icon={CheckCircle2} label="Completed lessons" value={stats.completedLessons} hint={`of ${stats.totalLessons} total`} tone="success" />
        <StatCard icon={GraduationCap} label="Completed courses" value={stats.completedCourses} tone="info" />
        <div className="card flex items-center gap-4 p-4 sm:p-5">
          <ProgressRing value={stats.overallProgress} size={68} stroke={7} label="Overall progress" />
          <div>
            <p className="text-xs font-medium text-muted">Overall progress</p>
            <p className="text-sm text-muted">Across all enrolled courses</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <SectionHeader title="My Courses" action={<Link to="/student/courses" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View all <ArrowRight className="size-4" /></Link>} className="mb-1" />
          {courses.length ? (
            <ul className="divide-y divide-line">{courses.map((c) => <CourseProgressRow key={c.enrollmentId} item={c} />)}</ul>
          ) : (
            <EmptyState icon={BookOpen} title="You haven't enrolled in a course yet" description="Browse the catalog and enrol for free to start tracking your progress." action={<ButtonLink to="/courses">Browse courses</ButtonLink>} className="mt-4" />
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionHeader title="Internship" className="mb-3" />
            {internship?.enrollment ? (
              <div className="space-y-3">
                <p className="font-semibold">{internship.enrollment.program.title}</p>
                <StatusBadge status={internship.enrollment.status} />
                <p className="text-sm text-muted">Week {internship.currentWeek} of {internship.enrollment.program.totalWeeks} · {internship.results.counts.approved}/{internship.results.counts.totalRequired} tasks approved</p>
                <ButtonLink to="/student/internship" size="sm" iconRight={ArrowRight}>Open internship</ButtonLink>
              </div>
            ) : internship?.applications?.length ? (
              <div className="space-y-2">
                <p className="text-sm">{internship.applications[0].program.title}</p>
                <StatusBadge status={internship.applications[0].status} />
                <div><ButtonLink to="/student/internship" size="sm" variant="outline" className="mt-2">View application</ButtonLink></div>
              </div>
            ) : (
              <div className="rounded-xl bg-primary-50 p-4">
                <Briefcase className="size-6 text-primary" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold">Join a free internship</p>
                <p className="mt-1 text-xs text-muted">Three months of practical tasks with mentor feedback.</p>
                <ButtonLink to="/internship" size="sm" className="mt-3">Explore programs</ButtonLink>
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Recent Activity" className="mb-3" />
            {recentActivity.length ? (
              <ul className="space-y-3.5">
                {recentActivity.map((a, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${a.type === 'lesson_completed' ? 'bg-success-light text-success' : 'bg-primary-light text-primary'}`}>
                      {a.type === 'lesson_completed' ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{a.type === 'lesson_completed' ? 'Completed' : 'Viewed'}: {a.lesson?.title}</span>
                      <span className="text-xs text-muted">{a.course?.title} · {relativeTime(a.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Your learning activity will appear here.</p>
            )}
          </Card>
        </div>
      </div>

      {courses.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <ButtonLink to="/student/progress" variant="outline" icon={TrendingUp}>View learning progress</ButtonLink>
          <ButtonLink to="/courses" variant="ghost" icon={PlayCircle}>Find another course</ButtonLink>
        </div>
      )}
    </div>
  );
}
