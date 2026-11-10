import { useState } from 'react';
import { Award, Copy, Download, ExternalLink } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { downloadFile } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Button, ButtonLink, Card, CardSkeleton, EmptyState, ErrorState, KeyValue, PageHeader, PageLoader, ProgressBar, StatusBadge, Tabs } from '../../components/common/ui.jsx';
import { CertificatePreview, EligibilityChecklist, ScoringExplanation } from '../../components/internship/Results.jsx';
import { CertificatePaymentPanel } from '../../components/student/CertificatePaymentPanel.jsx';
import { CertificateIllustration } from '../../components/common/Illustrations.jsx';
import { formatDate, pct } from '../../utils/format.js';

export default function InternshipCertificatePage() {
  useDocumentTitle('Certificates');
  const [tab, setTab] = useState('internship');
  const courses = useApi('/student/courses');
  const internship = useApi('/student/internship/certificate');
  const { data: courseData, loading: coursesLoading, error: coursesError, reload: reloadCourses } = courses;
  const { data: internshipData, loading: internshipLoading, error: internshipError, reload: reloadInternship } = internship;

  return (
    <div className="space-y-6">
      <PageHeader title="Certificates" description="View and download your course and internship certificates." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'internship', label: 'Internship certificate' },
          { value: 'course', label: 'Course certificates' },
        ]}
      />
      {tab === 'course'
        ? <CourseCertificates courses={courseData} loading={coursesLoading} error={coursesError} reload={reloadCourses} />
        : <InternshipCertificate data={internshipData} loading={internshipLoading} error={internshipError} reload={reloadInternship} />}
    </div>
  );
}

