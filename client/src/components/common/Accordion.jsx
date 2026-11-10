import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function AccordionItem({ title, meta, children, defaultOpen = false, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={`rounded-xl border border-line bg-white ${className}`}>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left hover:bg-primary-50/60">
          <span className="min-w-0 text-sm font-semibold text-ink">{title}</span>
          <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
            {meta}
            <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </span>
        </button>
      </h3>
      <div id={id} hidden={!open} className="border-t border-line px-2 py-2">
        {children}
      </div>
    </div>
  );
}
