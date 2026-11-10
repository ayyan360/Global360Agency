import { useState } from 'react';
import { Archive, Mail, MailOpen } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, ButtonLink, KeyValue, PageHeader, StatusBadge } from '../../components/common/ui.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { FilterBar, FilterSelect, SearchInput } from '../../components/admin/AdminKit.jsx';
import { formatDateTime } from '../../utils/format.js';

export default function AdminMessagesPage() {
  useDocumentTitle('Contact Messages');
  const toast = useToast();
  const [q, setQ] = useQueryState({ search: '', status: '', page: 1 });
  const { data, meta, loading, error, reload } = useApi('/admin/messages', { params: { search: q.search || undefined, status: q.status || undefined, page: q.page, pageSize: 15 } });
  const [open, setOpen] = useState(null);

  const setStatus = async (m, status) => {
    try {
      await api.patch(`/admin/messages/${m.id}`, { status });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };
  const view = (m) => {
    setOpen(m);
    if (m.status === 'new') setStatus(m, 'read');
  };

  return (
    <div>
      <PageHeader title="Contact Messages" description="Messages sent through the public contact form." />
      <FilterBar>
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search name, email or subject" />
        <FilterSelect label="Status" value={q.status} onChange={(status) => setQ({ status })} options={[{ value: 'new', label: 'New' }, { value: 'read', label: 'Read' }, { value: 'archived', label: 'Archived' }]} />
      </FilterBar>
      <DataTable
        caption="Contact messages"
        loading={loading}
        error={error}
        onRetry={reload}
        rows={data}
        meta={meta}
        onPage={(page) => setQ({ page }, { resetPage: false })}
        onRowClick={view}
        columns={[
          { key: 'from', header: 'From', render: (m) => <div className={m.status === 'new' ? 'font-semibold' : ''}>{m.name}<p className="text-xs font-normal text-muted">{m.email}</p></div> },
          { key: 'subject', header: 'Subject', render: (m) => <span className={m.status === 'new' ? 'font-semibold' : ''}>{m.subject}</span> },
          { key: 'createdAt', header: 'Received', render: (m) => <span className="text-muted">{formatDateTime(m.createdAt)}</span> },
          { key: 'status', header: 'Status', render: (m) => <StatusBadge status={m.status} /> },
        ]}
      />
      <Modal
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.subject}
        size="lg"
        footer={open && (
          <>
            <Button variant="outline" icon={open.status === 'archived' ? MailOpen : Archive} onClick={() => { setStatus(open, open.status === 'archived' ? 'read' : 'archived'); setOpen(null); }}>{open.status === 'archived' ? 'Unarchive' : 'Archive'}</Button>
            <ButtonLink to={`mailto:${open.email}?subject=${encodeURIComponent(`Re: ${open.subject}`)}`} icon={Mail} onClick={(e) => { e.preventDefault(); window.location.href = `mailto:${open.email}?subject=${encodeURIComponent(`Re: ${open.subject}`)}`; }}>Reply by email</ButtonLink>
          </>
        )}
      >
        {open && (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-3"><KeyValue label="From">{open.name}</KeyValue><KeyValue label="Email">{open.email}</KeyValue><KeyValue label="Received">{formatDateTime(open.createdAt)}</KeyValue></dl>
            <p className="whitespace-pre-line rounded-xl bg-primary-50 p-4 text-sm leading-6">{open.message}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
