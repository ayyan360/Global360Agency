import { useEffect, useState } from 'react';
import { BarChart3, Code2, Database, LayoutGrid, Megaphone, Palette, Search, Terminal, BookOpen, SlidersHorizontal, X } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDebounce, useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { CardSkeleton, EmptyState, ErrorState, Pagination, Select, Button } from '../../components/common/ui.jsx';
import { CourseCard } from '../../components/courses/CourseCard.jsx';
import { GraduationIllustration } from '../../components/common/Illustrations.jsx';

const CATEGORY_ICONS = { 'Web Development': Code2, Programming: Terminal, 'Data Science': Database, Design: Palette, Marketing: Megaphone, Business: BarChart3 };

const DEFAULTS = { search: '', category: '', level: '', minRating: '', sort: 'newest', page: 1 };

export default function CoursesPage() {
  useDocumentTitle('Courses');
  const [q, setQ] = useQueryState(DEFAULTS);
  const [searchInput, setSearchInput] = useState(q.search);
  const debounced = useDebounce(searchInput);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (debounced !== q.search) setQ({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  useEffect(() => setSearchInput(q.search), [q.search]);

  const params = { search: q.search || undefined, category: q.category || undefined, level: q.level || undefined, minRating: q.minRating || undefined, sort: q.sort, page: q.page, pageSize: 9 };
  const { data, meta, loading, error, reload } = useApi('/courses', { params });
  const { data: categories } = useApi('/courses/categories');
  const total = categories?.reduce((s, c) => s + c.count, 0) || 0;
  const activeFilters = [q.search && 'search', q.category && 'category', q.level && 'level', q.minRating && 'minRating'].filter(Boolean).length;

  const categoryList = (
    <nav aria-label="Course categories">
      <h2 className="mb-3 px-3 text-sm font-semibold text-ink">Categories</h2>
      <ul className="space-y-0.5">
        {[{ name: '', label: 'All Categories', count: total }, ...(categories || []).map((c) => ({ ...c, label: c.name }))].map((c) => {
          const Icon = c.name ? CATEGORY_ICONS[c.name] || BookOpen : LayoutGrid;
          const active = q.category === c.name;
          return (
            <li key={c.label}>
              <button type="button" onClick={() => setQ({ category: c.name })} aria-pressed={active} className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors ${active ? 'bg-primary-light font-semibold text-primary' : 'text-ink/80 hover:bg-primary-50'}`}>
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{c.label}</span>
                <span className="text-xs text-muted">{c.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <>
      <section className="border-b border-line bg-primary-50/60">
        <div className="container-page flex items-center justify-between gap-6 py-10">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">Our Courses</h1>
            <p className="mt-2 max-w-xl text-muted">Explore our range of free courses and start learning today. Enrol in any course and track your progress lesson by lesson.</p>
          </div>
          <GraduationIllustration className="hidden w-48 shrink-0 sm:block" />
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">{categoryList}</div>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 basis-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <label htmlFor="course-search" className="sr-only">Search courses</label>
              <input id="course-search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search courses…" className="h-11 w-full rounded-[10px] border border-line bg-white pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15" />
            </div>
            <Select aria-label="Sort courses" value={q.sort} onChange={(e) => setQ({ sort: e.target.value })} className="w-44" options={[{ value: 'newest', label: 'Newest first' }, { value: 'popular', label: 'Most popular' }, { value: 'rating', label: 'Highest rated' }, { value: 'title', label: 'Title A–Z' }]} />
            <Button variant="outline" className="lg:hidden" icon={SlidersHorizontal} onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
              Filters{activeFilters ? ` (${activeFilters})` : ''}
            </Button>
          </div>

          {filtersOpen && <div className="card mt-3 p-3 lg:hidden">{categoryList}</div>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Select aria-label="Filter by level" value={q.level} onChange={(e) => setQ({ level: e.target.value })} className="w-40" selectClassName="h-9 rounded-full text-xs" options={[{ value: '', label: 'Level: All' }, { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} />
            <Select aria-label="Filter by rating" value={q.minRating} onChange={(e) => setQ({ minRating: e.target.value })} className="w-40" selectClassName="h-9 rounded-full text-xs" options={[{ value: '', label: 'Rating: All' }, { value: '4', label: '4★ & up' }, { value: '3', label: '3★ & up' }]} />
            {activeFilters > 0 && (
              <button type="button" onClick={() => { setSearchInput(''); setQ({ search: '', category: '', level: '', minRating: '' }); }} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-light">
                <X className="size-3.5" /> Clear filters
              </button>
            )}
            {meta && <p className="ml-auto text-xs text-muted" aria-live="polite">{meta.total} course{meta.total === 1 ? '' : 's'} found</p>}
          </div>

          <div className="mt-6">
            {error ? (
              <ErrorState error={error} onRetry={reload} />
            ) : loading && !data ? (
              <CardSkeleton count={6} />
            ) : data?.length ? (
              <div className={`grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
                {data.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            ) : (
              <EmptyState icon={Search} title="No courses found" description="Try a different search term or clear the filters." />
            )}
          </div>
          <Pagination className="mt-8" meta={meta} onPage={(page) => setQ({ page }, { resetPage: false })} />
        </div>
      </div>
    </>
  );
}
