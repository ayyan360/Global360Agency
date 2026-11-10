import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Global360` : 'Global360 — Learn, Grow and Build Your Future';
  }, [title]);
}

export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Reads/writes filter state in the URL query string so filters are shareable and survive refresh. */
export function useQueryState(defaults) {
  const [params, setParams] = useSearchParams();
  const values = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const v = params.get(key);
    if (v !== null) values[key] = typeof defaults[key] === 'number' ? Number(v) || defaults[key] : v;
  }
  const update = (patch, { resetPage = true } = {}) => {
    const next = new URLSearchParams(params);
    const merged = { ...patch, ...(resetPage && !('page' in patch) && 'page' in defaults ? { page: 1 } : {}) };
    for (const [k, v] of Object.entries(merged)) {
      if (v === '' || v === undefined || v === null || v === defaults[k]) next.delete(k);
      else next.set(k, String(v));
    }
    setParams(next, { replace: true });
  };
  return [values, update];
}
