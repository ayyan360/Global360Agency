import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X, Globe } from 'lucide-react';
import { Logo } from '../components/common/Logo.jsx';
import { Avatar } from '../components/common/ui.jsx';
import { NotificationBell } from '../components/layout/NotificationBell.jsx';
import { UserMenu } from '../components/layout/UserMenu.jsx';
import { ScrollToTop } from '../components/layout/ScrollToTop.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { STUDENT_NAV, ADMIN_NAV } from '../constants/navigation.js';
import { titleCase } from '../utils/format.js';

function filterNav(items, can) {
  const visible = items.filter((i) => !i.perms || i.perms.some((p) => can(p)));
  // Drop section headers that have no visible items after them.
  return visible.filter((item, idx) => !item.section || (visible[idx + 1] && !visible[idx + 1].section));
}

function Sidebar({ items, onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5 lg:h-[72px]">
        <Logo size="sm" />
      </div>
      <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-primary-50 p-3">
        <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
          <p className="text-[11px] text-muted">{titleCase(user?.role)}</p>
        </div>
      </div>
      <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
        <ul className="space-y-0.5">
          {items.map((item, i) =>
            item.section ? (
              <li key={`s-${i}`} className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted/80">
                {item.section}
              </li>
            ) : (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-primary-light text-primary' : 'text-ink/75 hover:bg-primary-50 hover:text-ink'}`
                  }
                >
                  <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            )
          )}
        </ul>
      </nav>
      <div className="space-y-0.5 border-t border-line p-3">
        <NavLink to="/" className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-ink/75 hover:bg-primary-50">
          <Globe className="size-[18px]" aria-hidden="true" /> Back to website
        </NavLink>
        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate('/');
          }}
          className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-ink/75 hover:bg-danger-light hover:text-danger"
        >
          <LogOut className="size-[18px]" aria-hidden="true" /> Logout
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ area = 'student' }) {
  const { can } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);
  const items = filterNav(area === 'admin' ? ADMIN_NAV : STUDENT_NAV, can);

  return (
    <div className="min-h-dvh bg-page">
      <ScrollToTop />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-white lg:block">
        <Sidebar items={items} />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-fade-in bg-white shadow-[var(--shadow-pop)]">
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 text-muted hover:bg-primary-light" aria-label="Close navigation">
              <X className="size-5" />
            </button>
            <Sidebar items={items} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6 lg:h-[72px]">
          <button type="button" className="grid size-10 place-items-center rounded-xl text-ink hover:bg-primary-light lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
