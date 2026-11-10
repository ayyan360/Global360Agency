import { CheckCircle2, CircleDashed, Info, XCircle } from 'lucide-react';
import { ProgressBar, StatusBadge } from '../common/ui.jsx';
import { pct } from '../../utils/format.js';
import { formatDate } from '../../utils/format.js';

/**
 * Shows the three separate concepts the spec requires: task completion progress,
 * performance score, and certificate eligibility. They are never merged into one number.
 */
export function ResultsSummary({ results, compact = false }) {
  const { completionProgress, finalScore, provisionalScore, scoreIsFinal, threshold, counts, outcome } = results;
  return (
    <div className={`grid gap-4 ${compact ? 'sm:grid-cols-3' : 'md:grid-cols-3'}`}>
      <div className="card p-5">
        <p className="text-xs font-medium text-muted">Task completion</p>
        <p className="mt-1 text-3xl font-bold">{pct(completionProgress, 1)}</p>
        <ProgressBar value={completionProgress || 0} className="mt-3" label="Task completion progress" />
        <p className="mt-2 text-xs text-muted">{counts.approved} of {counts.totalRequired} required tasks approved</p>
      </div>
      <div className="card p-5">
        <p className="text-xs font-medium text-muted">{scoreIsFinal ? 'Final performance score' : 'Current score (provisional)'}</p>
        <p className="mt-1 text-3xl font-bold">{pct(scoreIsFinal ? finalScore : provisionalScore, 1)}</p>
        <ProgressBar value={(scoreIsFinal ? finalScore : provisionalScore) || 0} className="mt-3" tone={(scoreIsFinal ? finalScore : provisionalScore) >= threshold ? 'success' : 'primary'} label="Performance score" />
        <p className="mt-2 text-xs text-muted">{scoreIsFinal ? `Certificate threshold: ${threshold}%` : 'Based on assessed tasks so far. The final score is calculated when the program ends.'}</p>
      </div>
      <div className="card p-5">
        <p className="text-xs font-medium text-muted">Certificate eligibility</p>
        <div className="mt-2"><StatusBadge status={outcome} className="text-sm" /></div>
        <p className="mt-3 text-xs leading-5 text-muted">
          {outcome === 'qualified' && 'All requirements met.'}
          {outcome === 'in_progress' && `Requires program completion and a final score of at least ${threshold}%.`}
          {outcome === 'awaiting_assessments' && 'Some required submissions are still awaiting review or revision.'}
          {outcome === 'not_qualified' && 'The certificate requirements were not met.'}
          {outcome === 'ineligible' && 'This enrollment is not eligible for a certificate.'}
        </p>
      </div>
    </div>
  );
}

export function EligibilityChecklist({ checks }) {
  return (
    <ul className="space-y-2.5">
      {checks.map((c) => (
        <li key={c.key} className="flex gap-3 text-sm">
          {c.passed ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Passed" /> : c.key === 'programEnded' || c.key === 'assessmentsResolved' ? <CircleDashed className="mt-0.5 size-5 shrink-0 text-amber-500" aria-label="Not yet" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-label="Not met" />}
          <span>
            <span className="block font-medium text-ink">{c.label}</span>
            {c.detail && <span className="text-xs text-muted">{c.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ScoringExplanation({ results }) {
  return (
    <div className="flex gap-3 rounded-xl bg-primary-50 p-4 text-xs leading-5 text-muted">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="font-semibold text-ink">How your results are calculated</p>
        <p className="mt-1">{results.policy.explanation}</p>
        <p className="mt-1 font-mono text-[11px] text-ink/80">completion = approved required tasks ÷ required tasks × 100 · score = marks awarded ÷ marks available × 100</p>
        <p className="mt-1">Marks so far: {results.marks.earned} of {results.marks.possible} available on required tasks.</p>
      </div>
    </div>
  );
}

/** On-screen certificate preview uses the same artwork as the downloadable PDF. */
export function CertificatePreview({ certificate, description: descriptionOverride }) {
  const description = descriptionOverride || `has successfully completed the ${certificate.programTitle} internship in the ${certificate.track} track, from ${formatDate(certificate.startDate)} to ${formatDate(certificate.endDate)}.`;
  return (
    <div className="relative aspect-[2000/1333] overflow-hidden rounded-xl shadow-[var(--shadow-card)]">
      <img
        src="/Elegant%20Global360%20Completion%20Certificate%20(1).png"
        alt="Global360 certificate of completion design"
        className="absolute inset-0 size-full"
      />
      <p className="absolute left-[12%] top-[44.5%] flex h-[7%] w-[76%] items-center justify-center overflow-hidden text-center font-serif italic font-semibold leading-tight text-[#4B0BC4]" style={{ fontSize: 'clamp(12px, 2.4vw, 38px)' }}>
        {certificate.recipientName}
      </p>
      <p className="absolute left-[18%] top-[54.5%] flex h-[7%] w-[64%] items-center justify-center overflow-hidden text-center font-serif italic leading-tight text-[#111640]" style={{ fontSize: 'clamp(7px, 0.95vw, 14px)' }}>
        {description}
      </p>
      <p className="absolute left-[13%] top-[78.8%] flex h-[2.5%] w-[24%] items-center justify-center overflow-hidden text-center font-serif font-semibold leading-none text-[#111640]" style={{ fontSize: 'clamp(7px, 0.95vw, 15px)' }}>
        {formatDate(certificate.completionDate)}
      </p>
    </div>
  );
}
