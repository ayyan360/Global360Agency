import { useState } from 'react';
import { BarChart3, Code2, Database, Megaphone, Palette, Terminal, BookOpen } from 'lucide-react';

/**
 * Course thumbnail: uses the uploaded thumbnailUrl when present, otherwise (or if the image fails)
 * renders a generated, category-themed cover so cards never show broken images.
 */
const THEMES = {
  'Web Development': { icon: Code2, bg: '#1E1538', accent: '#8B5CF6', motif: 'code' },
  Programming: { icon: Terminal, bg: '#231B3F', accent: '#A78BFA', motif: 'code' },
  'Data Science': { icon: Database, bg: '#160F2E', accent: '#7C3AED', motif: 'chart' },
  Design: { icon: Palette, bg: '#F3EEFF', accent: '#6C2BEB', motif: 'shapes', light: true },
  Marketing: { icon: Megaphone, bg: '#EDE4FF', accent: '#6C2BEB', motif: 'chart', light: true },
  Business: { icon: BarChart3, bg: '#EFE7FF', accent: '#5720CC', motif: 'chart', light: true },
};
const DEFAULT = { icon: BookOpen, bg: '#2A1F4D', accent: '#9A6BF5', motif: 'shapes' };

function Motif({ motif, accent, light }) {
  const line = light ? '#C2A5FB' : '#4B3A7A';
  if (motif === 'code')
    return (
      <g>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i} transform={`translate(${24 + (i % 2) * 14} ${28 + i * 18})`}>
            <rect width={30 + ((i * 37) % 70)} height="6" rx="3" fill={i % 3 === 0 ? accent : line} opacity={i % 3 === 0 ? 0.9 : 0.8} />
            <rect x={36 + ((i * 37) % 70)} width={20 + ((i * 13) % 40)} height="6" rx="3" fill={line} opacity="0.6" />
          </g>
        ))}
      </g>
    );
  if (motif === 'chart')
    return (
      <g>
        <path d="M20 140 L70 110 L110 122 L160 76 L210 92 L260 48 L300 64" stroke={accent} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {[40, 90, 140, 190, 240].map((x, i) => (
          <rect key={x} x={x} y={150 - (30 + ((i * 29) % 60))} width="20" height={30 + ((i * 29) % 60)} rx="4" fill={line} opacity="0.7" />
        ))}
      </g>
    );
  return (
    <g>
      <circle cx="70" cy="70" r="34" fill={accent} opacity="0.85" />
      <rect x="130" y="40" width="70" height="70" rx="14" fill={line} />
      <path d="M240 120 l40 -70 l40 70Z" fill={accent} opacity="0.5" />
      <rect x="40" y="128" width="200" height="10" rx="5" fill={line} opacity="0.8" />
    </g>
  );
}

export function CourseThumbnail({ src, title, category, className = '', rounded = 'rounded-t-[var(--radius-card)]' }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={`aspect-[16/10] w-full object-cover ${rounded} ${className}`} />;
  }
  const t = THEMES[category] || DEFAULT;
  const Icon = t.icon;
  return (
    <div className={`relative aspect-[16/10] w-full overflow-hidden ${rounded} ${className}`} style={{ background: t.bg }} role="img" aria-label={`${title} course cover`}>
      <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
        <Motif motif={t.motif} accent={t.accent} light={t.light} />
      </svg>
      <span className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-xl bg-white/95 text-primary shadow-sm">
        <Icon className="size-5" aria-hidden="true" />
      </span>
    </div>
  );
}
