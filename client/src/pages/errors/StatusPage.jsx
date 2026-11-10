import { ButtonLink } from '../../components/common/ui.jsx';
import { useDocumentTitle } from '../../hooks/useCommon.js';

export function StatusPage({ code, title, message, primary = { to: '/', label: 'Back to home' }, secondary }) {
  useDocumentTitle(title);
  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-16">
      <div className="max-w-lg text-center">
        <p className="text-6xl font-extrabold tracking-tight text-primary/90 sm:text-7xl">{code}</p>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-3 text-muted">{message}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to={primary.to}>{primary.label}</ButtonLink>
          {secondary && (
            <ButtonLink to={secondary.to} variant="outline">
              {secondary.label}
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  );
}
