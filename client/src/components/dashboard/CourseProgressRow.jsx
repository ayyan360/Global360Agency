import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { CourseThumbnail } from '../courses/CourseThumbnail.jsx';
import { Button, ButtonLink, ProgressBar, StatusBadge } from '../common/ui.jsx';
import { formatDate } from '../../utils/format.js';

export function CourseProgressRow({ item, showMeta = false, onDownloadCertificate, downloadingCertificate = false }) {
  const done = item.status === 'completed' || item.progress === 100;
  return (
    <li className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
      <Link to={`/courses/${item.course.slug}`} className="w-full shrink-0 sm:w-28">
        <CourseThumbnail src={item.course.thumbnailUrl} lessonThumbnailUrl={item.course.lessonThumbnailUrl} title={item.course.title} category={item.course.category} rounded="rounded-lg" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/courses/${item.course.slug}`} className="font-semibold text-ink hover:text-primary">{item.course.title}</Link>
          {done && <StatusBadge status="completed" />}
        </div>
        {showMeta && <p className="mt-0.5 text-xs text-muted">Enrolled {formatDate(item.enrolledAt)} · {item.completedLessons} of {item.totalLessons} lessons completed</p>}
        <div className="mt-2 flex items-center gap-3">
          <ProgressBar value={item.progress} label={`${item.course.title} progress`} className="max-w-md" />
          <span className="w-10 text-right text-xs font-semibold text-ink">{item.progress}%</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {item.continueLessonId ? (
          <ButtonLink to={`/learn/${item.course.slug}/${item.continueLessonId}`} size="sm" variant={done ? 'outline' : 'primary'}>
            {done ? 'Review course' : item.progress > 0 ? 'Continue Learning' : 'Start Learning'}
          </ButtonLink>
        ) : (
          <span className="text-xs text-muted">No lessons yet</span>
        )}
        {item.course.curriculumLocked && item.progress === 100 && item.certificate && onDownloadCertificate && (
          <Button icon={Download} size="sm" variant="outline" onClick={() => onDownloadCertificate(item.course.id, item.course.title)} loading={downloadingCertificate}>
            Certificate PDF
          </Button>
        )}
      </div>
    </li>
  );
}
