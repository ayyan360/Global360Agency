import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { CalendarPlus, ExternalLink, Plus, Trash2, UserPlus, BarChart3, Users, ClipboardList, PlayCircle } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Badge, Button, ButtonLink, Card, Checkbox, ErrorState, Input, PageHeader, PageLoader, SectionHeader, Select, StatusBadge, Tabs, Textarea } from '../../components/common/ui.jsx';
import { ConfirmDialog } from '../../components/common/Modal.jsx';
import { TaskFormModal } from '../../components/admin/TaskFormModal.jsx';
import { linesToList, listToLines } from '../../components/admin/AdminKit.jsx';
import { formatDate, WEEKDAYS, WEEKDAYS_SHORT } from '../../utils/format.js';

const TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'Europe/London', 'Asia/Karachi', 'America/New_York'];
  }
})();
const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

function ProgramForm({ program, onSaved }) {
  const toast = useToast();
  const [formError, setFormError] = useState(null);
  const [needsConfirm, setNeedsConfirm] = useState(null);
  const p = program;
  const { register, handleSubmit, setError, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    values: {
      title: p?.title || '',
      slug: p?.slug || '',
      track: p?.track || '',
      shortDescription: p?.shortDescription || '',
      description: p?.description || '',
      startDate: p?.startDate || '',
      endDate: p?.endDate || '',
      durationMonths: p?.durationMonths ?? 3,
      durationWeeks: p?.durationWeeks ?? 12,
      applicationOpenAt: toLocalInput(p?.applicationOpenAt),
      applicationCloseAt: toLocalInput(p?.applicationCloseAt),
      capacity: p?.capacity ?? '',
      timezone: p?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      workingDays: (p?.workingDays || [1, 2, 3, 4, 5]).map(String),
      certificateThreshold: p?.certificateThreshold ?? 70,
      certificateFee: p?.certificateFee ?? 0,
      minCompletionPercent: p?.completionRules?.minCompletionPercent ?? 80,
      releaseTime: p?.scheduleConfig?.releaseTime || '09:00',
      dueTime: p?.scheduleConfig?.dueTime || '23:59',
      dueOffsetDays: p?.scheduleConfig?.dueOffsetDays ?? 0,
      lateSubmissionPolicy: p?.scheduleConfig?.lateSubmissionPolicy || 'accept_flagged',
      revisionGraceDays: p?.scheduleConfig?.revisionGraceDays ?? 7,
      allowEarlyAccess: p?.scheduleConfig?.allowEarlyAccess ?? false,
      allowedFileTypes: p?.submissionConfig?.allowedFileTypes || ['pdf', 'png', 'jpg', 'webp', 'zip'],
      maxFileSizeMB: p?.submissionConfig?.maxFileSizeMB ?? 10,
      maxFiles: p?.submissionConfig?.maxFiles ?? 5,
      maxVersions: p?.submissionConfig?.maxVersions ?? 5,
      allowResubmitBeforeReview: p?.submissionConfig?.allowResubmitBeforeReview ?? true,
      objectives: listToLines(p?.objectives),
      skills: (p?.skills || []).join(', '),
      eligibility: listToLines(p?.eligibility),
      weeklyCurriculum: (p?.weeklyCurriculum || []).map((w) => `${w.week} | ${w.title}`).join('\n'),
      status: p?.status || 'draft',
    },
  });

  const submit = async (v, confirmScheduleChange = false) => {
    setFormError(null);
    const body = {
      title: v.title,
      slug: v.slug || undefined,
      track: v.track,
      shortDescription: v.shortDescription,
      description: v.description,
      startDate: v.startDate,
      endDate: v.endDate,
      durationMonths: Number(v.durationMonths),
      durationWeeks: Number(v.durationWeeks),
      applicationOpenAt: v.applicationOpenAt ? new Date(v.applicationOpenAt).toISOString() : null,
      applicationCloseAt: v.applicationCloseAt ? new Date(v.applicationCloseAt).toISOString() : null,
      capacity: v.capacity === '' ? null : Number(v.capacity),
      timezone: v.timezone,
      workingDays: v.workingDays.map(Number).sort(),
      certificateThreshold: Number(v.certificateThreshold),
      certificateFee: Number(v.certificateFee),
      completionRules: { minCompletionPercent: Number(v.minCompletionPercent), requireAllAssessmentsResolved: true },
      scheduleConfig: { releaseTime: v.releaseTime, dueTime: v.dueTime, dueOffsetDays: Number(v.dueOffsetDays), lateSubmissionPolicy: v.lateSubmissionPolicy, revisionGraceDays: Number(v.revisionGraceDays), allowEarlyAccess: Boolean(v.allowEarlyAccess) },
      submissionConfig: { allowedFileTypes: v.allowedFileTypes, maxFileSizeMB: Number(v.maxFileSizeMB), maxFiles: Number(v.maxFiles), maxVersions: Number(v.maxVersions), allowResubmitBeforeReview: Boolean(v.allowResubmitBeforeReview) },
      objectives: linesToList(v.objectives),
      skills: v.skills.split(',').map((s) => s.trim()).filter(Boolean),
      eligibility: linesToList(v.eligibility),
      weeklyCurriculum: linesToList(v.weeklyCurriculum).map((line, i) => {
        const [a, ...rest] = line.split('|');
        const week = Number(a);
        return rest.length && week ? { week, title: rest.join('|').trim() } : { week: i + 1, title: line };
      }),
      status: v.status,
      ...(confirmScheduleChange ? { confirmScheduleChange: true } : {}),
    };
    try {
      const res = program ? await api.patch(`/admin/internships/${program.id}`, body) : await api.post('/admin/internships', body);
      toast.success(program ? 'Program saved.' : 'Program created. Next, add holidays, reviewers and tasks.');
      setNeedsConfirm(null);
      onSaved(res.data.data);
    } catch (err) {
      if (err.code === 'SCHEDULE_CHANGE_CONFIRMATION_REQUIRED') return setNeedsConfirm({ values: v, message: err.message });
      Object.entries(err.fieldErrors?.() || {}).forEach(([f, m]) => setError(f, { message: m }));
      setFormError(err.message);
    }
  };

  const wd = watch('workingDays');
  const types = watch('allowedFileTypes');

  return (
    <form onSubmit={handleSubmit((v) => submit(v))} className="space-y-6" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <Card>
        <SectionHeader title="Program details" />
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Title" required error={errors.title?.message} {...register('title')} />
          <Input label="Track" required placeholder="e.g. Web Development" hint="Use an existing track or type a new one." error={errors.track?.message} {...register('track')} />
          <Input label="Short description" required className="md:col-span-2" error={errors.shortDescription?.message} {...register('shortDescription')} />
          <Textarea label="Full description" required className="md:col-span-2" rows={5} error={errors.description?.message} {...register('description')} />
          <Input label="URL slug" placeholder="auto-generated" error={errors.slug?.message} {...register('slug')} />
          <Select label="Status" options={[{ value: 'draft', label: 'Draft (hidden)' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }]} {...register('status')} />
        </div>
      </Card>

      <Card>
        <SectionHeader title="Dates & schedule" description="Task dates are generated from the actual program dates, working days, holidays and timezone." />
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Start date" type="date" required error={errors.startDate?.message} {...register('startDate')} />
          <Input label="End date" type="date" required error={errors.endDate?.message} {...register('endDate')} />
          <Select label="Timezone" error={errors.timezone?.message} {...register('timezone')}>{TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
          <Input label="Duration (months)" type="number" min={1} {...register('durationMonths')} />
          <Input label="Duration (weeks)" type="number" min={1} hint="Make a 12-week schedule explicit here." {...register('durationWeeks')} />
          <Input label="Capacity" type="number" min={1} placeholder="Unlimited" error={errors.capacity?.message} {...register('capacity')} />
          <Input label="Applications open" type="datetime-local" error={errors.applicationOpenAt?.message} {...register('applicationOpenAt')} />
          <Input label="Applications close" type="datetime-local" error={errors.applicationCloseAt?.message} {...register('applicationCloseAt')} />
          <div />
          <fieldset className="md:col-span-3">
            <legend className="mb-2 text-[13px] font-medium">Working days</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const on = wd?.includes(String(d));
                return (
                  <button key={d} type="button" aria-pressed={on} onClick={() => setValue('workingDays', on ? wd.filter((x) => x !== String(d)) : [...wd, String(d)], { shouldDirty: true })} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${on ? 'border-primary bg-primary text-white' : 'border-line bg-white text-muted hover:border-primary/40'}`}>
                    {WEEKDAYS_SHORT[d]}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted">Default: Monday–Friday working, Saturday & Sunday off.</p>
          </fieldset>
          <Input label="Task release time" type="time" {...register('releaseTime')} />
          <Input label="Task due time" type="time" {...register('dueTime')} />
          <Input label="Due after (days)" type="number" min={0} max={14} hint="0 = due the same day" {...register('dueOffsetDays')} />
          <Select label="Late submissions" options={[{ value: 'accept_flagged', label: 'Accept and flag as late' }, { value: 'reject', label: 'Reject after deadline' }]} {...register('lateSubmissionPolicy')} />
          <Input label="Revision grace period (days after end)" type="number" min={0} max={60} {...register('revisionGraceDays')} />
          <div className="flex items-end"><Checkbox label="Allow early access" description="Let participants open tasks before release." {...register('allowEarlyAccess')} /></div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Assessment & certificate rules" description="These values are the single source of truth for dashboards, scoring and certificate issuance." />
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Certificate threshold (%)" type="number" min={0} max={100} step="0.01" error={errors.certificateThreshold?.message} {...register('certificateThreshold')} />
          <Input label="Certificate fee (PKR)" type="number" min={0} step={1} hint="Set to 0 for a free certificate." error={errors.certificateFee?.message} {...register('certificateFee')} />
          <Input label="Minimum completion (%)" type="number" min={0} max={100} hint="Share of required tasks that must be approved." {...register('minCompletionPercent')} />
          <div className="rounded-xl bg-primary-50 p-3 text-xs leading-5 text-muted">Final score = marks awarded ÷ marks available on required tasks × 100. Unsubmitted required tasks count as zero; optional tasks are excluded.</div>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-[13px] font-medium">Allowed file types</legend>
            <div className="flex flex-wrap gap-4">
              {['pdf', 'png', 'jpg', 'webp', 'zip'].map((t) => (
                <Checkbox key={t} label={t.toUpperCase()} checked={types?.includes(t)} onChange={(e) => setValue('allowedFileTypes', e.target.checked ? [...types, t] : types.filter((x) => x !== t), { shouldDirty: true })} />
              ))}
            </div>
          </fieldset>
          <Input label="Max file size (MB)" type="number" min={1} max={25} {...register('maxFileSizeMB')} />
          <Input label="Max files per submission" type="number" min={1} max={10} {...register('maxFiles')} />
          <Input label="Max versions per task" type="number" min={1} max={20} {...register('maxVersions')} />
          <div className="flex items-end"><Checkbox label="Allow resubmitting before review" {...register('allowResubmitBeforeReview')} /></div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Public program content" />
        <div className="grid gap-4 md:grid-cols-2">
          <Textarea label="Learning objectives (one per line)" rows={4} {...register('objectives')} />
          <Textarea label="Eligibility (one per line)" rows={4} {...register('eligibility')} />
          <Input label="Skills (comma-separated)" className="md:col-span-2" {...register('skills')} />
          <Textarea label="Weekly curriculum (one per line: week | title)" className="md:col-span-2" rows={5} {...register('weeklyCurriculum')} />
        </div>
      </Card>
      <div className="flex justify-end"><Button type="submit" size="lg" loading={isSubmitting}>{program ? 'Save program' : 'Create program'}</Button></div>
      <ConfirmDialog open={Boolean(needsConfirm)} onClose={() => setNeedsConfirm(null)} onConfirm={() => submit(needsConfirm.values, true)} tone="primary" title="Confirm schedule change" confirmLabel="Save anyway" message={needsConfirm?.message} />
    </form>
  );
}

function ScheduleTab({ program, onChanged }) {
  const { data: tasks, loading, reload } = useApi('/admin/internship-tasks', { params: { programId: program.id, pageSize: 100 } });
  const { data: tasks2 } = useApi(tasks && tasks.length === 100 ? '/admin/internship-tasks' : null, { params: { programId: program.id, pageSize: 100, page: 2 } });
  const [week, setWeek] = useState(1);
  const [modal, setModal] = useState(null);
  const all = useMemo(() => [...(tasks || []), ...(tasks2 || [])], [tasks, tasks2]);
  const days = program.schedule.days.filter((d) => d.weekNumber === week);
  const total = program.schedule.totalWeeks;
  const counts = { published: all.filter((t) => t.status === 'published').length, draft: all.filter((t) => t.status === 'draft').length };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{all.length} tasks · {counts.published} published · {counts.draft} drafts · {program.schedule.days.filter((d) => d.isWorkingDay).length} working days</p>
        <Button icon={Plus} onClick={() => setModal({ defaultDate: days.find((d) => d.isWorkingDay)?.date })}>Add task</Button>
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Program weeks">
        {Array.from({ length: total }, (_, i) => i + 1).map((w) => (
          <button key={w} type="button" role="tab" aria-selected={w === week} onClick={() => setWeek(w)} className={`h-8 min-w-10 rounded-lg px-2 text-xs font-semibold ${w === week ? 'bg-primary text-white' : 'bg-white text-muted ring-1 ring-line hover:text-primary'}`}>W{w}</button>
        ))}
      </div>
      {loading && !tasks ? <PageLoader /> : (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d) => {
            const dayTasks = all.filter((t) => t.scheduledDate === d.date);
            return (
              <div key={d.date} className={`flex min-h-36 flex-col rounded-xl border p-2.5 ${d.isWorkingDay ? 'border-line bg-white' : 'border-dashed border-line bg-page'}`}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-xs font-semibold">{WEEKDAYS_SHORT[d.weekday]} {Number(d.date.slice(8))}</span>
                  <span className="text-[10px] text-muted">{d.dayType === 'holiday' ? 'Holiday' : d.isWorkingDay ? '' : 'Off'}</span>
                </div>
                <ul className="flex-1 space-y-1.5">
                  {dayTasks.map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => setModal({ task: t })} className="w-full rounded-lg bg-primary-50 p-2 text-left text-[11px] leading-4 hover:bg-primary-light">
                        <span className="line-clamp-3 font-medium text-ink">{t.title}</span>
                        <span className="mt-1 flex items-center justify-between text-muted"><span>{t.maxMarks} pts</span>{t.status !== 'published' && <span className="font-semibold uppercase">{t.status}</span>}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {d.isWorkingDay && <button type="button" onClick={() => setModal({ defaultDate: d.date })} className="mt-2 rounded-lg py-1 text-[11px] font-medium text-primary hover:bg-primary-50">+ Add</button>}
              </div>
            );
          })}
        </div>
      )}
      {modal && <TaskFormModal open onClose={() => setModal(null)} program={program} task={modal.task} defaultDate={modal.defaultDate} onSaved={() => { reload(); onChanged(); }} />}
    </div>
  );
}

function HolidaysTab({ program, onChanged }) {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/admin/internships/${program.id}/holidays`, { date, name });
      toast.success('Holiday added.');
      if (res.data.data.warning) toast.warning(res.data.data.warning, { duration: 8000 });
      setDate('');
      setName('');
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (h) => {
    try {
      await api.delete(`/admin/internships/${program.id}/holidays/${h.id}`);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <SectionHeader title="Program holidays" description="No tasks can be scheduled on holidays without an explicit exception." />
        {program.holidays.length ? (
          <ul className="divide-y divide-line">
            {program.holidays.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-3 text-sm">
                <span className="font-medium">{formatDate(h.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="flex-1 text-muted">{h.name}</span>
                <button type="button" onClick={() => remove(h)} className="rounded-lg p-1.5 text-muted hover:bg-danger-light hover:text-danger" aria-label={`Remove ${h.name}`}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No holidays configured.</p>}
      </Card>
      <Card className="h-fit">
        <form onSubmit={add} className="space-y-4">
          <h2 className="font-semibold">Add holiday</h2>
          <Input label="Date" type="date" required min={program.startDate} max={program.endDate} value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. National holiday" />
          <Button type="submit" icon={CalendarPlus} loading={busy} disabled={!date || name.trim().length < 2}>Add holiday</Button>
        </form>
      </Card>
    </div>
  );
}

function ReviewersTab({ program, onChanged }) {
  const toast = useToast();
  const { data: reviewers } = useApi('/admin/reviewers');
  const { data: enrollments } = useApi('/admin/internship-enrollments', { params: { programId: program.id, pageSize: 50 } });
  const [reviewerId, setReviewerId] = useState('');
  const [enrollmentId, setEnrollmentId] = useState('');
  const assign = async () => {
    try {
      await api.post(`/admin/internships/${program.id}/reviewers`, { reviewerId, enrollmentId: enrollmentId || null });
      toast.success('Reviewer assigned.');
      setReviewerId('');
      setEnrollmentId('');
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };
  const remove = async (a) => {
    try {
      await api.delete(`/admin/internships/${program.id}/reviewers/${a.id}`);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <SectionHeader title="Assigned reviewers" description="Reviewers can only assess participants in programs (or for individual participants) they are assigned to." />
        {program.reviewers.length ? (
          <ul className="divide-y divide-line">
            {program.reviewers.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3 text-sm">
                <div className="flex-1"><p className="font-medium">{a.reviewer.name}</p><p className="text-xs text-muted">{a.reviewer.email}</p></div>
                <Badge tone={a.scope === 'program' ? 'primary' : 'neutral'}>{a.scope === 'program' ? 'Whole program' : `Only ${a.participant?.name}`}</Badge>
                <button type="button" onClick={() => remove(a)} className="rounded-lg p-1.5 text-muted hover:bg-danger-light hover:text-danger" aria-label="Remove assignment"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        ) : <Alert tone="warning">No reviewers are assigned yet. Submissions can still be assessed by admins.</Alert>}
      </Card>
      <Card className="h-fit space-y-4">
        <h2 className="font-semibold">Assign reviewer</h2>
        <Select label="Reviewer" placeholder="Choose a reviewer" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} options={(reviewers || []).map((r) => ({ value: r.id, label: `${r.name} (${r.role})` }))} hint="Create reviewer accounts under Students & Users." />
        <Select label="Scope" value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} options={[{ value: '', label: 'Whole program' }, ...(enrollments || []).map((e) => ({ value: e.id, label: `Only: ${e.participant.name}` }))]} />
        <Button icon={UserPlus} onClick={assign} disabled={!reviewerId}>Assign</Button>
      </Card>
    </div>
  );
}

export default function AdminProgramEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = !id;
  const { data: program, loading, error, reload } = useApi(isNew ? null : `/admin/internships/${id}`);
  const [tab, setTab] = useState('settings');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  useDocumentTitle(isNew ? 'New program' : program?.title || 'Program');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!isNew && (loading || !program)) return <PageLoader />;

  const evaluate = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/admin/internships/${id}/evaluate`);
      const s = res.data.data;
      toast.success(`Evaluated ${s.evaluated}: ${s.qualified} qualified, ${s.notQualified} not qualified, ${s.awaiting} awaiting assessments.`);
      setConfirm(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/internships/${id}`);
      toast.success('Program deleted.');
      navigate('/admin/internships');
    } catch (err) {
      toast.error(err.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ to: '/admin/internships', label: 'Internship Programs' }, { label: isNew ? 'New program' : program.title }]}
        title={isNew ? 'New internship program' : program.title}
        description={!isNew && <span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={program.status} /> {program.track} · {formatDate(program.startDate)} – {formatDate(program.endDate)} · {program.workingDays.map((d) => WEEKDAYS[d].slice(0, 3)).join(', ')} · {program.timezone} · release {program.scheduleConfig.releaseTime}, due {program.scheduleConfig.dueTime}</span>}
        actions={!isNew && (
          <>
            <ButtonLink to={`/internship/${program.slug}`} target="_blank" variant="outline" size="sm" icon={ExternalLink}>Public page</ButtonLink>
            <ButtonLink to={`/admin/internship-applications?programId=${program.id}`} variant="outline" size="sm" icon={ClipboardList}>Applications</ButtonLink>
            <ButtonLink to={`/admin/internship-participants?programId=${program.id}`} variant="outline" size="sm" icon={Users}>Participants</ButtonLink>
            <ButtonLink to={`/admin/reports?programId=${program.id}`} variant="outline" size="sm" icon={BarChart3}>Report</ButtonLink>
            <Button size="sm" variant="secondary" icon={PlayCircle} onClick={() => setConfirm('evaluate')}>Evaluate completion</Button>
            <Button size="sm" variant="danger-outline" icon={Trash2} onClick={() => setConfirm('delete')}>Delete</Button>
          </>
        )}
      />
      {!isNew && <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ value: 'settings', label: 'Settings' }, { value: 'schedule', label: 'Schedule & tasks' }, { value: 'holidays', label: 'Holidays', count: program.holidays.length }, { value: 'reviewers', label: 'Reviewers', count: program.reviewers.length }]} />}
      {tab === 'settings' && <ProgramForm program={program} onSaved={(p) => (isNew ? navigate(`/admin/internships/${p.id}`, { replace: true }) : reload())} />}
      {tab === 'schedule' && program && <ScheduleTab program={program} onChanged={reload} />}
      {tab === 'holidays' && program && <HolidaysTab program={program} onChanged={reload} />}
      {tab === 'reviewers' && program && <ReviewersTab program={program} onChanged={reload} />}
      <ConfirmDialog open={confirm === 'evaluate'} onClose={() => setConfirm(null)} onConfirm={evaluate} loading={busy} tone="primary" title="Evaluate completion" confirmLabel="Evaluate now" message="Recalculates every active participant from authoritative records. Participants are only completed after the end date when no required assessments are pending; eligible participants receive certificates (never duplicated). This also runs automatically every 15 minutes." />
      <ConfirmDialog open={confirm === 'delete'} onClose={() => setConfirm(null)} onConfirm={remove} loading={busy} title="Delete program?" confirmLabel="Delete program" message="Programs with applications cannot be deleted — archive them instead. Deleting removes its tasks and holidays." />
    </div>
  );
}
