import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser, UserButton, SignedIn } from '@clerk/clerk-react';
import {
    BookOpen,
    TrendingUp,
    LayoutGrid,
    Menu,
    Home,
    X,
    ChevronLeft,
} from 'lucide-react';
import { Skeleton } from '../shared/Skeleton';

// ─── Navigation Items ────────────────────────────────────────────────────────
export const STUDENT_NAV_ITEMS = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutGrid,
        to: '/student',
        color: 'from-amber-500 to-yellow-500',
        glow: 'shadow-amber-500/20',
    },
    {
        id: 'tests',
        label: 'All Tests',
        icon: BookOpen,
        to: '/student/all-tests',
        color: 'from-blue-500 to-cyan-500',
        glow: 'shadow-blue-500/20',
    },
    {
        id: 'performance',
        label: 'Performance',
        icon: TrendingUp,
        to: '/student/performance',
        color: 'from-emerald-500 to-teal-500',
        glow: 'shadow-emerald-500/20',
    },
];

// ─── Sidebar Component ───────────────────────────────────────────────────────
function StudentSidebar({
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
    return (
        <>
            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
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
                {!isLoaded ? (
                    <>
                        {/* Header skeleton */}
                        <div className={`flex items-center h-14 px-3 border-b border-gray-800/60 flex-shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
                            <div className="flex items-center gap-2 min-w-0">
                                <Skeleton className="w-7 h-7 rounded-md flex-shrink-0" />
                                {!collapsed && <Skeleton className="h-3.5 w-24 rounded-md" />}
                            </div>
                        </div>
                        {/* User profile skeleton */}
                        <div className={`flex items-center gap-3 px-3 py-4 border-b border-gray-800/40 flex-shrink-0 ${collapsed ? 'justify-center px-0' : ''}`}>
                            <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                            {!collapsed && (
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <Skeleton className="h-3.5 w-28 rounded" />
                                    <Skeleton className="h-3 w-36 rounded" />
                                </div>
                            )}
                        </div>
                        {/* Nav skeleton */}
                        <nav className="flex-1 py-3 px-2 space-y-0.5">
                            {!collapsed && <Skeleton className="h-2.5 w-16 rounded mx-2 mb-2" />}
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className={`flex items-center gap-3 rounded-xl ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}`}>
                                    <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                                    {!collapsed && <Skeleton className="h-3.5 w-24 rounded" />}
                                </div>
                            ))}
                        </nav>
                        {/* Bottom skeleton */}
                        <div className="flex-shrink-0 p-2 border-t border-gray-800/60">
                            <div className={`flex items-center gap-3 rounded-xl ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}`}>
                                <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                                {!collapsed && <Skeleton className="h-3.5 w-12 rounded" />}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
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

                        {/* ── User Profile (fixed avatar sizing) ── */}
                        <div className={`flex items-center gap-3 px-3 py-3 border-b border-gray-800/40 flex-shrink-0 ${collapsed ? 'justify-center px-2' : ''}`}>
                            <SignedIn>
                                <div
                                    className="flex-shrink-0 rounded-full ring-2 ring-gray-700 hover:ring-amber-500/50 transition-shadow overflow-hidden"
                                    style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}
                                >
                                    <UserButton
                                        afterSignOutUrl="/"
                                        appearance={{
                                            elements: {
                                                userButtonAvatarBox: '!w-9 !h-9',
                                                userButtonTrigger: 'focus:shadow-none !p-0 !w-9 !h-9 !block',
                                                userButtonBox: '!w-9 !h-9',
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
                                    <p className="text-[10px] text-gray-500 truncate">
                                        {user?.primaryEmailAddress?.emailAddress}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {!collapsed && (
                                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-2 pb-2">
                                    Main Menu
                                </p>
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
                    </>
                )}
            </aside>
        </>
    );
}

// ─── Student Layout ──────────────────────────────────────────────────────────
export function StudentLayout({
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
    const navigate = useNavigate();

    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
        try {
            return localStorage.getItem('studentSidebarCollapsed') === 'true';
        } catch {
            return false;
        }
    });

    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const [isLargeScreen, setIsLargeScreen] = useState(
        () => typeof window !== 'undefined' && window.innerWidth >= 1024
    );

    useEffect(() => {
        const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const sidebarWidth = sidebarCollapsed ? '72px' : '256px';

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex">
            <StudentSidebar
                collapsed={sidebarCollapsed && isLargeScreen}
                onCollapse={() => {
                    const next = !sidebarCollapsed;
                    setSidebarCollapsed(next);
                    try { localStorage.setItem('studentSidebarCollapsed', String(next)); } catch { /* ignore */ }
                }}
                mobileOpen={mobileSidebarOpen}
                onMobileClose={() => setMobileSidebarOpen(false)}
                activeNav={activeNav}
                user={user}
                isLoaded={isLoaded}
            />

            {/* Main Content */}
            <div
                className="flex-1 min-w-0 w-full transition-[margin] duration-300"
                style={{ marginLeft: isLargeScreen ? sidebarWidth : 0 }}
            >
                {/* Top Bar */}
                <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/60 h-16 flex items-center px-4 sm:px-6 gap-3">
                    {/* Mobile menu toggle */}
                    <button
                        onClick={() => setMobileSidebarOpen(true)}
                        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
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

export default StudentLayout;