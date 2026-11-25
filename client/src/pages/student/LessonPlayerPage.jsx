import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Circle, Lock, Menu, PlayCircle, VideoOff, X } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Breadcrumbs, Button, ButtonLink, ErrorState, PageLoader, ProgressBar } from '../../components/common/ui.jsx';
import { Logo } from '../../components/common/Logo.jsx';
import { YouTubeLessonPlayer } from '../../components/courses/YouTubeLessonPlayer.jsx';
import { formatDuration, getYouTubeVideoId, toEmbedUrl } from '../../utils/format.js';
import NotFoundPage from '../errors/NotFoundPage.jsx';

function CourseContent({ data, courseSlug, currentId, onNavigate }) {
  const [openModules, setOpenModules] = useState(() => new Set(data.modules.filter((m) => m.lessons.some((l) => l.id === currentId)).map((m) => m.id)));
  const toggle = (id) => setOpenModules((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div>
      <div className="border-b border-line p-4">
        <h2 className="font-semibold">Course Content</h2>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <ProgressBar value={data.progress.progress} size="sm" label="Course progress" />
          <span className="shrink-0">{data.progress.progress}%</span>
        </div>
      </div>
      <ul>
        {data.modules.map((m, mi) => {
          const open = openModules.has(m.id);
          return (
            <li key={m.id} className="border-b border-line">
              <button type="button" aria-expanded={open} onClick={() => toggle(m.id)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold hover:bg-primary-50">
                <span>Module {mi + 1}: {m.title}</span>
                <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {open && (
                <ul className="pb-2">
                  {m.lessons.map((l, li) => {
                    const active = l.id === currentId;
                    const Icon = l.isLocked ? Lock : l.isCompleted ? CheckCircle2 : active ? PlayCircle : Circle;
                    const content = (
                      <>
                        <Icon className={`size-4 shrink-0 ${l.isCompleted ? 'text-success' : active ? 'text-primary' : 'text-muted'}`} aria-hidden="true" />
                        <span className="flex-1">{li + 1}. {l.title}</span>
                        <span className="text-[11px] text-muted">{formatDuration(l.durationSeconds)}</span>
                      </>
                    );
                    return (
                      <li key={l.id}>
                        {l.isLocked ? (
                          <span className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-muted">{content}</span>
                        ) : (
                          <Link to={`/learn/${courseSlug}/${l.id}`} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={`flex items-center gap-2.5 px-4 py-2 text-[13px] ${active ? 'bg-primary-light font-medium text-primary' : 'text-ink hover:bg-primary-50'}`}>
                            {content}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function LessonPlayerPage() {
  const { courseSlug, lessonId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi(`/lessons/${lessonId}`);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useDocumentTitle(data?.lesson?.title || 'Lesson');

  if (error?.status === 404) return <NotFoundPage />;
  if (error?.status === 401 || error?.status === 403) {
    return (
      <div className="grid min-h-dvh place-items-center bg-page px-4">
        <div className="card max-w-md p-8 text-center">
          <Lock className="mx-auto size-10 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold">This lesson is locked</h1>
          <p className="mt-2 text-sm text-muted">{error.message}</p>
          <div className="mt-6 flex justify-center gap-2">
            {!user && <ButtonLink to={`/login?next=${encodeURIComponent(`/learn/${courseSlug}/${lessonId}`)}`}>Log in</ButtonLink>}
            <ButtonLink to={`/courses/${courseSlug}`} variant="outline">View course</ButtonLink>
          </div>
        </div>
      </div>
    );
  }
  if (error) return <div className="p-8"><ErrorState error={error} onRetry={reload} /></div>;
  if (loading || !data) return <PageLoader />;
  if (data.course.slug !== courseSlug) return <Navigate to={`/learn/${data.course.slug}/${lessonId}`} replace />;

  const { lesson, navigation, viewer } = data;
  const embed = toEmbedUrl(lesson.videoUrl);
  const videoId = getYouTubeVideoId(lesson.videoUrl);
  const nextLesson = data.modules.flatMap((module) => module.lessons).find((item) => item.id === navigation.nextLessonId);
  const nextLessonUrl = nextLesson && !nextLesson.isLocked ? `/learn/${courseSlug}/${nextLesson.id}` : null;

  const toggleComplete = async () => {
    setSaving(true);
    try {
      const completed = !lesson.isCompleted;
      const res = await api.post(`/lessons/${lessonId}/complete`, { completed });
      const result = res.data.data;
      setData((current) => ({
        ...current,
        lesson: { ...current.lesson, isCompleted: completed },
        modules: current.modules.map((module) => ({
          ...module,
          lessons: module.lessons.map((item) => item.id === lessonId ? { ...item, isCompleted: completed } : item),
        })),
        progress: { ...current.progress, ...result.courseProgress },
        viewer: { ...current.viewer, canTrackProgress: !result.courseCompleted },
      }));
      if (result.courseCompleted && completed) toast.success('Course completed! Your certificate is ready in My Courses.');
      else toast.success(completed ? 'Lesson marked as complete. Course progress updated.' : 'Lesson marked as not complete. Course progress updated.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
        <Logo size="sm" />
        <span className="hidden h-6 w-px bg-line sm:block" />
        <Link to={`/courses/${data.course.slug}`} className="hidden min-w-0 truncate text-sm font-medium text-muted hover:text-primary sm:block">{data.course.title}</Link>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted md:inline">Lesson {navigation.position} of {navigation.total}</span>
          <button type="button" className="grid size-10 place-items-center rounded-xl hover:bg-primary-light lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Show course content">
            <Menu className="size-5" />
          </button>
          <ButtonLink to={user ? '/student/courses' : `/courses/${data.course.slug}`} size="sm" variant="outline" className="hidden sm:inline-flex">Exit</ButtonLink>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_360px]">
        <main id="main" className="min-w-0">
          <Breadcrumbs className="mb-4" items={[{ to: `/courses/${data.course.slug}`, label: data.course.title }, { label: lesson.moduleTitle }, { label: lesson.title }]} />
          <div className="overflow-hidden rounded-[var(--radius-card)] bg-[#17152B] shadow-[var(--shadow-card)]">
            {videoId ? (
              <YouTubeLessonPlayer
                videoId={videoId}
                embedUrl={embed}
                title={lesson.title}
                courseUrl={`/courses/${data.course.slug}`}
                nextLessonUrl={nextLessonUrl}
                nextLessonTitle={nextLesson?.title}
                nextLessonLocked={nextLesson?.isLocked}
              />
            ) : embed ? (
              <div className="aspect-video">
                <iframe src={embed} title={lesson.title} className="size-full" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy" />
              </div>
            ) : (
              <div className="grid aspect-video place-items-center p-6 text-center text-white/80">
                <div>
                  <VideoOff className="mx-auto size-10 text-primary-300" aria-hidden="true" />
                  <p className="mt-3 font-semibold text-white">{lesson.videoUrl ? 'This video link is not supported' : 'No video for this lesson'}</p>
                  <p className="mt-1 text-sm">{lesson.videoUrl ? <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="underline">Open the video in a new tab</a> : 'Read the lesson notes below and mark the lesson complete when you are done.'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="card mt-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-primary">{lesson.moduleTitle}</p>
                <h1 className="mt-1 text-xl font-bold sm:text-2xl">{lesson.title}</h1>
                <p className="mt-1 text-xs text-muted">{formatDuration(lesson.durationSeconds)}{lesson.isPreview && ' · Free preview'}</p>
              </div>
              {viewer.canTrackProgress && (
                <Button onClick={toggleComplete} loading={saving} variant={lesson.isCompleted ? 'outline' : 'primary'} icon={CheckCircle2}>
                  {lesson.isCompleted ? 'Completed — undo' : 'Mark as Complete'}
                </Button>
              )}
              {viewer.isEnrolled && !viewer.canTrackProgress && (
                <span className="inline-flex items-center gap-2 rounded-lg bg-success-light px-3 py-2 text-sm font-medium text-success">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Course completed
                </span>
              )}
            </div>
            {!viewer.isEnrolled && (
              <Alert className="mt-4" tone="info" title="You're watching a free preview">
                <Link to={`/courses/${data.course.slug}`} className="link">Enrol for free</Link> to unlock every lesson and track your progress.
              </Alert>
            )}
            {lesson.description && <div className="prose-g360 mt-5 border-t border-line pt-5">{lesson.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
              {navigation.previousLessonId ? <ButtonLink to={`/learn/${courseSlug}/${navigation.previousLessonId}`} variant="outline" icon={ArrowLeft}>Previous</ButtonLink> : <span />}
              {nextLessonUrl ? <ButtonLink to={nextLessonUrl} variant="secondary" iconRight={ArrowRight}>Next Lesson</ButtonLink> : nextLesson?.isLocked ? <ButtonLink to={`/courses/${courseSlug}`} variant="secondary">Enroll to continue</ButtonLink> : <ButtonLink to={`/courses/${courseSlug}`} variant="secondary">Back to course</ButtonLink>}
            </div>
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="card sticky top-[88px] max-h-[calc(100dvh-110px)] overflow-y-auto p-0 scrollbar-thin">
            <CourseContent data={data} courseSlug={courseSlug} currentId={lessonId} />
          </div>
        </aside>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Course content">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 right-0 w-[min(90vw,380px)] overflow-y-auto bg-white">
            <button type="button" onClick={() => setSidebarOpen(false)} className="absolute right-3 top-3 rounded-lg p-1.5 hover:bg-primary-light" aria-label="Close"><X className="size-5" /></button>
            <CourseContent data={data} courseSlug={courseSlug} currentId={lessonId} onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
