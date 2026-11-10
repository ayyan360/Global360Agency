import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Code2, Palette, Briefcase, CalendarDays } from 'lucide-react';
import { formatDate } from '../../utils/format.js';

const TRACK_ICONS = { 'Web Development': Code2, 'Data Science': BarChart3, 'UI/UX Design': Palette };

export function TrackIcon({ track, className = 'size-5' }) {
  const Icon = TRACK_ICONS[track] || Briefcase;
  return <Icon className={className} aria-hidden="true" />;
}

export function ProgramCard({ program }) {
  const w = program.applicationWindow;
  return (
    <article className="card group relative flex h-full flex-col p-5">
      <span className="mb-4 grid size-11 place-items-center rounded-xl bg-primary-light text-primary">
        <TrackIcon track={program.track} />
      </span>
      <h3 className="text-base font-semibold text-ink">
        <Link to={`/internship/${program.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">
          {program.title}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{program.shortDescription}</p>
      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
        <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
        {formatDate(program.startDate)} – {formatDate(program.endDate)}
      </p>
      <div className="mt-auto flex items-center justify-between pt-4">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${w?.isOpen ? 'bg-success-light text-success' : 'bg-slate-100 text-slate-600'}`}>
          {w?.isOpen ? 'Applications open' : w?.state === 'not_yet_open' ? 'Opening soon' : 'Applications closed'}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Details <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}
