import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../../services/api.js';
import { relativeTime } from '../../utils/format.js';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const loadCount = useCallback(() => {
    api
      .get('/notifications/unread-count')
      .then((r) => setUnread(r.data.data.unread))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 60000);
    return () => clearInterval(t);
  }, [loadCount]);

  useEffect(() => {
    if (!open) return undefined;
    setLoading(true);
    api
      .get('/notifications', { params: { pageSize: 6 } })
      .then((r) => {
        setItems(r.data.data);
        setUnread(r.data.meta.unread);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.isRead) {
      api.post(`/notifications/${n.id}/read`).then(loadCount).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    await api.post('/notifications/read-all').catch(() => {});
    setItems((list) => list.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative grid size-10 place-items-center rounded-xl text-muted hover:bg-primary-light hover:text-primary">
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="card absolute right-0 z-50 mt-2 w-[min(92vw,360px)] animate-fade-in overflow-hidden p-0 shadow-[var(--shadow-pop)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto scrollbar-thin">
            {loading && !items.length && <li className="px-4 py-6 text-center text-sm text-muted">Loading…</li>}
            {!loading && !items.length && <li className="px-4 py-8 text-center text-sm text-muted">You're all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openItem(n)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-primary-50 ${n.isRead ? '' : 'bg-primary-50/60'}`}>
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-primary'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{n.title}</span>
                    <span className="line-clamp-2 block text-xs text-muted">{n.message}</span>
                    <span className="mt-1 block text-[11px] text-muted/80">{relativeTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-xs font-semibold text-primary hover:bg-primary-50">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
