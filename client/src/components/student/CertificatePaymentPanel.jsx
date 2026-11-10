import { useEffect, useState } from 'react';
import { CreditCard, Upload } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Button, Card } from '../common/ui.jsx';

export function CertificatePaymentPanel({ certificateType, certificateId, payment, onSubmitted }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const instructions = payment?.instructions || {};
  const hasInstructions = Boolean(instructions.bankName && instructions.accountHolder && instructions.accountNumber);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!payment?.required || payment.status === 'approved') return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Choose an image of your payment receipt.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('receipt', file);
      await api.post(`/student/certificate-payments/${certificateType}/${certificateId}/receipt`, body);
      setFile(null);
      toast.success('Receipt submitted. Our team will review your payment within 24 hours.');
      await onSubmitted?.();
    } catch (requestError) {
      setError(requestError.message || 'The payment receipt could not be uploaded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-5 border-primary-200 bg-primary-50/50">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-light text-primary">
          <CreditCard className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-semibold">Your certificate is ready</h3>
          <p className="mt-1 text-sm text-muted">
            Pay the certificate fee of <strong className="text-ink">{payment.currency} {Number(payment.amount).toLocaleString()}</strong>, then upload an image of your payment receipt. The certificate will be available after our team approves it.
          </p>
        </div>
      </div>

      {payment.status === 'pending' && (
        <Alert tone="info" className="mt-4">
          Your payment receipt was submitted. Our team will review it within 24 hours. You can download your certificate after approval.
        </Alert>
      )}

      {payment.status === 'rejected' && (
        <Alert tone="danger" className="mt-4">
          The previous receipt was not approved. {payment.reviewNote || 'Please check the payment details and submit a new receipt.'}
        </Alert>
      )}

      {!hasInstructions ? (
        <Alert tone="warning" className="mt-4">
          Payment instructions are being configured. Please check back before making a payment or uploading a receipt.
        </Alert>
      ) : (
        <>
          <dl className="mt-4 grid gap-3 rounded-xl border border-line bg-white p-4 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted">Bank</dt><dd className="mt-1 font-medium">{instructions.bankName}</dd></div>
            <div><dt className="text-xs text-muted">Account holder</dt><dd className="mt-1 font-medium">{instructions.accountHolder}</dd></div>
            <div className="sm:col-span-3"><dt className="text-xs text-muted">Bank account number / IBAN</dt><dd className="mt-1 break-all font-mono font-medium">{instructions.accountNumber}</dd></div>
          </dl>
          {payment.status !== 'pending' && (
            <form onSubmit={submit} className="mt-4 space-y-3">
              <label htmlFor={`certificate-receipt-${certificateType}-${certificateId}`} className="block text-sm font-medium">
                Payment receipt image <span className="font-normal text-muted">(JPG, PNG, or WEBP; up to 5 MB)</span>
              </label>
              <input
                id={`certificate-receipt-${certificateType}-${certificateId}`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  setError('');
                }}
                className="block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-light file:px-3 file:py-1.5 file:font-semibold file:text-primary"
              />
              {previewUrl && <img src={previewUrl} alt="Selected payment receipt preview" className="max-h-56 rounded-xl border border-line bg-white object-contain" />}
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
              <Button type="submit" icon={Upload} loading={busy} disabled={!file}>Submit payment receipt</Button>
            </form>
          )}
        </>
      )}
    </Card>
  );
}
