import { Link } from 'react-router-dom';

/** The emblem crop is used where the layout only has room for a compact mark. */
export function LogoMark({ className = 'size-8' }) {
  return (
    <span className={`inline-block shrink-0 overflow-hidden ${className}`} aria-hidden="true">
      <img src="/Logo.png" alt="" className="h-full max-w-none" />
    </span>
  );
}

export function Logo({ to = '/', className = '', light = false, size = 'md' }) {
  const height = size === 'sm' ? 'h-10' : 'h-12';
  const content = (
    <span className={`inline-flex items-center ${className}`}>
      <img
        src="/Logo.png"
        alt={to ? '' : 'Global360'}
        className={`${height} w-auto ${light ? 'brightness-0 invert' : ''}`}
      />
    </span>
  );
  if (!to) return content;
  return (
    <Link to={to} aria-label="Global360 home" className="inline-flex rounded-lg">
      {content}
    </Link>
  );
}
