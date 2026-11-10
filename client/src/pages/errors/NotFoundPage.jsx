import { StatusPage } from './StatusPage.jsx';

export default function NotFoundPage() {
  return <StatusPage code="404" title="Page not found" message="The page you're looking for doesn't exist or may have moved." secondary={{ to: '/courses', label: 'Browse courses' }} />;
}
