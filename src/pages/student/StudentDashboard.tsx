import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useUser, UserButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import { useTest } from '../../hooks/useTest';
import { LegacyTest, LegacyTestResult } from '../../contexts/TestContext';
import { Link } from 'react-router-dom';
import { STUDENT_NAV_ITEMS } from '../../components/layouts/StudentLayout';
import {
  BookOpen, CheckCircle, Search,
  ChevronRight, Star, Trophy,
  Zap, BarChart3, Menu, Home, X,
} from 'lucide-react';
import { getCachedUUIDFromClerkId } from '../../lib/clerkUtils';
import { Skeleton, CardSkeleton } from '../../components/shared/Skeleton';
import { useTestsQuery, useResultsQuery } from '../../hooks/quizQueries';
import { LightswindPagination } from '../../components/shared/LightswindPagination';
import { SGL, SGLToggle } from '../../components/student/SGL';

// ─── Sidebar Nav Items ── (imported from StudentLayout to keep a single source of truth)

// ─── Sidebar Component ───────────────────────────────────────────────────────
function Sidebar({
  collapsed,
  onCollapse,
  mobileOpen,
  onMobileClose,
  activeNav,
  user,
}: {
  collapsed: boolean;
  onCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  activeNav: string;
  user: any;
}) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen z-50 flex flex-col
          bg-gray-950 border-r border-gray-800/60
          transition-[width,transform] duration-300 ease-in-out
          ${collapsed ? 'w-[72px]' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.4)' }}
      >
        {/* Header: Logo (desktop: click to collapse/expand) + Mobile X */}
        <div className={`flex items-center h-14 px-3 border-b border-gray-800/60 flex-shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed ? (
            <>
              {/* Desktop: clickable logo */}
              <button
                onClick={onCollapse}
                className="hidden lg:flex items-center gap-2 min-w-0 group"
                title="Collapse sidebar"
              >
                <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0 bg-white shadow-lg group-hover:ring-2 group-hover:ring-amber-500/30 transition-shadow">
                  <img src="/favicon.svg" alt="QuizMaster" className="w-full h-full object-contain" loading="lazy" decoding="async" />
                </div>
                <span className="text-sm font-black bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent truncate">
                  QuizMaster
                </span>
              </button>
              {/* Mobile: static logo */}
              <div className="lg:hidden flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0 bg-white shadow-lg">
                  <img src="/favicon.svg" alt="QuizMaster" className="w-full h-full object-contain" loading="lazy" decoding="async" />
                </div>
                <span className="text-sm font-black bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent truncate">
                  QuizMaster
                </span>
              </div>
            </>
          ) : (
            /* Desktop collapsed: icon button to expand */
            <button
              onClick={onCollapse}
              className="hidden lg:flex w-8 h-8 rounded-md overflow-hidden flex-shrink-0 bg-white shadow-lg hover:ring-2 hover:ring-amber-500/30 transition-shadow"
              title="Expand sidebar"
            >
              <img src="/favicon.svg" alt="QuizMaster" className="w-full h-full object-contain" />
            </button>
          )}
          {/* Mobile close */}
          <button
            onClick={onMobileClose}
            className="lg:hidden flex w-7 h-7 items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-gray-800/60 transition-colors flex-shrink-0"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Profile */}
        <div className={`flex items-center gap-3 px-3 py-3 border-b border-gray-800/40 flex-shrink-0 ${collapsed ? 'justify-center px-2' : ''}`}>
          <SignedIn>
            <div
              className="flex-shrink-0 rounded-full ring-2 ring-gray-700 hover:ring-amber-500/50 transition-all overflow-hidden"
              style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}
            >
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    userButtonAvatarBox: '!w-9 !h-9 !rounded-full',
                    userButtonTrigger: 'focus:shadow-none !p-0 !w-9 !h-9 !rounded-full !block',
                    userButtonBox: '!w-9 !h-9 !rounded-full',
                    avatarImage: '!rounded-full !w-9 !h-9',
                    avatarBox: '!rounded-full !w-9 !h-9',
                    userButtonOuterIdentifier: 'hidden',
                  },
                }}
              />
            </div>
          </SignedIn>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user?.fullName || user?.firstName || 'Student'}
              </p>
              <p className="text-[10px] text-gray-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!collapsed && (
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-2 pb-2">Main Menu</p>
          )}
          {STUDENT_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <Link
                key={item.id}
                to={item.to}
                onClick={onMobileClose}
                title={collapsed ? item.label : undefined}
                className={`
                  group relative flex items-center gap-3 rounded-xl transition-colors duration-200 touch-manipulation
                  ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}
                  ${isActive
                    ? 'bg-gray-800/80 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }
                `}
              >
                {/* Active left indicator */}
                {isActive && (
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-gradient-to-b ${item.color}`} />
                )}

                {/* Icon */}
                <div className={`
                  flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-200
                  ${isActive
                    ? `bg-gradient-to-br ${item.color} shadow-lg ${item.glow}`
                    : 'bg-gray-800/40 group-hover:bg-gray-700/60'
                  }
                `}>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                </div>

                {!collapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}

                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-gray-800 border border-gray-700/60 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: Home Button */}
        <div className="flex-shrink-0 p-2 border-t border-gray-800/60">
          <Link
            to="/"
            onClick={onMobileClose}
            title={collapsed ? 'Home' : undefined}
            className={`
              group relative flex items-center gap-3 rounded-xl transition-colors duration-200 touch-manipulation w-full
              text-gray-400 hover:text-white hover:bg-gray-800/50
              ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}
            `}
          >
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-200 bg-gray-800/40 group-hover:bg-gradient-to-br group-hover:from-slate-600 group-hover:to-slate-700">
              <Home className="w-4 h-4" />
            </div>
            {!collapsed && (
              <span className="text-sm font-medium">Home</span>
            )}
            {collapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-gray-800 border border-gray-700/60 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl z-50">
                Home
              </div>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}

