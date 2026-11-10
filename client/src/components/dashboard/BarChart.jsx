/**
 * Lightweight accessible bar chart (no chart library). Values are percentages 0–100 or null.
 * Renders a visually-hidden data table for screen readers.
 */
export function BarChart({ data, height = 160, label = 'Chart', valueSuffix = '%', emptyLabel = 'No data yet' }) {
  const hasData = data.some((d) => d.value !== null && d.value !== undefined);
  return (
    <figure className="w-full">
      <div className="relative" style={{ height }} aria-hidden="true">
        <div className="absolute inset-0 flex flex-col justify-between">
          {[100, 75, 50, 25, 0].map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className="w-8 text-right text-[10px] text-muted">{t}</span>
              <div className="h-px flex-1 bg-line/70" />
            </div>
          ))}
        </div>
        <div className="absolute inset-y-0 left-10 right-0 flex items-end justify-around gap-1.5 pb-[1px]">
          {data.map((d) => (
            <div key={d.label} className="group relative flex h-full w-full max-w-7 flex-col justify-end">
              {d.value !== null && d.value !== undefined ? (
                <div className="w-full rounded-t-md bg-primary transition-all duration-500 group-hover:bg-primary-hover" style={{ height: `${Math.max(2, Math.min(100, d.value))}%` }} title={`${d.label}: ${d.value}${valueSuffix}`} />
              ) : (
                <div className="h-1 w-full rounded bg-primary-100" />
              )}
            </div>
          ))}
        </div>
        {!hasData && <div className="absolute inset-0 grid place-items-center text-xs text-muted">{emptyLabel}</div>}
      </div>
      <div className="ml-10 mt-2 flex justify-around gap-1.5" aria-hidden="true">
        {data.map((d) => (
          <span key={d.label} className="w-full max-w-7 truncate text-center text-[10px] text-muted">
            {d.short || d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{d.value === null || d.value === undefined ? 'No data' : `${d.value}${valueSuffix}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
