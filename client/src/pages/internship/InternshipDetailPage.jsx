import { useParams } from 'react-router-dom';
import { Award, CalendarDays, CalendarOff, CheckCircle2, Clock, Globe, ListChecks, Target, Users } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { Alert, Badge, Breadcrumbs, ButtonLink, ErrorState, PageLoader, StatusBadge } from '../../components/common/ui.jsx';
import { TrackIcon } from '../../components/internship/ProgramCard.jsx';
import { formatDate, formatDateTime, WEEKDAYS } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NotFoundPage from '../errors/NotFoundPage.jsx';

export default function InternshipDetailPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { data: p, loading, error, reload } = useApi(`/internships/${slug}`);
  useDocumentTitle(p?.title || 'Internship program');
  if (error?.status === 404) return <NotFoundPage />;
  if (error) return <div className="container-page py-16"><ErrorState error={error} onRetry={reload} /></div>;
  if (loading || !p) return <PageLoader />;

  const working = p.workingDays.map((d) => WEEKDAYS[d]);
  const off = [1, 2, 3, 4, 5, 6, 7].filter((d) => !p.workingDays.includes(d)).map((d) => WEEKDAYS[d]);
  const w = p.applicationWindow;
  const viewer = p.viewer;

  let cta;
  if (viewer?.enrollment) cta = <ButtonLink to="/student/internship" size="lg">Go to my internship</ButtonLink>;
  else if (viewer?.application && ['pending', 'under_review', 'waitlisted'].includes(viewer.application.status)) cta = <div className="flex items-center gap-2 text-sm">Your application: <StatusBadge status={viewer.application.status} /></div>;
  else if (w.isOpen) cta = <ButtonLink to={`/internship/apply/${p.slug}`} size="lg">Apply Now</ButtonLink>;
  else cta = <p className="text-sm font-medium text-muted">{w.state === 'not_yet_open' ? `Applications open ${formatDateTime(w.opensAt)}` : 'Applications for this program are closed.'}</p>;

  return (
    <>
      <section className="bg-primary-50/60">
        <div className="container-page py-10">
          <Breadcrumbs items={[{ to: '/', label: 'Home' }, { to: '/internship', label: 'Internship' }, { label: p.title }]} className="mb-5" />
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-11 place-items-center rounded-xl bg-white text-primary shadow-sm"><TrackIcon track={p.track} /></span>
                <Badge>{p.track}</Badge>
                <Badge tone="neutral">{p.durationMonths} months · {p.schedule.totalWeeks} weeks</Badge>
                {p.isSample && <Badge tone="outline">Sample program</Badge>}
              </div>
              <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{p.title}</h1>
              <p className="mt-3 text-muted">{p.shortDescription}</p>
            </div>
            <div className="card w-full max-w-sm p-5">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted">Program dates</dt><dd className="text-right font-medium">{formatDate(p.startDate)} – {formatDate(p.endDate)}</dd></div>
                {w.closesAt && <div className="flex justify-between gap-3"><dt className="text-muted">Apply by</dt><dd className="text-right font-medium">{formatDateTime(w.closesAt)}</dd></div>}
                {p.seatsRemaining !== null && <div className="flex justify-between gap-3"><dt className="text-muted">Seats remaining</dt><dd className="font-medium">{p.seatsRemaining}</dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-muted">Cost</dt><dd className="font-semibold text-primary">Free</dd></div>
              </dl>
              <div className="mt-5">{cta}</div>
              {!user && w.isOpen && <p className="mt-2 text-xs text-muted">You'll be asked to log in or create a free account.</p>}
            </div>
          </div>
        </div>
      </section>

      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-semibold">About the program</h2>
            <div className="prose-g360 mt-3">{p.description.split(/\n{2,}/).map((x, i) => <p key={i}>{x}</p>)}</div>
          </section>

          <section className="grid gap-4 sm:grid-cols-4">
            {[
              [CalendarDays, `${p.durationMonths} Months`, 'Duration'],
              [Clock, `${p.workingDays.length} Days/Week`, working.length === 5 && off.join() === 'Saturday,Sunday' ? 'Mon – Fri' : working.map((d) => d.slice(0, 3)).join(', ')],
              [CalendarOff, off.length ? off.map((d) => d.slice(0, 3)).join(' & ') : 'None', 'Days off'],
              [Award, 'Certificate', `At ${p.certificateThreshold}%+ final score`],
            ].map(([Icon, t, s]) => (
              <div key={s} className="card flex items-center gap-3 p-4">
                <span className="grid size-10 place-items-center rounded-xl bg-primary-light text-primary"><Icon className="size-5" aria-hidden="true" /></span>
                <div><p className="text-sm font-semibold">{t}</p><p className="text-xs text-muted">{s}</p></div>
              </div>
            ))}
          </section>

          {p.objectives?.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Target className="size-5 text-primary" aria-hidden="true" /> Learning objectives</h2>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">{p.objectives.map((o) => <li key={o} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />{o}</li>)}</ul>
            </section>
          )}

          {p.skills?.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">Skills you'll practise</h2>
              <div className="mt-3 flex flex-wrap gap-2">{p.skills.map((s) => <Badge key={s} className="px-3 py-1 text-sm">{s}</Badge>)}</div>
            </section>
          )}

          {p.weeklyCurriculum?.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><ListChecks className="size-5 text-primary" aria-hidden="true" /> Weekly curriculum</h2>
              <p className="mt-1 text-sm text-muted">Each week has a practical task on every working day and ends with a weekly deliverable.</p>
              <ol className="mt-4 grid gap-3 sm:grid-cols-2">
                {p.weeklyCurriculum.map((wk) => (
                  <li key={wk.week} className="flex gap-3 rounded-xl border border-line bg-white p-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-light text-xs font-bold text-primary">W{wk.week}</span>
                    <span><span className="block text-sm font-semibold">{wk.title}</span>{wk.summary && <span className="text-xs text-muted">{wk.summary}</span>}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold">Assessment process</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
              <li>Submit your work for each task (text, links or files).</li>
              <li>A reviewer assesses it out of the task's maximum marks.</li>
              <li>They approve it, request a revision, or reject it with feedback.</li>
              <li>Only finalized assessments count toward your results.</li>
            </ol>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold">Certificate requirements</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> Program has reached its end date</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> All required submissions assessed</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> At least {p.completionRules.minCompletionPercent}% of required tasks approved</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> Final score of at least {p.certificateThreshold}%</li>
            </ul>
          </div>
          {p.eligibility?.length > 0 && (
            <div className="card p-5">
              <h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-primary" aria-hidden="true" /> Eligibility</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">{p.eligibility.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          <Alert tone="info" icon={Globe}>
            Deadlines use the program timezone: <b>{p.timezone}</b>. Holidays: {p.schedule.holidays.length ? p.schedule.holidays.map((h) => `${formatDate(h.date)} (${h.name})`).join(', ') : 'none scheduled'}.
          </Alert>
        </aside>
      </div>
    </>
  );
}
