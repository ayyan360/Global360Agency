import { useId, useRef, useState } from 'react';
import { FileText, ImageIcon, FileArchive, UploadCloud, X } from 'lucide-react';
import { formatBytes } from '../../utils/format.js';

const EXT_ACCEPT = { pdf: '.pdf,application/pdf', png: '.png,image/png', jpg: '.jpg,.jpeg,image/jpeg', webp: '.webp,image/webp', zip: '.zip,application/zip' };

const iconFor = (name) => (/\.(png|jpe?g|webp)$/i.test(name) ? ImageIcon : /\.zip$/i.test(name) ? FileArchive : FileText);

/** Drag-and-drop file picker with client-side pre-checks (the server re-validates everything). */
export function FileUpload({ files, onChange, allowedTypes = ['pdf', 'png', 'jpg', 'webp', 'zip'], maxSizeMB = 10, maxFiles = 5, disabled, error }) {
  const inputId = useId();
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const [localError, setLocalError] = useState(null);

  const accept = allowedTypes.map((t) => EXT_ACCEPT[t]).filter(Boolean).join(',');

  const addFiles = (list) => {
    setLocalError(null);
    const incoming = Array.from(list || []);
    const next = [...files];
    for (const f of incoming) {
      const ext = (f.name.split('.').pop() || '').toLowerCase().replace('jpeg', 'jpg');
      if (!allowedTypes.includes(ext)) {
        setLocalError(`"${f.name}" is not an accepted file type.`);
        continue;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        setLocalError(`"${f.name}" is larger than ${maxSizeMB} MB.`);
        continue;
      }
      if (next.length >= maxFiles) {
        setLocalError(`You can attach up to ${maxFiles} files.`);
        break;
      }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    onChange(next);
  };

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled) addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${drag ? 'border-primary bg-primary-light' : 'border-primary-200 bg-primary-50/60 hover:border-primary/60'} ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <UploadCloud className="mb-2 size-8 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium text-ink">
          Drag and drop your files here or <span className="text-primary underline underline-offset-2">click to browse</span>
        </span>
        <span className="mt-1 text-xs text-muted">
          Supports {allowedTypes.map((t) => t.toUpperCase()).join(', ')} · up to {maxSizeMB} MB each · max {maxFiles} files
        </span>
        <input ref={ref} id={inputId} type="file" multiple accept={accept} className="sr-only" disabled={disabled} onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }} />
      </label>
      {(localError || error) && <p className="mt-2 text-xs text-danger" role="alert">{localError || error}</p>}
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => {
            const Icon = iconFor(f.name);
            return (
              <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm">
                <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted">{formatBytes(f.size)}</span>
                <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="rounded p-1 text-muted hover:bg-danger-light hover:text-danger" aria-label={`Remove ${f.name}`}>
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
