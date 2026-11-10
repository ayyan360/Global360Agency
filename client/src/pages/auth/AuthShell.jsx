import { Link, NavLink } from 'react-router-dom';
import { Logo } from '../../components/common/Logo.jsx';
import { SeatedLearnerIllustration } from '../../components/common/Illustrations.jsx';

/** Split-screen auth layout: pale-violet illustration panel + white form panel. */
export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary-50 p-10 lg:flex">
        <Logo />
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            {title}
          </h2>
          <p className="mt-3 max-w-sm text-muted">{subtitle}</p>
          <SeatedLearnerIllustration className="mt-6 w-full max-w-[380px]" />
        </div>
        <p className="text-xs text-muted">© {new Date().getFullYear()} Global360</p>
      </aside>
      <main id="main" className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-10">
          <div className="mb-8 grid grid-cols-2 border-b border-line text-center text-sm font-semibold">
            <NavLink to="/login" className={({ isActive }) => `-mb-px border-b-2 pb-3 ${isActive ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}>
              Login
            </NavLink>
            <NavLink to="/register" className={({ isActive }) => `-mb-px border-b-2 pb-3 ${isActive ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}>
              Register
            </NavLink>
          </div>
          {children}
          <p className="mt-8 text-center text-xs text-muted">
            <Link to="/" className="hover:text-primary">← Back to Global360</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
