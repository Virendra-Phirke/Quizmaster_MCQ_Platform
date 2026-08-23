import { lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { TestProvider } from './contexts/TestContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { ToastProvider } from './components/ui/Toast';
import LoadingSpinner from './components/shared/LoadingSpinner';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { canonicalizeRole } from './lib/roleUtils';

// Lazy load pages for better code splitting
// Common pages
const LandingPage = lazy(() => import('./pages/common/LandingPage'));
const AllReviewsPage = lazy(() => import('./pages/common/AllReviewsPage'));
const UserProfilePage = lazy(() => import('./pages/common/UserProfilePage'));

// Auth pages
const AuthPage = lazy(() => import('./pages/auth/AuthPage'));

// Teacher pages
const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard'));
const TestCreation = lazy(() => import('./pages/teacher/TestCreation'));
const EditTest = lazy(() => import('./pages/teacher/EditTest'));
const AnalyticsPage = lazy(() => import('./pages/teacher/AnalyticsPage'));
const ManageStudentsPage = lazy(() => import('./pages/teacher/ManageStudentsPage'));
const QuestionBankPage = lazy(() => import('./pages/teacher/QuestionBankPage'));
const TestDetailPage = lazy(() => import('./pages/teacher/TestDetailPage'));
const AllTestsViewPage = lazy(() => import('./pages/teacher/AllTestsViewPage'));

// Student pages
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const StudentPerformance = lazy(() => import('./pages/student/StudentPerformance'));
const AllTestsPage = lazy(() => import('./pages/student/AllTestsPage'));
const TakeTest = lazy(() => import('./pages/student/TakeTest'));
const TestInstructions = lazy(() => import('./pages/student/TestInstructions'));
const TestResults = lazy(() => import('./pages/student/TestResults'));

// Shared components
const RoleSetup = lazy(() => import('./components/shared/RoleSetup'));

// Optimized QueryClient with aggressive caching to reduce API calls
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes (increased from 5 for better caching)
      gcTime: 30 * 60 * 1000, // 30 minutes (increased from 10 for longer retention)
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always', // Only refetch if data is stale
    },
  },
});

// Protected Route wrapper that saves the current location for post-login redirect
function ProtectedTestRoute() {
  const { user } = useUser();
  const location = useLocation();
  const userRole = canonicalizeRole(user?.unsafeMetadata?.role as string | undefined);

  if (!user) {
    // User is not authenticated - store test link and redirect to signin
    const testPath = location.pathname + (location.search || '') + (location.hash || '');
    try {
      localStorage.setItem('pendingTestLink', testPath);
    } catch (error) {
      // Ignore storage errors
    }
    return <Navigate to="/auth/signin" replace />;
  }

  if (userRole === 'teacher') {
    // Route is /test/:testId/take → split gives ['','test',testId,'take'] → index [2] is testId
    const testId = location.pathname.split('/')[2];
    return <Navigate to={`/teacher/test/${testId}`} replace />;
  }

  // If user has no role yet, let TakeTest handle it — it auto-assigns 'student'
  // instantly without showing a role picker. Only redirect away for non-test roles.

  // PREFETCH OPTIMIZATION
  // On render of this routing wrapper, attempt to start pre-fetching the test 
  // in parallel with downloading the lazy-loaded <TakeTest /> javascript chunks.
  // Route is /test/:testId/take → split gives ['','test',testId,'take'] → index [2] is testId
  const testId = location.pathname.split('/')[2];
  if (testId && user.id) {
    import('./lib/supabase').then(({ supabase }) => {
      // Pre-warm the cache for this single test to improve LCP
      supabase
        .from('tests')
        .select('id, title, description, duration, time_per_question, negative_marking_enabled, negative_marks, default_marks, created_by, start_date, end_date, is_active')
        .eq('id', testId)
        .single()
        .then(({ data }) => {
          if (data) {
            queryClient.setQueryData(['test', testId, user.id], {
              id: data.id,
              title: data.title,
              description: data.description,
              duration: data.duration,
              timePerQuestion: data.time_per_question,
              negativeMarkingEnabled: data.negative_marking_enabled,
              createdBy: data.created_by,
              startDate: data.start_date,
              endDate: data.end_date,
              isPublic: data.is_active,
              defaultMarks: data.default_marks,
              negativeMarks: data.negative_marks,
              questions: []
            });
          }
        });
    }).catch(console.error);
  }

  return <TakeTest />;
}

// Protected Route for Test Instructions
function ProtectedTestInstructionsRoute() {
  const { user } = useUser();
  const location = useLocation();
  const userRole = canonicalizeRole(user?.unsafeMetadata?.role as string | undefined);

  if (!user) {
    const testPath = location.pathname + (location.search || '') + (location.hash || '');
    try {
      localStorage.setItem('pendingTestLink', testPath);
    } catch (error) {
      console.error('❌ Error storing test link:', error);
    }
    return <Navigate to="/auth/signin" replace />;
  }

  if (userRole === 'teacher') {
    const testId = location.pathname.split('/').pop() || location.pathname.split('/')[2];
    return <Navigate to={`/teacher/test/${testId}`} replace />;
  }

  // If user has no role or is a student, show test instructions
  // Role-less users will get auto-assigned 'student' when they proceed to take the test
  return <TestInstructions />;
}

