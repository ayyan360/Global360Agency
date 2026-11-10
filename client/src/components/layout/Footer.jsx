import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { Logo } from '../common/Logo.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';

// Text glyphs (brand icon sets are intentionally not bundled). Only links an admin configured are shown.
const SOCIAL = [
  ['facebook', 'f', 'Facebook'],
  ['linkedin', 'in', 'LinkedIn'],
  ['x', 'X', 'X'],
  ['youtube', 'YT', 'YouTube'],
  ['instagram', 'IG', 'Instagram'],
  ['github', 'GH', 'GitHub'],
];

const COLUMNS = [
  { title: 'Quick Links', links: [['/', 'Home'], ['/courses', 'Courses'], ['/internship', 'Internship'], ['/about', 'About'], ['/contact', 'Contact']] },
  { title: 'Courses', links: [['/courses?category=Web+Development', 'Web Development'], ['/courses?category=Data+Science', 'Data Science'], ['/courses?category=Design', 'Design'], ['/courses?category=Marketing', 'Marketing'], ['/courses', 'All courses']] },
  { title: 'Internship', links: [['/internship', 'Free Internship'], ['/internship#how-it-works', 'How it works'], ['/internship#tracks', 'Tracks'], ['/verify-certificate', 'Verify a certificate']] },
  { title: 'Support', links: [['/contact', 'Help & Contact'], ['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service']] },
];

export function Footer() {
  const { settings } = useSettings();
  const social = SOCIAL.filter(([key]) => settings?.social?.[key]);
  const contact = settings?.contact || {};
  return (
    <footer className="border-t border-line bg-white">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-6 text-muted">{settings?.site?.tagline || 'Learn practical skills, gain real experience and grow your career.'}</p>
          {(contact.email || contact.phone) && (
            <ul className="mt-4 space-y-1.5 text-sm text-muted">
              {contact.email && (
                <li className="flex items-center gap-2">
                  <Mail className="size-4 text-primary" aria-hidden="true" />
                  <a href={`mailto:${contact.email}`} className="hover:text-primary">{contact.email}</a>
                </li>
              )}
              {contact.phone && (
                <li className="flex items-center gap-2">
                  <Phone className="size-4 text-primary" aria-hidden="true" />
                  {contact.phone}
                </li>
              )}
            </ul>
          )}
          {social.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-ink">Follow Us</p>
              <div className="flex gap-2">
                {social.map(([key, glyph, label]) => (
                  <a key={key} href={settings.social[key]} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid size-9 place-items-center rounded-lg bg-primary-light text-xs font-bold text-primary hover:bg-primary hover:text-white">
                    <span aria-hidden="true">{glyph}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-sm font-semibold text-ink">{col.title}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map(([to, label]) => (
                <li key={label}>
                  <Link to={to} className="text-sm text-muted hover:text-primary">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-muted">
          <p>© {new Date().getFullYear()} Global360. All rights reserved.</p>
          <p>Learn • Grow • Succeed</p>
        </div>
      </div>
    </footer>
  );
}
