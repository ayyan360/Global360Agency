import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle, useQueryState } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, Pagination, Tabs } from '../../components/common/ui.jsx';
import { formatDateTime, relativeTime } from '../../utils/format.js';

export default function NotificationsPage() {
  useDocumentTitle('Notifications');
  const navigate = useNavigate();
  const [q, setQ] = useQueryState({ filter: 'all', page: 1 });
  const { data, meta, loading, error, reload } = useApi('/notifications', { params: { page: q.page, pageSize: 15, unreadOnly: q.filter === 'unread' } });

  const open = async (n) => {
    if (!n.isRead) await api.post(`/notifications/${n.id}/read`).catch(() => {});
    if (n.link) navigate(n.link);
    else reload();
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Updates about your applications, tasks, reviews and certificates."
        actions={meta?.unread > 0 && <Button variant="outline" icon={CheckCheck} onClick={async () => { await api.post('/notifications/read-all'); reload(); }}>Mark all as read</Button>}
      />
      <Tabs className="mb-5" value={q.filter} onChange={(filter) => setQ({ filter })} tabs={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread', count: meta?.unread }]} />
      {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <PageLoader /> : data?.length ? (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {data.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => open(n)} className={`flex w-full gap-3 px-5 py-4 text-left hover:bg-primary-50 ${n.isRead ? '' : 'bg-primary-50/50'}`}>
                  <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${n.isRead ? 'bg-line' : 'bg-primary'}`} aria-label={n.isRead ? 'Read' : 'Unread'} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{n.title}</span>
                    <span className="block text-sm text-muted">{n.message}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted" title={formatDateTime(n.createdAt)}>{relativeTime(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3"><Pagination meta={meta} onPage={(page) => setQ({ page }, { resetPage: false })} /></div>
        </Card>
      ) : (
        <EmptyState icon={Bell} title={q.filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} description="You'll be notified about applications, new tasks, reviews and certificates." />
      )}
    </div>
  );
}
