import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Button, Card, ErrorState, KeyValue, PageHeader, PageLoader, SectionHeader, Select, StatusBadge, Textarea } from '../../components/common/ui.jsx';
import { EligibilityChecklist, ResultsSummary, ScoringExplanation } from '../../components/internship/Results.jsx';
import { formatDate } from '../../utils/format.js';

const NEXT = { approved: ['in_progress', 'withdrawn', 'suspended'], in_progress: ['withdrawn', 'suspended'], suspended: ['in_progress', 'withdrawn'] };

export default function AdminParticipantDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { data: e, loading, error, reload } = useApi(`/admin/internship-enrollments/${id}`);
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useDocumentTitle(e?.participant?.name || 'Participant');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !e) return <PageLoader />;
  const r = e.results;

  const changeStatus = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/internship-enrollments/${id}/status`, { status, reason });
      toast.success('Enrollment status updated.');
      setStatus('');
      setReason('');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const evaluate = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/admin/internship-enrollments/${id}/evaluate`);
      const d = res.data.data;
      if (d.warning) toast.warning(d.warning, { duration: 9000 });
      else toast.success(d.issued ? `Certificate issued: ${d.certificate.certificateNumber}` : `Outcome: ${d.results.outcome.replace(/_/g, ' ')}`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ to: '/admin/internship-participants', label: 'Participants' }, { label: e.participant.name }]}
        title={e.participant.name}
        description={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={e.status} /> {e.program.title} · {formatDate(e.startDate)} – {formatDate(e.endDate)}</span>}
        actions={<Button variant="secondary" icon={PlayCircle} onClick={evaluate} loading={busy}>Evaluate completion</Button>}
      />
      {e.statusReason && <Alert tone="info">{e.statusReason}</Alert>}
      <ResultsSummary results={r} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card padded={false}>
          <div className="p-5 sm:p-6"><SectionHeader title="Task results" className="mb-0" /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-primary-50/70 text-xs uppercase tracking-wide text-muted"><tr><th className="px-5 py-3">Week</th><th className="px-5 py-3">Task</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">State</th><th className="px-5 py-3 text-right">Marks</th></tr></thead>
              <tbody className="divide-y divide-line">
                {r.tasks.map((t) => (
                  <tr key={t.taskId}>
                    <td className="px-5 py-2.5 text-muted">W{t.weekNumber}</td>
                    <td className="px-5 py-2.5">{t.title}{!t.isRequired && <span className="ml-1 text-xs text-muted">(optional)</span>}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted">{formatDate(t.scheduledDate)}</td>
                    <td className="px-5 py-2.5"><StatusBadge status={t.state} /></td>
                    <td className="px-5 py-2.5 text-right">{t.marks !== null ? `${t.marks}/${t.maxMarks}` : `—/${t.maxMarks}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <SectionHeader title="Participant" className="mb-3" />
            <dl className="grid grid-cols-2 gap-3">
              <KeyValue label="Email">{e.participant.email}</KeyValue>
              <KeyValue label="Enrolled">{formatDate(e.enrolledAt)}</KeyValue>
              <KeyValue label="Application">{e.application ? <Link to={`/admin/internship-applications/${e.application.id}`} className="link">View</Link> : '—'}</KeyValue>
              <KeyValue label="Certificate">{e.certificate ? <span className="font-mono text-xs">{e.certificate.certificateNumber}</span> : 'Not issued'}</KeyValue>
            </dl>
          </Card>
          <Card>
            <SectionHeader title="Eligibility checks" className="mb-3" />
            <EligibilityChecklist checks={r.checks} />
            <div className="mt-4"><ScoringExplanation results={r} /></div>
          </Card>
          {NEXT[e.status] && (
            <Card>
              <SectionHeader title="Change status" className="mb-3" />
              <div className="space-y-3">
                <Select aria-label="New status" placeholder="Choose new status" value={status} onChange={(ev) => setStatus(ev.target.value)} options={NEXT[e.status].map((s) => ({ value: s, label: s === 'in_progress' ? 'Reinstate / start (In progress)' : s.charAt(0).toUpperCase() + s.slice(1) }))} />
                <Textarea label="Reason" rows={2} value={reason} onChange={(ev) => setReason(ev.target.value)} hint="Required for withdrawal or suspension; shared with the participant." />
                <Button variant={status === 'in_progress' ? 'primary' : 'danger-outline'} disabled={!status} loading={busy} onClick={changeStatus}>Apply status change</Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
