import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';

/**
 * Fetch JSON from the API with loading/error state. Re-fetches when `url` or `params` change,
 * ignores stale responses and aborts on unmount.
 */
export function useApi(url, { params, enabled = true, keepPrevious = false } = {}) {
  const [state, setState] = useState({ data: undefined, meta: undefined, error: null, loading: Boolean(url && enabled) });
  const paramsKey = JSON.stringify(params || {});
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!url || !enabled) return;
    const id = ++reqId.current;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null, ...(keepPrevious ? {} : { data: s.data }) }));
    try {
      const res = await api.get(url, { params: JSON.parse(paramsKey), signal: controller.signal });
      if (id === reqId.current) setState({ data: res.data.data, meta: res.data.meta, error: null, loading: false });
    } catch (error) {
      if (error?.name === 'CanceledError') return;
      if (id === reqId.current) setState((s) => ({ ...s, error, loading: false }));
    }
    return () => controller.abort();
  }, [url, paramsKey, enabled, keepPrevious]);

  useEffect(() => {
    load();
    return () => {
      reqId.current += 1;
    };
  }, [load]);

  return { ...state, reload: load, setData: (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })) };
}

/** Wraps a mutation with pending state and toast-friendly error handling. */
export function useMutation(fn) {
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async (...args) => {
      setPending(true);
      try {
        return await fn(...args);
      } finally {
        setPending(false);
      }
    },
    [fn]
  );
  return [run, pending];
}
