import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Button, ButtonLink, Card, ErrorState, KeyValue, PageHeader, PageLoader, SectionHeader, StatusBadge, Textarea } from '../../components/common/ui.jsx';
import { formatDate, formatDateTime } from '../../utils/format.js';
import { ConfirmDialog } from '../../components/common/Modal.jsx';

const TRANSITIONS = {
  pending: ['under_review', 'approved', 'waitlisted', 'rejected'],
  under_review: ['approved', 'waitlisted', 'rejected'],
  waitlisted: ['under_review', 'approved', 'rejected'],
};
const LABELS = { under_review: 'Mark under review', approved: 'Approve', waitlisted: 'Waitlist', rejected: 'Reject' };
const VARIANTS = { approved: 'primary', rejected: 'danger-outline', waitlisted: 'outline', under_review: 'outline' };

export default function AdminApplicationDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { data: a, loading, error, reload } = useApi(`/admin/internship-applications/${id}`);
  const [publicFeedback, setPublicFeedback] = useState('');
  const [internalNotes, setInternalNotes] = useState(null);
  const [busy, setBusy] = useState(null);
  const [confirmReject, setConfirmReject] = useState(false);
  useDocumentTitle(a ? `Application: ${a.fullName}` : 'Application');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !a) return <PageLoader />;
  const notes = internalNotes ?? a.internalNotes ?? '';

  const decide = async (status) => {
    setConfirmReject(false);
    setBusy(status);
    try {
      await api.post(`/admin/internship-applications/${id}/decision`, { status, publicFeedback: publicFeedback || undefined, internalNotes: notes || undefined });
      toast.success(status === 'approved' ? 'Application approved and enrollment created.' : 'Application updated.');
      setPublicFeedback('');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const options = TRANSITIONS[a.status] || [];
  return (
    <div className="space-y-6">
      <PageHeader breadcrumbs={[{ to: '/admin/internship-applications', label: 'Applications' }, { label: a.fullName }]} title={a.fullName} description={<span className="inline-flex items-center gap-2"><StatusBadge status={a.status} /> Applied {formatDateTime(a.createdAt)} for {a.program.title}</span>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <SectionHeader title="Applicant" />
            <dl className="grid gap-4 sm:grid-cols-2">
              <KeyValue label="Full name">{a.fullName}</KeyValue>
              <KeyValue label="Email (account)">{a.email}</KeyValue>
              <KeyValue label="Phone">{a.phone || '—'}</KeyValue>
              <KeyValue label="Account created">{formatDate(a.applicant?.createdAt)}</KeyValue>
              <KeyValue label="Education" className="sm:col-span-2">{a.education || '—'}</KeyValue>
              <KeyValue label="Portfolio / GitHub" className="sm:col-span-2">{a.portfolioUrl ? <a href={a.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow" className="link inline-flex items-center gap-1">{a.portfolioUrl} <ExternalLink className="size-3" /></a> : '—'}</KeyValue>
            </dl>
          </Card>
          <Card>
            <SectionHeader title="Application" />
            <div className="space-y-5 text-sm">
              <section><h3 className="font-semibold">Motivation</h3><p className="mt-1 whitespace-pre-line text-muted">{a.motivation}</p></section>
              <section><h3 className="font-semibold">Existing skills</h3><p className="mt-1 whitespace-pre-line text-muted">{a.skills || '—'}</p></section>
              <section><h3 className="font-semibold">Experience</h3><p className="mt-1 whitespace-pre-line text-muted">{a.experience || '—'}</p></section>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <SectionHeader title="Decision" className="mb-3" />
            <dl className="mb-4 grid grid-cols-2 gap-3">
              <KeyValue label="Program"><Link to={`/admin/internships/${a.program.id}`} className="link">{a.program.title}</Link></KeyValue>
              <KeyValue label="Capacity">{a.program.capacity ?? 'Unlimited'}</KeyValue>
              {a.reviewer && <KeyValue label="Last reviewed by">{a.reviewer.name}</KeyValue>}
              {a.reviewedAt && <KeyValue label="Reviewed">{formatDateTime(a.reviewedAt)}</KeyValue>}
            </dl>
            {a.enrollment && (
              <Alert tone="success" className="mb-4" title="Enrollment created">
                <ButtonLink to={`/admin/internship-participants/${a.enrollment.id}`} size="sm" variant="outline" className="mt-2">View participant</ButtonLink>
              </Alert>
            )}
            {options.length ? (
              <div className="space-y-4">
                <Textarea label="Feedback to applicant (visible to them)" rows={3} value={publicFeedback} onChange={(e) => setPublicFeedback(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  {options.map((s) => <Button key={s} variant={VARIANTS[s]} loading={busy === s} disabled={Boolean(busy)} onClick={() => (s === 'rejected' ? setConfirmReject(true) : decide(s))} className={s === 'approved' ? 'col-span-2' : ''}>{LABELS[s]}</Button>)}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">This application is {a.status.replace(/_/g, ' ')}; no further decisions are possible.</p>
            )}
            {a.publicFeedback && <p className="mt-4 rounded-lg bg-primary-50 p-3 text-xs text-muted"><b className="text-ink">Feedback sent:</b> {a.publicFeedback}</p>}
          </Card>
          <Card>
            <SectionHeader title="Internal notes" description="Private — never shown to the applicant." className="mb-3" />
            <Textarea aria-label="Internal notes" rows={4} value={notes} onChange={(e) => setInternalNotes(e.target.value)} />
            {options.length === 0 && <p className="mt-2 text-xs text-muted">Notes are saved together with a decision.</p>}
          </Card>
        </div>
      </div>
      <ConfirmDialog open={confirmReject} onClose={() => setConfirmReject(false)} onConfirm={() => decide('rejected')} loading={busy === 'rejected'} title="Reject application?" confirmLabel="Reject application" message="The applicant will be notified. Any feedback you entered will be shown to them. Rejection is final for this application." />
    </div>
  );
}
