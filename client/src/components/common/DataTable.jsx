import { Skeleton, EmptyState, ErrorState, Pagination } from './ui.jsx';

/**
 * Responsive data table. On small screens rows render as stacked cards (labels from column headers).
 * columns: [{ key, header, render?(row), className?, hideOnMobile? }]
 */
export function DataTable({ columns, rows, loading, error, onRetry, empty, meta, onPage, rowKey = 'id', onRowClick, caption }) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  return (
    <div className="card overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-primary-50/70 text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`px-4 py-3 ${c.className || ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && !rows?.length
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-full max-w-[140px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows?.map((row) => (
                  <tr key={row[rowKey]} onClick={onRowClick ? () => onRowClick(row) : undefined} className={`${onRowClick ? 'cursor-pointer' : ''} transition-colors hover:bg-primary-50/40 ${loading ? 'opacity-60' : ''}`}>
                    {columns.map((c) => (
                      <td key={c.key} className={`px-4 py-3.5 align-middle ${c.className || ''}`}>
                        {c.render ? c.render(row) : row[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {loading && !rows?.length
          ? Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="space-y-2 p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </li>
            ))
          : rows?.map((row) => (
              <li key={row[rowKey]} className="space-y-2 p-4" onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns
                  .filter((c) => !c.hideOnMobile)
                  .map((c) => (
                    <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                      <span className="shrink-0 text-xs font-medium text-muted">{c.header}</span>
                      <span className="min-w-0 text-right">{c.render ? c.render(row) : row[c.key]}</span>
                    </div>
                  ))}
              </li>
            ))}
      </ul>
      {!loading && rows && rows.length === 0 && <div className="p-4">{empty || <EmptyState title="Nothing here yet" description="No records match the current filters." />}</div>}
      {meta && onPage && meta.totalPages > 1 && (
        <div className="border-t border-line px-4 py-3">
          <Pagination meta={meta} onPage={onPage} />
        </div>
      )}
    </div>
  );
}
