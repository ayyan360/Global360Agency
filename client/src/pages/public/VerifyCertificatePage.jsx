import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, Search, ShieldAlert, ShieldX } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { Button, KeyValue, PageLoader, ErrorState } from '../../components/common/ui.jsx';
import { LogoMark } from '../../components/common/Logo.jsx';
import { formatDate } from '../../utils/format.js';

export default function VerifyCertificatePage() {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(certificateId || '');
  useDocumentTitle('Verify certificate');
  const { data, loading, error, reload } = useApi(certificateId ? `/certificates/verify/${encodeURIComponent(certificateId)}` : null);

  return (
    <section className="bg-primary-50/50">
      <div className="container-page max-w-3xl py-14">
        <div className="text-center">
          <LogoMark className="mx-auto size-12" />
          <h1 className="mt-4 text-3xl font-bold">Certificate Verification</h1>
          <p className="mt-2 text-muted">Check that a Global360 course or internship certificate is genuine and currently valid.</p>
        </div>
        <form
          className="mx-auto mt-8 flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) navigate(`/verify-certificate/${encodeURIComponent(input.trim().toUpperCase())}`);
          }}
        >
          <label htmlFor="cert-id" className="sr-only">Certificate ID</label>
          <input id="cert-id" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter the certificate number" className="h-12 flex-1 rounded-xl border border-line bg-white px-4 text-sm uppercase tracking-wide focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15" />
          <Button type="submit" size="lg" icon={Search}>Verify</Button>
        </form>

        <div className="mt-10" aria-live="polite">
          {certificateId && loading && <PageLoader />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {data && !loading && (
            <div className={`card overflow-hidden ${data.valid ? '' : 'border-danger/30'}`}>
              <div className={`flex items-center gap-3 px-6 py-4 ${data.valid ? 'bg-success-light' : 'bg-danger-light'}`}>
                {data.valid ? <BadgeCheck className="size-7 text-success" aria-hidden="true" /> : data.status === 'revoked' ? <ShieldX className="size-7 text-danger" aria-hidden="true" /> : <ShieldAlert className="size-7 text-danger" aria-hidden="true" />}
                <div>
                  <p className="font-semibold text-ink">{data.valid ? 'Valid certificate' : data.status === 'revoked' ? 'This certificate has been revoked' : 'Certificate not found'}</p>
                  <p className="text-sm text-muted">
                    {data.valid ? 'This certificate was issued by Global360 and is currently valid.' : data.status === 'revoked' ? 'It is no longer valid and should not be relied upon.' : 'No certificate matches this ID. Check the ID and try again.'}
                  </p>
                </div>
              </div>
              {data.status !== 'not_found' && (
                <dl className="grid gap-5 p-6 sm:grid-cols-2">
                  <KeyValue label="Certificate holder">{data.holderName}</KeyValue>
                  <KeyValue label="Certificate ID"><span className="font-mono">{data.certificateNumber}</span></KeyValue>
                  {data.certificateType === 'course' ? (
                    <KeyValue label="Course">{data.courseTitle}</KeyValue>
                  ) : (
                    <>
                      <KeyValue label="Program">{data.programTitle}</KeyValue>
                      <KeyValue label="Internship track">{data.track}</KeyValue>
                      <KeyValue label="Program dates">{formatDate(data.startDate)} – {formatDate(data.endDate)}</KeyValue>
                    </>
                  )}
                  <KeyValue label="Completion date">{formatDate(data.completionDate)}</KeyValue>
                  <KeyValue label="Issue date">{formatDate(data.issuedAt)}</KeyValue>
                  <KeyValue label="Status"><span className={data.valid ? 'font-semibold text-success' : 'font-semibold text-danger'}>{data.valid ? 'Valid' : 'Revoked'}{data.revokedAt ? ` on ${formatDate(data.revokedAt)}` : ''}</span></KeyValue>
                </dl>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
