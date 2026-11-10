import { useState } from 'react';
import { ArrowRight, Award, Briefcase, CirclePlay, Clock, GraduationCap, Infinity as InfinityIcon, Laptop, MessagesSquare, Rocket, Users } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { ButtonLink, CardSkeleton, ErrorState, EmptyState } from '../../components/common/ui.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { CourseCard } from '../../components/courses/CourseCard.jsx';
import { LearnerIllustration, SeatedLearnerIllustration } from '../../components/common/Illustrations.jsx';
import { Link } from 'react-router-dom';

const BENEFITS = [
  { icon: GraduationCap, title: 'Expert-Led Courses', text: 'Structured, practical lessons' },
  { icon: Clock, title: 'Flexible Learning', text: 'Study at your own pace' },
  { icon: Briefcase, title: 'Free Internship', text: 'Gain real work experience' },
  { icon: Award, title: 'Certificate', text: 'Earned through assessed work' },
  { icon: InfinityIcon, title: 'Free Access', text: 'All courses are free to enrol' },
];

const WHY = [
  { icon: Laptop, title: 'Learn by doing', text: 'Every course and internship task is designed around practical work you can show.' },
  { icon: MessagesSquare, title: 'Real feedback', text: 'Internship submissions are reviewed by mentors who give actionable feedback.' },
  { icon: Rocket, title: 'Portfolio-ready', text: 'Finish with projects and a verifiable certificate to share with employers.' },
  { icon: Users, title: 'Open to everyone', text: 'Courses and internships are free — no fees, just your effort and consistency.' },
];

export default function HomePage() {
  useDocumentTitle(null);
  const { data, loading, error, reload } = useApi('/home');
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-primary-50" aria-hidden="true" />
        <div className="container-page relative grid items-center gap-10 py-12 md:grid-cols-[1.05fr_1fr] lg:py-16">
          <div className="max-w-xl">
            <p className="eyebrow">Learn • Grow • Succeed</p>
            <h1 className="mt-4 text-[2.4rem] font-extrabold leading-[1.1] sm:text-5xl lg:text-[3.4rem]">
              Build Your Future <br className="hidden sm:block" />
              With The <span className="text-primary">Right Skills</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted">
              Explore free, practical courses, track your progress as you learn, and join a free three-month internship to gain real experience and earn a verifiable certificate.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ButtonLink to="/courses" size="lg" iconRight={ArrowRight}>
                Explore Courses
              </ButtonLink>
              <button type="button" onClick={() => setVideoOpen(true)} className="group inline-flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-semibold text-ink hover:text-primary">
                <span className="grid size-10 place-items-center rounded-full bg-primary-light text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <CirclePlay className="size-5" aria-hidden="true" />
                </span>
                How Global360 works
              </button>
            </div>
          </div>
          <LearnerIllustration className="mx-auto w-full max-w-[540px]" />
        </div>
      </section>

      {/* Benefits row */}
      <section aria-label="Benefits" className="container-page">
        <ul className="card grid grid-cols-2 gap-x-4 gap-y-6 p-5 sm:grid-cols-3 lg:grid-cols-5 lg:p-6">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-light text-primary">
                <b.icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{b.title}</span>
                <span className="block text-xs text-muted">{b.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Popular courses */}
      <section className="container-page py-16" aria-labelledby="popular-heading">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="popular-heading" className="section-title">
              Popular Courses
            </h2>
            <p className="mt-1 text-sm text-muted">Start with the courses learners enrol in most.</p>
          </div>
          <Link to="/courses" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            View All Courses <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !data ? (
          <CardSkeleton count={4} className="lg:grid-cols-4" />
        ) : data?.featured?.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.featured.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <EmptyState title="No courses published yet" description="Courses will appear here once an administrator publishes them." />
        )}
        {data?.featured?.some((c) => c.isSample) && <p className="mt-4 text-xs text-muted">Courses marked “Sample” are demonstration content.</p>}
      </section>

      {/* Internship banner */}
      <section className="container-page" aria-labelledby="intern-banner">
        <div className="relative overflow-hidden rounded-[20px] bg-primary px-6 py-10 text-white sm:px-10 lg:py-12">
          <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/10" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-white/5" aria-hidden="true" />
          <div className="relative grid items-center gap-8 md:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">Free · 3 months · Mon–Fri</p>
              <h2 id="intern-banner" className="mt-3 text-2xl font-bold text-white sm:text-3xl">
                Start Your Career With a Free Internship
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-primary-100">
                Join a three-month online internship with practical tasks every working day, mentor feedback on your submissions, and a completion certificate for participants who meet the requirements and score at least 70%.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink to="/internship" variant="white" iconRight={ArrowRight}>
                  Apply Now
                </ButtonLink>
                <Link to="/internship#how-it-works" className="inline-flex h-10 items-center rounded-[10px] border border-white/40 px-4 text-sm font-semibold text-white hover:bg-white/10">
                  How it works
                </Link>
              </div>
            </div>
            <div className="hidden justify-end md:flex">
              <div className="rounded-2xl bg-white/95 p-2">
                <SeatedLearnerIllustration className="w-64" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Global360 */}
      <section className="container-page py-16" aria-labelledby="why-heading">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="eyebrow">Why Global360</p>
          <h2 id="why-heading" className="section-title mt-2">
            Learning that leads somewhere
          </h2>
          <p className="mt-2 text-sm text-muted">Courses build your foundation. The internship turns it into real, reviewed work.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => (
            <div key={w.title} className="card p-5">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-light text-primary">
                <w.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">{w.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">{w.text}</p>
            </div>
          ))}
        </div>
        {data?.stats && (data.stats.courses > 0 || data.stats.internshipPrograms > 0) && (
          <dl className="mt-10 grid grid-cols-2 gap-4 rounded-[var(--radius-card)] bg-primary-50 p-6 text-center sm:grid-cols-4">
            {[
              ['Published courses', data.stats.courses],
              ['Course categories', data.stats.categories],
              ['Internship programs', data.stats.internshipPrograms],
              ['Certificates issued', data.stats.certificatesIssued],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-1 text-2xl font-bold text-primary">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <Modal open={videoOpen} onClose={() => setVideoOpen(false)} title="How Global360 works" size="md">
        <ol className="space-y-4">
          {[
            ['Create a free account', 'Sign up in under a minute — no payment details needed.'],
            ['Learn with structured courses', 'Enrol in any course, watch lessons and mark them complete to track your progress.'],
            ['Apply for the free internship', 'Choose a track and apply. Approved participants get a personal internship dashboard.'],
            ['Complete daily tasks', 'Submit practical work Monday to Friday. Reviewers assess it and give feedback.'],
            ['Earn your certificate', 'Meet the completion requirements with a final score of at least 70% to receive a verifiable certificate.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
              <span>
                <span className="block font-semibold text-ink">{t}</span>
                <span className="text-sm text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex gap-2">
          <ButtonLink to="/register" onClick={() => setVideoOpen(false)}>
            Create free account
          </ButtonLink>
          <ButtonLink to="/internship" variant="outline" onClick={() => setVideoOpen(false)}>
            Internship details
          </ButtonLink>
        </div>
      </Modal>
    </>
  );
}
