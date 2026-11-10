import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { Badge, Card, ErrorState, PageHeader, PageLoader, ProgressRing, SectionHeader, StatusBadge } from '../../components/common/ui.jsx';
import { BarChart } from '../../components/dashboard/BarChart.jsx';
import { EligibilityChecklist, ResultsSummary, ScoringExplanation } from '../../components/internship/Results.jsx';
import { NoEnrollment } from '../../components/internship/NoEnrollment.jsx';
import { DECISION_LABELS } from '../../constants/status.js';
import { formatDate, relativeTime } from '../../utils/format.js';

export default function InternshipProgressPage() {
  useDocumentTitle('Internship Progress');
  const { data, loading, error, reload } = useApi('/student/internship/progress');
  const { data: dash } = useApi(error?.status === 404 ? '/student/internship' : null);
  if (error?.status === 404) return <div><h1 className="mb-6 text-2xl font-bold">My Progress</h1>{dash ? <NoEnrollment applications={dash.applications} onChanged={reload} /> : <PageLoader />}</div>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;
  const { results: r, weekly, skills, tasks, recentFeedback, enrollment } = data;
  const hasWeekly = weekly.some((w) => w.total > 0);

  return (
    <div className="space-y-6">
      <PageHeader title="My Progress" description={`Track your internship progress and assessed work for ${enrollment.program.title}.`} />
      <ResultsSummary results={r} />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr_1.4fr]">
        <Card className="flex flex-col items-center justify-center text-center">
          <ProgressRing value={r.completionProgress} label="Task completion progress" sublabel="tasks approved" />
          <p className="mt-3 text-sm font-semibold">Task completion</p>
          <p className="text-xs text-muted">{r.counts.approved} of {r.counts.totalRequired} required tasks</p>
        </Card>
        <Card>
          <SectionHeader title="Task summary" className="mb-3" />
          <ul className="divide-y divide-line text-sm">
            {[
              ['Approved', r.counts.approved, 'approved'],
              ['Pending review', r.counts.pendingReview, 'submitted'],
              ['Revision required', r.counts.revisionRequired, 'revision_required'],
              ['Rejected', r.counts.rejected, 'rejected'],
              ['Overdue (not submitted)', r.counts.overdue, 'overdue'],
              ['Available now', r.counts.available, 'available'],
              ['Scheduled', r.counts.scheduled, 'scheduled'],
            ].map(([label, n, s]) => (
              <li key={label} className="flex items-center justify-between py-2"><span className="flex items-center gap-2"><StatusBadge status={s} className="!px-1.5 !py-0 text-[10px]" />{label}</span><b>{n}</b></li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionHeader title="Weekly score" description="Average assessed score per week (required tasks)." className="mb-3" />
          {hasWeekly ? <BarChart data={weekly.map((w) => ({ label: `Week ${w.week}`, short: `W${w.week}`, value: w.scorePercent }))} label="Weekly assessed score" /> : <p className="text-sm text-muted">No tasks yet.</p>}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Certificate eligibility" className="mb-4" />
          <EligibilityChecklist checks={r.checks} />
          <div className="mt-5"><ScoringExplanation results={r} /></div>
        </Card>
        <Card>
          <SectionHeader title="Skills practised" className="mb-3" />
          {skills.length ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => <Badge key={s.skill} className="px-3 py-1 text-[13px]">{s.skill} <span className="ml-1 text-muted">{s.approved}/{s.tasks}</span></Badge>)}
            </div>
          ) : <p className="text-sm text-muted">Skills appear as tasks are published.</p>}
          <h3 className="mb-2 mt-6 text-sm font-semibold">Assessment feedback</h3>
          {recentFeedback.length ? (
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
              {recentFeedback.map((f) => (
                <li key={f.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex justify-between gap-2"><Link to={`/student/internship/tasks/${f.task.id}`} className="font-medium hover:text-primary">{f.task.title}</Link><span className="shrink-0 text-xs font-semibold text-primary">{f.marksAwarded ?? '—'}/{f.maxMarks}</span></div>
                  <p className="mt-1 line-clamp-2 text-muted">{f.feedback}</p>
                  <p className="mt-1 text-[11px] text-muted">{DECISION_LABELS[f.decision]} · {relativeTime(f.assessedAt)}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No feedback yet.</p>}
        </Card>
      </div>

      <Card padded={false}>
        <div className="p-5 sm:p-6"><SectionHeader title="All tasks" className="mb-0" /></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary-50/70 text-xs uppercase tracking-wide text-muted"><tr><th className="px-5 py-3">Week</th><th className="px-5 py-3">Task</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Marks</th></tr></thead>
            <tbody className="divide-y divide-line">
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3 text-muted">W{t.weekNumber}</td>
                  <td className="px-5 py-3"><Link to={`/student/internship/tasks/${t.id}`} className="hover:text-primary">{t.title}</Link>{!t.isRequired && <Badge tone="outline" className="ml-2">Optional</Badge>}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted">{formatDate(t.scheduledDate)}</td>
                  <td className="px-5 py-3"><StatusBadge status={t.state} /></td>
                  <td className="px-5 py-3 text-right font-medium">{t.marks !== null ? `${t.marks}/${t.maxMarks}` : t.state === 'overdue' ? `0/${t.maxMarks}` : `—/${t.maxMarks}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
