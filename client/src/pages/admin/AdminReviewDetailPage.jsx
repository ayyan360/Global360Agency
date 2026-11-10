import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, FolderGit2, Globe, History, Paperclip, PencilLine } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { api, apiUrl } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Badge, Button, Card, ErrorState, Input, KeyValue, PageHeader, PageLoader, SectionHeader, StatusBadge, Textarea } from '../../components/common/ui.jsx';
import { Modal, ConfirmDialog } from '../../components/common/Modal.jsx';
import { DECISION_LABELS } from '../../constants/status.js';
import { formatBytes, formatDateTime, titleCase } from '../../utils/format.js';

function AssessmentForm({ submission, task, onDone }) {
  const toast = useToast();
  const [decision, setDecision] = useState('approve');
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    const m = marks === '' ? null : Number(marks);
    if (decision !== 'request_revision' && m === null) errs.marksAwarded = 'Marks are required to approve or reject.';
    if (m !== null && (Number.isNaN(m) || m < 0 || m > task.maxMarks)) errs.marksAwarded = `Enter a value between 0 and ${task.maxMarks}.`;
    if (feedback.trim().length < 5) errs.feedback = 'Write at least a short piece of feedback.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (decision !== 'request_revision') return setConfirming(m);
    return send(m);
  };
  const send = async (m) => {
    setConfirming(null);
    setSaving(true);
    try {
      await api.post(`/admin/internship-submissions/${submission.id}/assessments`, { decision, marksAwarded: m, feedback: feedback.trim() });
      toast.success('Assessment recorded and the participant has been notified.');
      onDone();
    } catch (err) {
      setErrors({ ...(err.fieldErrors?.() || {}), form: err.message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">Decision</legend>
        <div className="grid grid-cols-3 gap-2">
          {[['approve', 'Approve', 'success'], ['request_revision', 'Request revision', 'warning'], ['reject', 'Reject', 'danger']].map(([v, l, tone]) => (
            <label key={v} className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-medium ${decision === v ? (tone === 'success' ? 'border-success bg-success-light text-success' : tone === 'warning' ? 'border-warning bg-warning-light text-amber-700' : 'border-danger bg-danger-light text-danger') : 'border-line text-muted hover:border-primary/40'}`}>
              <input type="radio" name="decision" value={v} checked={decision === v} onChange={() => setDecision(v)} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <Input label={`Marks (0–${task.maxMarks})${decision === 'request_revision' ? ' — optional, provisional' : ''}`} type="number" min={0} max={task.maxMarks} step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} error={errors.marksAwarded} />
      <Textarea label="Feedback to participant" required rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} error={errors.feedback} />
      <Button type="submit" block loading={saving}>{decision === 'request_revision' ? 'Request revision' : 'Finalize assessment'}</Button>
      <ConfirmDialog open={confirming !== null} onClose={() => setConfirming(null)} onConfirm={() => send(confirming)} tone="primary" title="Finalize assessment?" confirmLabel="Finalize" message={`Record "${DECISION_LABELS[decision]}" with ${confirming}/${task.maxMarks} marks? Finalized assessments can only be changed later by an audited admin amendment.`} />
    </form>
  );
}

function AmendModal({ assessment, maxMarks, onClose, onDone }) {
  const toast = useToast();
  const [decision, setDecision] = useState(assessment.decision);
  const [marks, setMarks] = useState(String(assessment.marksAwarded));
  const [feedback, setFeedback] = useState(assessment.feedback);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/admin/internship-assessments/${assessment.id}/amend`, { decision, marksAwarded: Number(marks), feedback, reason });
      toast.success('Assessment amended. The original is kept in the history.');
      onDone();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Amend finalized assessment" description="The previous assessment is preserved and marked as superseded. This action is audited." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving} disabled={reason.trim().length < 5}>Save amendment</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
        <label className="space-y-1.5 text-[13px] font-medium">Decision
          <select value={decision} onChange={(e) => setDecision(e.target.value)} className="block h-11 w-full rounded-[10px] border border-line bg-white px-3 text-sm"><option value="approve">Approve</option><option value="reject">Reject</option></select>
        </label>
        <Input label={`Marks (0–${maxMarks})`} type="number" min={0} max={maxMarks} step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} />
        <Textarea label="Feedback" className="sm:col-span-2" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        <Textarea label="Reason for amendment" required className="sm:col-span-2" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} hint="At least 5 characters; recorded in the audit log." />
      </div>
    </Modal>
  );
}

export default function AdminReviewDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/admin/internship-submissions/${id}`);
  const [amending, setAmending] = useState(null);
  useDocumentTitle('Review submission');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;
  const { submission, task, participant, program, versions } = data;
  const current = versions.find((v) => v.id === submission.id);
  const assessable = submission.isLatest && ['submitted', 'under_review'].includes(submission.status);

  const startReview = async () => {
    try {
      await api.post(`/admin/internship-submissions/${id}/start-review`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ to: '/admin/reviews', label: 'Submission Reviews' }, { label: `${participant.name} — ${task.title}` }]}
        title={task.title}
        description={<span className="inline-flex flex-wrap items-center gap-2">{participant.name} · {program.title} · Week {task.weekNumber} · <StatusBadge status={submission.status} /></span>}
        actions={submission.status === 'submitted' && submission.isLatest && <Button variant="outline" onClick={startReview}>Mark as under review</Button>}
      />
      {!submission.isLatest && <Alert tone="warning">You are viewing an older version. <Link to={`/admin/reviews/${versions.find((v) => v.status !== 'superseded')?.id}`} className="link">Open the latest version</Link>.</Alert>}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <SectionHeader title={`Version ${current.version}`} description={`Submitted ${formatDateTime(current.submittedAt, program.timezone)}${current.isLate ? ' · late' : ''}`} action={current.isLate && <Badge tone="warning">Late submission</Badge>} />
            {current.submissionText ? <p className="whitespace-pre-line rounded-xl bg-primary-50 p-4 text-sm leading-6">{current.submissionText}</p> : <p className="text-sm text-muted">No written explanation.</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {current.repositoryUrl && <a href={current.repositoryUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-primary hover:bg-primary-50"><FolderGit2 className="size-4" /> Repository <ExternalLink className="size-3" /></a>}
              {current.liveUrl && <a href={current.liveUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-primary hover:bg-primary-50"><Globe className="size-4" /> Live project <ExternalLink className="size-3" /></a>}
              {current.attachments.map((a) => (
                <a key={a.id} href={apiUrl(`/attachments/${a.id}`)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-primary hover:bg-primary-50"><Paperclip className="size-4" /> {a.originalFileName} <span className="text-xs text-muted">{formatBytes(a.sizeBytes)}</span></a>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Versions & assessment history" />
            <ol className="space-y-4">
              {versions.map((v) => (
                <li key={v.id} className={`rounded-xl border p-4 ${v.id === submission.id ? 'border-primary/40 bg-primary-50/40' : 'border-line'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/admin/reviews/${v.id}`} className="text-sm font-semibold hover:text-primary">Version {v.version}</Link>
                    <StatusBadge status={v.status} />
                    <span className="ml-auto text-xs text-muted">{formatDateTime(v.submittedAt, program.timezone)}</span>
                  </div>
                  {v.assessments.map((a) => (
                    <div key={a.id} className={`mt-3 rounded-lg border border-line bg-white p-3 text-sm ${a.supersededAt ? 'opacity-60' : ''}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{DECISION_LABELS[a.decision]}{a.isFinal ? '' : ' (not final)'}{a.supersededAt ? ' — superseded' : ''}</span>
                        <span className="flex items-center gap-2">
                          {a.marksAwarded !== null && <b>{a.marksAwarded}/{task.maxMarks}</b>}
                          {can('assessments:amend') && a.isFinal && !a.supersededAt && <button type="button" onClick={() => setAmending(a)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><PencilLine className="size-3.5" /> Amend</button>}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-muted">{a.feedback}</p>
                      {a.amendmentReason && <p className="mt-1 text-xs text-amber-700">Amendment reason: {a.amendmentReason}</p>}
                      <p className="mt-1 text-xs text-muted">{a.reviewer?.name} · {formatDateTime(a.assessedAt)}</p>
                    </div>
                  ))}
                  <details className="mt-3">
                    <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted hover:text-primary"><History className="size-3.5" /> Activity ({v.history.length})</summary>
                    <ul className="mt-2 space-y-1 border-l-2 border-line pl-3 text-xs text-muted">
                      {v.history.map((h) => <li key={h.id}>{formatDateTime(h.createdAt)} — {titleCase(h.action)}{h.actor ? ` by ${h.actor.name}` : ''}{h.newStatus ? ` → ${titleCase(h.newStatus)}` : ''}</li>)}
                    </ul>
                  </details>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeader title="Assess submission" className="mb-3" />
            {assessable ? <AssessmentForm submission={submission} task={task} onDone={reload} /> : <p className="text-sm text-muted">{submission.status === 'revision_required' ? 'Waiting for the participant to submit a revision.' : ['approved', 'rejected'].includes(submission.status) ? 'This submission has a finalized assessment.' : 'Only the latest version awaiting review can be assessed.'}</p>}
          </Card>
          <Card>
            <SectionHeader title="Task" className="mb-3" />
            <dl className="space-y-3">
              <KeyValue label="Participant">{participant.name} <span className="text-muted">({participant.email})</span></KeyValue>
              <KeyValue label="Due">{formatDateTime(task.dueAt, program.timezone)}</KeyValue>
              <KeyValue label="Max marks">{task.maxMarks}{task.isRequired ? '' : ' (optional task)'}</KeyValue>
            </dl>
            <h3 className="mt-4 text-sm font-semibold">Instructions</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-muted">{task.instructions}</p>
            {task.acceptanceCriteria?.length > 0 && (
              <>
                <h3 className="mt-4 text-sm font-semibold">Acceptance criteria</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{task.acceptanceCriteria.map((c) => <li key={c}>{c}</li>)}</ul>
              </>
            )}
          </Card>
        </div>
      </div>
      {amending && <AmendModal assessment={amending} maxMarks={task.maxMarks} onClose={() => setAmending(null)} onDone={reload} />}
    </div>
  );
}
