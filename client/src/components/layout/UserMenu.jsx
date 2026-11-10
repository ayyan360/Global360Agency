import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, UserRound, Bell } from 'lucide-react';
import { useAuth, homePathFor } from '../../context/AuthContext.jsx';
import { Avatar } from '../common/ui.jsx';
import { titleCase } from '../../utils/format.js';

export function UserMenu({ compact = false }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const profilePath = user.role === 'student' ? '/student/profile' : '/account/profile';

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-primary-light">
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
        {!compact && (
          <span className="hidden text-left sm:block">
            <span className="block max-w-[140px] truncate text-sm font-semibold leading-4 text-ink">{user.name}</span>
            <span className="block text-[11px] text-muted">{titleCase(user.role)}</span>
          </span>
        )}
        <ChevronDown className="size-4 text-muted" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-50 mt-2 w-56 animate-fade-in p-1.5 shadow-[var(--shadow-pop)]">
          <div className="border-b border-line px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          {[
            { to: homePathFor(user), label: 'Dashboard', icon: LayoutDashboard },
            { to: '/notifications', label: 'Notifications', icon: Bell },
            { to: profilePath, label: 'Profile', icon: UserRound },
          ].map((i) => (
            <Link key={i.label} role="menuitem" to={i.to} onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-primary-light hover:text-primary">
              <i.icon className="size-4" aria-hidden="true" /> {i.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate('/');
            }}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-light"
          >
            <LogOut className="size-4" aria-hidden="true" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
