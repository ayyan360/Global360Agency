import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';
import { Logo } from '../common/Logo.jsx';
import { ButtonLink } from '../common/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { NotificationBell } from './NotificationBell.jsx';
import { UserMenu } from './UserMenu.jsx';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/courses', label: 'Courses' },
  { to: '/internship', label: 'Internship' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

function SearchBox({ className = '', onDone }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        navigate(q.trim() ? `/courses?search=${encodeURIComponent(q.trim())}` : '/courses');
        onDone?.();
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <label htmlFor="nav-search" className="sr-only">
        Search courses
      </label>
      <input id="nav-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" className="h-10 w-full rounded-xl border border-line bg-page/70 pl-9 pr-3 text-sm placeholder:text-muted/70 focus:border-primary focus:bg-white focus:outline-none focus:ring-3 focus:ring-primary/15" />
    </form>
  );
}

export function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const linkCls = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-primary' : 'text-ink/80 hover:text-primary'}`;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center gap-4 lg:h-[72px]">
        <Logo />
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto hidden w-full max-w-[240px] md:block xl:max-w-xs">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {user ? (
            <>
              <NotificationBell />
              <UserMenu compact />
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:text-primary">
                Login
              </Link>
              <ButtonLink to="/register" size="sm" className="h-9 px-4">
                Sign Up
              </ButtonLink>
            </div>
          )}
          <button type="button" className="grid size-10 place-items-center rounded-xl text-ink hover:bg-primary-light lg:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-nav" className="border-t border-line bg-white lg:hidden">
          <div className="container-page space-y-3 py-4">
            <SearchBox onDone={() => setOpen(false)} />
            <nav aria-label="Mobile" className="grid gap-1">
              {LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-primary-light text-primary' : 'text-ink hover:bg-primary-50'}`}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
            {!user && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <ButtonLink to="/login" variant="outline">
                  Login
                </ButtonLink>
                <ButtonLink to="/register">Sign Up</ButtonLink>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
