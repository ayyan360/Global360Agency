import { useDocumentTitle } from '../../hooks/useCommon.js';
import { CourseContentPicker } from './AdminModulesPage.jsx';

export default function AdminLessonsPage() {
  useDocumentTitle('Lessons');
  return <CourseContentPicker title="Lessons" description="Manage lessons: titles, video links, durations, preview access and order." />;
}
