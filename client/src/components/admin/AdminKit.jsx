import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useDebounce } from '../../hooks/useCommon.js';
import { Select } from '../common/ui.jsx';

/** Search box that commits after typing pauses (keeps URL query state in sync). */
export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', className = '' }) {
  const [v, setV] = useState(value || '');
  const debounced = useDebounce(v);
  useEffect(() => setV(value || ''), [value]);
  useEffect(() => {
    if (debounced !== (value || '')) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return (
    <div className={`relative min-w-0 flex-1 basis-56 ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input type="search" aria-label={label} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-[10px] border border-line bg-white pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15" />
    </div>
  );
}

export function FilterBar({ children, className = '' }) {
  return <div className={`mb-4 flex flex-wrap items-center gap-3 ${className}`}>{children}</div>;
}

export function FilterSelect({ label, value, onChange, options, allLabel = 'All', className = 'w-48' }) {
  return (
    <Select
      aria-label={label}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      selectClassName="h-10"
      options={[{ value: '', label: `${label}: ${allLabel}` }, ...options]}
    />
  );
}

/** Splits a textarea of one-item-per-line into a clean string list (and back). */
export const linesToList = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
export const listToLines = (list) => (list || []).join('\n');
