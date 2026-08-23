import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser, UserButton, SignedIn } from '@clerk/clerk-react';
import { useSidebar } from '../../contexts/SidebarContext';
import {
    Plus,
    BookOpen,
    Users,
    BarChart3,
    LayoutGrid,
    FlaskConical,
    Menu,
    Home,
    X,
    ChevronLeft,
} from 'lucide-react';
import { Skeleton } from '../shared/Skeleton';

// ─── Navigation Items ────────────────────────────────────────────────────────
export const TEACHER_NAV_ITEMS = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutGrid,
        to: '/teacher',
        color: 'from-pink-500 to-rose-500',
        glow: 'shadow-pink-500/20',
    },
    {
        id: 'create',
        label: 'Create Test',
        icon: Plus,
        to: '/teacher/create-test',
        color: 'from-violet-500 to-purple-500',
        glow: 'shadow-purple-500/20',
    },
    {
        id: 'tests',
        label: 'All Tests',
        icon: BookOpen,
        to: '/teacher/all-tests',
        color: 'from-blue-500 to-cyan-500',
        glow: 'shadow-blue-500/20',
    },
    {
        id: 'analytics',
        label: 'Analytics',
        icon: BarChart3,
        to: '/teacher/analytics',
        color: 'from-emerald-500 to-teal-500',
        glow: 'shadow-emerald-500/20',
    },
    {
        id: 'students',
        label: 'Students',
        icon: Users,
        to: '/teacher/students',
        color: 'from-amber-500 to-orange-500',
        glow: 'shadow-amber-500/20',
    },
    {
        id: 'questions',
        label: 'Question Bank',
        icon: FlaskConical,
        to: '/teacher/question-bank',
        color: 'from-fuchsia-500 to-pink-500',
        glow: 'shadow-fuchsia-500/20',
    },
];

