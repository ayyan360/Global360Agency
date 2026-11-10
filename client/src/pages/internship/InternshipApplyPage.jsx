import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Button, ButtonLink, Checkbox, ErrorState, Input, PageLoader, Textarea, StatusBadge } from '../../components/common/ui.jsx';
import { SeatedLearnerIllustration } from '../../components/common/Illustrations.jsx';
import { formatDate } from '../../utils/format.js';
import NotFoundPage from '../errors/NotFoundPage.jsx';

const optionalUrl = z.string().trim().max(500).refine((v) => !v || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v), 'Enter a valid http(s) URL').optional();
const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: z.string().trim().max(40).refine((v) => !v || /^[+\d][\d\s()-]{5,39}$/.test(v), 'Enter a valid phone number').optional(),
  education: z.string().trim().max(300).optional(),
  experience: z.string().trim().max(3000).optional(),
  skills: z.string().trim().max(1000).optional(),
  motivation: z.string().trim().min(30, 'Tell us a bit more (at least 30 characters)').max(4000),
  portfolioUrl: optionalUrl,
  agree: z.literal(true, { error: 'Please confirm you understand the program requirements' }),
});

export default function InternshipApplyPage() {
  const { slug } = useParams();
  const { user, status } = useAuth();
  const navigate = useNavigate();
  const { data: program, loading, error, reload } = useApi(`/internships/${slug}`);
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone] = useState(false);
  useDocumentTitle('Apply for Internship');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), values: { fullName: user?.name || '', phone: user?.phone || '', education: '', experience: '', skills: '', motivation: '', portfolioUrl: '' } });

  if (status === 'loading') return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(`/internship/apply/${slug}`)}`} replace />;
  if (error?.status === 404) return <NotFoundPage />;
  if (error) return <div className="container-page py-16"><ErrorState error={error} onRetry={reload} /></div>;
  if (loading || !program) return <PageLoader />;

  const viewer = program.viewer;
  const blocked =
    user.role !== 'student'
      ? 'Only student accounts can apply for internships.'
      : viewer?.enrollment
        ? 'You are already enrolled in this internship.'
        : viewer?.application && ['pending', 'under_review', 'waitlisted'].includes(viewer.application.status)
          ? 'You already have an active application for this program.'
          : !program.applicationWindow.isOpen
            ? 'Applications for this program are not open.'
            : null;

  const onSubmit = async ({ agree, ...values }) => {
    setSubmitError(null);
    try {
      await api.post(`/internships/${program.id}/applications`, { ...values, agreeToTerms: agree });
      setDone(true);
      window.scrollTo(0, 0);
    } catch (err) {
      Object.entries(err.fieldErrors?.() || {}).forEach(([f, m]) => setError(f, { message: m }));
      setSubmitError(err.message);
    }
  };

  return (
    <section className="container-page py-10 lg:py-14">
      <div className="card grid overflow-hidden lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="hidden flex-col justify-between bg-primary-50 p-8 lg:flex">
          <div>
            <h2 className="text-3xl font-bold leading-tight">Your Skills<br />Our Support<br /><span className="text-primary">A Better Future</span></h2>
            <p className="mt-4 text-sm leading-6 text-muted">Join our internship and take the first step towards a successful career. Approved participants receive daily tasks from Monday to Friday and feedback on every submission.</p>
          </div>
          <SeatedLearnerIllustration className="mt-6 w-full max-w-[340px]" />
        </aside>
        <div className="p-6 sm:p-10">
          {done ? (
            <div className="flex flex-col items-center py-12 text-center" role="status">
              <CheckCircle2 className="size-14 text-success" aria-hidden="true" />
              <h1 className="mt-4 text-2xl font-bold">Application submitted</h1>
              <p className="mt-2 max-w-md text-muted">Thanks for applying to <b>{program.title}</b>. Your application status is <b>Pending</b>. We'll notify you in your dashboard when it has been reviewed.</p>
              <div className="mt-6 flex gap-3">
                <ButtonLink to="/student/internship">Track your application</ButtonLink>
                <ButtonLink to="/courses" variant="outline">Keep learning</ButtonLink>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Apply for Internship</h1>
              <p className="mt-1 text-sm text-muted">Fill in your details to apply for the free <b className="text-ink">{program.title}</b> ({program.track}), {formatDate(program.startDate)} – {formatDate(program.endDate)}.</p>
              {blocked ? (
                <div className="mt-6 space-y-4">
                  <Alert tone="warning" title="You can't apply right now">{blocked}</Alert>
                  {viewer?.application && <p className="flex items-center gap-2 text-sm">Current application: <StatusBadge status={viewer.application.status} /></p>}
                  <div className="flex gap-3">
                    <ButtonLink to="/student/internship">Go to my internship</ButtonLink>
                    <ButtonLink to="/internship" variant="outline">View programs</ButtonLink>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
                  {submitError && <Alert tone="danger" className="sm:col-span-2">{submitError}</Alert>}
                  <Input label="Full name" required autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
                  <Input label="Email address" value={user.email} disabled hint="Applications use your account email." readOnly />
                  <Input label="Phone number" type="tel" autoComplete="tel" placeholder="Optional" error={errors.phone?.message} {...register('phone')} />
                  <Input label="Selected track" value={program.track} disabled readOnly />
                  <Input label="Education" className="sm:col-span-2" placeholder="e.g. BS Computer Science (2nd year), self-taught…" error={errors.education?.message} {...register('education')} />
                  <Textarea label="Existing skills" className="sm:col-span-2" rows={2} placeholder="Tools, languages or design skills you already have" error={errors.skills?.message} {...register('skills')} />
                  <Textarea label="Relevant experience" className="sm:col-span-2" rows={3} placeholder="Projects, courses, work or volunteering (optional)" error={errors.experience?.message} {...register('experience')} />
                  <Textarea label="Why do you want to join?" required className="sm:col-span-2" rows={5} placeholder="Tell us about your motivation and what you hope to achieve…" error={errors.motivation?.message} {...register('motivation')} />
                  <Input label="Portfolio or GitHub link" className="sm:col-span-2" type="url" placeholder="https://" error={errors.portfolioUrl?.message} {...register('portfolioUrl')} />
                  <div className="sm:col-span-2">
                    <Checkbox label={`I understand this is a free 3-month program with tasks every working day, and that a certificate requires completion and a final score of at least ${program.certificateThreshold}%.`} {...register('agree')} />
                    {errors.agree && <p className="mt-1 text-xs text-danger" role="alert">{errors.agree.message}</p>}
                  </div>
                  <Button type="submit" size="lg" className="sm:col-span-2" loading={isSubmitting}>Submit Application</Button>
                  <p className="text-center text-xs text-muted sm:col-span-2">
                    Already applied? <Link to="/student/internship" className="link">Track your application</Link>
                  </p>
                </form>
              )}
            </>
          )}
          {!done && <button type="button" onClick={() => navigate(-1)} className="mt-6 text-xs text-muted hover:text-primary">← Back</button>}
        </div>
      </div>
    </section>
  );
}
