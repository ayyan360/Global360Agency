import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar.jsx';
import { Footer } from '../components/layout/Footer.jsx';
import { ScrollToTop } from '../components/layout/ScrollToTop.jsx';

export default function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <ScrollToTop />
      <Navbar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
