import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Avatar, Button, Input, PageHeader, Select, StatusBadge } from '../../components/common/ui.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { FilterBar, FilterSelect, SearchInput } from '../../components/admin/AdminKit.jsx';
import { formatDate, titleCase } from '../../utils/format.js';

function CreateStaffModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'reviewer' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      await api.post('/admin/users', form);
      toast.success('Staff account created. Share the password securely and ask them to change it.');
      onCreated();
      onClose();
    } catch (err) {
      setErrors({ ...(err.fieldErrors?.() || {}), form: err.message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Create staff account" description="Public sign-up only creates student accounts. Use this for instructors, reviewers and admins." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Create account</Button></>}>
      <div className="grid gap-4">
        {errors.form && <p className="text-sm text-danger" role="alert">{errors.form}</p>}
        <Input label="Full name" required value={form.name} onChange={set('name')} error={errors.name} />
        <Input label="Email" type="email" required value={form.email} onChange={set('email')} error={errors.email} />
        <Input label="Temporary password" type="password" required value={form.password} onChange={set('password')} error={errors.password} hint="At least 8 characters with letters and numbers." />
        <Select label="Role" value={form.role} onChange={set('role')} options={[{ value: 'reviewer', label: 'Reviewer / mentor' }, { value: 'instructor', label: 'Instructor' }, { value: 'admin', label: 'Admin' }]} />
      </div>
    </Modal>
  );
}

export default function AdminStudentsPage() {
  useDocumentTitle('Students & Users');
  const navigate = useNavigate();
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useQueryState({ search: '', role: 'student', status: '', page: 1 });
  const { data, meta, loading, error, reload } = useApi('/admin/users', { params: { search: q.search || undefined, role: q.role || undefined, status: q.status || undefined, page: q.page, pageSize: 15 } });

  return (
    <div>
      <PageHeader title="Students & Users" description="Search learners and staff, view their activity and manage account status." actions={can('roles:manage') && <Button icon={UserPlus} onClick={() => setCreating(true)}>Create staff account</Button>} />
      <FilterBar>
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search by name or email" />
        <FilterSelect label="Role" value={q.role} onChange={(role) => setQ({ role })} options={['student', 'instructor', 'reviewer', 'admin'].map((r) => ({ value: r, label: titleCase(r) }))} />
        <FilterSelect label="Status" value={q.status} onChange={(status) => setQ({ status })} options={['active', 'suspended', 'deactivated'].map((r) => ({ value: r, label: titleCase(r) }))} />
      </FilterBar>
      <DataTable
        caption="Users"
        loading={loading}
        error={error}
        onRetry={reload}
        rows={data}
        meta={meta}
        onPage={(page) => setQ({ page }, { resetPage: false })}
        onRowClick={(u) => navigate(`/admin/students/${u.id}`)}
        columns={[
          { key: 'name', header: 'Name', render: (u) => <div className="flex items-center gap-3"><Avatar name={u.name} src={u.avatarUrl} size="sm" /><div><Link to={`/admin/students/${u.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:text-primary">{u.name}</Link><p className="text-xs text-muted">{u.email}</p></div></div> },
          { key: 'role', header: 'Role', render: (u) => titleCase(u.role) },
          { key: 'courseEnrollments', header: 'Courses' },
          { key: 'internshipEnrollments', header: 'Internships' },
          { key: 'accountStatus', header: 'Status', render: (u) => <StatusBadge status={u.accountStatus} /> },
          { key: 'createdAt', header: 'Joined', render: (u) => <span className="text-muted">{formatDate(u.createdAt)}</span>, hideOnMobile: true },
        ]}
      />
      {creating && <CreateStaffModal open onClose={() => setCreating(false)} onCreated={reload} />}
    </div>
  );
}
