import { StatusPage } from './StatusPage.jsx';

export default function UnauthorizedPage() {
  return <StatusPage code="401" title="Please log in" message="You need to be signed in to view this page." primary={{ to: '/login', label: 'Log in' }} secondary={{ to: '/register', label: 'Create an account' }} />;
}
