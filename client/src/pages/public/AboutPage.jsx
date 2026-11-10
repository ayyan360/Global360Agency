import { Accessibility, Award, BookOpenCheck, Eye, HandHeart, Lightbulb, Sprout, Target } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { ButtonLink } from '../../components/common/ui.jsx';
import { TeamIllustration } from '../../components/common/Illustrations.jsx';

const VALUES = [
  { icon: Award, title: 'Quality', text: 'Practical, well-structured content and fair, consistent assessment.' },
  { icon: Accessibility, title: 'Accessibility', text: 'Learning should be free and usable by everyone, on any device.' },
  { icon: Sprout, title: 'Growth', text: 'We support steady progress through practice, feedback and reflection.' },
  { icon: HandHeart, title: 'Integrity', text: 'Certificates reflect real, assessed work — never just attendance.' },
];

export default function AboutPage() {
  useDocumentTitle('About');
  const { data: stats } = useApi('/stats');
  return (
    <>
      <section className="bg-primary-50/60">
        <div className="container-page grid items-center gap-10 py-14 md:grid-cols-2">
          <div>
            <p className="eyebrow">About Global360</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight">Practical learning, open to everyone</h1>
            <p className="mt-4 text-muted leading-7">
              Global360 is an online learning platform that combines free, structured courses with a free three-month internship program. Learners build a foundation through lessons, then prove their skills through real tasks reviewed by mentors.
            </p>
          </div>
          <TeamIllustration className="mx-auto w-full max-w-md" />
        </div>
      </section>

      <section className="container-page grid gap-6 py-14 md:grid-cols-2">
        <div className="card p-6">
          <span className="grid size-11 place-items-center rounded-xl bg-primary-light text-primary"><Target className="size-5" aria-hidden="true" /></span>
          <h2 className="mt-4 text-xl font-semibold">Our Mission</h2>
          <p className="mt-2 text-sm leading-7 text-muted">To make quality, career-relevant education accessible to anyone with the motivation to learn — and to give learners a fair, transparent way to demonstrate what they can do.</p>
        </div>
        <div className="card p-6">
          <span className="grid size-11 place-items-center rounded-xl bg-primary-light text-primary"><Eye className="size-5" aria-hidden="true" /></span>
          <h2 className="mt-4 text-xl font-semibold">Our Vision</h2>
          <p className="mt-2 text-sm leading-7 text-muted">A world where talent is recognised by the work people produce, not by the fees they can afford — where every learner can build a portfolio of real, reviewed projects.</p>
        </div>
      </section>

      <section className="bg-primary-50/50 py-14">
        <div className="container-page grid items-center gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow">Learning philosophy</p>
            <h2 className="section-title mt-2">Learn it. Apply it. Prove it.</h2>
          </div>
          <ul className="space-y-4">
            {[
              [BookOpenCheck, 'Learn with structure', 'Short, focused lessons organised into modules, with progress you can see.'],
              [Lightbulb, 'Apply every day', 'Internship participants complete a practical task on each working day — Monday to Friday.'],
              [Award, 'Earn recognition fairly', 'Certificates require completed work and a final score of at least 70%, verified publicly.'],
            ].map(([Icon, t, d]) => (
              <li key={t} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-primary shadow-sm"><Icon className="size-5" aria-hidden="true" /></span>
                <span>
                  <span className="block font-semibold">{t}</span>
                  <span className="text-sm text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-14">
        <h2 className="section-title mb-6">Our Values</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.title} className="card p-5">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-light text-primary"><v.icon className="size-5" aria-hidden="true" /></span>
              <h3 className="mt-4 font-semibold">{v.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">{v.text}</p>
            </div>
          ))}
        </div>
        {stats && (
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ['Published courses', stats.courses],
              ['Internship programs', stats.internshipPrograms],
              ['Certificates issued', stats.certificatesIssued],
            ].map(([l, v]) => (
              <div key={l} className="rounded-[var(--radius-card)] bg-primary-50 p-5 text-center">
                <p className="text-3xl font-bold text-primary">{v}</p>
                <p className="mt-1 text-sm text-muted">{l}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">Figures are live counts from the Global360 database.</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink to="/courses">Browse courses</ButtonLink>
          <ButtonLink to="/internship" variant="secondary">Explore the internship</ButtonLink>
        </div>
      </section>
    </>
  );
}
