import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Award, ExternalLink, Trash2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Button, ButtonLink, Card, Checkbox, ErrorState, Input, PageHeader, PageLoader, Select, StatusBadge, Tabs, Textarea } from '../../components/common/ui.jsx';
import { ConfirmDialog } from '../../components/common/Modal.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { CourseContentManager } from '../../components/admin/CourseContentManager.jsx';
import { linesToList, listToLines } from '../../components/admin/AdminKit.jsx';
import { formatDate } from '../../utils/format.js';

function CourseForm({ course, onSaved }) {
  const { can } = useAuth();
  const toast = useToast();
  const isAdmin = can('courses:manage');
  const { data: instructors } = useApi(isAdmin ? '/admin/instructors' : null);
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    values: {
      title: course?.title || '',
      slug: course?.slug || '',
      shortDescription: course?.shortDescription || '',
      description: course?.description || '',
      category: course?.category || '',
      level: course?.level || 'beginner',
      status: course?.status || 'draft',
      thumbnailUrl: course?.thumbnailUrl || '',
      instructorId: course?.instructorId || '',
      language: course?.language || 'English',
      outcomes: listToLines(course?.outcomes),
      requirements: listToLines(course?.requirements),
      isFree: course?.isFree ?? true,
      certificateFee: course?.certificateFee ?? 0,
    },
  });

  const submit = async (v) => {
    setFormError(null);
    const body = {
      ...v,
      slug: v.slug || undefined,
      thumbnailUrl: v.thumbnailUrl || null,
      instructorId: isAdmin ? v.instructorId || null : undefined,
      outcomes: linesToList(v.outcomes),
      requirements: linesToList(v.requirements),
    };
    try {
      const res = course ? await api.patch(`/admin/courses/${course.id}`, body) : await api.post('/admin/courses', body);
      toast.success(course ? 'Course saved.' : 'Course created. Now add modules and lessons.');
      onSaved(res.data.data);
    } catch (err) {
      Object.entries(err.fieldErrors?.() || {}).forEach(([f, m]) => setError(f, { message: m }));
      setFormError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4 md:grid-cols-2" noValidate>
      {formError && <Alert tone="danger" className="md:col-span-2">{formError}</Alert>}
      <Input label="Title" required className="md:col-span-2" error={errors.title?.message} {...register('title')} />
      <Input label="Short description" required className="md:col-span-2" hint="Shown on course cards (10–300 characters)." error={errors.shortDescription?.message} {...register('shortDescription')} />
      <Textarea label="Full description" required className="md:col-span-2" rows={6} error={errors.description?.message} {...register('description')} />
      <Input label="Category" required placeholder="e.g. Web Development" error={errors.category?.message} {...register('category')} />
      <Select label="Level" error={errors.level?.message} options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} {...register('level')} />
      <details open={Boolean(course)} className="rounded-xl border border-line md:col-span-2">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Optional settings</summary>
        <div className="grid gap-4 border-t border-line p-4 md:grid-cols-2">
          <Select label="Status" error={errors.status?.message} options={[{ value: 'draft', label: 'Draft (hidden)' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived (hidden)' }]} {...register('status')} />
          {isAdmin ? (
            <Select label="Instructor" placeholder="No instructor" options={(instructors || []).map((i) => ({ value: i.id, label: `${i.name} (${i.role})` }))} {...register('instructorId')} />
          ) : (
            <Input label="Instructor" value="You" disabled readOnly />
          )}
          <Input label="Thumbnail image URL" placeholder="https://… (leave empty for a generated cover)" error={errors.thumbnailUrl?.message} {...register('thumbnailUrl')} />
          <Input label="URL slug" placeholder="Auto-generated from title" hint="Leave empty to generate automatically." error={errors.slug?.message} {...register('slug')} />
          <Input label="Language" error={errors.language?.message} {...register('language')} />
          <div className="flex items-end"><Checkbox label="Free course" description="Students can enrol without payment." {...register('isFree')} /></div>
          <Input label="Certificate fee (PKR)" type="number" min={0} step={1} hint="Set to 0 for a free certificate." error={errors.certificateFee?.message} {...register('certificateFee', { valueAsNumber: true })} />
          <Textarea label="Learning outcomes (one per line)" rows={4} error={errors.outcomes?.message} {...register('outcomes')} />
          <Textarea label="Requirements (one per line)" rows={4} error={errors.requirements?.message} {...register('requirements')} />
        </div>
      </details>
      <div className="md:col-span-2"><Button type="submit" loading={isSubmitting}>{course ? 'Save course' : 'Create course'}</Button></div>
    </form>
  );
}

function Enrollments({ courseId, curriculumLocked }) {
  const [page, setPage] = useState(1);
  const [completionTarget, setCompletionTarget] = useState(null);
  const [completing, setCompleting] = useState(false);
  const toast = useToast();
  const { data, meta, loading, error, reload } = useApi(`/admin/courses/${courseId}/enrollments`, { params: { page, pageSize: 15 } });
  const completeEnrollment = async () => {
    const target = completionTarget;
    if (!target) return;
    setCompleting(true);
    try {
      const result = await api.post(`/admin/courses/${courseId}/enrollments/${target.id}/complete`);
      const certificateIssued = result.data.data.certificateIssued;
      toast.success(certificateIssued
        ? `Course completed for ${target.user?.name}. Certificate issued.`
        : `Course completed for ${target.user?.name}. A certificate will be issued automatically after the curriculum is locked.`);
      setCompletionTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCompleting(false);
    }
  };
  return (
    <>
      <DataTable
        caption="Course enrollments"
        loading={loading}
        error={error}
        onRetry={reload}
        rows={data}
        meta={meta}
        onPage={setPage}
        columns={[
          { key: 'user', header: 'Student', render: (e) => <span><b className="font-medium">{e.user?.name}</b><br /><span className="text-xs text-muted">{e.user?.email}</span></span> },
          { key: 'enrolledAt', header: 'Enrolled', render: (e) => formatDate(e.enrolledAt) },
          { key: 'progress', header: 'Progress', render: (e) => `${e.progress ?? 0}%` },
          { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
          {
            key: 'actions',
            header: 'Action',
            render: (e) => e.status === 'active' ? (
              <Button
                size="sm"
                variant="outline"
                icon={Award}
                onClick={(event) => {
                  event.stopPropagation();
                  setCompletionTarget(e);
                }}
              >
                Mark complete
              </Button>
            ) : null,
          },
        ]}
      />
      <ConfirmDialog
        open={Boolean(completionTarget)}
        onClose={() => setCompletionTarget(null)}
        onConfirm={completeEnrollment}
        loading={completing}
        title="Complete this course enrollment?"
        confirmLabel="Mark course complete"
        tone="primary"
        message={`This will mark every lesson complete for ${completionTarget?.user?.name || 'this learner'} and finalize the enrollment. ${curriculumLocked ? 'A certificate will be issued automatically.' : 'No certificate is issued until the course curriculum is locked.'}`}
      />
    </>
  );
}

export default function AdminCourseEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = !id;
  const { data: course, loading, error, reload } = useApi(isNew ? null : `/admin/courses/${id}`);
  const [tab, setTab] = useState('details');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useDocumentTitle(isNew ? 'New course' : course?.title || 'Edit course');

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!isNew && (loading || !course)) return <PageLoader />;

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/courses/${id}`);
      toast.success('Course deleted.');
      navigate('/admin/courses');
    } catch (err) {
      toast.error(err.message);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ to: '/admin/courses', label: 'Courses' }, { label: isNew ? 'New course' : course.title }]}
        title={isNew ? 'New course' : course.title}
        description={isNew ? 'Fill in the course details. You can add modules and lessons after saving.' : <span className="inline-flex items-center gap-2">Status <StatusBadge status={course.status} /> · Last updated {formatDate(course.updatedAt)}</span>}
        actions={!isNew && (
          <>
            {course.status === 'published' && <ButtonLink to={`/courses/${course.slug}`} target="_blank" variant="outline" icon={ExternalLink}>View live</ButtonLink>}
            <Button variant="danger-outline" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>
          </>
        )}
      />
      {!isNew && <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ value: 'details', label: 'Details' }, { value: 'content', label: 'Modules & lessons' }, { value: 'enrollments', label: 'Enrollments' }]} />}
      {tab === 'details' && <Card><CourseForm course={course} onSaved={(c) => (isNew ? navigate(`/admin/courses/${c.id}`, { replace: true }) : reload())} /></Card>}
      {tab === 'content' && course && <Card><CourseContentManager course={course} onChanged={reload} /></Card>}
      {tab === 'enrollments' && course && <Enrollments courseId={course.id} curriculumLocked={course.curriculumLocked} />}
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove} loading={deleting} title="Delete course?" confirmLabel="Delete course" message="This permanently deletes the course, its modules and lessons. Courses with enrollments cannot be deleted — archive them instead." />
    </div>
  );
}