// ─── Main StudentDashboard ───────────────────────────────────────────────────
function StudentDashboard() {
  const { user } = useUser();
  const { tests: legacyTests, results: legacyResults } = useTest();
  const testsQuery = useTestsQuery();
  const resultsQuery = useResultsQuery((Array.isArray(testsQuery.data) ? testsQuery.data : legacyTests) || []);
  const loading = testsQuery.isLoading || resultsQuery.isLoading;

  const [userUUID, setUserUUID] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'completed'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [resultsPage, setResultsPage] = useState(1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('studentSidebarCollapsed') === 'true'; } catch { return false; }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024
  );
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('preferredViewMode');
    if (saved) return saved as 'grid' | 'list';
    return typeof window !== 'undefined' && window.innerWidth < 640 ? 'list' : 'grid';
  });

  const testsPerPage = 6;
  const resultsPerPage = 5;

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
      // Auto-collapse sidebar on smaller screens
      if (window.innerWidth < 1280 && window.innerWidth >= 1024) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    // Set initial state
    if (window.innerWidth < 1280 && window.innerWidth >= 1024) {
      setSidebarCollapsed(true);
    }
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('preferredViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const generateUserUUID = async () => {
      if (user?.id) {
        const uuid = await getCachedUUIDFromClerkId(user.id);
        setUserUUID(uuid);
      }
    };
    generateUserUUID();
  }, [user?.id]);

  const availableTests = useMemo(() =>
    legacyTests.filter((test: LegacyTest) => test.isPublic), [legacyTests]);

  const myResults = useMemo(() =>
    legacyResults.filter((result: LegacyTestResult) => result.studentId === userUUID),
    [legacyResults, userUUID]);

  const completedTestIds = useMemo(() =>
    myResults.map((result: LegacyTestResult) => result.testId), [myResults]);

  // Count tests per filter for badges (accounting for active status)
  const filterCounts = useMemo(() => {
    const now = new Date();
    const getActiveTests = (tests: LegacyTest[]) => tests.filter((test) => {
      const startDate = test.startDate ? new Date(test.startDate) : new Date(0);
      const endDate = test.endDate ? new Date(test.endDate) : new Date();
      return now >= startDate && now <= endDate;
    });

    const activeTests = getActiveTests(availableTests);
    return {
      all: availableTests.length,
      available: activeTests.filter((t: LegacyTest) => !completedTestIds.includes(t.id)).length,
      completed: completedTestIds.length, // Show count of ALL completed tests, not just public ones
    };
  }, [availableTests, completedTestIds]);

  const filteredTests = useMemo(() => {
    // For completed filter, show ALL completed tests regardless of public/private/active status
    const testsToFilter = filterMode === 'completed' ? legacyTests : availableTests;

    return testsToFilter.filter((test: LegacyTest) => {
      // Filter by mode
      if (filterMode === 'available' && completedTestIds.includes(test.id)) return false;
      if (filterMode === 'completed' && !completedTestIds.includes(test.id)) return false;

      // Only filter by active status if NOT showing all or completed tests
      if (filterMode !== 'all' && filterMode !== 'completed') {
        const now = new Date();
        const startDate = test.startDate ? new Date(test.startDate) : new Date(0);
        const endDate = test.endDate ? new Date(test.endDate) : new Date();
        const isTestActive = now >= startDate && now <= endDate;
        if (!isTestActive) return false;
      }

      // Filter by search
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return test.title.toLowerCase().includes(query) || test.description.toLowerCase().includes(query);
    });
  }, [availableTests, legacyTests, searchQuery, filterMode, completedTestIds]);

  const { totalPages, paginatedTests } = useMemo(() => {
    const totalPages = Math.ceil(filteredTests.length / testsPerPage);
    const startIndex = (currentPage - 1) * testsPerPage;
    const paginatedTests = filteredTests.slice(startIndex, startIndex + testsPerPage);
    return { totalPages, paginatedTests };
  }, [filteredTests, currentPage, testsPerPage]);

  const sortedAndPaginatedResults = useMemo(() =>
    myResults
      .slice()
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice((resultsPage - 1) * resultsPerPage, resultsPage * resultsPerPage),
    [myResults, resultsPage, resultsPerPage]);

  const calculateScore = useCallback((result: LegacyTestResult): number => {
    const test = legacyTests.find((t: LegacyTest) => t.id === result.testId);
    if (!test) return result.score;
    if (result.earnedMarks != null && result.totalMarks != null && result.totalMarks > 0) {
      return (result.earnedMarks / result.totalMarks) * 100;
    }
    const totalMarks = test.questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const earnedMarks = test.questions.reduce((sum, q, idx) =>
      sum + (result.answers[idx] === q.correctAnswer ? (q.marks || 1) : 0), 0);
    return totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0;
  }, [legacyTests]);

  const { avgScore, bestScore, testsCompleted } = useMemo(() => {
    if (myResults.length === 0) return { avgScore: 0, bestScore: 0, testsCompleted: 0 };
    const scores = myResults.map(r => calculateScore(r));
    return {
      avgScore: scores.reduce((s, v) => s + v, 0) / scores.length,
      bestScore: Math.max(...scores),
      testsCompleted: myResults.length,
    };
  }, [myResults, calculateScore]);

  const getScoreColor = useCallback((score: number): { color: string; bgColor: string; label: string } => {
    if (score >= 81) return { color: 'text-emerald-400', bgColor: 'bg-emerald-500/15', label: 'Excellent' };
    if (score >= 61) return { color: 'text-green-400', bgColor: 'bg-green-500/15', label: 'Good' };
    if (score >= 41) return { color: 'text-amber-400', bgColor: 'bg-amber-500/15', label: 'Average' };
    if (score >= 21) return { color: 'text-orange-400', bgColor: 'bg-orange-500/15', label: 'Below Average' };
    return { color: 'text-red-400', bgColor: 'bg-red-500/15', label: 'Poor' };
  }, []);

  const sidebarWidth = sidebarCollapsed ? 72 : 256;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.03),transparent_50%)] pointer-events-none" />

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed && isLargeScreen}
        onCollapse={() => {
          const next = !sidebarCollapsed;
          setSidebarCollapsed(next);
          try { localStorage.setItem('studentSidebarCollapsed', String(next)); } catch { /* ignore */ }
        }}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        activeNav="dashboard"
        user={user}
      />

      {/* Main Content */}
      <div
        className="relative flex-1 min-w-0 w-full transition-[margin] duration-300"
        style={{ marginLeft: isLargeScreen ? sidebarWidth : 0 }}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-slate-950 border-b border-slate-800/60 h-14 flex items-center px-3 sm:px-5 gap-3">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-[color,background-color,border-color,transform] active:scale-95"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Page title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-black bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 bg-clip-text text-transparent leading-none">
              Dashboard
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block">
              Welcome back, <span className="font-bold text-amber-400">{user?.firstName}</span>
            </p>
          </div>

          {/* Home link in header (mobile only) */}
          <Link
            to="/"
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors text-xs font-semibold border border-slate-700/50"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>

          {/* Auth */}
          <SignedOut>
            <Link
              to="/auth/signin"
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-900 rounded-xl font-bold text-xs sm:text-sm transition-transform shadow-lg shadow-amber-500/20 active:scale-95"
            >
              Sign In
            </Link>
          </SignedOut>
        </header>

        {/* Page Body */}
        {loading ? (
          <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 mt-4">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <CardSkeleton lines={2} /><CardSkeleton lines={2} /><CardSkeleton lines={2} />
            </div>
            <div className="bg-slate-900 rounded-2xl border border-slate-700/50 p-4 sm:p-6">
              <Skeleton className="h-6 w-48 mb-6" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-4 border rounded-xl bg-slate-800/30 border-slate-700/50 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-9 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6">

            {/* Database Status
          <div className="mb-3 sm:mb-5">
            <DatabaseStatus />
          </div> */}

            {/* Statistics Cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
              {/* Completed */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50 hover:border-amber-500/30 rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-lg hover:shadow-xl hover:shadow-amber-500/5 transition-[color,background-color,border-color,box-shadow,transform] duration-300 group">
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-amber-500/5 group-hover:bg-amber-500/10 rounded-full blur-2xl transition-[color,background-color,border-color,box-shadow,transform] duration-500" />
                <div className="relative text-center">
                  <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-amber-500/10 rounded-lg sm:rounded-xl mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform duration-300">
                    <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
                  </div>
                  <p className="text-xl sm:text-3xl font-black text-amber-400 mb-0.5">{testsCompleted}</p>
                  <p className="text-[9px] sm:text-xs text-slate-400 font-semibold">Completed</p>
                </div>
              </div>
              {/* Average */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50 hover:border-blue-500/30 rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-lg hover:shadow-xl hover:shadow-blue-500/5 transition-[color,background-color,border-color,box-shadow,transform] duration-300 group">
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-blue-500/5 group-hover:bg-blue-500/10 rounded-full blur-2xl transition-[color,background-color,border-color,box-shadow,transform] duration-500" />
                <div className="relative text-center">
                  <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/10 rounded-lg sm:rounded-xl mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform duration-300">
                    <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                  </div>
                  <p className="text-xl sm:text-3xl font-black text-blue-400 mb-0.5">{avgScore.toFixed(1)}%</p>
                  <p className="text-[9px] sm:text-xs text-slate-400 font-semibold">Average</p>
                </div>
              </div>
              {/* Best */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50 hover:border-emerald-500/30 rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-lg hover:shadow-xl hover:shadow-emerald-500/5 transition-[color,background-color,border-color,box-shadow,transform] duration-300 group">
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-emerald-500/5 group-hover:bg-emerald-500/10 rounded-full blur-2xl transition-[color,background-color,border-color,box-shadow,transform] duration-500" />
                <div className="relative text-center">
                  <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500/10 rounded-lg sm:rounded-xl mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform duration-300">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
                  </div>
                  <p className="text-xl sm:text-3xl font-black text-emerald-400 mb-0.5">{bestScore.toFixed(1)}%</p>
                  <p className="text-[9px] sm:text-xs text-slate-400 font-semibold">Best</p>
                </div>
              </div>
            </div>

            {/* Available Tests Section */}
            <div className="bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl shadow-xl mb-4 sm:mb-6">
              <div className="p-3 sm:p-5 border-b border-slate-700/50">
                <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-2">

                  {/* Left: View All + Filter dropdown */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      to="/student/all-tests"
                      className="px-3 sm:px-4 py-2 relative font-bold rounded-lg text-xs sm:text-sm whitespace-nowrap text-amber-200 transition-all duration-200 hover:scale-105 active:scale-95 border border-amber-400/30 hover:border-amber-300/60 bg-gradient-to-br from-amber-400/20 via-yellow-300/10 to-amber-500/20 shadow-[0_4px_16px_rgba(251,191,36,0.15),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_24px_rgba(251,191,36,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] hover:from-amber-400/30 hover:via-yellow-300/20 hover:to-amber-500/30"
                    >
                      View All Tests
                    </Link>

                    {/* Filter Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setFilterOpen(o => !o)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all duration-150 ${filterMode !== 'all'
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                          : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:border-slate-500'
                          }`}
                      >
                        {filterMode === 'available' && <Zap className="w-3 h-3" />}
                        {filterMode === 'completed' && <CheckCircle className="w-3 h-3" />}
                        {filterMode === 'all' && <span className="w-3 h-3 inline-flex items-center justify-center text-[9px] font-black">☰</span>}
                        <span className="capitalize">{filterMode === 'all' ? 'All' : filterMode}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${filterMode !== 'all' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-400'
                          }`}>
                          {filterCounts[filterMode]}
                        </span>
                        <svg className={`w-3 h-3 transition-transform duration-150 ${filterOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </button>

                      {filterOpen && (
                        <>
                          {/* Backdrop */}
                          <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                          {/* Menu */}
                          <div className="absolute left-0 top-full mt-1.5 z-20 min-w-[160px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                            {(
                              [
                                { key: 'all', label: 'All', count: filterCounts.all, icon: null },
                                { key: 'available', label: 'Available', count: filterCounts.available, icon: <Zap className="w-3.5 h-3.5" /> },
                                { key: 'completed', label: 'Completed', count: filterCounts.completed, icon: <CheckCircle className="w-3.5 h-3.5" /> },
                              ] as const
                            ).map(({ key, label, count, icon }) => (
                              <button
                                key={key}
                                onClick={() => { setFilterMode(key); setCurrentPage(1); setFilterOpen(false); }}
                                className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold transition-colors ${filterMode === key
                                  ? key === 'all' ? 'bg-slate-700/80 text-white' : key === 'available' ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'
                                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                  }`}
                              >
                                <span className="flex items-center gap-2">{icon}{label}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${filterMode === key
                                  ? key === 'all' ? 'bg-slate-600 text-slate-200' : key === 'available' ? 'bg-amber-500/25 text-amber-300' : 'bg-emerald-500/25 text-emerald-300'
                                  : 'bg-slate-800 text-slate-500'
                                  }`}>{count}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Search + View toggle */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search tests..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="w-full sm:w-48 pl-8 pr-3 py-2 border border-slate-700/50 rounded-lg bg-slate-900 text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-[color,background-color,border-color,box-shadow] text-xs outline-none"
                      />
                    </div>
                    <SGLToggle
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      className="hidden sm:flex flex-shrink-0"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-5">
                {filteredTests.length === 0 ? (
                  <div className="text-center py-10 sm:py-14">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-800/50 rounded-xl border border-slate-700/50 mb-3">
                      <BookOpen className="h-7 w-7 text-slate-500" />
                    </div>
                    <h3 className="text-base font-bold text-slate-200 mb-1.5">
                      {searchQuery ? 'No tests found' : filterMode === 'available' ? 'No available tests' : filterMode === 'completed' ? 'No completed tests' : 'No tests available'}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {searchQuery ? 'Try different search terms.' : filterMode === 'completed' ? "You haven't completed any tests yet." : 'New tests will appear here.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <SGL
                      tests={paginatedTests}
                      allTests={legacyTests}
                      completedTestIds={completedTestIds}
                      results={myResults}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      getScoreColor={getScoreColor}
                      hideToggle
                    />
                    {filteredTests.length > testsPerPage && (
                      <LightswindPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Recent Results */}
            {myResults.length > 0 && (
              <div className="bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl shadow-xl">
                <div className="p-3 sm:p-5 border-b border-slate-700/50 flex flex-row justify-between items-center gap-2">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-100">Recent Results</h2>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Your latest performances</p>
                  </div>
                  <Link
                    to="/student/performance"
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 whitespace-nowrap"
                  >
                    Overall Performance <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="p-3 sm:p-5">
                  <div className="space-y-2 sm:space-y-2.5">
                    {sortedAndPaginatedResults.map((result: LegacyTestResult) => {
                      const test = legacyTests.find((t: LegacyTest) => t.id === result.testId);
                      const testTitle = test?.title || `Test (ID: ${result.testId.substring(0, 8)}...)`;
                      const testExists = !!test;
                      return (
                        <Link
                          key={result.id}
                          to={`/results/${result.testId}`}
                          className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-800/40 border border-slate-700/50 rounded-lg hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 transition-[color,background-color,border-color,box-shadow] duration-200"
                        >
                          <div className="flex-1 min-w-0 w-full sm:w-auto">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <h3 className="font-bold text-slate-100 group-hover:text-amber-400 transition-colors text-xs sm:text-sm leading-snug">{testTitle}</h3>
                              {!testExists && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-700/50 text-slate-500 rounded uppercase tracking-wide">Archived</span>}
                              {test && !test.isPublic && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-700/50 text-slate-500 rounded uppercase tracking-wide">Inactive</span>}
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {new Date(result.completedAt).toLocaleDateString()} • {new Date(result.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                            <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-black text-sm sm:text-base border ${getScoreColor(result.score).color} ${getScoreColor(result.score).bgColor} border-slate-700/50`}>
                              {result.score.toFixed(1)}%
                            </div>
                            <p className="text-[10px] sm:text-xs text-slate-500 font-bold">
                              {result.earnedMarks != null && result.totalMarks != null
                                ? `${result.earnedMarks}/${result.totalMarks}m`
                                : `${Math.round((result.score / 100) * result.totalQuestions)}/${result.totalQuestions}`}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {myResults.length > resultsPerPage && (
                    <LightswindPagination
                      currentPage={resultsPage}
                      totalPages={Math.ceil(myResults.length / resultsPerPage)}
                      onPageChange={setResultsPage}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(StudentDashboard);