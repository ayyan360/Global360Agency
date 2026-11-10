import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CheckCircle2, ExternalLink, FileText, FolderGit2 as Github, Globe, HelpCircle, Paperclip, Send } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Badge, Button, ButtonLink, Card, ErrorState, Input, PageLoader, StatusBadge, Textarea } from '../../components/common/ui.jsx';
import { FileUpload } from '../../components/forms/FileUpload.jsx';
import { DECISION_LABELS } from '../../constants/status.js';
import { apiUrl } from '../../services/api.js';
import { formatBytes, formatDateTime } from '../../utils/format.js';
import NotFoundPage from '../errors/NotFoundPage.jsx';

const isUrl = (v) => !v || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v);

function SubmissionForm({ detail, onSubmitted }) {
  const toast = useToast();
  const { task, submissionPolicy: policy } = detail;
  const types = task.submissionTypes;
  const [text, setText] = useState('');
  const [repo, setRepo] = useState('');
  const [live, setLive] = useState('');
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (repo && !isUrl(repo)) errs.repositoryUrl = 'Enter a valid http(s) URL';
    if (live && !isUrl(live)) errs.liveUrl = 'Enter a valid http(s) URL';
    if (!text.trim() && !repo && !live && !files.length) errs.form = 'Add at least one of: a written explanation, a link, or a file.';
    setErrors(errs);
    setFormError(errs.form || null);
    if (Object.keys(errs).length) return;
    const fd = new FormData();
    if (text.trim()) fd.append('submissionText', text.trim());
    if (repo) fd.append('repositoryUrl', repo.trim());
    if (live) fd.append('liveUrl', live.trim());
    files.forEach((f) => fd.append('files', f));
    setSubmitting(true);
    try {
      await api.post(`/student/internship/tasks/${task.id}/submissions`, fd);
      toast.success('Your work was submitted for review.');
      setText(''); setRepo(''); setLive(''); setFiles([]);
      onSubmitted();
    } catch (err) {
      setErrors(err.fieldErrors?.() || {});
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      {types.includes('file') && (
        <div>
          <p className="mb-1.5 text-[13px] font-medium">Files</p>
          <FileUpload files={files} onChange={setFiles} allowedTypes={policy.allowedFileTypes} maxSizeMB={policy.maxFileSizeMB} maxFiles={policy.maxFiles} />
        </div>
      )}
      {types.includes('repository') && <Input label="Repository URL" icon={Github} type="url" placeholder="https://github.com/you/project" value={repo} onChange={(e) => setRepo(e.target.value)} error={errors.repositoryUrl} />}
      {types.includes('live') && <Input label="Live project URL" icon={Globe} type="url" placeholder="https://" value={live} onChange={(e) => setLive(e.target.value)} error={errors.liveUrl} />}
      {types.includes('text') && <Textarea label="Description / explanation" rows={5} placeholder="What did you build? Which decisions did you make? Anything you'd like the reviewer to know?" value={text} onChange={(e) => setText(e.target.value)} error={errors.submissionText} maxLength={20000} />}
      <Button type="submit" size="lg" block icon={Send} loading={submitting}>Submit for review</Button>
      <p className="text-center text-xs text-muted">Submitting is not the same as completing: a reviewer must approve your work for it to count.</p>
    </form>
  );
}

function History({ submissions, timezone }) {
  if (!submissions.length) return <p className="text-sm text-muted">You haven't submitted this task yet.</p>;
  return (
    <ol className="space-y-4">
      {submissions.map((s) => (
        <li key={s.id} className={`rounded-xl border p-4 ${s.status === 'superseded' ? 'border-line bg-page/60' : 'border-line bg-white'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Version {s.version}</span>
            <StatusBadge status={s.status} />
            {s.isLate && <Badge tone="warning">Late</Badge>}
            <span className="ml-auto text-xs text-muted">Submitted {formatDateTime(s.submittedAt, timezone)}</span>
          </div>
          {s.submissionText && <p className="mt-3 whitespace-pre-line text-sm text-ink/90">{s.submissionText}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {s.repositoryUrl && <a href={s.repositoryUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline"><Github className="size-4" /> Repository <ExternalLink className="size-3" /></a>}
            {s.liveUrl && <a href={s.liveUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline"><Globe className="size-4" /> Live project <ExternalLink className="size-3" /></a>}
            {s.attachments.map((a) => (
              <a key={a.id} href={apiUrl(`/attachments/${a.id}`)} className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2 py-1 text-xs text-primary hover:bg-primary-light">
                <Paperclip className="size-3.5" /> {a.originalFileName} <span className="text-muted">({formatBytes(a.sizeBytes)})</span>
              </a>
            ))}
          </div>
          {s.assessments.map((a) => (
            <div key={a.id} className={`mt-3 rounded-lg p-3 text-sm ${a.decision === 'approve' ? 'bg-success-light' : a.decision === 'reject' ? 'bg-danger-light' : 'bg-warning-light'} ${a.superseded ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{DECISION_LABELS[a.decision]}{a.superseded && ' (superseded)'}</span>
                {a.marksAwarded !== null && <span className="font-semibold">{a.marksAwarded} marks{!a.isFinal && ' (provisional)'}</span>}
              </div>
              <p className="mt-1 whitespace-pre-line text-ink/80">{a.feedback}</p>
              <p className="mt-1 text-xs text-muted">{a.reviewer?.name} · {formatDateTime(a.assessedAt, timezone)}</p>
            </div>
          ))}
        </li>
      ))}
    </ol>
  );
}