// ─── Sidebar Component ───────────────────────────────────────────────────────
function TeacherSidebar({
    collapsed,
    onCollapse,
    mobileOpen,
    onMobileClose,
    activeNav,
    user,
    isLoaded,
}: {
    collapsed: boolean;
    onCollapse: () => void;
    mobileOpen: boolean;
    onMobileClose: () => void;
    activeNav: string;
    user: ReturnType<typeof useUser>['user'];
    isLoaded: boolean;
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
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={onMobileClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed top-0 left-0 h-screen z-50 flex flex-col
                    bg-gray-950 border-r border-gray-800/60
                    transition-all duration-300 ease-in-out
                    ${isCollapsed ? 'w-[72px]' : 'w-64'}
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
                style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.4)' }}
            >
                {!isLoaded ? (
                    <>
                        {/* Header skeleton */}
                        <div className={`flex items-center h-14 px-3 border-b border-gray-800/60 flex-shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                            <div className="flex items-center gap-2 min-w-0">
                                <Skeleton className="w-7 h-7 rounded-md flex-shrink-0" />
                                {!isCollapsed && <Skeleton className="h-3.5 w-24 rounded-md" />}
                            </div>
                        </div>
                        {/* User profile skeleton */}
                        <div className={`flex items-center gap-3 px-3 py-4 border-b border-gray-800/40 flex-shrink-0 ${isCollapsed ? 'justify-center px-0' : ''}`}>
                            <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                            {!isCollapsed && (
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <Skeleton className="h-3.5 w-28 rounded" />
                                    <Skeleton className="h-3 w-36 rounded" />
                                </div>
                            )}
                        </div>
                        {/* Nav skeleton */}
                        <nav className="flex-1 py-3 px-2 space-y-0.5">
                            {!isCollapsed && <Skeleton className="h-2.5 w-16 rounded mx-2 mb-2" />}
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className={`flex items-center gap-3 rounded-xl ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}`}>
                                    <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                                    {!isCollapsed && <Skeleton className="h-3.5 w-24 rounded" />}
                                </div>
                            ))}
                        </nav>
                        {/* Bottom skeleton */}
                        <div className="flex-shrink-0 p-2 border-t border-gray-800/60">
                            <div className={`flex items-center gap-3 rounded-xl ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}`}>
                                <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                                {!isCollapsed && <Skeleton className="h-3.5 w-12 rounded" />}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
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
                                        <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0 bg-white shadow-lg group-hover:ring-2 group-hover:ring-pink-500/30 transition-all">
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
                                    className="hidden lg:flex w-8 h-8 rounded-md overflow-hidden flex-shrink-0 bg-white shadow-lg hover:ring-2 hover:ring-pink-500/30 transition-all"
                                    title="Expand sidebar"
                                >
                                    <img src="/favicon.svg" alt="QuizMaster" className="w-full h-full object-contain" />
                                </button>
                            )}
                            {/* Mobile close */}
                            <button
                                onClick={onMobileClose}
                                className="lg:hidden flex w-7 h-7 items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-gray-800/60 transition-all flex-shrink-0"
                                aria-label="Close menu"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* ── User Profile (fixed avatar sizing) ── */}
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
                                    <p className="text-xs text-gray-500 truncate">
                                        {user?.primaryEmailAddress?.emailAddress}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {!isCollapsed && (
                                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-2 pb-2">
                                    Main Menu
                                </p>
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
                                    group relative flex items-center gap-3 rounded-xl transition-all duration-200 touch-manipulation
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

                                        {/* Icon */}
                                        <div className={`
                                    flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200
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

                                        {/* Tooltip for collapsed state */}
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
                            group relative flex items-center gap-3 rounded-xl transition-all duration-200 touch-manipulation w-full
                            text-gray-400 hover:text-white hover:bg-gray-800/50
                            ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}
                        `}
                            >
                                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 bg-gray-800/40 group-hover:bg-gradient-to-br group-hover:from-slate-600 group-hover:to-slate-700">
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
                    </>
                )}
            </aside>
        </>
    );
}

// ─── Teacher Layout ──────────────────────────────────────────────────────────
export function TeacherLayout({
    activeNav,
    title,
    subtitle,
    headerActions,
    children,
}: {
    activeNav: string;
    title: string;
    subtitle?: string;
    headerActions?: React.ReactNode;
    children: React.ReactNode;
}) {
    const { user, isLoaded } = useUser();
    const { sidebarCollapsed, setSidebarCollapsed } = useSidebar();
    const navigate = useNavigate();

    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const [isLargeScreen, setIsLargeScreen] = useState(
        () => typeof window !== 'undefined' && window.innerWidth >= 1024
    );

    useEffect(() => {
        const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleCollapse = () => {
        setSidebarCollapsed(!sidebarCollapsed);
    };

    const sidebarWidth = sidebarCollapsed ? 72 : 256;

    return (
        <div className="min-h-screen bg-gray-950 flex">
            <TeacherSidebar
                collapsed={sidebarCollapsed}
                onCollapse={handleCollapse}
                mobileOpen={mobileSidebarOpen}
                onMobileClose={() => setMobileSidebarOpen(false)}
                activeNav={activeNav}
                user={user}
                isLoaded={isLoaded}
            />

            {/* Main Content */}
            <div
                className="flex-1 min-w-0 w-full transition-all duration-300"
                style={{ marginLeft: isLargeScreen ? sidebarWidth : 0 }}
            >
                {/* Top Bar */}
                <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/60 h-16 flex items-center px-4 sm:px-6 gap-3">
                    {/* Mobile menu toggle */}
                    <button
                        onClick={() => setMobileSidebarOpen(true)}
                        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
                        aria-label="Open menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    {/* Back button — desktop only */}
                    <button
                        onClick={() => navigate(-1)}
                        className="hidden lg:flex flex-shrink-0 w-9 h-9 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
                        title="Go back"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    {/* Page title */}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base sm:text-lg font-bold text-white truncate">{title}</h1>
                        {subtitle && (
                            <p className="text-xs text-gray-500 hidden sm:block truncate">{subtitle}</p>
                        )}
                    </div>

                    {/* Page-specific header actions */}
                    {headerActions && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {headerActions}
                        </div>
                    )}
                </header>

                {/* Page Body */}
                {children}
            </div>
        </div>
    );
}

export default TeacherLayout;