import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Award, BookOpen, CheckCircle2, CirclePlay, Clock, Globe, Heart, Lock, PlayCircle, Star, BarChart3 } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Avatar, Badge, Breadcrumbs, Button, ButtonLink, ErrorState, PageLoader, ProgressBar, Tabs, Textarea } from '../../components/common/ui.jsx';
import { AccordionItem } from '../../components/common/Accordion.jsx';
import { CourseThumbnail } from '../../components/courses/CourseThumbnail.jsx';
import { CourseCard, Rating } from '../../components/courses/CourseCard.jsx';
import { LEVEL_LABELS } from '../../constants/status.js';
import { formatDate, formatDuration } from '../../utils/format.js';
import NotFoundPage from '../errors/NotFoundPage.jsx';

function ReviewForm({ course, onSaved }) {
  const toast = useToast();
  const [rating, setRating] = useState(course.viewer.myReview?.rating || 0);
  const [comment, setComment] = useState(course.viewer.myReview?.comment || '');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return toast.error('Choose a rating from 1 to 5 stars.');
    setSaving(true);
    try {
      await api.put(`/courses/${course.id}/review`, { rating, comment });
      toast.success('Thanks — your review has been saved.');
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <p className="text-sm font-semibold">{course.viewer.myReview ? 'Update your review' : 'Review this course'}</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)} className="rounded p-0.5">
            <Star className={`size-6 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-line'}`} />
          </button>
        ))}
      </div>
      <Textarea label="Comment (optional)" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
      <Button type="submit" size="sm" loading={saving}>
        Save review
      </Button>
    </form>
  );
}

