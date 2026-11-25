import { Link } from 'react-router-dom';
import { BookOpen, Star } from 'lucide-react';
import { CourseThumbnail } from './CourseThumbnail.jsx';
import { LEVEL_LABELS } from '../../constants/status.js';

export function Rating({ rating, count, className = '' }) {
  if (!count) return <span className={`text-xs text-muted ${className}`}>No reviews yet</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${className}`} aria-label={`Rated ${rating} out of 5 from ${count} reviews`}>
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="font-semibold text-ink">{Number(rating).toFixed(1)}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
}

export function CourseCard({ course }) {
  return (
    <article className="card group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-[0_16px_40px_-20px_rgb(108_43_235/0.45)]">
      <div className="relative">
        <CourseThumbnail src={course.thumbnailUrl} lessonThumbnailUrl={course.lessonThumbnailUrl} title={course.title} category={course.category} />
        {course.isSample && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Sample</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[15px] font-semibold leading-snug text-ink">
          <Link to={`/courses/${course.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none group-hover:text-primary">
            {course.title}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <span>{course.category}</span>
          <span aria-hidden="true">•</span>
          <span>{LEVEL_LABELS[course.level] || course.level}</span>
          <span aria-hidden="true">•</span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3" aria-hidden="true" />
            {course.lessonCount} lessons
          </span>
        </p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <Rating rating={course.rating} count={course.reviewCount} />
          {course.isFree && <span className="text-sm font-bold text-primary">Free</span>}
        </div>
      </div>
    </article>
  );
}
