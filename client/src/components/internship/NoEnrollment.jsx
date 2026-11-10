import { Briefcase } from 'lucide-react';
import { ButtonLink, Card, EmptyState, StatusBadge } from '../common/ui.jsx';
import { formatDate } from '../../utils/format.js';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useState } from 'react';
import { ConfirmDialog } from '../common/Modal.jsx';

/** Shown when the user has no internship enrollment yet (lists applications if any). */
export function NoEnrollment({ applications = [], onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const withdraw = async (id) => {
    setConfirmId(null);
    setBusy(id);
    try {
      await api.post(`/student/internship/applications/${id}/withdraw`);
      toast.success('Application withdrawn.');
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-6">
      {applications.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold">Your applications</h2>
          <ul className="mt-4 divide-y divide-line">
            {applications.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.program?.title}</p>
                  <p className="text-xs text-muted">Applied {formatDate(a.createdAt)} · {a.program?.track} · starts {formatDate(a.program?.startDate)}</p>
                  {a.publicFeedback && <p className="mt-1 text-sm text-muted">Feedback: {a.publicFeedback}</p>}
                </div>
                <StatusBadge status={a.status} />
                {['pending', 'under_review', 'waitlisted'].includes(a.status) && (
                  <button type="button" disabled={busy === a.id} onClick={() => setConfirmId(a.id)} className="text-xs font-medium text-danger hover:underline disabled:opacity-50">Withdraw</button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <EmptyState
        icon={Briefcase}
        title={applications.some((a) => ['pending', 'under_review', 'waitlisted'].includes(a.status)) ? 'Your application is being reviewed' : 'You are not enrolled in an internship'}
        description="Approved participants get a personal internship dashboard with daily tasks, feedback and progress tracking."
        action={<ButtonLink to="/internship">Explore internship programs</ButtonLink>}
      />
      <ConfirmDialog open={Boolean(confirmId)} onClose={() => setConfirmId(null)} onConfirm={() => withdraw(confirmId)} title="Withdraw application?" confirmLabel="Withdraw" message="Your application will be withdrawn. This cannot be undone, but you may apply again while applications are open." />
    </div>
  );
}
