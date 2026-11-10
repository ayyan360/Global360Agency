import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Award, BookOpen, Briefcase, ClipboardList, GraduationCap, Inbox, ListChecks, MessageSquare, UserCheck, Users, BadgeCheck, Presentation, ArrowRight } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { Card, ErrorState, PageHeader, PageLoader, SectionHeader, StatCard, StatusBadge } from '../../components/common/ui.jsx';
import { BarChart } from '../../components/dashboard/BarChart.jsx';
import { formatDate } from '../../utils/format.js';

export default function AdminDashboardPage() {
  useDocumentTitle('Admin Dashboard');
  const { can } = useAuth();
  const allowed = can('reports:view');
  const { data, loading, error, reload } = useApi(allowed ? '/admin/dashboard' : null);
  if (!allowed) return <Navigate to={can('courses:manage-own') ? '/admin/courses' : '/admin/reviews'} replace />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;
  const s = data.stats;
  const maxTrend = Math.max(1, ...data.enrollmentTrend.map((d) => d.count));

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Dashboard" description="Manage your platform content, learners and internship programs. All figures are live from the database." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={BookOpen} label="Total courses" value={s.totalCourses} hint={`${s.publishedCourses} published`} />
        <StatCard icon={Users} label="Total students" value={s.totalStudents} tone="info" />
        <StatCard icon={GraduationCap} label="Course enrollments" value={s.totalEnrollments} tone="success" />
        <StatCard icon={Presentation} label="Active instructors" value={s.activeInstructors} />
        <StatCard icon={Briefcase} label="Internship programs" value={s.internshipPrograms} />
        <StatCard icon={ClipboardList} label="Pending applications" value={s.pendingApplications} tone="warning" />
        <StatCard icon={UserCheck} label="Active participants" value={s.activeParticipants} tone="info" />
        <StatCard icon={ListChecks} label="Pending submissions" value={s.pendingSubmissions} tone="warning" />
        <StatCard icon={BadgeCheck} label="Completed internships" value={s.completedInternships} tone="success" />
        <StatCard icon={Award} label="Certificates issued" value={s.certificatesIssued} tone="success" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <SectionHeader title="Recent Enrollments" action={<Link to="/admin/enrollments" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View all <ArrowRight className="size-4" /></Link>} />
          {data.recentEnrollments.length ? (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="px-2 py-2">Student</th><th className="px-2 py-2">Course</th><th className="px-2 py-2">Date</th><th className="px-2 py-2">Status</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {data.recentEnrollments.map((e) => (
                    <tr key={e.id}>
                      <td className="px-2 py-2.5"><Link to={`/admin/students/${e.user.id}`} className="font-medium hover:text-primary">{e.user.name}</Link></td>
                      <td className="px-2 py-2.5 text-muted">{e.course.title}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-muted">{formatDate(e.enrolledAt)}</td>
                      <td className="px-2 py-2.5"><StatusBadge status={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted">No enrollments yet.</p>}
        </Card>
        <Card>
          <SectionHeader title="Enrollments, last 14 days" />
          <BarChart data={data.enrollmentTrend.map((d) => ({ label: d.date, short: d.date.slice(8), value: Math.round((d.count / maxTrend) * 100), raw: d.count }))} label="Daily enrollments (relative)" valueSuffix="% of peak" emptyLabel="No enrollments in this period" />
          <p className="mt-2 text-xs text-muted">Bars are relative to the busiest day ({maxTrend} enrollment{maxTrend === 1 ? '' : 's'}).</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          ['/admin/courses', BookOpen, 'Manage Courses', 'Create, edit and publish courses'],
          ['/admin/internship-applications', ClipboardList, 'Review Applications', `${s.pendingApplications} awaiting a decision`],
          ['/admin/reviews', ListChecks, 'Review Submissions', `${s.pendingSubmissions} waiting for assessment`],
          ['/admin/messages', s.newMessages ? MessageSquare : Inbox, 'Contact Messages', `${s.newMessages} new`],
        ].map(([to, Icon, t, d]) => (
          <Link key={to} to={to} className="group rounded-[var(--radius-card)] bg-primary p-5 text-white transition-colors hover:bg-primary-hover">
            <Icon className="size-6" aria-hidden="true" />
            <p className="mt-3 font-semibold">{t}</p>
            <p className="text-xs text-primary-100">{d}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
