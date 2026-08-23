import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser, UserButton, SignedIn } from '@clerk/clerk-react';
import { useDeleteTestMutation, useToggleTestStatusMutation } from '../../hooks/quizMutations';
import { LegacyTest, LegacyTestResult } from '../../contexts/TestContext';
import { Link, useNavigate } from 'react-router-dom';
import { useSidebar } from '../../contexts/SidebarContext';
import { TEACHER_NAV_ITEMS } from '../../components/layouts/TeacherLayout';
import {
    Plus,
    BookOpen,
    Users,
    TrendingUp,
    BarChart3,
    Home,
    Search,
    Filter,
    X,
    ChevronRight,
    Menu,
    Layers,
    Activity
} from 'lucide-react';
import { getCachedUUIDFromClerkId } from '../../lib/clerkUtils';
import { LightswindPagination } from '../../components/shared/LightswindPagination';
import { CardSkeleton } from '../../components/shared/Skeleton';
import { useTestsQuery, useResultsQuery } from '../../hooks/quizQueries';
import { useToast } from '../../components/ui/Toast';
import { PremiumDialog } from '../../components/shared/PremiumDialog';
import { TGL, TGLToggle } from '../../components/teacher/TGL';

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
    // On mobile the sidebar is always fully expanded (never icon-only)
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 1024
    );
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    const isCollapsed = isMobile ? false : collapsed;

    return (
        <>
            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                    onClick={onMobileClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed top-0 left-0 h-screen z-50 flex flex-col
                    bg-gray-950 border-r border-gray-800/60
                    transition-[width,transform] duration-300 ease-in-out
                    ${isCollapsed ? 'w-[72px]' : 'w-64'}
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
                style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.4)' }}
            >
                {/* Header: Logo (desktop: click to collapse/expand) + Mobile X */}
                <div className={`flex items-center h-14 px-3 border-b border-gray-800/60 flex-shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!isCollapsed ? (
                        <>
                            {/* Desktop: clickable logo */}
                            <button
                                onClick={onCollapse}
                                className="hidden lg:flex items-center gap-2 min-w-0 group"
                                title="Collapse sidebar"
                            >
                                <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0 bg-white shadow-lg group-hover:ring-2 group-hover:ring-pink-500/30 transition-shadow">
                                    <img src="/favicon.svg" alt="QuizMaster" className="w-full h-full object-contain" loading="lazy" decoding="async" />
                                </div>
                                <span className="text-sm font-black bg-gradient-to-r from-pink-400 to-rose-500 bg-clip-text text-transparent truncate">
                                    QuizMaster
                                </span>
                            </button>
                            {/* Mobile: static logo */}
                            <div className="lg:hidden flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0 bg-white shadow-lg">
                                    <img src="/favicon.svg" alt="QuizMaster" className="w-full h-full object-contain" loading="lazy" decoding="async" />
                                </div>
                                <span className="text-sm font-black bg-gradient-to-r from-pink-400 to-rose-500 bg-clip-text text-transparent truncate">
                                    QuizMaster
                                </span>
                            </div>
                        </>
                    ) : (
                        /* Desktop collapsed: icon button to expand */
                        <button
                            onClick={onCollapse}
                            className="hidden lg:flex w-8 h-8 rounded-md overflow-hidden flex-shrink-0 bg-white shadow-lg hover:ring-2 hover:ring-pink-500/30 transition-shadow"
                            title="Expand sidebar"
                        >
                            <img src="/favicon.svg" alt="QuizMaster" className="w-full h-full object-contain" loading="lazy" decoding="async" />
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
                <div className={`flex items-center gap-3 px-3 py-3 border-b border-gray-800/40 flex-shrink-0 ${isCollapsed ? 'justify-center px-2' : ''}`}>
                    <SignedIn>
                        <div
                            className="flex-shrink-0 rounded-full ring-2 ring-gray-700 hover:ring-pink-500/50 transition-all overflow-hidden"
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
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                                {user?.fullName || user?.firstName || 'Teacher'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {!isCollapsed && (
                        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-2 pb-2">Main Menu</p>
                    )}
                    {TEACHER_NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeNav === item.id;
                        return (
                            <Link
                                key={item.id}
                                to={item.to}
                                onClick={onMobileClose}
                                title={isCollapsed ? item.label : undefined}
                                className={`
                                    group relative flex items-center gap-3 rounded-xl transition-colors duration-200 touch-manipulation
                                    ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}
                                    ${isActive
                                        ? 'bg-gray-800/80 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                                    }
                                `}
                            >
                                {/* Active indicator */}
                                {isActive && (
                                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-gradient-to-b ${item.color}`} />
                                )}

                                {/* Icon with gradient background when active */}
                                <div className={`
                                    flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-200
                                    ${isActive
                                        ? `bg-gradient-to-br ${item.color} shadow-lg ${item.glow}`
                                        : 'bg-gray-800/40 group-hover:bg-gray-700/60'
                                    }
                                `}>
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                                </div>

                                {!isCollapsed && (
                                    <span className="text-sm font-medium">{item.label}</span>
                                )}

                                {/* Tooltip for collapsed */}
                                {isCollapsed && (
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
                        title={isCollapsed ? 'Home' : undefined}
                        className={`
                            group relative flex items-center gap-3 rounded-xl transition-colors duration-200 touch-manipulation w-full
                            text-gray-400 hover:text-white hover:bg-gray-800/50
                            ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}
                        `}
                    >
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-200 bg-gray-800/40 group-hover:bg-gradient-to-br group-hover:from-slate-600 group-hover:to-slate-700">
                            <Home className="w-4 h-4" />
                        </div>
                        {!isCollapsed && (
                            <span className="text-sm font-medium">Home</span>
                        )}
                        {isCollapsed && (
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

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
    label,
    value,
    icon: Icon,
    accentColor,
    iconBg,
    iconColor,
    trend,
}: {
    label: string;
    value: string | number;
    icon: any;
    accentColor: string;
    iconBg: string;
    iconColor: string;
    trend?: string;
}) {
    return (
        <div className={`relative overflow-hidden rounded-2xl border ${iconBg.includes('pink') ? 'border-pink-500/20' : iconBg.includes('blue') ? 'border-blue-500/20' : iconBg.includes('violet') ? 'border-violet-500/20' : 'border-emerald-500/20'} bg-gray-900/80 p-2.5 sm:p-5 group hover:bg-gray-800/80 transition-[color,background-color,border-color,box-shadow] duration-300 hover:shadow-xl hover:shadow-black/30`}>
            {/* Subtle top-right glow */}
            <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-30 ${iconBg}`} />
            <div className="relative z-10">
                {/* Icon + Label row */}
                <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                    <p className="text-[9px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
                    <div className={`${iconBg} p-1.5 sm:p-2 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`w-3 h-3 sm:w-4 sm:h-4 ${iconColor}`} />
                    </div>
                </div>
                {/* Value */}
                <p className={`text-xl sm:text-4xl font-extrabold ${accentColor} leading-none mb-1.5 sm:mb-2`}>
                    {value}
                </p>
                {/* Trend */}
                {trend && (
                    <p className="text-[9px] sm:text-[11px] text-gray-500 flex items-center gap-1">
                        <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-500 flex-shrink-0" />
                        <span className="text-emerald-400 truncate">{trend}</span>
                    </p>
                )}
            </div>
        </div>
    );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
function TeacherDashboard() {
    const { user } = useUser();
    const navigate = useNavigate();
    const testsQuery = useTestsQuery();
    const resultsQuery = useResultsQuery((testsQuery.data || []) as LegacyTest[]);
    const deleteTestMutation = useDeleteTestMutation();
    const toggleStatusMutation = useToggleTestStatusMutation();
    const loading = testsQuery.isLoading || resultsQuery.isLoading;

    const [userUUID, setUserUUID] = useState<string>('');
    const [copiedTestId, setCopiedTestId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [resultsPage, setResultsPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [testToDelete, setTestToDelete] = useState<{ id: string; title: string } | null>(null);
    const [viewMode, setViewMode] = useState<'tile' | 'list'>('tile');
    const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
    const [isLargeScreen, setIsLargeScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
    useEffect(() => {
        const handler = () => {
            setIsPhone(window.innerWidth < 640);
            setIsLargeScreen(window.innerWidth >= 1024);
        };
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    const effectiveViewMode = isPhone ? 'list' : viewMode;
    const [showFilters, setShowFilters] = useState(false);
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
    const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'scheduled' | 'ended'>('all');
    const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const { sidebarCollapsed, setSidebarCollapsed } = useSidebar();
    const testsPerPage = 12;
    const resultsPerPage = 5;
    const { addToast } = useToast();

    useEffect(() => {
        const generateUserUUID = async () => {
            if (user?.id) {
                const uuid = await getCachedUUIDFromClerkId(user.id);
                setUserUUID(uuid);
            }
        };
        generateUserUUID();
    }, [user?.id]);

    const myTests = useMemo(() =>
        (testsQuery.data || []).filter((test: LegacyTest) => test.createdBy === userUUID),
        [testsQuery.data, userUUID]
    );

    const filteredTests = useMemo(() => {
        let filtered = myTests.filter((test: LegacyTest) => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return test.title.toLowerCase().includes(query) || test.description.toLowerCase().includes(query);
        });

        // Apply status filter
        if (statusFilter !== 'all') {
            const now = new Date();
            filtered = filtered.filter((test: LegacyTest) => {
                const startDate = new Date(test.startDate || 0);
                const endDate = new Date(test.endDate || 0);

                if (statusFilter === 'available') {
                    return now >= startDate && now <= endDate;
                } else if (statusFilter === 'scheduled') {
                    return now < startDate;
                } else if (statusFilter === 'ended') {
                    return now > endDate;
                }
                return true;
            });
        }

        // Apply visibility filter
        if (visibilityFilter !== 'all') {
            filtered = filtered.filter((test: LegacyTest) => {
                if (visibilityFilter === 'public') return test.isPublic === true;
                if (visibilityFilter === 'private') return test.isPublic === false;
                return true;
            });
        }

        switch (sortBy) {
            case 'newest':
                filtered = [...filtered].sort((a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
                break;
            case 'oldest':
                filtered = [...filtered].sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
                break;
            case 'name':
                filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
                break;
        }
        return filtered;
    }, [myTests, searchQuery, sortBy, statusFilter, visibilityFilter]);

    const myResults = useMemo(() =>
        (resultsQuery.data || []).filter((result: LegacyTestResult) => myTests.some((test: LegacyTest) => test.id === result.testId)),
        [resultsQuery.data, myTests]
    );

    const totalStudents = useMemo(() => {
        const studentIds = new Set(myResults.map((r: LegacyTestResult) => r.studentId));
        return studentIds.size;
    }, [myResults]);

    const averageScore = useMemo(() => {
        if (myResults.length === 0) return 0;
        const scores = myResults.map((result: LegacyTestResult) => {
            if (result.earnedMarks != null && result.totalMarks != null && result.totalMarks > 0) {
                return (result.earnedMarks / result.totalMarks) * 100;
            }
            return result.score;
        });
        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }, [myResults]);

    const handleEdit = useCallback((testId: string) => navigate(`/teacher/edit-test/${testId}`), [navigate]);

    const handleDeleteTest = useCallback((testId: string, testTitle: string) => {
        setTestToDelete({ id: testId, title: testTitle });
        setDeleteDialogOpen(true);
    }, []);

    const confirmDeleteTest = useCallback(async () => {
        if (!testToDelete) return;
        try {
            await deleteTestMutation.mutateAsync({ id: testToDelete.id });
            addToast({ type: 'success', title: 'Test Deleted', message: 'The test has been deleted successfully.' });
            setDeleteDialogOpen(false);
            setTestToDelete(null);
        } catch {
            addToast({ type: 'error', title: 'Delete Failed', message: 'Failed to delete the test. Please try again.' });
        }
    }, [testToDelete, deleteTestMutation, addToast]);

    const handleToggleStatus = useCallback(async (testId: string) => {
        try {
            await toggleStatusMutation.mutateAsync({
                id: testId,
                current: myTests.find(t => t.id === testId)?.isPublic || false,
            });
            addToast({
                type: 'success',
                title: 'Status Updated',
                message: `Test is now ${myTests.find(t => t.id === testId)?.isPublic ? 'public' : 'private'}`
            });
        } catch {
            addToast({ type: 'error', title: 'Update Failed', message: 'Failed to update test status. Please try again.' });
        }
    }, [myTests, toggleStatusMutation, addToast]);

    const copyTestLink = useCallback(async (testId: string) => {
        const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
        const link = `${baseUrl}/#/test/${testId}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopiedTestId(testId);
            addToast({ type: 'success', title: 'Link Copied', message: 'Test link has been copied to clipboard.' });
            setTimeout(() => setCopiedTestId(null), 2000);
        } catch {
            addToast({ type: 'error', title: 'Copy Failed', message: 'Failed to copy link. Please try again.' });
        }
    }, [addToast]);

    const sidebarWidth = sidebarCollapsed ? 72 : 256;

    return (
        <div className="min-h-screen bg-gray-950 flex">
            {/* Sidebar */}
            <Sidebar
                collapsed={sidebarCollapsed}
                onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                mobileOpen={mobileSidebarOpen}
                onMobileClose={() => setMobileSidebarOpen(false)}
                activeNav="dashboard"
                user={user}
            />

            {/* Main Content — no left margin on mobile (sidebar off-canvas), only on lg+ */}
            <div
                className="flex-1 min-w-0 w-full transition-[margin] duration-300"
                style={{ marginLeft: isLargeScreen ? sidebarWidth : 0 }}
            >
                {/* Top Bar */}
                <header className="sticky top-0 z-30 bg-gray-950/90 border-b border-gray-800/60 h-16 flex items-center px-4 sm:px-6 gap-4">
                    {/* Mobile menu toggle */}
                    <button
                        onClick={() => setMobileSidebarOpen(true)}
                        title="Open navigation menu"
                        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    {/* Page title */}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold text-white">Teacher Dashboard</h1>

                        <p className="text-xs text-gray-500 hidden sm:block">
                            Welcome back, {user?.firstName} — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>

                    </div>

                </header>

                {/* Page Body */}
                <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

                    {loading ? (
                        <div className="space-y-6 mt-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                                <CardSkeleton lines={3} />
                                <CardSkeleton lines={3} />
                                <CardSkeleton lines={3} />
                                <CardSkeleton lines={3} />
                            </div>
                            <div className="h-8 w-48 bg-gray-800/60 rounded-md mt-8 mb-4"></div>
                            <div className="space-y-3">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="h-20 bg-gray-800/40 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Stats Grid — 2×2 on mobile, 4-col on desktop */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
                                <StatCard
                                    label="Total Tests"
                                    value={myTests.length}
                                    icon={Layers}
                                    accentColor="text-pink-400"
                                    iconBg="bg-pink-500/15"
                                    iconColor="text-pink-400"
                                    trend="All time"
                                />
                                <StatCard
                                    label="Total Students"
                                    value={totalStudents}
                                    icon={Users}
                                    accentColor="text-blue-400"
                                    iconBg="bg-blue-500/15"
                                    iconColor="text-blue-400"
                                    trend="Unique participants"
                                />
                                <StatCard
                                    label="Average Score"
                                    value={`${averageScore.toFixed(1)}%`}
                                    icon={TrendingUp}
                                    accentColor="text-violet-400"
                                    iconBg="bg-violet-500/15"
                                    iconColor="text-violet-400"
                                    trend="Across all tests"
                                />
                                <StatCard
                                    label="Submissions"
                                    value={myResults.length}
                                    icon={BarChart3}
                                    accentColor="text-emerald-400"
                                    iconBg="bg-emerald-500/15"
                                    iconColor="text-emerald-400"
                                    trend="Total attempts"
                                />
                            </div>

                            {/* My Tests Section */}
                            <div className="mb-8">
                                {/* Section Header — always single row on all screen sizes */}
                                <div className="flex items-center justify-between gap-3 mb-5">
                                    <div>
                                        <h2 className="text-xl font-bold text-white">My Tests</h2>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            {filteredTests.length} {filteredTests.length === 1 ? 'test' : 'tests'}
                                            {searchQuery && ` matching "${searchQuery}"`}
                                        </p>
                                    </div>
                                    <Link
                                        to="/teacher/all-tests"
                                        className="flex-shrink-0 text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors group"
                                    >
                                        View all <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                    </Link>
                                </div>

                                {/* Toolbar */}
                                <div className="flex flex-col gap-3 mb-5">
                                    <div className="flex items-center gap-2">
                                        {/* Search */}
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                            <input
                                                type="text"
                                                placeholder="Search tests..."
                                                value={searchQuery}
                                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                                className="w-full pl-9 pr-9 py-2.5 bg-gray-900/70 border border-gray-800 focus:border-pink-500/50 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-pink-500/20 transition-[color,background-color,border-color,box-shadow] text-sm outline-none"
                                            />
                                            {searchQuery && (
                                                <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }} title="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <X className="w-4 h-4 text-gray-500 hover:text-white transition-colors" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Filter toggle */}
                                        <button
                                            onClick={() => setShowFilters(!showFilters)}
                                            className={`flex-shrink-0 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${showFilters ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-900/70 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'}`}
                                        >
                                            <Filter className="w-4 h-4" />
                                            <span className="hidden sm:inline">Filter</span>
                                        </button>

                                        <TGLToggle
                                            viewMode={viewMode}
                                            onViewModeChange={setViewMode}
                                            className="hidden sm:flex flex-shrink-0"
                                        />

                                        {/* Create Test — right of search row */}
                                        <Link
                                            to="/teacher/create-test"
                                            className="flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-teal-500/20 hover:bg-teal-400/30 text-teal-300 hover:text-teal-200 border border-teal-500/30 hover:border-teal-400/50 rounded-xl font-medium text-sm transition-[color,background-color,border-color,box-shadow,transform] shadow-lg shadow-teal-900/40 hover:shadow-teal-800/50 active:scale-95 touch-manipulation"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span className="hidden sm:inline">Create Test</span>
                                        </Link>
                                    </div>

                                    {/* Sort and Filter Options */}
                                    {showFilters && (
                                        <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 space-y-4">
                                            {/* Sort by */}
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sort by</p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {(['newest', 'oldest', 'name'] as const).map((opt) => (
                                                        <button
                                                            key={opt}
                                                            onClick={() => setSortBy(opt)}
                                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${sortBy === opt ? 'bg-gray-700 text-white border border-gray-600' : 'text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent'}`}
                                                        >
                                                            {opt === 'name' ? 'A–Z' : opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Status Filter */}
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Test Status</p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {(['all', 'available', 'scheduled', 'ended'] as const).map((opt) => (
                                                        <button
                                                            key={opt}
                                                            onClick={() => setStatusFilter(opt)}
                                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${statusFilter === opt ? 'bg-gray-700 text-white border border-gray-600' : 'text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent'}`}
                                                        >
                                                            {opt === 'all' ? 'All Tests' : opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Visibility Filter */}
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Visibility</p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {(['all', 'public', 'private'] as const).map((opt) => (
                                                        <button
                                                            key={opt}
                                                            onClick={() => setVisibilityFilter(opt)}
                                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${visibilityFilter === opt ? 'bg-gray-700 text-white border border-gray-600' : 'text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent'}`}
                                                        >
                                                            {opt === 'all' ? 'All Visibility' : opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Tests Grid / List */}
                                {filteredTests.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/60 flex items-center justify-center mb-4">
                                            <BookOpen className="w-8 h-8 text-gray-600" />
                                        </div>
                                        <h3 className="text-base font-semibold text-white mb-1">
                                            {searchQuery ? 'No tests found' : 'No tests yet'}
                                        </h3>
                                        <p className="text-sm text-gray-500 mb-6 max-w-xs">
                                            {searchQuery ? 'Try adjusting your search.' : 'Create your first test to get started.'}
                                        </p>
                                        <Link
                                            to="/teacher/create-test"
                                            className="px-5 py-2.5 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/60 hover:border-gray-600/60 text-gray-200 hover:text-white rounded-xl font-medium text-sm transition-[color,background-color,border-color,transform] shadow-lg active:scale-95"
                                        >
                                            Create Test
                                        </Link>
                                    </div>
                                ) : (
                                    <TGL
                                        tests={filteredTests.slice((currentPage - 1) * testsPerPage, currentPage * testsPerPage)}
                                        results={myResults}
                                        copiedTestId={copiedTestId}
                                        onShare={copyTestLink}
                                        onToggleStatus={handleToggleStatus}
                                        onEdit={handleEdit}
                                        onDelete={handleDeleteTest}
                                        viewMode={effectiveViewMode}
                                        onViewModeChange={setViewMode}
                                        hideToggle
                                    />
                                )}

                                {/* Pagination */}
                                {filteredTests.length > testsPerPage && (
                                    <LightswindPagination
                                        currentPage={currentPage}
                                        totalPages={Math.ceil(filteredTests.length / testsPerPage)}
                                        onPageChange={setCurrentPage}
                                        showInfo
                                        totalItems={filteredTests.length}
                                        itemsPerPage={testsPerPage}
                                        itemLabel="tests"
                                        className="mt-6 border-t border-gray-800/60 pt-5"
                                    />
                                )}
                            </div>

                            {/* Recent Results */}
                            {myResults.length > 0 && (
                                <div className="rounded-2xl border border-gray-800/60 bg-gray-900/40 overflow-hidden">
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-800/60 bg-gray-900/60">
                                        <div>
                                            <h2 className="text-base font-bold text-white">Recent Results</h2>
                                            <p className="text-xs text-gray-500 mt-0.5">{myResults.length} total submissions</p>
                                        </div>
                                        <Link to="/teacher/analytics" className="text-xs sm:text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors group">
                                            Analytics <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </Link>
                                    </div>

                                    {/* Desktop column headers — hidden on mobile */}
                                    <div className="hidden sm:grid grid-cols-[1fr_130px_90px] gap-4 px-5 py-2.5 border-b border-gray-800/40 bg-gray-900/30">
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Student / Test</span>
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Date</span>
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Score</span>
                                    </div>

                                    {/* Result rows */}
                                    <div className="divide-y divide-gray-800/30 px-3 sm:px-0 py-2 sm:py-0 space-y-2 sm:space-y-0">
                                        {myResults
                                            .slice()
                                            .sort((a: LegacyTestResult, b: LegacyTestResult) =>
                                                new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
                                            )
                                            .slice((resultsPage - 1) * resultsPerPage, resultsPage * resultsPerPage)
                                            .map((result: LegacyTestResult) => {
                                                const test = myTests.find((t: LegacyTest) => t.id === result.testId);
                                                const pct = result.earnedMarks != null && result.totalMarks != null && result.totalMarks > 0
                                                    ? (result.earnedMarks / result.totalMarks) * 100
                                                    : result.score;
                                                const scoreColor = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400';
                                                const scoreBg = pct >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' : pct >= 60 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';
                                                const marksLabel = result.earnedMarks != null && result.totalMarks != null
                                                    ? `${result.earnedMarks}/${result.totalMarks}`
                                                    : `${Math.round((result.score / 100) * result.totalQuestions)}/${result.totalQuestions}`;

                                                return (
                                                    <div key={result.id}>
                                                        {/* ── Mobile card (< sm) ── */}
                                                        <div className="sm:hidden flex items-center gap-3 bg-gray-800/30 border border-gray-700/40 rounded-xl px-3 py-3">
                                                            {/* Score badge — left */}
                                                            <div className={`flex-shrink-0 w-12 h-12 rounded-xl border ${scoreBg} flex flex-col items-center justify-center`}>
                                                                <span className={`text-sm font-bold leading-none ${scoreColor}`}>{Math.round(pct)}%</span>
                                                                <span className="text-[10px] text-gray-600 mt-0.5">{marksLabel}</span>
                                                            </div>
                                                            {/* Info */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold text-white truncate leading-snug">{result.studentName}</p>
                                                                <p className="text-xs text-gray-500 truncate mt-0.5">{test?.title}</p>
                                                                <p className="text-[11px] text-gray-600 mt-1">
                                                                    {new Date(result.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* ── Desktop row (≥ sm) ── */}
                                                        <div className="hidden sm:grid grid-cols-[1fr_130px_90px] gap-4 px-5 py-3.5 hover:bg-gray-800/20 transition-colors items-center">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium text-white truncate">{result.studentName}</p>
                                                                <p className="text-xs text-gray-500 truncate mt-0.5">{test?.title}</p>
                                                            </div>
                                                            <p className="text-xs text-gray-500 text-center">
                                                                {new Date(result.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </p>
                                                            <div className="text-right">
                                                                <p className={`text-sm font-bold ${scoreColor}`}>{pct.toFixed(1)}%</p>
                                                                <p className="text-xs text-gray-600">{marksLabel}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>

                                    {myResults.length > resultsPerPage && (
                                        <div className="px-4 sm:px-5 py-4 border-t border-gray-800/40">
                                            <LightswindPagination
                                                currentPage={resultsPage}
                                                totalPages={Math.ceil(myResults.length / resultsPerPage)}
                                                onPageChange={setResultsPage}
                                                showInfo
                                                totalItems={myResults.length}
                                                itemsPerPage={resultsPerPage}
                                                itemLabel="results"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>

            {/* Delete Confirm Dialog */}
            <PremiumDialog
                isOpen={deleteDialogOpen}
                onClose={() => { setDeleteDialogOpen(false); setTestToDelete(null); }}
                onConfirm={confirmDeleteTest}
                title="Delete Test"
                subtitle={testToDelete?.title}
                message="Are you sure you want to delete this test? This action cannot be undone and all associated data will be permanently removed."
                confirmText="Delete Test"
                cancelText="Cancel"
                type="danger"
                infoText="This will permanently delete the test and all its related configuration, results, and history."
                isLoading={deleteTestMutation.isPending}
            />
        </div>
    );
}

export default TeacherDashboard;