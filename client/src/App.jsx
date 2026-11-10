import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import { RequireAuth, GuestOnly } from './routes/guards.jsx';
import { PageLoader } from './components/common/ui.jsx';
import { ErrorBoundary } from './pages/errors/ErrorBoundary.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { AssistantWidget } from './components/assistant/AssistantWidget.jsx';

// Public
const Home = lazy(() => import('./pages/public/HomePage.jsx'));
const Courses = lazy(() => import('./pages/public/CoursesPage.jsx'));
const CourseDetail = lazy(() => import('./pages/public/CourseDetailPage.jsx'));
const About = lazy(() => import('./pages/public/AboutPage.jsx'));
const Contact = lazy(() => import('./pages/public/ContactPage.jsx'));
const Policy = lazy(() => import('./pages/public/PolicyPage.jsx'));
const VerifyCertificate = lazy(() => import('./pages/public/VerifyCertificatePage.jsx'));
const InternshipLanding = lazy(() => import('./pages/internship/InternshipLandingPage.jsx'));
const InternshipDetail = lazy(() => import('./pages/internship/InternshipDetailPage.jsx'));
const InternshipApply = lazy(() => import('./pages/internship/InternshipApplyPage.jsx'));
// Auth
const Login = lazy(() => import('./pages/auth/LoginPage.jsx'));
const Register = lazy(() => import('./pages/auth/RegisterPage.jsx'));
// Errors
const NotFound = lazy(() => import('./pages/errors/NotFoundPage.jsx'));
const Unauthorized = lazy(() => import('./pages/errors/UnauthorizedPage.jsx'));
const AccessDenied = lazy(() => import('./pages/errors/AccessDeniedPage.jsx'));
// Learner
const LessonPlayer = lazy(() => import('./pages/student/LessonPlayerPage.jsx'));
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboardPage.jsx'));
const MyCourses = lazy(() => import('./pages/student/MyCoursesPage.jsx'));
const LearningProgress = lazy(() => import('./pages/student/LearningProgressPage.jsx'));
const Profile = lazy(() => import('./pages/student/ProfilePage.jsx'));
const Notifications = lazy(() => import('./pages/student/NotificationsPage.jsx'));
const InternshipDashboard = lazy(() => import('./pages/student/InternshipDashboardPage.jsx'));
const InternshipTasks = lazy(() => import('./pages/student/InternshipTasksPage.jsx'));
const InternshipTaskDetail = lazy(() => import('./pages/student/InternshipTaskDetailPage.jsx'));
const InternshipProgress = lazy(() => import('./pages/student/InternshipProgressPage.jsx'));
const InternshipCertificate = lazy(() => import('./pages/student/InternshipCertificatePage.jsx'));
// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboardPage.jsx'));
const AdminCourses = lazy(() => import('./pages/admin/AdminCoursesPage.jsx'));
const AdminCourseEditor = lazy(() => import('./pages/admin/AdminCourseEditorPage.jsx'));
const AdminModules = lazy(() => import('./pages/admin/AdminModulesPage.jsx'));
const AdminLessons = lazy(() => import('./pages/admin/AdminLessonsPage.jsx'));
const AdminStudents = lazy(() => import('./pages/admin/AdminStudentsPage.jsx'));
const AdminStudentDetail = lazy(() => import('./pages/admin/AdminStudentDetailPage.jsx'));
const AdminEnrollments = lazy(() => import('./pages/admin/AdminEnrollmentsPage.jsx'));
const AdminPrograms = lazy(() => import('./pages/admin/AdminProgramsPage.jsx'));
const AdminProgramEditor = lazy(() => import('./pages/admin/AdminProgramEditorPage.jsx'));
const AdminApplications = lazy(() => import('./pages/admin/AdminApplicationsPage.jsx'));
const AdminApplicationDetail = lazy(() => import('./pages/admin/AdminApplicationDetailPage.jsx'));
const AdminParticipants = lazy(() => import('./pages/admin/AdminParticipantsPage.jsx'));
const AdminParticipantDetail = lazy(() => import('./pages/admin/AdminParticipantDetailPage.jsx'));
const AdminTasks = lazy(() => import('./pages/admin/AdminTasksPage.jsx'));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviewsPage.jsx'));
const AdminReviewDetail = lazy(() => import('./pages/admin/AdminReviewDetailPage.jsx'));
const AdminCertificates = lazy(() => import('./pages/admin/AdminCertificatesPage.jsx'));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessagesPage.jsx'));
const AdminReports = lazy(() => import('./pages/admin/AdminReportsPage.jsx'));
const AdminAuditLog = lazy(() => import('./pages/admin/AdminAuditLogPage.jsx'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettingsPage.jsx'));

const ADMIN_AREA = ['courses:manage', 'courses:manage-own', 'submissions:review-assigned'];

/** Shared pages (notifications) render inside the dashboard shell that matches the user's role. */
function RoleShell() {
  const { user } = useAuth();
  return <DashboardLayout area={user?.role === 'student' ? 'student' : 'admin'} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="courses" element={<Courses />} />
            <Route path="courses/:slug" element={<CourseDetail />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="privacy" element={<Policy kind="privacy" />} />
            <Route path="terms" element={<Policy kind="terms" />} />
            <Route path="internship" element={<InternshipLanding />} />
            <Route path="internship/apply/:slug" element={<InternshipApply />} />
            <Route path="internship/:slug" element={<InternshipDetail />} />
            <Route path="verify-certificate" element={<VerifyCertificate />} />
            <Route path="verify-certificate/:certificateId" element={<VerifyCertificate />} />
            <Route path="unauthorized" element={<Unauthorized />} />
            <Route path="access-denied" element={<AccessDenied />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route element={<GuestOnly />}>
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
          </Route>

          <Route path="learn/:courseSlug/:lessonId" element={<LessonPlayer />} />

          <Route element={<RequireAuth />}>
            <Route path="student" element={<DashboardLayout area="student" />}>
              <Route index element={<StudentDashboard />} />
              <Route path="courses" element={<MyCourses />} />
              <Route path="progress" element={<LearningProgress />} />
              <Route path="profile" element={<Profile />} />
              <Route path="internship" element={<InternshipDashboard />} />
              <Route path="internship/tasks" element={<InternshipTasks />} />
              <Route path="internship/tasks/:taskId" element={<InternshipTaskDetail />} />
              <Route path="internship/progress" element={<InternshipProgress />} />
              <Route path="certificates" element={<InternshipCertificate />} />
              <Route path="internship/certificate" element={<InternshipCertificate />} />
            </Route>
            <Route element={<RoleShell />}>
              <Route path="notifications" element={<Notifications />} />
              <Route path="account/profile" element={<Profile />} />
            </Route>
          </Route>

          <Route element={<RequireAuth permissions={ADMIN_AREA} />}>
            <Route path="admin" element={<DashboardLayout area="admin" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="courses" element={<AdminCourses />} />
              <Route path="courses/new" element={<AdminCourseEditor />} />
              <Route path="courses/:id" element={<AdminCourseEditor />} />
              <Route path="modules" element={<AdminModules />} />
              <Route path="lessons" element={<AdminLessons />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="students/:id" element={<AdminStudentDetail />} />
              <Route path="enrollments" element={<AdminEnrollments />} />
              <Route path="internships" element={<AdminPrograms />} />
              <Route path="internships/new" element={<AdminProgramEditor />} />
              <Route path="internships/:id" element={<AdminProgramEditor />} />
              <Route path="internship-applications" element={<AdminApplications />} />
              <Route path="internship-applications/:id" element={<AdminApplicationDetail />} />
              <Route path="internship-participants" element={<AdminParticipants />} />
              <Route path="internship-participants/:id" element={<AdminParticipantDetail />} />
              <Route path="internship-tasks" element={<AdminTasks />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="reviews/:id" element={<AdminReviewDetail />} />
              <Route path="certificates" element={<AdminCertificates />} />
              <Route path="messages" element={<AdminMessages />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="audit-log" element={<AdminAuditLog />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <AssistantWidget />
    </ErrorBoundary>
  );
}