export default function InternshipTaskDetailPage() {
  const { taskId } = useParams();
  const { data, loading, error, reload } = useApi(`/student/internship/tasks/${taskId}`);
  const { data: submissions, reload: reloadSubs } = useApi(data ? `/student/internship/tasks/${taskId}/submissions` : null);
  useDocumentTitle(data?.task?.title || 'Task');

  if (error?.status === 404) return <NotFoundPage />;
  if (error?.status === 403) return <Card className="text-center"><CalendarClock className="mx-auto size-10 text-primary" /><p className="mt-3 font-semibold">Not available yet</p><p className="mt-1 text-sm text-muted">{error.message}</p><ButtonLink to="/student/internship/tasks" variant="outline" className="mt-5">Back to tasks</ButtonLink></Card>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;
  const { task, program, canSubmit, cannotSubmitReason } = data;
  const tz = program.timezone;
  const latest = submissions?.find((s) => s.status !== 'superseded');

  return (
    <div className="space-y-6">
      <Link to="/student/internship/tasks" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary"><ArrowLeft className="size-4" /> Back to tasks</Link>
      <div>
        <h1 className="text-2xl font-bold">Upload Task</h1>
        <p className="mt-1 text-sm text-muted">Submit your work for this task.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <div className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-light text-primary"><FileText className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold">{task.title}</h2>
                  <StatusBadge status={task.status} />
                </div>
                <p className="mt-1 text-sm text-muted">{task.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {task.skills.map((s) => <Badge key={s}>{s}</Badge>)}
                  <span>Week {task.weekNumber}</span>·<span>Due {formatDateTime(task.dueAt, tz)}</span>·<span>Max {task.maxMarks} marks</span>{!task.isRequired && <Badge tone="outline">Optional</Badge>}
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-5 border-t border-line pt-5">
              <section>
                <h3 className="text-sm font-semibold">Instructions</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">{task.instructions}</p>
              </section>
              {task.requirements.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold">Requirements</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{task.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
                </section>
              )}
              {task.resources.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold">Reference materials</h3>
                  <ul className="mt-2 space-y-1 text-sm">{task.resources.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">{r.label} <ExternalLink className="size-3" /></a></li>)}</ul>
                </section>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold">{latest?.status === 'revision_required' ? 'Submit a revision' : latest ? 'Submit a new version' : 'Submit your work'}</h2>
            {canSubmit ? (
              <>
                {latest?.status === 'submitted' && <Alert tone="info" className="mb-4">You already submitted version {latest.version}. A new submission will replace it before review starts.</Alert>}
                {new Date(task.dueAt) < new Date() && !latest && <Alert tone="warning" className="mb-4" title="This task is past its deadline">Late submissions are accepted and flagged as late for the reviewer.</Alert>}
                <SubmissionForm detail={data} onSubmitted={() => { reload(); reloadSubs(); }} />
              </>
            ) : (
              <Alert tone={latest?.status === 'approved' ? 'success' : 'info'} icon={latest?.status === 'approved' ? CheckCircle2 : undefined}>{cannotSubmitReason}</Alert>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold">Submission history</h2>
            {submissions ? <History submissions={submissions} timezone={tz} /> : <PageLoader />}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="font-semibold">Task Guidelines</h2>
            <ul className="mt-3 space-y-2.5">
              {(task.acceptanceCriteria.length ? task.acceptanceCriteria : ['Follow the instructions', 'Explain your approach']).map((c) => (
                <li key={c} className="flex gap-2 text-sm text-muted"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> {c}</li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="font-semibold">Submission policy</h2>
            <ul className="mt-3 space-y-1.5 text-xs leading-5 text-muted">
              <li>Accepted files: {data.submissionPolicy.allowedFileTypes.join(', ').toUpperCase()} (max {data.submissionPolicy.maxFileSizeMB} MB each, {data.submissionPolicy.maxFiles} files)</li>
              <li>Up to {data.submissionPolicy.maxVersions} versions per task</li>
              <li>Late work: {data.submissionPolicy.lateSubmissionPolicy === 'reject' ? 'not accepted after the deadline' : 'accepted and flagged as late'}</li>
              <li>Deadlines use {tz} time</li>
            </ul>
          </Card>
          <Card className="bg-primary-50">
            <HelpCircle className="size-6 text-primary" aria-hidden="true" />
            <h2 className="mt-2 font-semibold">Need help?</h2>
            <p className="mt-1 text-sm text-muted">Contact the Global360 team if something about the task is unclear.</p>
            <ButtonLink to="/contact?subject=Internship%20program" variant="outline" size="sm" className="mt-3">Contact support</ButtonLink>
          </Card>
        </aside>
      </div>
    </div>
  );
}
