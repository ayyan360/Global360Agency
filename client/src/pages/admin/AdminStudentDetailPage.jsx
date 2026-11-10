import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Avatar, Button, Card, ErrorState, KeyValue, PageHeader, PageLoader, ProgressBar, SectionHeader, Select, StatusBadge } from '../../components/common/ui.jsx';
import { ConfirmDialog } from '../../components/common/Modal.jsx';
import { formatDate, formatDateTime, titleCase } from '../../utils/format.js';

export default function AdminStudentDetailPage() {
  const { id } = useParams();
  const { user: me, can } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/admin/users/${id}`);
  const [pending, setPending] = useState(null); // { field, value }
  const [saving, setSaving] = useState(false);
  useDocumentTitle(data?.user?.name || 'User');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;
  const u = data.user;
  const self = me.id === u.id;

  const apply = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/users/${id}`, { [pending.field]: pending.value });
      toast.success('Account updated.');
      setPending(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader breadcrumbs={[{ to: '/admin/students', label: 'Students & Users' }, { label: u.name }]} title={u.name} description={u.email} />
      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <div className="flex items-center gap-3"><Avatar name={u.name} src={u.avatarUrl} size="lg" /><div><p className="font-semibold">{u.name}</p><StatusBadge status={u.accountStatus} /></div></div>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <KeyValue label="Role">{titleCase(u.role)}</KeyValue>
            <KeyValue label="Joined">{formatDate(u.createdAt)}</KeyValue>
            <KeyValue label="Last login">{formatDateTime(data.lastLoginAt)}</KeyValue>
            <KeyValue label="Phone">{u.phone || '—'}</KeyValue>
          </dl>
          <div className="mt-6 space-y-4 border-t border-line pt-5">
            {self && <Alert tone="info">You cannot change your own role or status.</Alert>}
            <Select label="Account status" value={u.accountStatus} disabled={self} onChange={(e) => setPending({ field: 'accountStatus', value: e.target.value })} options={['active', 'suspended', 'deactivated'].map((s) => ({ value: s, label: titleCase(s) }))} hint="Suspending or deactivating signs the user out everywhere." />
            {can('roles:manage') && <Select label="Role" value={u.role} disabled={self} onChange={(e) => setPending({ field: 'role', value: e.target.value })} options={['student', 'instructor', 'reviewer', 'admin'].map((s) => ({ value: s, label: titleCase(s) }))} hint="Role changes are recorded in the audit log." />}
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <SectionHeader title="Course enrollments" />
            {data.courseEnrollments.length ? (
              <ul className="space-y-4">
                {data.courseEnrollments.map((e) => (
                  <li key={e.id}>
                    <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-sm"><Link to={`/admin/courses/${e.course.id}`} className="font-medium hover:text-primary">{e.course.title}</Link><span className="text-xs text-muted">Enrolled {formatDate(e.enrolledAt)} · {e.completedLessons}/{e.totalLessons} lessons · {e.progress}%</span></div>
                    <ProgressBar value={e.progress} size="sm" />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No course enrollments.</p>}
          </Card>
          <Card>
            <SectionHeader title="Internship participation" />
            {data.internshipEnrollments.length ? (
              <ul className="divide-y divide-line">
                {data.internshipEnrollments.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <Link to={`/admin/internship-participants/${e.id}`} className="min-w-0 flex-1 font-medium hover:text-primary">{e.program.title}</Link>
                    <StatusBadge status={e.status} />
                    {e.finalScore !== null && <span className="text-xs">Final {e.finalScore}%</span>}
                    {e.certificate && <span className="font-mono text-xs text-muted">{e.certificate.certificateNumber}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No internship enrollments.</p>}
          </Card>
        </div>
      </div>
      <ConfirmDialog open={Boolean(pending)} onClose={() => setPending(null)} onConfirm={apply} loading={saving} tone="primary" title="Confirm account change" confirmLabel="Apply change" message={pending && `Change ${pending.field === 'role' ? 'role' : 'account status'} of ${u.name} to "${titleCase(pending.value)}"?`} />
    </div>
  );
}
