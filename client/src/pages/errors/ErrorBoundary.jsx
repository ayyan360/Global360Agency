import { Component } from 'react';
import { RefreshCw } from 'lucide-react';
import { LogoMark } from '../../components/common/Logo.jsx';

/** General error fallback for unexpected rendering errors (also catches failed lazy chunk loads). */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Global360 UI error', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-page px-4">
        <div className="card max-w-md p-8 text-center">
          <LogoMark className="mx-auto mb-5 size-12" />
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">An unexpected error occurred while displaying this page. Please reload — if the problem continues, contact support.</p>
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">
              <RefreshCw className="size-4" /> Reload page
            </button>
            <a href="/" className="inline-flex h-10 items-center rounded-[10px] border border-line px-4 text-sm font-semibold text-ink hover:bg-primary-50">
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
