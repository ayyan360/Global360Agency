import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ExternalLink, ShieldX } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { api, apiUrl, downloadFile } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, PageHeader, StatusBadge } from '../../components/common/ui.jsx';
import { ConfirmDialog } from '../../components/common/Modal.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { FilterBar, FilterSelect, SearchInput } from '../../components/admin/AdminKit.jsx';
import { formatDate } from '../../utils/format.js';

export default function AdminCertificatesPage() {
  useDocumentTitle('Certificates');
  const toast = useToast();
  const [q, setQ] = useQueryState({ search: '', status: '', page: 1 });
  const { data, meta, loading, error, reload } = useApi('/admin/internship-certificates', { params: { search: q.search || undefined, status: q.status || undefined, page: q.page, pageSize: 15 } });
  const [paymentQuery, setPaymentQuery] = useQueryState({ paymentStatus: 'pending', paymentType: '', paymentPage: 1 });
  const payments = useApi('/admin/certificate-payments', {
    params: {
      status: paymentQuery.paymentStatus || undefined,
      certificateType: paymentQuery.paymentType || undefined,
      page: paymentQuery.paymentPage,
      pageSize: 15,
    },
  });
  const [revoking, setRevoking] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [busy, setBusy] = useState(false);

  const revoke = async (reason) => {
    setBusy(true);
    try {
      await api.post(`/admin/internship-certificates/${revoking.id}/revoke`, { reason });
      toast.success('Certificate revoked. Public verification now reports it as revoked.');
      setRevoking(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reviewPayment = async (item, decision, note) => {
    setBusy(true);
    try {
      await api.post(`/admin/certificate-payments/${item.id}/review`, { decision, ...(note ? { note } : {}) });
      toast.success(decision === 'approve' ? 'Payment approved. The certificate is now available to the learner.' : 'Payment rejected. The learner can submit a corrected receipt.');
      setRejecting(null);
      payments.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      <section>
      <PageHeader title="Certificates" description="Certificates are issued automatically when a participant qualifies. Revocation is audited and reflected on the public verification page." />
      <FilterBar>
        <SearchInput value={q.search} onChange={(search) => setQ({ search })} placeholder="Search holder name or certificate ID" />
        <FilterSelect label="Status" value={q.status} onChange={(status) => setQ({ status })} options={[{ value: 'valid', label: 'Valid' }, { value: 'revoked', label: 'Revoked' }]} />
      </FilterBar>
      <DataTable
        caption="Certificates"
        loading={loading}
        error={error}
        onRetry={reload}
        rows={data}
        meta={meta}
        onPage={(page) => setQ({ page }, { resetPage: false })}
        columns={[
          { key: 'certificateNumber', header: 'Certificate ID', render: (c) => <span className="font-mono text-xs">{c.certificateNumber}</span> },
          { key: 'recipientName', header: 'Holder', render: (c) => <div><Link to={`/admin/internship-participants/${c.enrollmentId}`} className="font-semibold hover:text-primary">{c.recipientName}</Link><p className="text-xs text-muted">{c.enrollment?.participant?.email}</p></div> },
          { key: 'programTitle', header: 'Program', render: (c) => <span>{c.programTitle}<br /><span className="text-xs text-muted">{c.track}</span></span> },
          { key: 'finalScore', header: 'Score', render: (c) => `${Number(c.finalScore).toFixed(2)}%` },
          { key: 'issuedAt', header: 'Issued', render: (c) => formatDate(c.issuedAt) },
          { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (c) => (
              <div className="flex justify-end gap-1">
                <a href={`/verify-certificate/${c.certificateNumber}`} target="_blank" rel="noopener noreferrer" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-primary-light hover:text-primary" aria-label="Open verification page" title="Verification page"><ExternalLink className="size-4" /></a>
                <button type="button" onClick={() => downloadFile(`/admin/internship-certificates/${c.id}/download`, `${c.certificateNumber}.pdf`).catch((e) => toast.error(e.message))} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-primary-light hover:text-primary" aria-label="Download PDF" title="Download PDF"><Download className="size-4" /></button>
                {c.status === 'valid' && <button type="button" onClick={() => setRevoking(c)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-light hover:text-danger" aria-label="Revoke certificate" title="Revoke"><ShieldX className="size-4" /></button>}
              </div>
            ),
          },
        ]}
      />
      <ConfirmDialog open={Boolean(revoking)} onClose={() => setRevoking(null)} onConfirm={revoke} loading={busy} requireReason reasonLabel="Revocation reason" title="Revoke certificate?" confirmLabel="Revoke certificate" message={revoking && `Certificate ${revoking.certificateNumber} for ${revoking.recipientName} will be marked as revoked. This cannot be undone and the holder will be notified.`} />
      </section>

      <section>
        <PageHeader title="Certificate payment receipts" description="Review private receipt images. Approving a payment unlocks the learner's certificate." />
        <FilterBar>
          <FilterSelect
            label="Payment status"
            value={paymentQuery.paymentStatus}
            onChange={(paymentStatus) => setPaymentQuery({ paymentStatus, paymentPage: 1 })}
            options={[{ value: 'pending', label: 'Pending review' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: '', label: 'All statuses' }]}
          />
          <FilterSelect
            label="Certificate type"
            value={paymentQuery.paymentType}
            onChange={(paymentType) => setPaymentQuery({ paymentType, paymentPage: 1 })}
            options={[{ value: 'course', label: 'Course' }, { value: 'internship', label: 'Internship' }, { value: '', label: 'All types' }]}
          />
        </FilterBar>
        <DataTable
          caption="Certificate payment receipts"
          loading={payments.loading}
          error={payments.error}
          onRetry={payments.reload}
          rows={payments.data}
          meta={payments.meta}
          onPage={(paymentPage) => setPaymentQuery({ paymentPage }, { resetPage: false })}
          columns={[
            { key: 'learner', header: 'Learner', render: (p) => <div><p className="font-semibold">{p.user.name}</p><p className="text-xs text-muted">{p.user.email}</p></div> },
            { key: 'certificate', header: 'Certificate', render: (p) => <div><p className="font-medium">{p.certificate.title}</p><p className="text-xs text-muted">{p.certificateType} · PKR {Number(p.certificate.fee).toLocaleString()}</p><p className="font-mono text-[11px] text-muted">{p.certificate.number}</p></div> },
            { key: 'submittedAt', header: 'Receipt', render: (p) => <a href={apiUrl(`/admin/certificate-payments/${p.id}/receipt`)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p.user.name}'s private payment receipt`}><img src={apiUrl(`/admin/certificate-payments/${p.id}/receipt`)} crossOrigin="use-credentials" alt="Payment receipt" className="h-16 w-24 rounded-lg border border-line bg-page object-contain" /></a> },
            { key: 'status', header: 'Status', render: (p) => <div><StatusBadge status={p.status} />{p.reviewNote && <p className="mt-1 max-w-48 text-xs text-muted">{p.reviewNote}</p>}</div> },
            { key: 'actions', header: 'Actions', render: (p) => p.status === 'pending' ? <div className="flex gap-2"><Button size="sm" onClick={() => reviewPayment(p, 'approve')}>Approve</Button><Button size="sm" variant="outline" onClick={() => setRejecting(p)}>Reject</Button></div> : <span className="text-xs text-muted">{p.reviewedAt ? formatDate(p.reviewedAt) : '—'}</span> },
          ]}
        />
      </section>
      <ConfirmDialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        onConfirm={(note) => reviewPayment(rejecting, 'reject', note)}
        loading={busy}
        requireReason
        reasonLabel="Reason for rejection"
        title="Reject this payment receipt?"
        confirmLabel="Reject receipt"
        message={rejecting && `${rejecting.user.name} will be notified and can upload a corrected receipt.`}
      />
    </div>
  );
}
