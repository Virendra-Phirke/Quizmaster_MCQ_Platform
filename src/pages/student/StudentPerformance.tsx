import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { LegacyTestResult } from '../../contexts/TestContext';
import { useTestsQuery, useResultsQuery } from '../../hooks/quizQueries';
import { getCachedUUIDFromClerkId } from '../../lib/clerkUtils';
import { CardSkeleton, Skeleton } from '../../components/shared/Skeleton';
import { LightswindPagination } from '../../components/shared/LightswindPagination';
import {
    TrendingUp,
    TrendingDown,
    Award,
    Clock,
    Calendar,
    BarChart3,
    CheckCircle,
    Search,
    Download,
    Target,
    Activity,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    X
} from 'lucide-react';
import { StudentLayout } from '../../components/layouts/StudentLayout';

// Helper to format duration
const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

// Helper to format date
const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
};

// Short date for mobile
const formatDateShort = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
};


// Get performance insights
const getPerformanceInsights = (results: any[], stats: any) => {
    if (results.length === 0) return [];

    const insights = [];
    const recent5 = results.slice(-5);
    const older5 = results.slice(-10, -5);

    // Trend analysis
    if (recent5.length >= 3 && older5.length >= 3) {
        const recentAvg = recent5.reduce((a, b) => a + b.calculatedPercentage, 0) / recent5.length;
        const olderAvg = older5.reduce((a, b) => a + b.calculatedPercentage, 0) / older5.length;
        const improvement = recentAvg - olderAvg;

        if (improvement > 5) {
            insights.push({
                type: 'success',
                icon: TrendingUp,
                message: `Performance improving! +${improvement.toFixed(1)}% in recent tests`,
            });
        } else if (improvement < -5) {
            insights.push({
                type: 'warning',
                icon: TrendingDown,
                message: `Performance declining. ${Math.abs(improvement).toFixed(1)}% drop in recent tests`,
            });
        }
    }

    // Consistency check
    const scores = results.map(r => r.calculatedPercentage);
    const variance = scores.reduce((a, b) => a + Math.pow(b - stats.avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 10) {
        insights.push({
            type: 'info',
            icon: Target,
            message: 'Consistent performance across tests',
        });
    } else if (stdDev > 20) {
        insights.push({
            type: 'warning',
            icon: Activity,
            message: 'Performance varies significantly. Focus on consistency',
        });
    }

    // Study time analysis
    const avgTime = stats.totalTime / stats.totalTests;
    if (avgTime < 300) { // less than 5 minutes
        insights.push({
            type: 'warning',
            icon: Clock,
            message: 'Average test time is low. Consider reviewing more carefully',
        });
    }

    // Achievement milestones
    if (stats.totalTests >= 50) {
        insights.push({
            type: 'success',
            icon: Award,
            message: `Achievement unlocked: ${stats.totalTests} tests completed!`,
        });
    } else if (stats.totalTests >= 20) {
        insights.push({
            type: 'info',
            icon: Award,
            message: `${50 - stats.totalTests} more tests to reach 50 test milestone`,
        });
    }

    return insights;
};

export default function StudentPerformance() {
    const { user } = useUser();
    const testsQuery = useTestsQuery();
    const resultsQuery = useResultsQuery(testsQuery.data || []);
    const loading = testsQuery.isLoading || resultsQuery.isLoading;

    const [userUUID, setUserUUID] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof LegacyTestResult | 'testTitle' | null, direction: 'asc' | 'desc' }>({
        key: 'completedAt',
        direction: 'desc'
    });
    const [filterQuery, setFilterQuery] = useState('');
    const [showInsights, setShowInsights] = useState(true);
    const [selectedTimeRange, setSelectedTimeRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
    const [historyPage, setHistoryPage] = useState(1);
    const resultsPerPage = 10;

    // Drag-to-scroll for the chart
    const scrollRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const scrollStartLeft = useRef(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        isDragging.current = true;
        dragStartX.current = e.clientX;
        scrollStartLeft.current = scrollRef.current.scrollLeft;
        scrollRef.current.style.cursor = 'grabbing';
        scrollRef.current.style.userSelect = 'none';
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging.current || !scrollRef.current) return;
        const dx = e.clientX - dragStartX.current;
        scrollRef.current.scrollLeft = scrollStartLeft.current - dx;
    }, []);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
        if (scrollRef.current) {
            scrollRef.current.style.cursor = 'grab';
            scrollRef.current.style.userSelect = '';
        }
    }, []);

    // Generate UUID for current user
    useEffect(() => {
        const generateUserUUID = async () => {
            if (user?.id) {
                const uuid = await getCachedUUIDFromClerkId(user.id);
                setUserUUID(uuid);
            }
        };
        generateUserUUID();
    }, [user?.id]);

    // Process data with time range filter
    const { myResults, stats, chartData, insights } = useMemo(() => {
        let results = (resultsQuery.data || [])
            .filter((r: LegacyTestResult) => r.studentId === userUUID)
            .map((r: LegacyTestResult) => {
                const test = (testsQuery.data || []).find(t => t.id === r.testId);
                return {
                    ...r,
                    testTitle: test?.title || 'Unknown Test',
                    maxMarks: test?.totalMarks || r.totalMarks || 0,
                    calculatedPercentage: r.totalMarks && r.totalMarks > 0
                        ? ((r.earnedMarks || r.score || 0) / r.totalMarks) * 100
                        : r.score
                };
            });

        // Apply time range filter
        if (selectedTimeRange !== 'all') {
            const now = new Date();
            const cutoff = new Date();
            if (selectedTimeRange === '7d') cutoff.setDate(now.getDate() - 7);
            else if (selectedTimeRange === '30d') cutoff.setDate(now.getDate() - 30);
            else if (selectedTimeRange === '90d') cutoff.setDate(now.getDate() - 90);

            results = results.filter(r => new Date(r.completedAt) >= cutoff);
        }

        if (results.length === 0) {
            return {
                myResults: [],
                stats: { totalTests: 0, avgScore: 0, bestScore: 0, totalTime: 0, worstScore: 0, passRate: 0 },
                chartData: [],
                insights: []
            };
        }

        const totalTests = results.length;
        const scores = results.map(r => r.calculatedPercentage);
        const avgScore = scores.reduce((a, b) => a + b, 0) / totalTests;
        const bestScore = Math.max(...scores);
        const worstScore = Math.min(...scores);
        const totalTime = results.reduce((sum, r) => sum + r.timeTaken, 0);
        const passRate = (scores.filter(s => s >= 60).length / totalTests) * 100;

        const chartData = results
            .slice()
            .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
            .map(r => ({
                id: r.id,
                testId: r.testId,
                date: new Date(r.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                score: Math.round(r.calculatedPercentage),
                title: r.testTitle
            }));

        const statsData = { totalTests, avgScore, bestScore, worstScore, totalTime, passRate };
        const insights = getPerformanceInsights(results, statsData);

        return {
            myResults: results,
            stats: statsData,
            chartData,
            insights
        };
    }, [resultsQuery.data, userUUID, testsQuery.data, selectedTimeRange]);

    // Sort and Filter Logic
    const processedResults = useMemo(() => {
        let data = [...myResults];

        if (filterQuery) {
            const q = filterQuery.toLowerCase();
            data = data.filter(r => r.testTitle.toLowerCase().includes(q));
        }

        if (sortConfig.key) {
            data.sort((a: any, b: any) => {
                if (a[sortConfig.key!] < b[sortConfig.key!]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key!] > b[sortConfig.key!]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return data;
    }, [myResults, filterQuery, sortConfig]);

    // Paginate results
    const totalHistoryPages = Math.ceil(processedResults.length / resultsPerPage);
    const paginatedResults = useMemo(() => {
        const start = (historyPage - 1) * resultsPerPage;
        return processedResults.slice(start, start + resultsPerPage);
    }, [processedResults, historyPage, resultsPerPage]);

    // Reset page when filters change
    useEffect(() => {
        setHistoryPage(1);
    }, [filterQuery, sortConfig, selectedTimeRange]);

    const handleSort = (key: keyof LegacyTestResult | 'testTitle') => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const exportToExcel = () => {
        if (processedResults.length === 0) return;
        const rows = processedResults.map((r: any, i: number) => ({
            '#': i + 1,
            'Test Name': r.testTitle,
            'Score (%)': parseFloat(r.calculatedPercentage.toFixed(1)),
            'Earned Marks': r.earnedMarks ?? r.score ?? 0,
            'Total Marks': r.totalMarks ?? 100,
            'Time Taken': formatDuration(r.timeTaken),
            'Completed At': formatDate(r.completedAt),
        }));
        import('xlsx').then(XLSX => {
            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Performance');
            XLSX.writeFile(workbook, `my_performance_${new Date().toISOString().split('T')[0]}.xlsx`);
        });
    };

    if (loading) {
        return (
            <StudentLayout activeNav="performance" title="Performance Analytics" subtitle="Your test history and insights">
                <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <CardSkeleton lines={1} />
                        <CardSkeleton lines={1} />
                        <CardSkeleton lines={1} />
                        <CardSkeleton lines={1} />
                    </div>
                    <Skeleton className="h-48 sm:h-64 w-full rounded-xl" />
                    <Skeleton className="h-64 sm:h-96 w-full rounded-xl" />
                </div>
            </StudentLayout>
        );
    }

    // Chart constants - responsive
    const CHART_TOTAL_H = 240;
    const CHART_TOP_PAD = 24;
    const CHART_PLOT_H = CHART_TOTAL_H - CHART_TOP_PAD;

    // Tile color map
    const tileColors: Record<string, { hover: string; glow: string; iconGrad: string; iconBorder: string; ic: string }> = {
        blue: { hover: 'hover:border-blue-500/50', glow: 'from-blue-500/20', iconGrad: 'from-blue-500/20 to-blue-600/20', iconBorder: 'border-blue-500/30', ic: 'text-blue-400' },
        amber: { hover: 'hover:border-amber-500/50', glow: 'from-amber-500/20', iconGrad: 'from-amber-500/20 to-amber-600/20', iconBorder: 'border-amber-500/30', ic: 'text-amber-400' },
        emerald: { hover: 'hover:border-emerald-500/50', glow: 'from-emerald-500/20', iconGrad: 'from-emerald-500/20 to-emerald-600/20', iconBorder: 'border-emerald-500/30', ic: 'text-emerald-400' },
        violet: { hover: 'hover:border-violet-500/50', glow: 'from-violet-500/20', iconGrad: 'from-violet-500/20 to-violet-600/20', iconBorder: 'border-violet-500/30', ic: 'text-violet-400' },
        indigo: { hover: 'hover:border-indigo-500/50', glow: 'from-indigo-500/20', iconGrad: 'from-indigo-500/20 to-indigo-600/20', iconBorder: 'border-indigo-500/30', ic: 'text-indigo-400' },
        pink: { hover: 'hover:border-pink-500/50', glow: 'from-pink-500/20', iconGrad: 'from-pink-500/20 to-pink-600/20', iconBorder: 'border-pink-500/30', ic: 'text-pink-400' },
    };

    const statTiles = [
        { label: 'Tests Completed', value: stats.totalTests, icon: CheckCircle, a: 'blue' },
        { label: 'Average Score', value: `${stats.avgScore.toFixed(1)}%`, icon: TrendingUp, a: 'amber' },
        { label: 'Best Score', value: `${stats.bestScore.toFixed(1)}%`, icon: Award, a: 'emerald' },
        { label: 'Total Study', value: `${Math.floor(stats.totalTime / 3600)}h ${Math.floor((stats.totalTime % 3600) / 60)}m`, icon: Clock, a: 'violet' },
        { label: 'Pass Rate', value: `${stats.passRate.toFixed(0)}%`, icon: Target, a: 'indigo' },
        { label: 'Score Range', value: `${stats.worstScore.toFixed(0)}–${stats.bestScore.toFixed(0)}%`, icon: Activity, a: 'pink' },
    ];

    return (
        <StudentLayout
            activeNav="performance"
            title="Performance Analytics"
            subtitle="Your test history and insights"
        >
            <div className="w-full px-3 sm:px-5 pt-4 sm:pt-6 pb-16 sm:pb-20">

                {/* Controls Row: Time Range Filter + Export */}
                <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
                    {/* Time range pills */}
                    <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {[
                            { value: 'all', label: 'All Time' },
                            { value: '7d', label: '7 Days' },
                            { value: '30d', label: '30 Days' },
                            { value: '90d', label: '90 Days' }
                        ].map((range) => (
                            <button
                                key={range.value}
                                onClick={() => setSelectedTimeRange(range.value as any)}
                                className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap ${selectedTimeRange === range.value
                                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 shadow-lg shadow-amber-500/30 border border-amber-400/50'
                                    : 'bg-gray-900/60 border border-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-800/70 hover:border-gray-600/60'
                                    }`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>

                    {/* Export button */}
                    <button
                        onClick={exportToExcel}
                        className="group relative flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-gray-900/60 border border-gray-700/50 hover:bg-gray-800/70 hover:border-gray-600/60 text-gray-400 hover:text-white rounded-xl text-xs sm:text-sm font-medium transition-[color,background-color,border-color,transform] duration-200 overflow-hidden flex-shrink-0 active:scale-95"
                    >
                        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />
                        <Download className="h-3.5 w-3.5 relative z-10" />
                        <span className="relative z-10 hidden sm:inline">Export</span>
                    </button>
                </div>

                {/* Performance Insights */}
                {insights.length > 0 && showInsights && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 mb-4 sm:mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-indigo-400" />
                                Performance Insights
                            </h2>
                            <button
                                onClick={() => setShowInsights(false)}
                                title="Close insights"
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                            {insights.map((insight, idx) => {
                                const Icon = insight.icon;
                                return (
                                    <div
                                        key={idx}
                                        className={`flex items-start gap-3 p-3 rounded-lg border ${insight.type === 'success'
                                            ? 'bg-emerald-500/5 border-emerald-500/20'
                                            : insight.type === 'warning'
                                                ? 'bg-amber-500/5 border-amber-500/20'
                                                : 'bg-blue-500/5 border-blue-500/20'
                                            }`}
                                    >
                                        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${insight.type === 'success'
                                            ? 'text-emerald-400'
                                            : insight.type === 'warning'
                                                ? 'text-amber-400'
                                                : 'text-blue-400'
                                            }`} />
                                        <p className="text-xs sm:text-sm text-slate-300">{insight.message}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Stats Tiles — reference style */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
                    {statTiles.map(({ label, value, icon: Icon, a }) => {
                        const c = tileColors[a];
                        return (
                            <div key={label} className={`group relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-2xl p-3 sm:p-4 ${c.hover} transition-[color,background-color,border-color,transform] duration-300`}>
                                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${c.glow} to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500`} />
                                <div className="relative flex items-center gap-2.5 sm:gap-3">
                                    <div className={`p-1.5 sm:p-2 bg-gradient-to-br ${c.iconGrad} border ${c.iconBorder} rounded-lg flex-shrink-0`}>
                                        <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${c.ic}`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] sm:text-xs text-slate-400 font-medium leading-none mb-1">{label}</p>
                                        <p className={`text-base sm:text-lg font-bold ${c.ic} leading-none truncate`}>{value}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Score History Chart */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 mb-4 sm:mb-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-indigo-400" />
                            Performance History
                            {chartData.length > 0 && (
                                <span className="text-xs font-normal text-slate-500 ml-1">({chartData.length} tests)</span>
                            )}
                        </h2>
                        {chartData.length > 8 && (
                            <span className="text-[10px] sm:text-xs text-slate-500 flex items-center gap-1 shrink-0">
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M15 6l6 6-6 6" /></svg>
                                Scroll to explore
                            </span>
                        )}
                    </div>

                    {chartData.length > 0 ? (() => {
                        const PAD_X = 5;
                        const n = chartData.length;
                        const step = n > 1 ? (100 - PAD_X * 2) / (n - 1) : 0;

                        const pts = chartData.map((d, i) => ({
                            xPct: PAD_X + i * step,
                            yPct: 100 - d.score,
                            ...d,
                        }));
                        const polyPoints = pts.map(p => `${p.xPct},${p.yPct}`).join(' ');
                        const areaPoints = `${pts[0].xPct},100 ${polyPoints} ${pts[pts.length - 1].xPct},100`;

                        return (
                            <div className="flex select-none gap-0">
                                {/* Y-Axis labels */}
                                <div
                                    className="shrink-0 flex flex-col justify-between items-end pr-2 sm:pr-3 text-[10px] sm:text-[11px] font-medium text-slate-500"
                                    style={{ height: CHART_TOTAL_H, paddingTop: CHART_TOP_PAD }}
                                >
                                    <span>100</span>
                                    <span>75</span>
                                    <span>50</span>
                                    <span>25</span>
                                    <span>0</span>
                                </div>

                                {/* Chart column */}
                                <div className="flex-1 flex flex-col min-w-0">
                                    <div
                                        ref={scrollRef}
                                        className="overflow-x-auto touch-pan-x"
                                        style={{
                                            scrollbarWidth: 'thin',
                                            scrollbarColor: '#334155 transparent',
                                            cursor: 'grab',
                                            WebkitOverflowScrolling: 'touch'
                                        }}
                                        onMouseDown={handleMouseDown}
                                        onMouseMove={handleMouseMove}
                                        onMouseUp={handleMouseUp}
                                        onMouseLeave={handleMouseUp}
                                    >
                                        <div style={{ minWidth: Math.max(400, n * 80), paddingLeft: 8, paddingRight: 8 }}>
                                            <div style={{ height: CHART_TOP_PAD }} />

                                            {/* Plot area */}
                                            <div className="relative" style={{ height: CHART_PLOT_H }}>
                                                {/* Grid lines */}
                                                {[0, 25, 50, 75, 100].map(v => (
                                                    <div
                                                        key={v}
                                                        className="absolute left-0 right-0 border-t border-dashed border-slate-800/60"
                                                        style={{ top: `${100 - v}%` }}
                                                    />
                                                ))}

                                                {/* SVG: line + gradient area */}
                                                <svg
                                                    className="absolute inset-0 w-full h-full"
                                                    viewBox="0 0 100 100"
                                                    preserveAspectRatio="none"
                                                    style={{ overflow: 'visible' }}
                                                >
                                                    <defs>
                                                        <linearGradient id="perfAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.10" />
                                                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                                                        </linearGradient>
                                                    </defs>
                                                    <polygon points={areaPoints} fill="url(#perfAreaGrad)" />
                                                    <polyline
                                                        points={polyPoints}
                                                        fill="none"
                                                        stroke="#10b981"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        vectorEffect="non-scaling-stroke"
                                                        style={{
                                                            filter: 'drop-shadow(0 2px 6px rgba(16,185,129,0.35))',
                                                            strokeDasharray: 10000,
                                                            strokeDashoffset: 0,
                                                            animation: 'chartDraw 1.2s ease-out forwards',
                                                        }}
                                                    />
                                                </svg>

                                                {/* Data points + tooltips */}
                                                {pts.map((p, i) => {
                                                    const isFirst = i === 0;
                                                    const isLast = i === pts.length - 1;
                                                    const showBelow = p.score >= 50;
                                                    const tooltipPos = isFirst ? 'left-0' : isLast ? 'right-0' : 'left-1/2 -translate-x-1/2';
                                                    const arrowPos = isFirst ? 'ml-2' : isLast ? 'mr-2 ml-auto' : 'mx-auto';
                                                    return (
                                                        <Link
                                                            key={i}
                                                            to={`/results/${p.testId}`}
                                                            className="absolute z-10 group/dot"
                                                            style={{
                                                                left: `${p.xPct}%`,
                                                                top: `${p.yPct}%`,
                                                                transform: 'translate(-50%, -50%)',
                                                                animation: `chartPop 0.4s ease-out ${0.3 + i * 0.08}s backwards`,
                                                            }}
                                                        >
                                                            <span className="block w-5 h-5" />
                                                            {/* Tooltip */}
                                                            <div className={`pointer-events-none absolute ${tooltipPos} ${showBelow ? 'top-full mt-3 -translate-y-1 group-hover/dot:translate-y-0' : 'bottom-full mb-3 translate-y-1 group-hover/dot:translate-y-0'} opacity-0 group-hover/dot:opacity-100 transition-[width,transform] duration-200 z-50`}>
                                                                {showBelow && <div className={`w-2.5 h-2.5 bg-slate-800/95 border-l border-t border-slate-700/80 rotate-45 -mb-1.5 ${arrowPos}`} />}
                                                                <div className="bg-slate-800/95 border border-slate-700/80 rounded-xl shadow-2xl px-3 sm:px-4 py-2 sm:py-3 text-center min-w-[100px] sm:min-w-[120px]">
                                                                    <div className="text-lg sm:text-xl font-extrabold text-emerald-400 leading-tight">{p.score}%</div>
                                                                    <div className="text-[10px] sm:text-[11px] text-slate-300 font-medium truncate max-w-[120px] sm:max-w-[150px] mt-1">{p.title}</div>
                                                                    <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5">{p.date}</div>
                                                                </div>
                                                                {!showBelow && <div className={`w-2.5 h-2.5 bg-slate-800/95 border-r border-b border-slate-700/80 rotate-45 -mt-1.5 ${arrowPos}`} />}
                                                            </div>
                                                        </Link>
                                                    );
                                                })}
                                            </div>

                                            {/* X-axis labels */}
                                            <div className="relative h-6 sm:h-7">
                                                {pts.map((p, i) => (
                                                    <span
                                                        key={i}
                                                        className="absolute text-[10px] sm:text-[11px] text-slate-500 font-medium -translate-x-1/2 pt-2"
                                                        style={{ left: `${p.xPct}%` }}
                                                    >
                                                        {p.date}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="h-40 sm:h-48 flex flex-col items-center justify-center text-slate-500 gap-2">
                            <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-slate-700" />
                            <span className="text-xs sm:text-sm text-center px-4">No performance data yet. Take a test to see your chart!</span>
                        </div>
                    )}

                    <style>{`
                        @keyframes chartDraw { from { stroke-dashoffset: 10000 } to { stroke-dashoffset: 0 } }
                        @keyframes chartPop { from { opacity: 0; transform: translate(-50%, -50%) scale(0) } to { opacity: 1; transform: translate(-50%, -50%) scale(1) } }
                    `}</style>
                </div>

                {/* Detailed History Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-indigo-400" />
                            Detailed History
                        </h2>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:flex-initial sm:min-w-[240px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Filter by test name..."
                                    value={filterQuery}
                                    onChange={(e) => setFilterQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="block sm:hidden divide-y divide-slate-800">
                        {paginatedResults.length > 0 ? (
                            paginatedResults.map((result, idx) => (
                                <div key={result.id || idx} className="p-4 hover:bg-slate-800/30 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1 min-w-0 pr-3">
                                            <h3 className="font-medium text-white text-sm truncate mb-1" title={result.testTitle}>
                                                {result.testTitle}
                                            </h3>
                                            <p className="text-xs text-slate-400">
                                                {formatDateShort(result.completedAt)}
                                            </p>
                                        </div>
                                        <div className={`shrink-0 px-2.5 py-1 rounded-md text-sm font-bold ${result.calculatedPercentage >= 80
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                            result.calculatedPercentage >= 60
                                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                'bg-red-500/10 text-red-400 border border-red-500/20'
                                            }`}>
                                            {Math.round(result.calculatedPercentage)}%
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-400 flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatDuration(result.timeTaken)}
                                        </span>
                                        <Link
                                            to={`/results/${result.testId}`}
                                            className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                                        >
                                            View Details →
                                        </Link>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                No test history found.
                            </div>
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase font-semibold">
                                    <th className="p-4 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('testTitle')}>
                                        <div className="flex items-center gap-1">
                                            Test Name
                                            {sortConfig.key === 'testTitle' && (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="p-4 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('completedAt')}>
                                        <div className="flex items-center gap-1">
                                            Date
                                            {sortConfig.key === 'completedAt' && (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="p-4 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('score')}>
                                        <div className="flex items-center gap-1">
                                            Score
                                            {sortConfig.key === 'score' && (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="p-4">Time Taken</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {paginatedResults.length > 0 ? (
                                    paginatedResults.map((result, idx) => (
                                        <tr key={result.id || idx} className="hover:bg-slate-800/30 transition-colors group">
                                            <td className="p-4 font-medium text-white truncate max-w-[250px]" title={result.testTitle}>
                                                {result.testTitle}
                                            </td>
                                            <td className="p-4 text-slate-400 text-sm">
                                                {formatDate(result.completedAt)}
                                            </td>
                                            <td className="p-4">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-bold ${result.calculatedPercentage >= 80
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                    result.calculatedPercentage >= 60
                                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                        'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    }`}>
                                                    {Math.round(result.calculatedPercentage)}%
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-400 text-sm">
                                                {formatDuration(result.timeTaken)}
                                            </td>
                                            <td className="p-4 text-right">
                                                <Link
                                                    to={`/results/${result.testId}`}
                                                    className="inline-flex items-center text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                                                >
                                                    View Details
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-500">
                                            No test history found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {processedResults.length > resultsPerPage && (
                        <LightswindPagination
                            currentPage={historyPage}
                            totalPages={totalHistoryPages}
                            onPageChange={setHistoryPage}
                            showInfo
                            totalItems={processedResults.length}
                            itemsPerPage={resultsPerPage}
                            itemLabel="results"
                            className="border-t border-slate-800"
                        />
                    )}
                </div>
            </div>
        </StudentLayout>
    );
}