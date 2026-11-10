import { forwardRef, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Eye, EyeOff, Inbox, Loader2, RefreshCw, ChevronRight as Crumb } from 'lucide-react';
import { statusInfo } from '../../constants/status.js';
import { initials } from '../../utils/format.js';

const cx = (...c) => c.filter(Boolean).join(' ');

// ---------------- Buttons ----------------
const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm shadow-primary/20 disabled:bg-primary/60',
  secondary: 'border border-primary/30 bg-white text-primary hover:bg-primary-light disabled:opacity-60',
  outline: 'border border-line bg-white text-ink hover:border-primary/40 hover:bg-primary-50 disabled:opacity-60',
  ghost: 'text-muted hover:bg-primary-light hover:text-primary disabled:opacity-60',
  danger: 'bg-danger text-white hover:bg-red-600 disabled:opacity-60',
  'danger-outline': 'border border-danger/30 bg-white text-danger hover:bg-danger-light disabled:opacity-60',
  white: 'bg-white text-primary hover:bg-primary-50 shadow-sm',
};
const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-[10px]',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
  icon: 'size-9 rounded-lg',
};

export function buttonClasses({ variant = 'primary', size = 'md', block, className } = {}) {
  return cx(
    'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className
  );
}

export const Button = forwardRef(function Button({ variant, size, block, loading, icon: Icon, iconRight: IconRight, className, children, disabled, type = 'button', ...props }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClasses({ variant, size, block, className })} {...props}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : Icon && <Icon className="size-4" aria-hidden="true" />}
      {children}
      {IconRight && !loading && <IconRight className="size-4" aria-hidden="true" />}
    </button>
  );
});

export function ButtonLink({ to, variant, size, block, className, icon: Icon, iconRight: IconRight, children, ...props }) {
  return (
    <Link to={to} className={buttonClasses({ variant, size, block, className })} {...props}>
      {Icon && <Icon className="size-4" aria-hidden="true" />}
      {children}
      {IconRight && <IconRight className="size-4" aria-hidden="true" />}
    </Link>
  );
}

// ---------------- Form fields ----------------
const fieldBase =
  'block w-full rounded-[10px] border bg-white px-3.5 text-sm text-ink placeholder:text-muted/70 transition-colors focus:outline-none focus:ring-3 focus:ring-primary/15 disabled:bg-page disabled:text-muted';
const fieldBorder = (error) => (error ? 'border-danger focus:border-danger' : 'border-line focus:border-primary');

export function Field({ label, htmlFor, error, hint, required, children, className, labelAction }) {
  return (
    <div className={cx('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
            {label}
            {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
          </label>
          {labelAction}
        </div>
      )}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-center gap-1 text-xs text-danger" role="alert">
          <AlertCircle className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, error, hint, required, icon: Icon, className, id, type = 'text', labelAction, ...props }, ref) {
  const auto = useId();
  const inputId = id || auto;
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className} labelAction={labelAction}>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />}
        <input
          ref={ref}
          id={inputId}
          type={isPassword && show ? 'text' : type}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          required={required}
          className={cx(fieldBase, fieldBorder(error), 'h-11', Icon && 'pl-9', isPassword && 'pr-10')}
          {...props}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:text-primary" aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, required, className, id, rows = 4, ...props }, ref) {
  const auto = useId();
  const inputId = id || auto;
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        required={required}
        className={cx(fieldBase, fieldBorder(error), 'py-2.5 leading-6')}
        {...props}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, error, hint, required, className, id, options = [], placeholder, children, selectClassName, ...props }, ref) {
  const auto = useId();
  const inputId = id || auto;
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <select
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        required={required}
        className={cx(fieldBase, fieldBorder(error), 'h-11 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%23716C86%27%3E%3Cpath d=%27M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z%27/%3E%3C/svg%3E")] bg-[length:1.1rem] bg-[right_0.7rem_center] bg-no-repeat pr-9', selectClassName)}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
    </Field>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, description, className, id, ...props }, ref) {
  const auto = useId();
  const inputId = id || auto;
  return (
    <div className={cx('flex items-start gap-2.5', className)}>
      <input ref={ref} id={inputId} type="checkbox" className="mt-0.5 size-4 rounded border-line accent-primary" {...props} />
      <label htmlFor={inputId} className="text-sm text-ink">
        {label}
        {description && <span className="block text-xs text-muted">{description}</span>}
      </label>
    </div>
  );
});

