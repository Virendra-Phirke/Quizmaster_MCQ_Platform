import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutGrid,
    List,
    BookOpen,
    Users,
    TrendingUp,
    BarChart3,
    Share2,
    Eye,
    EyeOff,
    Edit,
    Trash2,
    CheckCircle,
    Award,
    Clock,
} from 'lucide-react';
import { LegacyTest, LegacyTestResult } from '../../contexts/TestContext';

interface TGLProps {
    tests: LegacyTest[];
    results: LegacyTestResult[];
    copiedTestId: string | null;
    onShare: (testId: string) => void;
    onToggleStatus: (testId: string) => void;
    onEdit: (testId: string) => void;
    onDelete: (testId: string, title: string) => void;
    viewMode: 'tile' | 'list';
    onViewModeChange: (mode: 'tile' | 'list') => void;
    /** Hide the built-in toggle buttons (if parent owns the toolbar) */
    hideToggle?: boolean;
    /** Extra class names on the outer wrapper */
    className?: string;
}

// ─── View Toggle Buttons ─────────────────────────────────────────────────────
export function TGLToggle({
    viewMode,
    onViewModeChange,
    className = '',
}: {
    viewMode: 'tile' | 'list';
    onViewModeChange: (mode: 'tile' | 'list') => void;
    className?: string;
}) {
    return (
        <div className={`flex items-center bg-gray-900/70 border border-gray-800 rounded-xl p-1 gap-0.5 ${className}`}>
            <button
                onClick={() => onViewModeChange('tile')}
                title="Tile view"
                className={`p-2 rounded-lg transition-colors ${viewMode === 'tile'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:text-white'
                    }`}
            >
                <LayoutGrid className="w-4 h-4" />
            </button>
            <button
                onClick={() => onViewModeChange('list')}
                title="List view"
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:text-white'
                    }`}
            >
                <List className="w-4 h-4" />
            </button>
        </div>
    );
}

// ─── List View Item ──────────────────────────────────────────────────────────
const ListItem = React.memo(function ListItem({
    test,
    results,
    copiedTestId,
    onShare,
    onToggleStatus,
    onEdit,
    onDelete,
}: {
    test: LegacyTest;
    results: LegacyTestResult[];
    copiedTestId: string | null;
    onShare: (testId: string) => void;
    onToggleStatus: (testId: string) => void;
    onEdit: (testId: string) => void;
    onDelete: (testId: string, title: string) => void;
}) {
    const navigate = useNavigate();

    const stats = useMemo(() => {
        const testResults = results.filter((r) => r.testId === test.id);
        const totalMarks =
            test.totalMarks ??
            test.questions?.reduce((s: number, q: any) => s + (q.marks || 1), 0) ??
            0;

        let avg = 0;
        if (testResults.length > 0) {
            avg =
                testResults
                    .map((r) => {
                        if (
                            r.earnedMarks != null &&
                            r.totalMarks != null &&
                            r.totalMarks > 0
                        )
                            return (r.earnedMarks / r.totalMarks) * 100;
                        return r.score;
                    })
                    .reduce((s, v) => s + v, 0) / testResults.length;
        }

        const avgColor =
            avg >= 80
                ? 'text-emerald-400'
                : avg >= 60
                    ? 'text-amber-400'
                    : avg > 0
                        ? 'text-red-400'
                        : 'text-gray-500';

        return { submissions: testResults.length, totalMarks, avg, avgColor };
    }, [test, results]);

    return (
        <div
            onClick={() => navigate(`/teacher/test/${test.id}`)}
            className="group relative bg-gray-900/60 border border-gray-800/60 hover:border-gray-700/80 rounded-2xl overflow-hidden cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] duration-200 hover:shadow-lg hover:shadow-black/30 active:scale-[0.99]"
        >
            {/* Left accent bar */}
            <div
                className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-2xl transition-[color,background-color,border-color,box-shadow,transform] duration-200 ${test.isPublic
                    ? 'bg-gradient-to-b from-emerald-500 to-teal-600'
                    : 'bg-gradient-to-b from-gray-600 to-gray-700'
                    } group-hover:w-1`}
            />

            <div className="pl-4 pr-4 pt-4 pb-3 sm:pl-5 sm:pr-5 sm:pt-4 sm:pb-4">
                {/* Row 1: Title + Status badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-semibold text-white truncate group-hover:text-pink-300 transition-colors leading-snug">
                            {test.title}
                        </p>
                        {test.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                {test.description}
                            </p>
                        )}
                    </div>
                    <span
                        className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${test.isPublic
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-gray-800/60 text-gray-500 border-gray-700/50'
                            }`}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${test.isPublic ? 'bg-emerald-400' : 'bg-gray-600'
                                }`}
                        />
                        {test.isPublic ? 'Public' : 'Private'}
                    </span>
                </div>

                {/* Row 2: Stats chips */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/15 rounded-lg">
                        <BookOpen className="w-3 h-3 text-blue-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-blue-300">
                            {test.questions?.length || test.questionCount || 0} Qs
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/15 rounded-lg">
                        <BarChart3 className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-amber-300">
                            {stats.totalMarks} Marks
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/60 border border-slate-700/40 rounded-lg">
                        <Users className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-slate-300">
                            {stats.submissions} Submissions
                        </span>
                    </div>
                    {stats.submissions > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800/60 border border-gray-700/40 rounded-lg">
                            <TrendingUp className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className={`text-xs font-semibold ${stats.avgColor}`}>
                                {stats.avg.toFixed(0)}% avg
                            </span>
                        </div>
                    )}
                </div>

                {/* Row 3: Action buttons */}
                <div
                    className="flex items-center gap-2 pt-3 border-t border-gray-800/50"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Share */}
                    <button
                        onClick={() => onShare(test.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-[color,background-color,border-color,transform] active:scale-95 touch-manipulation ${copiedTestId === test.id
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-600'
                            }`}
                    >
                        {copiedTestId === test.id ? (
                            <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Copied</span>
                            </>
                        ) : (
                            <>
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Share</span>
                            </>
                        )}
                    </button>

                    {/* Toggle visibility */}
                    <button
                        onClick={() => onToggleStatus(test.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800/60 border border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-600 transition-[color,background-color,border-color,transform] active:scale-95 touch-manipulation"
                    >
                        {test.isPublic ? (
                            <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Make Private</span>
                            </>
                        ) : (
                            <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Make Public</span>
                            </>
                        )}
                    </button>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Edit */}
                    <button
                        onClick={() => onEdit(test.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 transition-[color,background-color,border-color,transform] active:scale-95 touch-manipulation"
                        title="Edit test"
                    >
                        <Edit className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                        onClick={() => onDelete(test.id, test.title)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 transition-[color,background-color,border-color,transform] active:scale-95 touch-manipulation"
                        title="Delete test"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
});

// ─── Duration Helper ─────────────────────────────────────────────────────────
const formatDuration = (minutes: number, timePerQuestion?: number, questionCount?: number): string => {
    let totalSeconds = minutes * 60;
    if (timePerQuestion && questionCount) {
        totalSeconds = timePerQuestion * questionCount;
    }
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

// ─── Tile View Item ──────────────────────────────────────────────────────────
const TileItem = React.memo(function TileItem({
    test,
    results,
    copiedTestId,
    onShare,
    onToggleStatus,
    onEdit,
    onDelete,
}: {
    test: LegacyTest;
    results: LegacyTestResult[];
    copiedTestId: string | null;
    onShare: (testId: string) => void;
    onToggleStatus: (testId: string) => void;
    onEdit: (testId: string) => void;
    onDelete: (testId: string, title: string) => void;
}) {
    const navigate = useNavigate();

    const stats = useMemo(() => {
        const testResults = results.filter((r) => r.testId === test.id);
        let averageScore = 0;
        if (testResults.length > 0) {
            const scores = testResults.map((r) => {
                if (r.earnedMarks != null && r.totalMarks != null && r.totalMarks > 0) {
                    return (r.earnedMarks / r.totalMarks) * 100;
                }
                return r.score;
            });
            averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        }
        const questionCount = test.questionCount ?? (test.questions?.length || 0);
        const totalMarks = test.totalMarks ?? (test.questions?.reduce((s: number, q: any) => s + (q.marks || 1), 0) || 0);
        return { questions: questionCount, marks: totalMarks, submissions: testResults.length, average: averageScore };
    }, [test.id, test.questions, test.questionCount, test.totalMarks, results]);

    return (
        <div
            onClick={() => navigate(`/teacher/test/${test.id}`)}
            className="group relative overflow-hidden bg-gradient-to-br from-slate-800/95 via-slate-900/95 to-slate-800/95 border border-slate-700/50 rounded-xl shadow-lg hover:shadow-2xl hover:shadow-amber-500/10 hover:border-amber-500/30 transition-[color,background-color,border-color,box-shadow] duration-300 cursor-pointer"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-transparent to-yellow-500/0 group-hover:from-amber-500/5 group-hover:to-yellow-500/5 transition-[color,background-color,border-color,box-shadow] duration-300" />
            <div className="relative p-2 sm:p-4 z-10">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xs sm:text-base font-bold text-slate-100 line-clamp-2 leading-snug group-hover:text-amber-400 transition-colors duration-200 mb-0.5">
                            {test.title}
                        </h3>
                        <p className="text-[9px] sm:text-xs text-slate-500 line-clamp-1">{test.description}</p>
                    </div>
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-bold whitespace-nowrap flex-shrink-0 ${
                        test.isPublic
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-700/30 text-slate-400 border border-slate-700/50'
                    }`}>
                        {test.isPublic ? 'Public' : 'Private'}
                    </span>
                </div>

                {/* Stats Pills */}
                <div className="flex flex-wrap items-center gap-1 mb-2">
                    <div className="inline-flex items-center gap-0.5 text-[9px] sm:text-xs font-semibold text-blue-400 bg-blue-500/10 px-1 sm:px-2 py-0.5 rounded border border-blue-500/20">
                        <BookOpen className="h-2 w-2 sm:h-3 sm:w-3" />
                        <span>{stats.questions}Q</span>
                    </div>
                    <div className="inline-flex items-center gap-0.5 text-[9px] sm:text-xs font-semibold text-violet-400 bg-violet-500/10 px-1 sm:px-2 py-0.5 rounded border border-violet-500/20">
                        <Award className="h-2 w-2 sm:h-3 sm:w-3" />
                        <span>{stats.marks}m</span>
                    </div>
                    <div className="inline-flex items-center gap-0.5 text-[9px] sm:text-xs font-semibold text-amber-400 bg-amber-500/10 px-1 sm:px-2 py-0.5 rounded border border-amber-500/20">
                        <Clock className="h-2 w-2 sm:h-3 sm:w-3" />
                        <span>{formatDuration(test.duration, test.timePerQuestion, stats.questions)}</span>
                    </div>
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                    <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-1.5">
                        <div className="flex items-center gap-1 mb-0.5">
                            <div className="p-0.5 rounded bg-purple-500/10">
                                <Users className="w-2 h-2 sm:w-3 sm:h-3 text-purple-400" />
                            </div>
                            <span className="text-[8px] sm:text-[10px] text-slate-500 font-medium">Submissions</span>
                        </div>
                        <p className="text-sm sm:text-lg font-black text-slate-100">{stats.submissions}</p>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-1.5">
                        <div className="flex items-center gap-1 mb-0.5">
                            <div className="p-0.5 rounded bg-emerald-500/10">
                                <TrendingUp className="w-2 h-2 sm:w-3 sm:h-3 text-emerald-400" />
                            </div>
                            <span className="text-[8px] sm:text-[10px] text-slate-500 font-medium">Average</span>
                        </div>
                        <p className={`text-sm sm:text-lg font-black ${
                            stats.average >= 80 ? 'text-emerald-400' :
                            stats.average >= 60 ? 'text-amber-400' : 'text-orange-400'
                        }`}>
                            {stats.average.toFixed(1)}%
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 pt-2 border-t border-slate-700/40">
                    <button
                        onClick={(e) => { e.stopPropagation(); onShare(test.id); }}
                        className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 sm:py-2 rounded-lg transition-colors duration-200 border ${
                            copiedTestId === test.id
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-800/60 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-700/50 hover:border-slate-600/60'
                        }`}
                        title="Copy test link"
                    >
                        {copiedTestId === test.id ? <CheckCircle className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" /> : <Share2 className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />}
                        <span className="text-[9px] sm:text-xs font-bold hidden xs:inline">Share</span>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleStatus(test.id); }}
                        className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 sm:py-2 bg-slate-800/60 hover:bg-slate-800/80 rounded-lg transition-colors duration-200 text-slate-400 hover:text-slate-200 border border-slate-700/50 hover:border-slate-600/60"
                        title={test.isPublic ? 'Make Private' : 'Make Public'}
                    >
                        {test.isPublic ? <Eye className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" /> : <EyeOff className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />}
                        <span className="text-[9px] sm:text-xs font-bold hidden xs:inline">{test.isPublic ? 'Hide' : 'Show'}</span>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(test.id); }}
                        className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 sm:py-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors duration-200 text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50"
                        title="Edit test"
                    >
                        <Edit className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                        <span className="text-[9px] sm:text-xs font-bold hidden xs:inline">Edit</span>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(test.id, test.title); }}
                        className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 sm:py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors duration-200 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50"
                        title="Delete test"
                    >
                        <Trash2 className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                        <span className="text-[9px] sm:text-xs font-bold hidden xs:inline">Delete</span>
                    </button>
                </div>
            </div>
        </div>
    );
});

// ─── Main TGL Component ──────────────────────────────────────────────────────
export const TGL = React.memo(function TGL({
    tests,
    results,
    copiedTestId,
    onShare,
    onToggleStatus,
    onEdit,
    onDelete,
    viewMode,
    onViewModeChange,
    hideToggle = false,
    className = '',
}: TGLProps) {
    return (
        <div className={className}>
            {/* Toggle (only shown if not hidden) */}
            {!hideToggle && (
                <div className="flex justify-end mb-4">
                    <TGLToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
                </div>
            )}

            {/* Content */}
            {viewMode === 'tile' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                    {tests.map((test) => (
                        <TileItem
                            key={test.id}
                            test={test}
                            results={results}
                            copiedTestId={copiedTestId}
                            onShare={onShare}
                            onToggleStatus={onToggleStatus}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    {tests.map((test) => (
                        <ListItem
                            key={test.id}
                            test={test}
                            results={results}
                            copiedTestId={copiedTestId}
                            onShare={onShare}
                            onToggleStatus={onToggleStatus}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

export default TGL;
