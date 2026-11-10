import { ArrowRight, Award, Briefcase, CalendarDays, CalendarOff, ClipboardCheck, FolderGit2, Gift, MessagesSquare, Rocket, Send, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { ButtonLink, CardSkeleton, EmptyState, ErrorState } from '../../components/common/ui.jsx';
import { AccordionItem } from '../../components/common/Accordion.jsx';
import { LearnerIllustration } from '../../components/common/Illustrations.jsx';
import { ProgramCard } from '../../components/internship/ProgramCard.jsx';

const HIGHLIGHTS = [
  { icon: CalendarDays, title: 'Three-Month Program', text: '12 weeks of structured work' },
  { icon: Briefcase, title: 'Real Daily Tasks', text: 'Practical work Monday–Friday' },
  { icon: MessagesSquare, title: 'Mentor Feedback', text: 'Every submission is reviewed' },
  { icon: Gift, title: 'Free Internship', text: 'No fees at any stage' },
  { icon: Award, title: 'Completion Certificate', text: 'For qualifying participants' },
];

const STEPS = [
  { icon: Send, title: 'Apply', text: 'Choose a track and submit your application with your motivation and skills.' },
  { icon: UserCheck, title: 'Get Approved', text: 'Our team reviews applications. Approved participants get a personal internship dashboard.' },
  { icon: ClipboardCheck, title: 'Complete and Submit Tasks', text: 'Each working day brings a practical task. Submit your work and act on reviewer feedback.' },
  { icon: Award, title: 'Earn Your Certificate', text: 'Meet the completion requirements with a final score of at least 70% to receive a verifiable certificate.' },
];

const WHY = [
  { icon: Rocket, title: 'Practical experience', text: 'Work on realistic tasks that mirror what teams do every day.' },
  { icon: MessagesSquare, title: 'Mentorship & feedback', text: 'Reviewers assess your work with marks and actionable comments.' },
  { icon: FolderGit2, title: 'Portfolio development', text: 'Finish with weekly deliverables and a capstone you can show.' },
  { icon: Gift, title: 'Free participation', text: 'No application fee, no program fee, no certificate fee.' },
];

const FAQ = [
  ['Is the internship really free?', 'Yes. There are no fees to apply, participate or receive a certificate.'],
  ['How much time do I need?', 'Plan for around 2–3 hours on each working day (Monday to Friday). Saturdays and Sundays are days off.'],
  ['How is my work assessed?', 'Each task has maximum marks. Reviewers assess your submission and either approve it, request a revision, or reject it with feedback. A submission only counts once a reviewer finalizes its assessment.'],
  ['What do I need to earn the certificate?', 'The program must have ended, all of your required submissions must be assessed, you must meet the completion requirement, and your final score — total marks awarded divided by total available marks on required tasks — must be at least 70%. Missed required tasks count as zero.'],
  ['Is a job or placement guaranteed?', 'No. The internship gives you practical experience, feedback and portfolio work, but it does not guarantee employment, placement or a certificate.'],
  ['Can someone verify my certificate?', 'Yes. Every certificate has a unique ID and a public verification page that shows only the essential details.'],
];

export default function InternshipLandingPage() {
  useDocumentTitle('Free Internship Program');
  const { data: programs, loading, error, reload } = useApi('/internships');
  const open = programs?.find((p) => p.applicationWindow?.isOpen);

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-10 size-80 rounded-full bg-primary-50" aria-hidden="true" />
        <div className="container-page relative grid items-center gap-10 py-12 md:grid-cols-[1.05fr_1fr] lg:py-16">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary"><Sparkles className="size-3.5" aria-hidden="true" /> Free internship program</p>
            <h1 className="mt-5 text-[2.3rem] font-extrabold leading-[1.1] sm:text-5xl">
              Gain Real Experience. <br className="hidden sm:block" />
              <span className="text-primary">Build Your Future.</span>
            </h1>
            <p className="mt-5 max-w-lg leading-7 text-muted">Join our free three-month internship program, work on practical tasks, develop your skills and build your portfolio.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to={open ? `/internship/apply/${open.slug}` : '#tracks'} size="lg" iconRight={ArrowRight}>Apply Now</ButtonLink>
              <ButtonLink to="#how-it-works" size="lg" variant="secondary">Learn More</ButtonLink>
            </div>
          </div>
          <LearnerIllustration className="mx-auto w-full max-w-[520px]" badge="play" />
        </div>
      </section>

      <section className="container-page" aria-label="Program highlights">
        <ul className="card grid grid-cols-2 gap-x-4 gap-y-6 p-5 sm:grid-cols-3 lg:grid-cols-5 lg:p-6">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title} className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-light text-primary"><h.icon className="size-5" aria-hidden="true" /></span>
              <span><span className="block text-sm font-semibold">{h.title}</span><span className="block text-xs text-muted">{h.text}</span></span>
            </li>
          ))}
        </ul>
        <div className="mt-5 grid gap-4 rounded-[var(--radius-card)] bg-primary-50 p-5 sm:grid-cols-3">
          <div className="flex items-center gap-3"><CalendarDays className="size-5 text-primary" aria-hidden="true" /><span className="text-sm"><b>5 working days</b> per week — Monday to Friday</span></div>
          <div className="flex items-center gap-3"><CalendarOff className="size-5 text-primary" aria-hidden="true" /><span className="text-sm"><b>Saturday & Sunday</b> are days off</span></div>
          <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-primary" aria-hidden="true" /><span className="text-sm">Certificate at a <b>70%+</b> final score</span></div>
        </div>
      </section>

      <section id="how-it-works" className="container-page scroll-mt-24 py-16" aria-labelledby="how">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 id="how" className="section-title mt-2">Four steps from application to certificate</h2>
        </div>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card relative p-5">
              <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-white">{i + 1}</span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-center text-sm text-muted">A certificate requires successful completion of the program and a final score of at least 70%. It is never issued just for submitting tasks.</p>
      </section>

      <section id="tracks" className="scroll-mt-24 bg-primary-50/50 py-16" aria-labelledby="tracks-h">
        <div className="container-page">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Internship tracks</p>
              <h2 id="tracks-h" className="section-title mt-2">Available Internship Programs</h2>
            </div>
          </div>
          {error ? <ErrorState error={error} onRetry={reload} /> : loading && !programs ? <CardSkeleton count={3} /> : programs?.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((p) => <ProgramCard key={p.id} program={p} />)}
            </div>
          ) : (
            <EmptyState icon={Briefcase} title="No programs open right now" description="New internship programs will be announced here. Check back soon." />
          )}
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="why-int">
        <h2 id="why-int" className="section-title mb-2">Why Join Global360?</h2>
        <p className="mb-8 text-sm text-muted">Get hands-on experience, improve your skills and boost your career readiness.</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => (
            <div key={w.title} className="card p-5">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-light text-primary"><w.icon className="size-5" aria-hidden="true" /></span>
              <h3 className="mt-4 font-semibold">{w.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">{w.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page grid gap-10 pb-16 lg:grid-cols-[1fr_1.4fr]" aria-labelledby="faq">
        <div>
          <h2 id="faq" className="section-title">Frequently asked questions</h2>
          <p className="mt-2 text-sm text-muted">Everything you need to know about eligibility, assessment and certificates.</p>
          <div className="card mt-6 p-5">
            <h3 className="font-semibold">Eligibility</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
              <li>A free Global360 student account</li>
              <li>Around 2–3 hours available each working day</li>
              <li>A computer and a stable internet connection</li>
              <li>Track-specific recommendations are listed on each program page</li>
            </ul>
          </div>
        </div>
        <div className="space-y-3">
          {FAQ.map(([q, a], i) => (
            <AccordionItem key={q} title={q} defaultOpen={i === 0}>
              <p className="px-2 py-1 text-sm leading-6 text-muted">{a}</p>
            </AccordionItem>
          ))}
        </div>
      </section>

      <section className="container-page pb-16">
        <div className="rounded-[20px] bg-primary px-6 py-10 text-center text-white sm:px-10">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to start your internship?</h2>
          <p className="mx-auto mt-2 max-w-xl text-primary-100">Apply for free and start building real experience with mentor feedback.</p>
          <ButtonLink to={open ? `/internship/apply/${open.slug}` : '#tracks'} variant="white" size="lg" className="mt-6" iconRight={ArrowRight}>Apply Now</ButtonLink>
        </div>
      </section>
    </>
  );
}