// ---------------- Display ----------------
export function Badge({ children, tone = 'primary', className, icon: Icon }) {
  const tones = {
    primary: 'bg-primary-light text-primary',
    neutral: 'bg-slate-100 text-slate-700',
    success: 'bg-success-light text-success',
    warning: 'bg-warning-light text-amber-700',
    danger: 'bg-danger-light text-danger',
    info: 'bg-sky-50 text-sky-700',
    outline: 'border border-line bg-white text-muted',
  };
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>
      {Icon && <Icon className="size-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }) {
  const info = statusInfo(status);
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', info.className, className)}>{info.label}</span>;
}

export function Card({ as: Tag = 'div', className, children, padded = true, ...props }) {
  return (
    <Tag className={cx('card', padded && 'p-5 sm:p-6', className)} {...props}>
      {children}
    </Tag>
  );
}

export function SectionHeader({ title, description, action, className, as: Tag = 'h2' }) {
  return (
    <div className={cx('mb-5 flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <Tag className="text-lg font-semibold text-ink">{title}</Tag>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, breadcrumbs }) {
  return (
    <div className="mb-6">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-3" />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" className={cx('inline-flex items-center gap-2 text-sm text-muted', className)}>
      <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-lg bg-primary-100/60', className)} aria-hidden="true" />;
}

export function CardSkeleton({ count = 3, className }) {
  return (
    <div className={cx('grid gap-5 sm:grid-cols-2 lg:grid-cols-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <Skeleton className="aspect-[16/10] rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line bg-primary-50/50 px-6 py-12 text-center', className)}>
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary-light text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong', className }) {
  return (
    <div role="alert" className={cx('flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-danger/20 bg-danger-light/50 px-6 py-10 text-center', className)}>
      <AlertCircle className="mb-3 size-8 text-danger" aria-hidden="true" />
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted">{error?.message || 'Please try again.'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Alert({ tone = 'info', title, children, icon: Icon = AlertCircle, className }) {
  const tones = {
    info: 'border-primary/20 bg-primary-50 text-ink',
    success: 'border-success/20 bg-success-light text-ink',
    warning: 'border-warning/30 bg-warning-light text-ink',
    danger: 'border-danger/20 bg-danger-light text-ink',
  };
  const iconTone = { info: 'text-primary', success: 'text-success', warning: 'text-amber-600', danger: 'text-danger' };
  return (
    <div className={cx('flex gap-3 rounded-xl border p-4 text-sm', tones[tone], className)} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon className={cx('mt-0.5 size-5 shrink-0', iconTone[tone])} aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-muted">{children}</div>
      </div>
    </div>
  );
}

export function ProgressBar({ value = 0, className, size = 'md', label, tone = 'primary' }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const h = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' }[size];
  const fill = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning' }[tone];
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-primary-100', h, className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label || 'Progress'}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', fill)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function ProgressRing({ value = 0, size = 128, stroke = 12, label, sublabel, className }) {
  const v = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, Number(value)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cx('relative inline-grid place-items-center', className)} style={{ width: size, height: size }} role="img" aria-label={`${label || 'Progress'}: ${value === null || value === undefined ? 'not available' : `${Math.round(v)}%`}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-primary-100)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-primary)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-ink">{value === null || value === undefined ? '—' : `${Number(v.toFixed(1))}%`}</div>
        {sublabel && <div className="text-[11px] text-muted">{sublabel}</div>}
      </div>
    </div>
  );
}

export function Avatar({ name, src, size = 'md', className }) {
  const s = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' }[size];
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img src={src} alt="" onError={() => setFailed(true)} className={cx('shrink-0 rounded-full object-cover', s, className)} />;
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-full bg-primary-light font-semibold text-primary', s, className)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Breadcrumbs({ items, className }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <Crumb className="size-3.5 text-muted/60" aria-hidden="true" />}
            {item.to && i < items.length - 1 ? (
              <Link to={item.to} className="hover:text-primary">
                {item.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined} className={i === items.length - 1 ? 'font-medium text-ink' : ''}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Pagination({ meta, onPage, className }) {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, totalPages, total, pageSize } = meta;
  const pages = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let p = start; p <= Math.min(totalPages, start + 4); p += 1) pages.push(p);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className={cx('flex flex-wrap items-center justify-between gap-3', className)} aria-label="Pagination">
      <p className="text-xs text-muted">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:border-primary/40 hover:text-primary disabled:opacity-40" aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        {pages.map((p) => (
          <button key={p} type="button" onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined} className={cx('grid size-8 place-items-center rounded-lg text-xs font-semibold', p === page ? 'bg-primary text-white' : 'border border-line text-ink hover:border-primary/40 hover:text-primary')}>
            {p}
          </button>
        ))}
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:border-primary/40 hover:text-primary disabled:opacity-40" aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}

export function Tabs({ tabs, value, onChange, className, variant = 'underline' }) {
  return (
    <div role="tablist" className={cx(variant === 'underline' ? 'flex gap-6 overflow-x-auto border-b border-line scrollbar-thin' : 'inline-flex flex-wrap gap-1 rounded-xl bg-primary-50 p-1', className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cx(
              'shrink-0 text-sm font-medium transition-colors',
              variant === 'underline'
                ? cx('-mb-px border-b-2 px-0.5 pb-3 pt-1', active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink')
                : cx('rounded-lg px-3.5 py-1.5', active ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-ink')
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cx('ml-1.5 rounded-full px-1.5 py-0.5 text-[11px]', active ? 'bg-primary-light text-primary' : 'bg-slate-100 text-muted')}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'primary', className, children }) {
  const tones = { primary: 'bg-primary-light text-primary', success: 'bg-success-light text-success', warning: 'bg-warning-light text-amber-600', danger: 'bg-danger-light text-danger', info: 'bg-sky-50 text-sky-600' };
  return (
    <div className={cx('card flex items-start gap-3.5 p-4 sm:p-5', className)}>
      {Icon && (
        <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold leading-tight text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        {children}
      </div>
    </div>
  );
}

export function KeyValue({ label, children, className }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children ?? '—'}</dd>
    </div>
  );
}

export { cx };