function CourseCertificates({ courses, loading, error, reload }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !courses) return <CardSkeleton count={2} />;
  if (!courses?.length) {
    return <EmptyState icon={Award} title="Not participated" description="You are not enrolled in any courses yet." action={<ButtonLink to="/courses">Browse courses</ButtonLink>} />;
  }

  const download = async (item) => {
    setDownloading(item.course.id);
    try {
      await downloadFile(
        `/student/courses/${item.course.id}/certificate/download`,
        `Course Completion - ${item.course.title} - Global360.pdf`
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-5">
      {courses.map((item) => {
        const complete = item.totalLessons > 0 && item.completedLessons === item.totalLessons;
        const eligible = Boolean(item.course.curriculumLocked && complete && item.certificate);
        const certificate = item.certificate;
        return (
          <Card key={item.enrollmentId}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{item.course.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  {item.completedLessons} of {item.totalLessons} lessons completed
                  {item.course.curriculumLocked ? ' · Curriculum locked' : ' · Curriculum still open'}
                </p>
              </div>
              <span className="text-sm font-semibold">{item.progress}%</span>
            </div>
            <ProgressBar value={item.progress} label={`${item.course.title} completion`} className="mt-3" />
            {eligible ? (
              <div className="mt-5 space-y-4">
                {item.certificatePayment?.required && item.certificatePayment.status !== 'approved' ? (
                  <CertificatePaymentPanel certificateType="course" certificateId={certificate.id} payment={item.certificatePayment} onSubmitted={reload} />
                ) : null}
                <Card>
                  <h3 className="font-semibold">Certificate details</h3>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <KeyValue label="Certificate name">{certificate.recipientName}</KeyValue>
                    <KeyValue label="Course">{item.course.title}</KeyValue>
                    <KeyValue label="Completion date">{formatDate(certificate.completionDate)}</KeyValue>
                    <KeyValue label="Issued">{formatDate(certificate.issuedAt)}</KeyValue>
                    <KeyValue label="Certificate number"><span className="font-mono">{certificate.certificateNumber}</span></KeyValue>
                  </dl>
                </Card>
                {!item.certificatePayment?.required || item.certificatePayment.status === 'approved' ? (
                  <>
                    <CertificatePreview
                      certificate={certificate}
                      description={`has successfully completed the course ${item.course.title}, in recognition of their dedication, hard work and valuable contribution to Global360 Agency.`}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-muted">Certificate {certificate.certificateNumber}</p>
                      <div className="flex flex-wrap gap-2">
                        <a href={`/verify-certificate/${encodeURIComponent(certificate.certificateNumber)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-white px-4 text-sm font-semibold hover:bg-primary-50"><ExternalLink className="size-4" /> Verify certificate</a>
                        <Button icon={Download} onClick={() => download(item)} loading={downloading === item.course.id}>Download Certificate (PDF)</Button>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                {complete
                  ? 'You have completed every lesson. Your certificate will be issued automatically once the course curriculum is locked.'
                  : 'Complete every lesson. Your certificate will be issued automatically after you finish and the course curriculum is locked.'}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function InternshipCertificate({ data, loading, error, reload }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  if (error?.status === 404) {
    return <EmptyState icon={Award} title="Not participated" description="You are not enrolled in an internship program." action={<ButtonLink to="/student/internship">Explore internship</ButtonLink>} />;
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;
  const { certificate: c, results: r, enrollment } = data;
  const verifyUrl = c ? `${window.location.origin}${c.verificationPath}` : null;

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile('/student/internship/certificate/download', `Internship Completion - ${c.programTitle} - Global360.pdf`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">Internship program: <span className="font-medium text-ink">{enrollment.program.title}</span></p>
      {c && c.status === 'valid' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {data.certificatePayment?.required && data.certificatePayment.status !== 'approved' ? (
              <CertificatePaymentPanel certificateType="internship" certificateId={c.id} payment={data.certificatePayment} onSubmitted={reload} />
            ) : (
              <>
                <CertificatePreview certificate={c} />
                <div className="flex flex-wrap justify-center gap-3">
                  <Button icon={Download} size="lg" onClick={download} loading={downloading}>Download Certificate (PDF)</Button>
                  <a href={c.verificationPath} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold hover:bg-primary-50"><ExternalLink className="size-4" /> Public verification page</a>
                </div>
              </>
            )}
          </div>
          <Card className="h-fit">
            <h2 className="font-semibold">Certificate details</h2>
            <dl className="mt-4 space-y-3">
              <KeyValue label="Status"><StatusBadge status="valid" /></KeyValue>
              <KeyValue label="Certificate name">{c.recipientName}</KeyValue>
              <KeyValue label="Certificate number"><span className="font-mono">{c.certificateNumber}</span></KeyValue>
              <KeyValue label="Final score">{pct(c.finalScore, 2)}</KeyValue>
              <KeyValue label="Completion date">{formatDate(c.completionDate)}</KeyValue>
              <KeyValue label="Issued">{formatDate(c.issuedAt)}</KeyValue>
            </dl>
            <div className="mt-5 rounded-lg bg-primary-50 p-3">
              <p className="text-xs text-muted">Verification link</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate text-xs">{verifyUrl}</code>
                <button type="button" onClick={() => navigator.clipboard?.writeText(verifyUrl).then(() => toast.success('Link copied.'))} className="rounded p-1 text-primary hover:bg-primary-light" aria-label="Copy verification link"><Copy className="size-4" /></button>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card>
            <div className="flex items-center gap-4">
              <CertificateIllustration className="w-28 shrink-0" />
              <div>
                <p className="text-lg font-semibold">
                  {c?.status === 'revoked' ? 'Certificate revoked' : r.outcome === 'not_qualified' ? 'Completed — Not Qualified' : r.outcome === 'awaiting_assessments' ? 'Awaiting final assessments' : 'Not yet eligible'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {c?.status === 'revoked'
                    ? 'This certificate was revoked and is no longer valid. Contact support for details.'
                    : r.outcome === 'not_qualified'
                      ? `Your final score was ${pct(r.finalScore, 2)}. A certificate requires meeting every requirement below, including a final score of at least ${r.threshold}%.`
                      : r.outcome === 'awaiting_assessments'
                        ? 'The program has ended. Your certificate status will be decided once all required submissions are assessed.'
                        : `Your certificate becomes available after the program ends on ${formatDate(enrollment.endDate)}, if you meet all requirements.`}
                </p>
              </div>
            </div>
            <div className="mt-6 border-t border-line pt-5"><EligibilityChecklist checks={r.checks} /></div>
          </Card>
          <div className="space-y-4">
            <Card>
              <h2 className="flex items-center gap-2 font-semibold"><Award className="size-5 text-primary" /> Your results so far</h2>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <KeyValue label="Task completion">{pct(r.completionProgress, 1)}</KeyValue>
                <KeyValue label={r.scoreIsFinal ? 'Final score' : 'Provisional score'}>{pct(r.scoreIsFinal ? r.finalScore : r.provisionalScore, 1)}</KeyValue>
                <KeyValue label="Certificate threshold">{r.threshold}%</KeyValue>
                <KeyValue label="Eligibility"><StatusBadge status={r.outcome} /></KeyValue>
              </dl>
            </Card>
            <ScoringExplanation results={r} />
            <Alert tone="info">Internship certificates are issued automatically once all completion and score requirements pass. <a href="/student/internship/progress" className="link">View detailed progress</a></Alert>
          </div>
        </div>
      )}
    </div>
  );
}
