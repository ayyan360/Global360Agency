import { useState } from 'react';
import { Download } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { downloadFile } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, SectionHeader, StatCard, StatusBadge } from '../../components/common/ui.jsx';
import { FilterSelect } from '../../components/admin/AdminKit.jsx';
import { formatDate, pct } from '../../utils/format.js';
import { Award, ClipboardList, UserCheck, Percent } from 'lucide-react';

export default function AdminReportsPage() {
  useDocumentTitle('Reports');
  const toast = useToast();
  const [q, setQ] = useQueryState({ programId: '' });
  const [exporting, setExporting] = useState(false);
  const { data: programs } = useApi('/admin/internships', { params: { pageSize: 50 } });
  const programId = q.programId || programs?.[0]?.id;
  const { data: r, loading, error, reload } = useApi(programId ? `/admin/internship-reports/${programId}` : null);
  const sum = (rows) => (rows || []).reduce((s, x) => s + x.count, 0);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile(`/admin/internship-reports/${programId}/participants.csv`, 'participants.csv');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Program-level reporting from live data." actions={programId && <Button icon={Download} variant="outline" onClick={exportCsv} loading={exporting}>Export participants (CSV)</Button>} />
      <FilterSelect label="Program" allLabel="Choose" className="w-80" value={programId || ''} onChange={(v) => setQ({ programId: v })} options={(programs || []).map((p) => ({ value: p.id, label: p.title }))} />
      {!programId ? <EmptyState title="No programs yet" /> : error ? <ErrorState error={error} onRetry={reload} /> : loading || !r ? <PageLoader /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard icon={ClipboardList} label="Applications" value={sum(r.applications)} />
            <StatCard icon={UserCheck} label="Enrollments" value={sum(r.enrollments)} tone="info" />
            <StatCard icon={Percent} label="Average final score" value={pct(r.scores.averageFinalScore, 1)} hint={`${r.scores.scored} scored · threshold ${r.program.certificateThreshold}%`} tone="success" />
            <StatCard icon={Award} label="Certificates" value={r.certificates.valid} hint={`${r.certificates.revoked} revoked`} tone="success" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionHeader title="Applications by status" />
              <ul className="space-y-2">{r.applications.length ? r.applications.map((a) => <li key={a.status} className="flex items-center justify-between text-sm"><StatusBadge status={a.status} /><b>{a.count}</b></li>) : <li className="text-sm text-muted">No applications.</li>}</ul>
            </Card>
            <Card>
              <SectionHeader title="Participants by status" />
              <ul className="space-y-2">{r.enrollments.length ? r.enrollments.map((a) => <li key={a.status} className="flex items-center justify-between text-sm"><StatusBadge status={a.status} /><b>{a.count}</b></li>) : <li className="text-sm text-muted">No participants.</li>}</ul>
            </Card>
          </div>
          <Card padded={false}>
            <div className="p-5 sm:p-6"><SectionHeader title="Task statistics" description="Published tasks with submission and assessment figures." className="mb-0" /></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-primary-50/70 text-xs uppercase tracking-wide text-muted"><tr><th className="px-5 py-3">Week</th><th className="px-5 py-3">Task</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Submitted by</th><th className="px-5 py-3">Pending</th><th className="px-5 py-3">Approved</th><th className="px-5 py-3">Avg marks</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {r.tasks.map((t) => (
                    <tr key={t.id}>
                      <td className="px-5 py-2.5 text-muted">W{t.weekNumber}</td>
                      <td className="px-5 py-2.5">{t.title}</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-muted">{formatDate(t.scheduledDate)}</td>
                      <td className="px-5 py-2.5">{t.submittedBy}</td>
                      <td className="px-5 py-2.5">{t.pendingReview}</td>
                      <td className="px-5 py-2.5">{t.approved}</td>
                      <td className="px-5 py-2.5">{t.avgMarks !== null ? `${t.avgMarks}/${t.maxMarks}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