export default function CourseDetailPage() {
  const { slug } = useParams();
  const { data: course, loading, error, reload } = useApi(`/courses/${slug}`);
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);
  useDocumentTitle(course?.title || 'Course');

  if (error?.status === 404) return <NotFoundPage />;
  if (error) return <div className="container-page py-16"><ErrorState error={error} onRetry={reload} /></div>;
  if (loading || !course) return <PageLoader />;

  const v = course.viewer;
  const lessons = course.modules.flatMap((m) => m.lessons);
  const firstPreview = lessons.find((l) => l.isPreview);

  const enroll = async () => {
    if (!user) return navigate(`/login?next=${encodeURIComponent(`/courses/${slug}`)}`);
    setBusy(true);
    try {
      await api.post(`/courses/${course.id}/enroll`);
      toast.success('You are enrolled. Happy learning!');
      const first = lessons[0];
      if (first) navigate(`/learn/${course.slug}/${first.id}`);
      else reload();
    } catch (err) {
      if (err.code === 'ALREADY_ENROLLED') reload();
      else toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleWishlist = async () => {
    if (!user) return navigate(`/login?next=${encodeURIComponent(`/courses/${slug}`)}`);
    try {
      const res = await api.post(`/courses/${course.id}/wishlist`);
      toast.success(res.data.data.inWishlist ? 'Added to your wishlist.' : 'Removed from your wishlist.');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const lessonLink = (l) => `/learn/${course.slug}/${l.id}`;
  const canOpen = (l) => l.isPreview || v.isEnrolled || v.canManage;

  return (
    <>
      <section className="border-b border-line bg-primary-50/50">
        <div className="container-page py-8 lg:py-10">
          <Breadcrumbs items={[{ to: '/', label: 'Home' }, { to: '/courses', label: 'Courses' }, { to: `/courses?category=${encodeURIComponent(course.category)}`, label: course.category }, { label: course.title }]} className="mb-5" />
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
            <CourseThumbnail src={course.thumbnailUrl} lessonThumbnailUrl={course.lessonThumbnailUrl} title={course.title} category={course.category} rounded="rounded-[var(--radius-card)]" className="shadow-[var(--shadow-card)]" />
            <div>
              {course.isSample && <Badge tone="outline" className="mb-3">Sample course</Badge>}
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{course.title}</h1>
              <p className="mt-3 max-w-2xl text-muted">{course.shortDescription}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge>{course.category}</Badge>
                <Badge tone="neutral" icon={BarChart3}>{LEVEL_LABELS[course.level]}</Badge>
                <span className="inline-flex items-center gap-1 text-sm text-muted"><BookOpen className="size-4 text-primary" aria-hidden="true" /> {course.lessonCount} lessons</span>
                {course.durationSeconds > 0 && <span className="inline-flex items-center gap-1 text-sm text-muted"><Clock className="size-4 text-primary" aria-hidden="true" /> {formatDuration(course.durationSeconds)}</span>}
                <Rating rating={course.rating} count={course.reviewCount} className="text-sm" />
              </div>
              {course.instructor && <p className="mt-3 text-sm text-muted">Instructor: <span className="font-medium text-ink">{course.instructor.name}</span></p>}

              {v.isEnrolled && (
                <div className="mt-5 max-w-md">
                  <div className="mb-1.5 flex justify-between text-xs text-muted"><span>Your progress</span><span className="font-semibold text-ink">{v.progress}%</span></div>
                  <ProgressBar value={v.progress} label="Course progress" />
                  <p className="mt-1 text-xs text-muted">{v.completedLessons} of {v.totalLessons} lessons completed</p>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                {v.isEnrolled ? (
                  v.nextLessonId ? <ButtonLink to={`/learn/${course.slug}/${v.nextLessonId}`} size="lg" icon={PlayCircle}>{v.progress > 0 ? 'Continue Learning' : 'Start Learning'}</ButtonLink> : <Button size="lg" disabled>No lessons yet</Button>
                ) : (
                  <Button size="lg" icon={PlayCircle} onClick={enroll} loading={busy}>
                    {user ? 'Enroll for Free' : 'Log in to Enroll'}
                  </Button>
                )}
                <Button size="lg" variant="secondary" icon={Heart} onClick={toggleWishlist} aria-pressed={v.inWishlist}>
                  {v.inWishlist ? 'In Wishlist' : 'Add to Wishlist'}
                </Button>
                {!v.isEnrolled && firstPreview && (
                  <ButtonLink to={lessonLink(firstPreview)} size="lg" variant="ghost" icon={CirclePlay}>
                    Preview lesson
                  </ButtonLink>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'curriculum', label: 'Curriculum' }, { value: 'instructor', label: 'Instructor' }, { value: 'reviews', label: 'Reviews', count: course.reviewCount }]} />
          <div className="pt-6" role="tabpanel">
            {tab === 'overview' && (
              <div className="space-y-8">
                <section>
                  <h2 className="text-lg font-semibold">About This Course</h2>
                  <div className="prose-g360 mt-3">
                    {course.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </section>
                {course.outcomes?.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold">What you'll achieve</h2>
                    <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                      {course.outcomes.map((o) => (
                        <li key={o} className="flex gap-2 text-sm text-ink"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> {o}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {course.requirements?.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold">Requirements</h2>
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
                      {course.requirements.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </section>
                )}
              </div>
            )}
            {tab === 'curriculum' && (
              <section>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold">Curriculum</h2>
                  <p className="text-sm text-muted">{course.lessonCount} lessons · {formatDuration(course.durationSeconds)}</p>
                </div>
                {course.modules.length === 0 ? <p className="text-sm text-muted">The curriculum is being prepared.</p> : (
                  <div className="space-y-3">
                    {course.modules.map((m, mi) => (
                      <AccordionItem key={m.id} defaultOpen={mi === 0} title={`Module ${mi + 1}: ${m.title}`} meta={`${m.lessons.length} lessons`}>
                        <ul>
                          {m.lessons.map((l, li) => (
                            <li key={l.id}>
                              {canOpen(l) ? (
                                <Link to={lessonLink(l)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-primary-50">
                                  {l.isCompleted ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Completed" /> : <PlayCircle className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                                  <span className="flex-1">{li + 1}. {l.title}</span>
                                  {l.isPreview && !v.isEnrolled && <Badge>Preview</Badge>}
                                  <span className="text-xs text-muted">{formatDuration(l.durationSeconds)}</span>
                                </Link>
                              ) : (
                                <div className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted">
                                  <Lock className="size-4 shrink-0" aria-label="Locked" />
                                  <span className="flex-1">{li + 1}. {l.title}</span>
                                  <span className="text-xs">{formatDuration(l.durationSeconds)}</span>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </AccordionItem>
                    ))}
                  </div>
                )}
              </section>
            )}
            {tab === 'instructor' && (
              <section className="card flex gap-4 p-5">
                {course.instructor ? (
                  <>
                    <Avatar name={course.instructor.name} src={course.instructor.avatarUrl} size="lg" />
                    <div>
                      <h2 className="font-semibold">{course.instructor.name}</h2>
                      {course.instructor.headline && <p className="text-sm text-primary">{course.instructor.headline}</p>}
                      <p className="mt-2 text-sm leading-6 text-muted">{course.instructor.bio || 'No biography provided yet.'}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted">Instructor information has not been added for this course.</p>
                )}
              </section>
            )}
            {tab === 'reviews' && (
              <section className="space-y-4">
                {v.isEnrolled && <ReviewForm course={course} onSaved={reload} />}
                {course.reviews.length === 0 ? (
                  <p className="text-sm text-muted">No reviews yet.{v.isEnrolled ? ' Be the first to share your experience.' : ' Enrolled learners can leave a review.'}</p>
                ) : (
                  <ul className="space-y-3">
                    {course.reviews.map((r) => (
                      <li key={r.id} className="card p-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.user?.name} src={r.user?.avatarUrl} size="sm" />
                          <div>
                            <p className="text-sm font-semibold">{r.user?.name}</p>
                            <p className="flex items-center gap-1 text-xs text-muted">
                              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`size-3 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-line'}`} aria-hidden="true" />)}
                              <span className="sr-only">{r.rating} out of 5</span> · {formatDate(r.createdAt)}
                            </p>
                          </div>
                        </div>
                        {r.comment && <p className="mt-3 text-sm text-muted">{r.comment}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold">This course includes</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-muted">
              <li className="flex items-center gap-2.5"><BookOpen className="size-4 text-primary" aria-hidden="true" /> {course.lessonCount} lessons in {course.modules.length} modules</li>
              {course.durationSeconds > 0 && <li className="flex items-center gap-2.5"><Clock className="size-4 text-primary" aria-hidden="true" /> {formatDuration(course.durationSeconds)} of content</li>}
              <li className="flex items-center gap-2.5"><Globe className="size-4 text-primary" aria-hidden="true" /> Taught in {course.language}</li>
              <li className="flex items-center gap-2.5"><BarChart3 className="size-4 text-primary" aria-hidden="true" /> Progress tracking</li>
              <li className="flex items-center gap-2.5"><Award className="size-4 text-primary" aria-hidden="true" /> Free to enrol</li>
            </ul>
          </div>
          <div className="rounded-[var(--radius-card)] bg-primary p-5 text-white">
            <p className="font-semibold">Ready for real experience?</p>
            <p className="mt-1 text-sm text-primary-100">Apply your skills in our free three-month internship.</p>
            <ButtonLink to="/internship" variant="white" size="sm" className="mt-4">Explore the internship</ButtonLink>
          </div>
        </aside>
      </div>

      {course.related.length > 0 && (
        <section className="container-page pb-16" aria-labelledby="related">
          <h2 id="related" className="section-title mb-6">Related Courses</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {course.related.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </section>
      )}
    </>
  );
}
