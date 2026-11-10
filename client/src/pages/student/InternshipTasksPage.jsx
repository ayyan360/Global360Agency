import { ChevronLeft, ChevronRight, CalendarOff, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { Badge, ButtonLink, Card, ErrorState, PageLoader, StatusBadge } from '../../components/common/ui.jsx';
import { NoEnrollment } from '../../components/internship/NoEnrollment.jsx';
import { formatDate, formatDateTime, WEEKDAYS_SHORT } from '../../utils/format.js';

function daySummary(day) {
  if (day.dayType === 'day_off') return ['Off', 'text-muted'];
  if (day.dayType === 'holiday') return ['Holiday', 'text-muted'];
  if (day.dayType === 'outside_program') return ['—', 'text-muted'];
  if (!day.tasks.length) return ['No task', 'text-muted'];
  const s = day.tasks.map((t) => t.status);
  if (s.every((x) => x === 'approved')) return ['Completed', 'text-success'];
  if (s.some((x) => x === 'overdue')) return ['Overdue', 'text-danger'];
  if (s.some((x) => x === 'revision_required')) return ['Revise', 'text-amber-600'];
  if (s.some((x) => ['submitted', 'under_review'].includes(x))) return ['In review', 'text-sky-700'];
  if (s.some((x) => x === 'available')) return ['Pending', 'text-primary'];
  return ['Scheduled', 'text-muted'];
}

export default function InternshipTasksPage() {
  useDocumentTitle('Internship Tasks');
  const [q, setQ] = useQueryState({ week: 0, day: '' });
  const { data, loading, error, reload } = useApi('/student/internship/tasks', { params: q.week ? { week: q.week } : {}, keepPrevious: true });
  const { data: dash } = useApi(error?.status === 404 ? '/student/internship' : null);

  if (error?.status === 404) return <div><h1 className="mb-6 text-2xl font-bold">Internship Tasks</h1>{dash ? <NoEnrollment applications={dash.applications} onChanged={reload} /> : <PageLoader />}</div>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageLoader />;

  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: data.timezone }).format(new Date());
  const todayDay = data.days.find((d) => d.date === todayIso);
  const lastWithTasks = [...data.days].reverse().find((d) => d.tasks.length && d.date <= todayIso);
  const selected =
    data.days.find((d) => d.date === q.day) ||
    (todayDay && (todayDay.tasks.length || !lastWithTasks) ? todayDay : null) ||
    lastWithTasks ||
    data.days.find((d) => d.tasks.length) ||
    data.days[0];
  const go = (week) => setQ({ week, day: '' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Internship Tasks</h1>
          <p className="mt-1 text-sm text-muted">Complete your daily tasks and upload your work. Times shown in {data.timezone}.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white p-1">
          <button type="button" onClick={() => go(data.week - 1)} disabled={data.week <= 1} className="grid size-9 place-items-center rounded-lg hover:bg-primary-light disabled:opacity-40" aria-label="Previous week"><ChevronLeft className="size-4" /></button>
          <span className="min-w-[170px] px-2 text-center text-sm font-semibold" aria-live="polite">
            Week {data.week} · {formatDate(data.days[0].date, { day: 'numeric', month: 'short' })} – {formatDate(data.days[6].date, { day: 'numeric', month: 'short' })}
          </span>
          <button type="button" onClick={() => go(data.week + 1)} disabled={data.week >= data.totalWeeks} className="grid size-9 place-items-center rounded-lg hover:bg-primary-light disabled:opacity-40" aria-label="Next week"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      {data.week !== data.currentWeek && <button type="button" onClick={() => go(data.currentWeek)} className="text-sm font-medium text-primary hover:underline">Jump to current week ({data.currentWeek})</button>}

      <div className={`grid grid-cols-4 gap-2 sm:grid-cols-7 ${loading ? 'opacity-60' : ''}`} role="tablist" aria-label="Days of the week">
        {data.days.map((d) => {
          const [label, cls] = daySummary(d);
          const active = d.date === selected.date;
          const off = d.dayType !== 'working';
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setQ({ day: d.date }, { resetPage: false })}
              className={`rounded-xl border p-3 text-center transition-colors ${active ? 'border-primary bg-primary-50 ring-2 ring-primary/20' : off ? 'border-line bg-page/60' : 'border-line bg-white hover:border-primary/40'}`}
            >
              <span className="block text-xs text-muted">{WEEKDAYS_SHORT[d.weekday]}</span>
              <span className={`mt-0.5 block text-lg font-bold ${off ? 'text-muted' : 'text-ink'}`}>{Number(d.date.slice(8))}</span>
              <span className={`mt-0.5 block text-[11px] font-medium ${cls}`}>{label}</span>
              {d.date === todayIso && <span className="mx-auto mt-1 block size-1.5 rounded-full bg-primary" aria-label="Today" />}
            </button>
          );
        })}
      </div>

      <Card>
        <h2 className="text-lg font-semibold">{formatDate(selected.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
        {selected.dayType !== 'working' && !selected.tasks.length ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary-50 p-4 text-sm text-muted">
            <CalendarOff className="size-5 text-primary" aria-hidden="true" />
            {selected.dayType === 'holiday' ? `Program holiday: ${selected.holidayName}. No tasks today.` : selected.dayType === 'outside_program' ? 'This day is outside the program dates.' : 'Day off — no tasks are scheduled on weekends.'}
          </div>
        ) : selected.tasks.length ? (
          <ol className="mt-4 space-y-3">
            {selected.tasks.map((t, i) => (
              <li key={t.id} className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-light text-sm font-bold text-primary">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.isReleased ? <Link to={`/student/internship/tasks/${t.id}`} className="hover:text-primary">{t.title}</Link> : t.title}</p>
                  {t.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{t.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {t.skills?.slice(0, 3).map((s) => <Badge key={s}>{s}</Badge>)}
                    <span>Max {t.maxMarks} marks</span>
                    {!t.isRequired && <Badge tone="outline">Optional</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <StatusBadge status={t.status} />
                  <span className="text-xs text-muted">{t.isReleased ? `Due ${formatDateTime(t.dueAt, data.timezone)}` : `Available ${formatDateTime(t.availableAt, data.timezone)}`}</span>
                  {t.isReleased ? (
                    <ButtonLink to={`/student/internship/tasks/${t.id}`} size="sm" variant={['available', 'revision_required', 'overdue'].includes(t.status) ? 'primary' : 'outline'}>
                      {['available', 'overdue'].includes(t.status) ? 'Upload your work' : t.status === 'revision_required' ? 'Submit revision' : 'View task'}
                    </ButtonLink>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted"><Lock className="size-3.5" /> Not released yet</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-muted">No tasks have been published for this day yet.</p>
        )}
      </Card>
    </div>
  );
}
