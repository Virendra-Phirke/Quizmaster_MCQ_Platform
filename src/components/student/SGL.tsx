import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutGrid,
  List,
  Clock,
  BookOpen,
  Award,
  CheckCircle,
  Zap,
  BarChart3,
} from 'lucide-react';
import { LegacyTest, LegacyTestResult } from '../../contexts/TestContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatDuration = (
  minutes: number,
  timePerQuestion?: number,
  questionCount?: number,
): string => {
  let totalSeconds = minutes * 60;
  if (timePerQuestion && questionCount) {
    totalSeconds = timePerQuestion * questionCount;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(hours.toString().padStart(2, '0'));
  parts.push(mins.toString().padStart(2, '0'));
  parts.push(secs.toString().padStart(2, '0'));
  return parts.join(':');
};

const defaultGetScoreColor = (
  score: number,
): { color: string; bgColor: string; label: string } => {
  if (score >= 81)
    return { color: 'text-emerald-400', bgColor: 'bg-emerald-500/15', label: 'Excellent' };
  if (score >= 61)
    return { color: 'text-green-400', bgColor: 'bg-green-500/15', label: 'Good' };
  if (score >= 41)
    return { color: 'text-amber-400', bgColor: 'bg-amber-500/15', label: 'Average' };
  if (score >= 21)
    return { color: 'text-orange-400', bgColor: 'bg-orange-500/15', label: 'Below Average' };
  return { color: 'text-red-400', bgColor: 'bg-red-500/15', label: 'Poor' };
};

// ─── Score computation (shared between grid & list cards) ────────────────────
function computeMarksBasedScore(
  test: LegacyTest,
  isCompleted: boolean,
  result: LegacyTestResult | undefined,
  allTests: LegacyTest[],
): number {
  if (!isCompleted || !result) return 0;

  // 1. Use server-computed score as primary source of truth (set by submit_test_result RPC)
  //    This is the most reliable value — avoids cases where earnedMarks=0 but score is correct.
  if (result.score != null && result.score > 0) return result.score;

  // 2. Derive from earnedMarks / totalMarks if available and non-zero
  if (
    result.earnedMarks != null &&
    result.totalMarks != null &&
    result.totalMarks > 0 &&
    result.earnedMarks > 0
  ) {
    return (result.earnedMarks / result.totalMarks) * 100;
  }

  // 3. Local fallback: recompute from raw answers + question data (for old results without marks)
  const fullTest = allTests.find((t) => t.id === test.id);
  if (fullTest?.questions?.length) {
    const totalMarks = fullTest.questions.reduce(
      (sum: number, q: any) => sum + (q.marks || 1),
      0,
    );
    const earnedMarks = fullTest.questions.reduce(
      (sum: number, q: any, idx: number) =>
        sum + (result.answers[idx] === q.correctAnswer ? (q.marks || 1) : 0),
      0,
    );
    return totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0;
  }

  // 4. Last resort: return stored score even if 0
  return result.score ?? 0;
}

// ─── Props ───────────────────────────────────────────────────────────────────
export interface SGLProps {
  /** Tests to render */
  tests: LegacyTest[];
  /** All tests in the system (needed for fallback score computation) */
  allTests: LegacyTest[];
  /** Completed test IDs for the current student */
  completedTestIds: string[];
  /** Student's results keyed by testId */
  results: LegacyTestResult[];
  /** Current view mode */
  viewMode: 'grid' | 'list';
  /** Callback when view mode changes */
  onViewModeChange: (mode: 'grid' | 'list') => void;
  /** Optional custom score-color function */
  getScoreColor?: (
    score: number,
  ) => { color: string; bgColor: string; label: string };
  /** Hide the built-in toggle buttons (if parent owns the toolbar) */
  hideToggle?: boolean;
  /** Extra class names on the outer wrapper */
  className?: string;
  /** Grid classes override (default: 'grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4') */
  gridClassName?: string;
  /** List wrapper classes override (default: 'flex flex-col gap-2.5 sm:gap-3') */
  listClassName?: string;
}

// ─── View Toggle Buttons ─────────────────────────────────────────────────────
export function SGLToggle({
  viewMode,
  onViewModeChange,
  className = '',
}: {
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-1 bg-slate-900 border border-slate-700/50 rounded-lg p-0.5 ${className}`}
    >
      <button
        onClick={() => onViewModeChange('grid')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-bold transition-colors text-xs ${viewMode === 'grid'
          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          : 'text-slate-400 hover:text-slate-300 border border-transparent'
          }`}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onViewModeChange('list')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-bold transition-colors text-xs ${viewMode === 'list'
          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          : 'text-slate-400 hover:text-slate-300 border border-transparent'
          }`}
        aria-label="List view"
      >
        <List className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Grid Card ───────────────────────────────────────────────────────────────
const StudentCardGrid = memo(function StudentCardGrid({
  test,
  isCompleted,
  result,
  allTests,
  getScoreColor,
}: {
  test: LegacyTest;
  isCompleted: boolean;
  result?: LegacyTestResult;
  allTests: LegacyTest[];
  getScoreColor: (score: number) => { color: string; bgColor: string; label: string };
}) {
  const questionCount = test.questionCount ?? test.questions.length;
  const totalMarks =
    test.totalMarks ??
    test.questions.reduce((sum: number, q: any) => sum + (q.marks || 1), 0);

  const marksBasedScore = useMemo(
    () => computeMarksBasedScore(test, isCompleted, result, allTests),
    [test, isCompleted, result, allTests],
  );

  const scoreColor = getScoreColor(marksBasedScore);

  return (
    <div className="group relative overflow-hidden bg-gradient-to-br from-slate-800/95 via-slate-900/95 to-slate-800/95 border border-slate-700/50 rounded-xl sm:rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-amber-500/10 hover:border-amber-500/30 transition-[color,background-color,border-color,box-shadow] duration-300 flex flex-col h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-transparent to-yellow-500/0 group-hover:from-amber-500/5 group-hover:to-yellow-500/5 transition-[color,background-color,border-color,box-shadow] duration-300" />
      <div className="relative p-3 sm:p-5 flex flex-col h-full z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-100 line-clamp-2 flex-1 min-w-0 leading-snug group-hover:text-amber-400 transition-colors duration-200">
            {test.title}
          </h3>
          {isCompleted ? (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
              <CheckCircle className="h-3 w-3" />
              <span className="hidden xs:inline">Done</span>
            </span>
          ) : (
            <span className="px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
              New
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">
          {test.description}
        </p>

        {/* Stats Pills */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md border border-amber-500/20">
            <Clock className="h-3 w-3" />
            <span>{formatDuration(test.duration, test.timePerQuestion, questionCount)}</span>
          </div>
          <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md border border-blue-500/20">
            <BookOpen className="h-3 w-3" />
            <span>{questionCount}</span>
          </div>
          <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-violet-400 bg-violet-500/10 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md border border-violet-500/20">
            <Award className="h-3 w-3" />
            <span>{totalMarks}m</span>
          </div>
        </div>

        {/* Score */}
        {isCompleted && result && (
          <div className="relative overflow-hidden bg-slate-900/60 border border-slate-700/50 rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${scoreColor.bgColor.replace('/15', '')} animate-pulse`}
                />
                <span className="text-[10px] sm:text-xs font-bold text-slate-400">
                  {scoreColor.label}
                </span>
              </div>
              <span className={`text-xl sm:text-2xl font-black ${scoreColor.color}`}>
                {marksBasedScore.toFixed(1)}%
              </span>
            </div>
            <div className="text-[9px] sm:text-xs text-slate-500 font-medium text-center mt-1">
              {result.earnedMarks != null && result.totalMarks != null && result.earnedMarks > 0
                ? `${result.earnedMarks}/${result.totalMarks} marks`
                : `${Math.round((marksBasedScore / 100) * totalMarks)}/${totalMarks} marks`}{' '}
              • {result.timeTaken ? Math.floor(result.timeTaken / 60) : 0}:
              {result.timeTaken
                ? (result.timeTaken % 60).toString().padStart(2, '0')
                : '00'}
              m
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="w-full mt-auto">
          {!isCompleted ? (
            <Link
              to={`/test/${test.id}`}
              className="group/btn relative z-20 touch-manipulation w-full flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl overflow-hidden bg-gradient-to-br from-white/20 to-white/10 hover:from-white/30 hover:to-white/15 text-white font-bold text-xs sm:text-sm shadow-lg shadow-white/10 hover:shadow-xl hover:shadow-white/20 transition-[color,background-color,border-color,box-shadow,transform] duration-300 hover:scale-[1.02] active:scale-[0.98] border border-white/30 hover:border-white/50"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent opacity-50 group-hover/btn:opacity-70 transition-opacity duration-300" />
              <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
              <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 relative z-10" />
              <span className="relative z-10">Start Test</span>
            </Link>
          ) : (
            <Link
              to={`/results/${test.id}`}
              className="group/btn relative z-20 touch-manipulation w-full flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl overflow-hidden bg-slate-800/60 hover:bg-slate-800/80 text-slate-200 hover:text-white font-bold text-xs sm:text-sm shadow-lg shadow-slate-900/50 hover:shadow-xl hover:shadow-slate-900/60 transition-[color,background-color,border-color,box-shadow,transform] duration-300 hover:scale-[1.02] active:scale-[0.98] border border-slate-600/50 hover:border-slate-500/60"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-50 group-hover/btn:opacity-70 transition-opacity duration-300" />
              <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 relative z-10" />
              <span className="relative z-10">View Results</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── List Card ───────────────────────────────────────────────────────────────
const StudentCardList = memo(function StudentCardList({
  test,
  isCompleted,
  result,
  allTests,
  getScoreColor,
}: {
  test: LegacyTest;
  isCompleted: boolean;
  result?: LegacyTestResult;
  allTests: LegacyTest[];
  getScoreColor: (score: number) => { color: string; bgColor: string; label: string };
}) {
  const questionCount = test.questionCount ?? test.questions.length;
  const totalMarks =
    test.totalMarks ??
    test.questions.reduce((sum: number, q: any) => sum + (q.marks || 1), 0);

  const marksBasedScore = useMemo(
    () => computeMarksBasedScore(test, isCompleted, result, allTests),
    [test, isCompleted, result, allTests],
  );

  const scoreColor = getScoreColor(marksBasedScore);

  return (
    <div className="group relative overflow-hidden bg-gradient-to-r from-slate-800/95 via-slate-900/95 to-slate-800/95 border border-slate-700/50 rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-500/30 transition-[color,background-color,border-color,box-shadow] duration-300">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-transparent to-yellow-500/0 group-hover:from-amber-500/5 group-hover:to-yellow-500/5 transition-[color,background-color,border-color,box-shadow] duration-300" />
      <div className="relative p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left Content */}
        <div className="flex-1 min-w-0 w-full sm:w-auto">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-100 leading-snug flex-1 group-hover:text-amber-400 transition-colors duration-200">
              {test.title}
            </h3>
            {isCompleted ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                <CheckCircle className="h-3 w-3" />
                Done
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 whitespace-nowrap">
                New
              </span>
            )}
          </div>
          {/* Stats */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded-md text-[10px] font-semibold text-amber-400 border border-amber-500/20">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(test.duration, test.timePerQuestion, questionCount)}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 rounded-md text-[10px] font-semibold text-blue-400 border border-blue-500/20">
              <BookOpen className="h-3 w-3" />
              <span>{questionCount}Q</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-violet-500/10 rounded-md text-[10px] font-semibold text-violet-400 border border-violet-500/20">
              <Award className="h-3 w-3" />
              <span>{totalMarks}m</span>
            </div>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex flex-row items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {isCompleted && result && (
            <div className="flex flex-col items-center justify-center bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2">
              <div className={`text-xl sm:text-2xl font-black ${scoreColor.color}`}>
                {marksBasedScore.toFixed(1)}%
              </div>
              <div className="text-[9px] text-slate-500 font-medium">
                {result.earnedMarks != null && result.totalMarks != null && result.earnedMarks > 0
                  ? `${result.earnedMarks}/${result.totalMarks}`
                  : `${Math.round((marksBasedScore / 100) * totalMarks)}/${totalMarks}`}
              </div>
            </div>
          )}
          <div className="flex-1 sm:w-40">
            {!isCompleted ? (
              <Link
                to={`/test/${test.id}`}
                className="group/btn relative z-20 touch-manipulation w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg overflow-hidden bg-gradient-to-br from-white/20 to-white/10 hover:from-white/30 hover:to-white/15 text-white font-bold text-xs sm:text-sm shadow-lg shadow-white/10 hover:shadow-xl hover:shadow-white/20 transition-[color,background-color,border-color,box-shadow,transform] duration-300 hover:scale-[1.02] active:scale-[0.98] border border-white/30 hover:border-white/50"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent opacity-50 group-hover/btn:opacity-70 transition-opacity duration-300" />
                <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
                <Zap className="h-3.5 w-3.5 relative z-10" />
                <span className="relative z-10">Start</span>
              </Link>
            ) : (
              <Link
                to={`/results/${test.id}`}
                className="group/btn relative z-20 touch-manipulation w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg overflow-hidden bg-slate-800/60 hover:bg-slate-800/80 text-slate-200 hover:text-white font-bold text-xs sm:text-sm shadow-lg shadow-slate-900/50 hover:shadow-xl hover:shadow-slate-900/60 transition-[color,background-color,border-color,box-shadow,transform] duration-300 hover:scale-[1.02] active:scale-[0.98] border border-slate-600/50 hover:border-slate-500/60"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-50 group-hover/btn:opacity-70 transition-opacity duration-300" />
                <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
                <BarChart3 className="h-3.5 w-3.5 relative z-10" />
                <span className="relative z-10">Results</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Main SGL Component ──────────────────────────────────────────────────────
export const SGL = memo(function SGL({
  tests,
  allTests,
  completedTestIds,
  results,
  viewMode,
  onViewModeChange,
  getScoreColor = defaultGetScoreColor,
  hideToggle = false,
  className = '',
  gridClassName = 'grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4',
  listClassName = 'flex flex-col gap-2.5 sm:gap-3',
}: SGLProps) {
  return (
    <div className={className}>
      {/* Toggle (only shown if not hidden) */}
      {!hideToggle && (
        <div className="flex justify-end mb-4">
          <SGLToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
        </div>
      )}

      {/* Content */}
      {viewMode === 'grid' ? (
        <div className={gridClassName}>
          {tests.map((test) => {
            const isCompleted = completedTestIds.includes(test.id);
            const result = results.find((r) => r.testId === test.id);
            return (
              <StudentCardGrid
                key={test.id}
                test={test}
                isCompleted={isCompleted}
                result={result}
                allTests={allTests}
                getScoreColor={getScoreColor}
              />
            );
          })}
        </div>
      ) : (
        <div className={listClassName}>
          {tests.map((test) => {
            const isCompleted = completedTestIds.includes(test.id);
            const result = results.find((r) => r.testId === test.id);
            return (
              <StudentCardList
                key={test.id}
                test={test}
                isCompleted={isCompleted}
                result={result}
                allTests={allTests}
                getScoreColor={getScoreColor}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

export default SGL;
