import { StatusPage } from './StatusPage.jsx';

export default function AccessDeniedPage() {
  return <StatusPage code="403" title="Access denied" message="Your account doesn't have permission to view this page. If you think this is a mistake, contact an administrator." secondary={{ to: '/contact', label: 'Contact support' }} />;
}
