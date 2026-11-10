import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button, Textarea } from './ui.jsx';

/** Accessible modal dialog: focus trap, Escape to close, focus restore, scroll lock. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', closeOnBackdrop = true }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const lastFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector('[data-autofocus], input, select, textarea, button:not([data-close])');
      (el || panelRef.current)?.focus();
    }, 20);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={closeOnBackdrop ? onClose : undefined} aria-hidden="true" />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`relative flex max-h-[92vh] w-full ${width} animate-fade-in flex-col rounded-t-2xl bg-white shadow-[var(--shadow-pop)] sm:rounded-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button type="button" data-close onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-primary-light hover:text-ink" aria-label="Close dialog">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** Confirmation dialog; optionally requires a written reason (for audited actions). */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'danger', loading, requireReason, reasonLabel = 'Reason' }) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  const disabled = requireReason && reason.trim().length < 5;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={() => onConfirm(reason.trim())} loading={loading} disabled={disabled} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {tone === 'danger' && (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-light text-danger">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
        )}
        <div className="flex-1 text-sm text-muted">{message}</div>
      </div>
      {requireReason && <Textarea className="mt-4" label={reasonLabel} required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} hint="At least 5 characters. This is recorded in the audit log." />}
    </Modal>
  );
}
