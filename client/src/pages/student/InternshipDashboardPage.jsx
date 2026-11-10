import { Link } from 'react-router-dom';
import { Award, BarChart3, CalendarClock, ClipboardList, ListChecks, MessageSquareText, Upload } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { Alert, ButtonLink, Card, ErrorState, PageLoader, ProgressBar, SectionHeader, StatCard, StatusBadge } from '../../components/common/ui.jsx';
import { DeskMiniIllustration } from '../../components/common/Illustrations.jsx';
import { ResultsSummary } from '../../components/internship/Results.jsx';
import { NoEnrollment } from '../../components/internship/NoEnrollment.jsx';
import { TrackIcon } from '../../components/internship/ProgramCard.jsx';
import { DECISION_LABELS } from '../../constants/status.js';
import { formatDate, formatDateTime, relativeTime } from '../../utils/format.js';

export default function InternshipDashboardPage() {
  useDocumentTitle('Internship Dashboard');
  const { data, loading, error, reload } = useApi('/student/internship');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;
  if (!data.enrollment) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">Internship</h1>
        <NoEnrollment applications={data.applications} onChanged={reload} />
      </div>
    );
  }

  const { enrollment: e, results: r, currentWeek, upcomingDeadlines, todaysTasks, recentFeedback, certificate } = data;
  const tz = e.program.timezone;
  const weekPct = Math.round((Math.min(currentWeek, e.program.totalWeeks) / e.program.totalWeeks) * 100);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Internship Dashboard</h1>
            <p className="mt-1 text-sm text-muted">Complete your daily tasks, track your progress and work towards your certificate.</p>
          </div>
          {e.status === 'approved' && <Alert tone="info" title="Your internship starts soon">The program begins on {formatDate(e.startDate)}. Tasks will appear here on each working day.</Alert>}
          {['withdrawn', 'suspended'].includes(e.status) && <Alert tone="warning" title={`Enrollment ${e.status}`}>{e.statusReason || 'Contact support for details.'}</Alert>}

          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid size-14 place-items-center rounded-2xl bg-primary-light text-primary"><TrackIcon track={e.program.track} className="size-7" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">{e.program.title}</p>
                <p className="text-sm text-muted">{e.program.track} · {formatDate(e.startDate)} – {formatDate(e.endDate)} · Mon–Fri</p>
              </div>
              <StatusBadge status={e.status} />
            </div>
            <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-4">
              <div><p className="text-xs text-muted">Current week</p><p className="mt-1 text-xl font-bold">{currentWeek} <span className="text-sm font-normal text-muted">/ {e.program.totalWeeks}</span></p><ProgressBar value={weekPct} size="sm" className="mt-2" label="Program timeline" /></div>
              <div><p className="text-xs text-muted">Required tasks</p><p className="mt-1 text-xl font-bold">{r.counts.totalRequired}</p></div>
              <div><p className="text-xs text-muted">Approved</p><p className="mt-1 text-xl font-bold text-success">{r.counts.approved}</p></div>
              <div><p className="text-xs text-muted">Certificate threshold</p><p className="mt-1 text-xl font-bold">{e.program.certificateThreshold}%</p></div>
            </div>
          </Card>
        </div>

        <div className="card relative hidden overflow-hidden bg-primary-50 p-6 xl:block">
          <p className="text-xl font-bold leading-snug text-primary">Small steps every day lead to big results.</p>
          <DeskMiniIllustration className="mt-4 w-full" />
        </div>
      </div>

      <ResultsSummary results={r} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={ClipboardList} label="Pending review" value={r.counts.pendingReview} tone="info" />
        <StatCard icon={MessageSquareText} label="Revision required" value={r.counts.revisionRequired} tone="warning" />
        <StatCard icon={CalendarClock} label="Overdue" value={r.counts.overdue} tone="danger" />
        <StatCard icon={ListChecks} label="Upcoming (scheduled)" value={r.counts.scheduled} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Today's tasks" action={<Link to="/student/internship/tasks" className="text-sm font-semibold text-primary hover:underline">All tasks</Link>} className="mb-3" />
          {todaysTasks.length ? (
            <ul className="space-y-2">
              {todaysTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted">Due {formatDateTime(t.dueAt, tz)}</p>
                  </div>
                  <StatusBadge status={t.status} />
                  {t.isReleased && <ButtonLink to={`/student/internship/tasks/${t.id}`} size="sm" variant={['available', 'revision_required', 'overdue'].includes(t.status) ? 'primary' : 'outline'}>{['available', 'revision_required', 'overdue'].includes(t.status) ? 'Open' : 'View'}</ButtonLink>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-primary-50 p-4 text-sm text-muted">No task is scheduled for today{[6, 7].includes(new Date().getDay() || 7) ? ' — it’s a day off. Enjoy your weekend!' : '.'}</p>
          )}
          <h3 className="mb-2 mt-6 text-sm font-semibold">Upcoming deadlines</h3>
          {upcomingDeadlines.length ? (
            <ul className="divide-y divide-line">
              {upcomingDeadlines.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link to={`/student/internship/tasks/${t.id}`} className="min-w-0 truncate hover:text-primary">{t.title}</Link>
                  <span className="shrink-0 text-xs text-muted">{relativeTime(t.dueAt)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No open tasks with upcoming deadlines.</p>}
        </Card>

        <Card>
          <SectionHeader title="Recent feedback" className="mb-3" />
          {recentFeedback.length ? (
            <ul className="space-y-3">
              {recentFeedback.map((f) => (
                <li key={f.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link to={`/student/internship/tasks/${f.task.id}`} className="text-sm font-medium hover:text-primary">{f.task.title}</Link>
                    <span className="text-xs font-semibold text-primary">{f.marksAwarded !== null ? `${f.marksAwarded}/${f.maxMarks}` : DECISION_LABELS[f.decision]}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{f.feedback}</p>
                  <p className="mt-1 text-[11px] text-muted">{DECISION_LABELS[f.decision]} · {f.reviewer?.name} · {relativeTime(f.assessedAt)}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Reviewer feedback will appear here after your submissions are assessed.</p>}
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Quick Links</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['/student/internship/tasks', ListChecks, 'View Tasks', "This week's assignments"],
            [upcomingDeadlines[0] ? `/student/internship/tasks/${upcomingDeadlines[0].id}` : '/student/internship/tasks', Upload, 'Upload Work', 'Submit your next task'],
            ['/student/internship/progress', BarChart3, 'Track Progress', 'Scores, weeks and skills'],
            ['/student/internship/certificate', Award, certificate ? 'View Certificate' : 'Certificate', certificate ? certificate.certificateNumber : 'Eligibility and requirements'],
          ].map(([to, Icon, t, d]) => (
            <Link key={t} to={to} className="card group p-5 transition-colors hover:border-primary/40">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-light text-primary group-hover:bg-primary group-hover:text-white"><Icon className="size-5" aria-hidden="true" /></span>
              <p className="mt-3 font-semibold">{t}</p>
              <p className="text-xs text-muted">{d}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