// Protected Route for Student Dashboard
function ProtectedStudentRoute() {
  const { user } = useUser();
  const userRole = canonicalizeRole(user?.unsafeMetadata?.role as string | undefined);

  if (!user) {
    // Do NOT overwrite pendingTestLink here — it may already hold a test path.
    // Unauthenticated users visiting /student should just go to sign-in.
    return <Navigate to="/auth/signin" replace />;
  }

  if (userRole === 'student') {
    return <StudentDashboard />;
  }

  return <Navigate to="/setup-role" replace />;
}

function AppRoutes() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  // Get user role from Clerk user metadata (normalized)
  const userRole = canonicalizeRole(user?.unsafeMetadata?.role as string | undefined);

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* User profile */}
        <Route path="/user" element={user ? <UserProfilePage /> : <Navigate to="/auth/signin" />} />

        {/* All Reviews Page - Public */}
        <Route path="/reviews" element={<AllReviewsPage />} />

        {/* Legacy /login still supported - render auth page (signin) */}
        <Route path="/login" element={<AuthPage defaultMode="signin" />} />

        {/* New canonical auth routes */}
        <Route path="/auth" element={<Navigate to="/auth/signin" replace />} />
        <Route path="/auth/:mode" element={<AuthPage />} />

        {/* Add a route for role setup */}
        <Route
          path="/setup-role"
          element={
            user ? <RoleSetup /> : <Navigate to="/auth/signin" />
          }
        />

        <Route
          path="/teacher"
          element={
            user ? (
              userRole === 'teacher' ? <TeacherDashboard /> : <Navigate to="/setup-role" />
            ) : (
              <Navigate to="/auth/signin" />
            )
          }
        />
        <Route
          path="/teacher/dashboard"
          element={
            user ? (
              userRole === 'teacher' ? <TeacherDashboard /> : <Navigate to="/setup-role" />
            ) : (
              <Navigate to="/auth/signin" />
            )
          }
        />
        <Route
          path="/teacher/create-test"
          element={
            user ? (
              userRole === 'teacher' ? <TestCreation /> : <Navigate to="/setup-role" />
            ) : (
              <Navigate to="/auth/signin" />
            )
          }
        />
        <Route
          path="/teacher/edit-test/:testId"
          element={
            user ? (
              userRole === 'teacher' ? <EditTest /> : <Navigate to="/setup-role" />
            ) : (
              <Navigate to="/auth/signin" />
            )
          }
        />
        <Route
          path="/teacher/analytics"
          element={
            user ? (
              userRole === 'teacher' ? <AnalyticsPage /> : <Navigate to="/setup-role" />
            ) : (
              <Navigate to="/auth/signin" />
            )
          }
        />
        <Route
          path="/teacher/students"
          element={
            user ? (
              userRole === 'teacher' ? <ManageStudentsPage /> : <Navigate to="/setup-role" />
            ) : (
              <Navigate to="/auth/signin" />
            )
          }
        />
        <Route
          path="/teacher/question-bank"
          element={
            user ? (
              userRole === 'teacher' ? <QuestionBankPage /> : <Navigate to="/setup-role" />
            ) : (
              <Navigate to="/auth/signin" />
            )
          }
        />
        <Route
          path="/teacher/all-tests"
          element={
            user ? (
              userRole === 'teacher' ? <AllTestsViewPage /> : <Navigate to="/setup-role" />
            ) : (
              <Navigate to="/auth/signin" />
            )
          }
        />
        <Route
          path="/teacher/test/:testId"
          element={
            user ? (
              userRole === 'teacher' ? <TestDetailPage /> : <Navigate to="/setup-role" />
            ) : (
              <Navigate to="/auth/signin" />
            )
          }
        />
        <Route
          path="/student"
          element={<ProtectedStudentRoute />}
        />
        <Route
          path="/student/dashboard"
          element={<ProtectedStudentRoute />}
        />
        <Route
          path="/student/performance"
          element={
            user ? (
              userRole === 'student' ? <StudentPerformance /> : <Navigate to="/setup-role" />
            ) : (
              <Navigate to="/auth/signin" />
            )
          }
        />
        <Route
          path="/student/all-tests"
          element={
            user ? (
              userRole === 'student' ? <AllTestsPage /> : <Navigate to="/setup-role" />
            ) : (
              <Navigate to="/auth/signin" />
            )
          }
        />
        <Route
          path="/test/:testId"
          element={<ProtectedTestInstructionsRoute />}
        />
        <Route
          path="/test/:testId/take"
          element={<ProtectedTestRoute />}
        />
        <Route
          path="/results/:testId"
          element={
            user ? <TestResults /> : <Navigate to="/auth/signin" />
          }
        />

        {/* Landing Page */}
        <Route
          path="/"
          element={<LandingPage />}
        />

        {/* Dashboard Routes */}
        <Route
          path="/dashboard"
          element={
            user ? (
              userRole === 'teacher' ? <Navigate to="/teacher" /> :
                userRole === 'student' ? <Navigate to="/student" /> :
                  <Navigate to="/setup-role" />
            ) : (
              <Navigate to="/auth/signin" />
            )
          }
        />

        {/* Catch-all route */}
        <Route
          path="*"
          element={<Navigate to="/" />}
        />
      </Routes>
    </Suspense>
  );
}



function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <TestProvider>
              <LoadingProvider>
                <SidebarProvider>
                  <ToastProvider>
                    <div className="min-h-screen bg-[#0f0f12] text-gray-100 transition-colors duration-300 selection:bg-pink-500/80 selection:text-white">
                      <AppRoutes />
                    </div>
                  </ToastProvider>
                </SidebarProvider>
              </LoadingProvider>
            </TestProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
