import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useTestForResultsQuery, useSingleTestResultQuery } from '../../hooks/quizQueries';
import { LegacyTest, LegacyTestResult } from '../../contexts/TestContext';
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Trophy, Award, TrendingUp,
  BarChart3, BookOpen, AlertCircle,
  ChevronDown, ChevronUp, Filter, Eye, EyeOff, Home
} from 'lucide-react';
import { canonicalizeRole } from '../../lib/roleUtils';
import { Skeleton, CardSkeleton } from '../../components/shared/Skeleton';
import { isMCQ } from '../../types/question';

function TestResults() {
  const { testId } = useParams<{ testId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const studentIdParam = searchParams.get('student');

  const testQuery = useTestForResultsQuery(testId);
  const singleResultQuery = useSingleTestResultQuery(testId, studentIdParam);

  const isTestLoading = testQuery.isLoading;
  const isResultsLoading = singleResultQuery.isLoading;
  const isTestError = testQuery.isError;
  const isResultsError = singleResultQuery.isError;

  // Check if we have a cached result in localStorage (from submission on this device)
  const hasCachedResult = useMemo(() => {
    if (singleResultQuery.data) return true;
    try { return !!localStorage.getItem(`quizmaster_result_${testId}`); } catch { return false; }
  }, [singleResultQuery.data, testId]);

  // We MUST wait for isTestLoading because test data is required to decode correctness.
  // We can only bypass isResultsLoading if we have cached results.
  const loading = (isTestLoading || (isResultsLoading && !hasCachedResult)) && !isTestError && !isResultsError;

  // New state for UI features & timeout safety
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'correct' | 'incorrect' | 'skipped'>('all');
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Safety timeout: if loading for more than 8 seconds, auto-refetch queries then show manual refresh
  useEffect(() => {
    if (loading) {
      // First timeout: auto-refetch at 5 seconds (helps Android slow network)
      const autoRetry = setTimeout(() => {
        if (testQuery.isLoading || testQuery.isError) testQuery.refetch();
        if (singleResultQuery.isLoading || singleResultQuery.isError) singleResultQuery.refetch();
      }, 5000);
      // Second timeout: show manual refresh button at 10 seconds
      const timer = setTimeout(() => {
        setHasTimedOut(true);
      }, 10000);
      return () => { clearTimeout(timer); clearTimeout(autoRetry); };
    } else {
      setHasTimedOut(false);
    }
  }, [loading]);

  const handleManualRefresh = () => {
    // Try refetching queries first before a full page reload
    testQuery.refetch();
    singleResultQuery.refetch();
    // If still stuck after 3 seconds, do a hard reload
    setTimeout(() => {
      if (testQuery.isLoading || singleResultQuery.isLoading) {
        window.location.reload();
      }
    }, 3000);
  };

  const userRole = canonicalizeRole(user?.unsafeMetadata?.role as string | undefined);
  const isTeacherView = userRole === 'teacher' && !!studentIdParam;

  const test: LegacyTest | null | undefined = testQuery.data;

  // Fallback: Use localStorage cached result when query returns null
  // This fixes Android where RLS/auth issues prevent the query from returning data
  // even though the submission succeeded (the same test ID works on PC)
  const myResult: LegacyTestResult | null | undefined = useMemo(() => {
    // Prefer query data when available
    if (singleResultQuery.data) {
      // Clean up cache since live data is now available
      try { localStorage.removeItem(`quizmaster_result_${testId}`); } catch (e) { /* ignore */ }
      return singleResultQuery.data;
    }
    // Fallback: read from localStorage (cached during submission)
    if (!testId) return null;
    try {
      const stored = localStorage.getItem(`quizmaster_result_${testId}`);
      if (!stored) return null;
      const p = JSON.parse(stored);
      return {
        id: p.resultId || 'cached',
        testId: p.testId || testId,
        studentId: p.studentId || '',
        studentName: p.studentName || 'Student',
        score: p.score ?? 0,
        earnedMarks: p.earnedMarks,
        totalMarks: p.totalMarks,
        totalQuestions: p.totalQuestions ?? 0,
        timeTaken: p.timeTaken ?? 0,
        answers: p.answers ?? [],
        completedAt: p.completedAt || new Date().toISOString()
      } as LegacyTestResult;
    } catch (e) { return null; }
  }, [singleResultQuery.data, testId]);

  // Calculate statistics
  const correctAnswers = useMemo(() => {
    if (!myResult || !test) return 0;
    const safeAnswers = myResult.answers || [];
    return safeAnswers.filter((answer, index) =>
      answer === test.questions[index]?.correctAnswer
    ).length;
  }, [myResult, test]);

  const totalMarks = useMemo(() => test?.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || myResult?.totalMarks || 0, [test, myResult]);

  const earnedMarks = useMemo(() => {
    if (!test || !myResult) return myResult?.earnedMarks ?? 0;
    const safeAnswers = myResult.answers || [];

    const marksBeforeClamping = test.questions.reduce((sum, q, idx) => {
      const userAns = safeAnswers[idx];
      const correctAns = q.correctAnswer;
      const isCorrect = userAns === correctAns;
      const questionMarks = q.marks || 1;

      if (isCorrect) {
        return sum + questionMarks;
      }

      const isAnswered = userAns >= 0;

      if (isAnswered && !isCorrect) {
        if (test.negativeMarkingEnabled) {
          return sum - (test.negativeMarks || 1);
        } else {
          return sum;
        }
      }

      return sum;
    }, 0);

    return Math.max(0, marksBeforeClamping);
  }, [test, myResult]);

  const calculatedScore = useMemo(() => {
    if (totalMarks > 0) {
      return (earnedMarks / totalMarks) * 100;
    }
    return 0;
  }, [earnedMarks, totalMarks]);

  const displayScore = useMemo(() => {
    if (!myResult) return 0;
    // Prefer locally-calculated score (from answers + questions) — the DB score can be 0 due to a SQL issue.
    // Only fall back to myResult.score when we have no test data to compute from.
    if (test?.questions?.length) return calculatedScore;
    // Fallback: if we have no test data yet but have a non-zero DB score, show that
    return myResult.score > 0 ? myResult.score : calculatedScore;
  }, [test, myResult, calculatedScore]);

  // Advanced statistics
  const stats = useMemo(() => {
    if (!test || !myResult) return null;
    const safeAnswers = myResult.answers || [];

    const skipped = safeAnswers.filter(ans => ans === undefined || ans === null || ans === -1).length;
    const incorrect = test.questions.length - correctAnswers - skipped;
    const avgTimePerQuestion = myResult.timeTaken / test.questions.length;

    // classAverage calculates across all results for this test. Since we only fetched a single result,
    // we cannot accurately display a class average or rank here without a separate aggregation query.
    // For now, we omit them or default to the student's own score.
    const classAverage = displayScore;

    let negativeDeduction = 0;
    let rawEarned = 0;
    let correctCount = 0;
    let incorrectCount = 0;

    if (test?.negativeMarkingEnabled) {
      const safeAnswers = myResult.answers || [];
      test.questions.forEach((q, idx) => {
        const userAns = safeAnswers[idx];
        const isCorrect = userAns === q.correctAnswer;
        const isAnswered = userAns !== undefined && userAns !== null && userAns >= 0;

        if (isCorrect) {
          rawEarned += (q.marks || 1);
          correctCount += 1;
        } else if (isAnswered) {
          negativeDeduction += (test.negativeMarks || 1);
          incorrectCount += 1;
        }
      });
    }

    return {
      skipped,
      incorrect,
      attempted: test.questions.length - skipped,
      avgTimePerQuestion,
      classAverage,
      rank: 1, // Full rank feature requires fetching all students' results
      totalStudents: 1,
      negativeDeduction,
      rawEarned,
      correctCount,
      incorrectCount
    };
  }, [test, myResult, correctAnswers, displayScore]);

  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const getScoreGradient = useCallback((score: number) => {
    if (score >= 90) return 'from-emerald-500 via-green-500 to-teal-500';
    if (score >= 70) return 'from-blue-500 via-indigo-500 to-purple-500';
    if (score >= 50) return 'from-amber-500 via-orange-500 to-yellow-500';
    return 'from-red-500 via-rose-500 to-pink-500';
  }, []);

  const getPerformanceMessage = useCallback((score: number) => {
    if (score >= 90) return { message: 'Outstanding Performance!', emoji: '🎉', color: 'text-emerald-500' };
    if (score >= 70) return { message: 'Great Job!', emoji: '👏', color: 'text-blue-500' };
    if (score >= 50) return { message: 'Good Effort!', emoji: '👍', color: 'text-amber-500' };
    return { message: 'Keep Practicing!', emoji: '💪', color: 'text-red-500' };
  }, []);

  const toggleQuestion = (index: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedQuestions(newExpanded);
  };

  const toggleAllQuestions = () => {
    if (expandedQuestions.size === filteredQuestions.length) {
      setExpandedQuestions(new Set());
    } else {
      // Use actual question indices, not filtered indices
      setExpandedQuestions(new Set(filteredQuestions.map(({ index }) => index)));
    }
  };

  // Filter questions based on selected filter
  const filteredQuestions = useMemo(() => {
    if (!test || !myResult) return [];
    const safeAnswers = myResult.answers || [];

    return test.questions.map((q, idx) => ({ question: q, index: idx })).filter(({ question, index }) => {
      const userAns = safeAnswers[index];
      const correctAns = question.correctAnswer;
      const isCorrect = userAns === correctAns;
      const isSkipped = userAns === undefined || userAns === null || userAns === -1;

      if (filterType === 'all') return true;
      if (filterType === 'correct') return isCorrect;
      if (filterType === 'incorrect') return !isCorrect && !isSkipped;
      if (filterType === 'skipped') return isSkipped;
      return true;
    });
  }, [test, myResult, filterType]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
          <div className="flex items-center space-x-3 sm:space-x-4 mb-6 sm:mb-8">
            <Skeleton className="h-6 w-20 sm:w-32" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 sm:h-8 w-48 sm:w-64" />
              <Skeleton className="h-3 sm:h-4 w-32 sm:w-40" />
            </div>
          </div>
          <div className="rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 p-6 sm:p-8 lg:p-12 shadow-2xl shadow-slate-200/50 dark:shadow-slate-950/50 mb-6 sm:mb-8">
            <div className="text-center space-y-4 sm:space-y-6">
              <Skeleton className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 mx-auto rounded-full" />
              <Skeleton className="h-12 sm:h-16 lg:h-20 w-32 sm:w-48 lg:w-64 mx-auto" />
              <Skeleton className="h-4 sm:h-5 lg:h-6 w-40 sm:w-56 lg:w-64 mx-auto" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mt-8 sm:mt-10 max-w-2xl mx-auto">
              <CardSkeleton lines={2} />
              <CardSkeleton lines={2} />
            </div>
          </div>
          <div className="space-y-4 sm:space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} lines={5} />
            ))}
          </div>
          {hasTimedOut && (
            <div className="mt-8 text-center animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 mb-6 text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                <span>Syncing might be taking longer than usual...</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={handleManualRefresh}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 transform hover:scale-105 active:scale-95"
                >
                  Manual Refresh Results
                </button>
                <button
                  onClick={() => navigate('/student')}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95"
                >
                  Go to Dashboard
                </button>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                You can try refreshing manually if results don't show up shortly.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!myResult) {
    // Still loading or retrying — keep showing the skeleton/loading state
    if (isResultsLoading || singleResultQuery.isFetching) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin inline-block w-12 h-12 border-4 border-blue-200 dark:border-slate-700 border-t-blue-600 rounded-full mb-4"></div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Loading your results...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <div className="text-center rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-800/90 shadow-2xl p-6 sm:p-8 lg:p-10 max-w-md w-full">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl"></div>
            <XCircle className="relative h-16 w-16 sm:h-20 sm:w-20 text-red-500 mx-auto" />
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent mb-3">
            Results Not Found
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6">
            {isTeacherView
              ? 'Unable to find results for this student.'
              : 'Unable to find your test results.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="group relative inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transition-[box-shadow,transform] duration-300 hover:scale-105"
            >
              <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              <span>Go Back</span>
            </button>
            <button
              onClick={() => navigate(userRole === 'teacher' ? '/teacher' : '/student')}
              className="group relative inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-white font-semibold shadow-lg transition-[color,background-color,border-color,transform] duration-300 hover:scale-105"
            >
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <div className="text-center rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-800/90 shadow-2xl p-6 sm:p-8 lg:p-10 max-w-md w-full">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl"></div>
            <AlertCircle className="relative h-16 w-16 sm:h-20 sm:w-20 text-amber-500 mx-auto" />
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent mb-3">
            Failed to Load Test Data
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6">
            We recovered your answers, but couldn't fetch the questions right now. Please check your internet connection and try again.
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={handleManualRefresh}
              className="group relative inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transition-[box-shadow,transform] duration-300 hover:scale-105"
            >
              <span>Reload Results</span>
            </button>
            <button
              onClick={() => navigate(userRole === 'teacher' ? '/teacher' : '/student')}
              className="group relative inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-white font-semibold shadow-lg transition-[color,background-color,border-color,transform] duration-300 hover:scale-105"
            >
              <Home className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const performance = getPerformanceMessage(displayScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Enhanced Header with Actions */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex items-center justify-between py-3 sm:py-4 lg:py-5 gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0 flex-1">
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigate(-1)}
                  className="group flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 hover:shadow-md"
                  title="Go back"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:-translate-x-1" />
                  <span className="text-xs sm:text-sm lg:text-base hidden sm:inline">Back</span>
                </button>
                <button
                  onClick={() => navigate(userRole === 'teacher' ? '/teacher' : '/student')}
                  className="group flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-[color,background-color,border-color,box-shadow] duration-200 hover:shadow-md"
                  title="Go to dashboard"
                >
                  <Home className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-xs sm:text-sm lg:text-base hidden sm:inline">Home</span>
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-lg lg:text-2xl xl:text-3xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 dark:from-slate-100 dark:via-blue-100 dark:to-indigo-100 bg-clip-text text-transparent truncate">
                  {isTeacherView ? `${myResult.studentName}'s Results` : 'Test Results'}
                </h1>
                <p className="text-xs sm:text-sm lg:text-base text-slate-600 dark:text-slate-400 truncate mt-0.5">{test?.title || 'Test'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        {/* Teacher View Badge */}
        {isTeacherView && (
          <div className="mb-4 sm:mb-6 lg:mb-8 rounded-xl sm:rounded-2xl border border-blue-200/60 dark:border-blue-800/60 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 p-4 sm:p-5 lg:p-6 flex items-center gap-3 sm:gap-4 shadow-lg shadow-blue-100/50 dark:shadow-blue-950/50">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-xl"></div>
              <div className="relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm sm:text-base lg:text-lg text-blue-900 dark:text-blue-100">Teacher View</p>
              <p className="text-xs sm:text-sm lg:text-base text-blue-700 dark:text-blue-300 truncate mt-0.5">
                Viewing {myResult.studentName}'s detailed submission
              </p>
            </div>
          </div>
        )}

        {/* Performance Badge */}
        <div className="mb-6 sm:mb-8 rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-800/95 p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl">{performance.emoji}</span>
              <div>
                <h3 className={`text-lg sm:text-xl font-bold ${performance.color}`}>{performance.message}</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Submitted on {new Date(myResult.completedAt || Date.now()).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
            {stats && stats.totalStudents > 1 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Rank {stats.rank}/{stats.totalStudents}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Score & Stats Section */}
        <div className="rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-slate-700/60 bg-slate-900 shadow-xl p-6 sm:p-8 lg:p-10 mb-8">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            {/* Left: Score Circle */}
            <div className="flex-1 flex flex-col items-center">
              <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-800" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#scoreGradient)"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - displayScore / 100)}`}
                    strokeLinecap="round"
                    className="transition-[stroke-dashoffset] duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={displayScore >= 90 ? '#10B981' : displayScore >= 50 ? '#3B82F6' : '#EF4444'} />
                      <stop offset="100%" stopColor={displayScore >= 90 ? '#059669' : displayScore >= 50 ? '#8B5CF6' : '#EC4899'} />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <span className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Your Score</span>
                  <span className={`text-5xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-br ${getScoreGradient(displayScore)} bg-clip-text text-transparent`}>
                    {displayScore.toFixed(1)}%
                  </span>
                  <div className="flex items-center gap-2 mt-2 text-sm sm:text-base font-medium text-slate-300">
                    <span>{correctAnswers}/{test?.questions?.length || myResult?.totalQuestions || 0} Correct</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Enhanced Stats Grid */}
            <div className="flex-1 w-full grid grid-cols-2 gap-3 sm:gap-4">
              {/* Time Card */}
              <div className="bg-slate-800/50 rounded-xl p-4 sm:p-5 border border-slate-700/50 flex flex-col items-center justify-center text-center hover:bg-slate-800/80 transition-[color,background-color,border-color,transform] hover:scale-105">
                <div className="p-2 sm:p-3 bg-blue-500/10 rounded-full mb-2 sm:mb-3">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white mb-1">{formatTime(myResult?.timeTaken || 0)}</div>
                <div className="text-xs sm:text-sm text-slate-400">Time Taken</div>
              </div>

              {/* Correct Answers Card */}
              <div className="bg-slate-800/50 rounded-xl p-4 sm:p-5 border border-slate-700/50 flex flex-col items-center justify-center text-center hover:bg-slate-800/80 transition-[color,background-color,border-color,transform] hover:scale-105">
                <div className="p-2 sm:p-3 bg-emerald-500/10 rounded-full mb-2 sm:mb-3">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white mb-1">{correctAnswers}</div>
                <div className="text-xs sm:text-sm text-slate-400">Correct</div>
              </div>

              {/* Incorrect Answers Card */}
              <div className="bg-slate-800/50 rounded-xl p-4 sm:p-5 border border-slate-700/50 flex flex-col items-center justify-center text-center hover:bg-slate-800/80 transition-[color,background-color,border-color,transform] hover:scale-105">
                <div className="p-2 sm:p-3 bg-red-500/10 rounded-full mb-2 sm:mb-3">
                  <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white mb-1">{stats?.incorrect || 0}</div>
                <div className="text-xs sm:text-sm text-slate-400">Incorrect</div>
              </div>

              {/* Marks Card */}
              <div className="bg-slate-800/50 rounded-xl p-4 sm:p-5 border border-slate-700/50 flex flex-col items-center justify-center text-center hover:bg-slate-800/80 transition-[color,background-color,border-color,transform] hover:scale-105">
                <div className="p-2 sm:p-3 bg-purple-500/10 rounded-full mb-2 sm:mb-3">
                  <Award className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white mb-1">
                  {test?.negativeMarkingEnabled ? earnedMarks : ((myResult.earnedMarks === 0 && earnedMarks > 0) ? earnedMarks : (myResult.earnedMarks ?? earnedMarks))}
                  <span className="text-sm sm:text-base font-medium text-slate-500">/{myResult.totalMarks ?? totalMarks}</span>
                </div>
                <div className="text-xs sm:text-sm text-slate-400">Marks</div>
              </div>
            </div>
          </div>
        </div>


        {/* Negative Marking Explanation Banner */}
        {test?.negativeMarkingEnabled && stats && stats.negativeDeduction > 0 && (() => {
          const finalScore = Math.max(0, stats.rawEarned - stats.negativeDeduction);
          const nm = test.negativeMarks || 1;
          const isPlural = (n: number) => n !== 1;

          return (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#111318", border: "1px solid rgba(148,163,184,0.1)" }}>

              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5" style={{ borderBottom: "1px solid rgba(148,163,184,0.08)", background: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl shrink-0" style={{ background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.28)" }}>
                  <AlertCircle className="h-4 w-4 text-orange-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm sm:text-[15px] font-black text-white tracking-tight">Score Breakdown</p>
                    <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(251,146,60,0.12)", color: "#fdba74", border: "1px solid rgba(251,146,60,0.22)" }}>
                      Negative Marking
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] font-semibold mt-0.5" style={{ color: "rgba(253,186,116,0.5)" }}>
                    <span style={{ color: "rgba(253,186,116,0.82)" }}>{nm} mark{isPlural(nm) ? "s" : ""}</span> deducted per wrong answer
                  </p>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 p-3 sm:p-4">

                {/* CORRECT */}
                <div className="flex-1 rounded-xl overflow-hidden" style={{ background: "rgba(5,46,22,0.5)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <div className="flex items-center gap-2 px-3 pt-2.5 pb-0">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full shrink-0" style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.35)" }}>
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(52,211,153,0.5)" }}>Correct</span>
                  </div>

                  {/* Mobile: single row */}
                  <div className="flex items-center justify-between gap-2 px-3 pt-1.5 pb-3 sm:hidden">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black" style={{ color: "#34d399" }}>{stats.correctCount}</span>
                      <span className="text-sm font-bold" style={{ color: "rgba(52,211,153,0.6)" }}>{isPlural(stats.correctCount) ? "questions" : "question"}</span>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.18)" }}>
                      <span className="text-sm font-black" style={{ color: "#6ee7b7" }}>+{stats.rawEarned}</span>
                      <span className="text-[10px] font-semibold" style={{ color: "rgba(52,211,153,0.5)" }}>marks</span>
                    </div>
                  </div>

                  {/* PC: single row */}
                  <div className="hidden sm:flex items-center justify-between gap-3 px-3 pt-2 pb-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black" style={{ color: "#34d399" }}>{stats.correctCount}</span>
                      <span className="text-sm font-bold" style={{ color: "rgba(52,211,153,0.6)" }}>{isPlural(stats.correctCount) ? "questions" : "question"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.18)" }}>
                      <span className="text-base font-black" style={{ color: "#6ee7b7" }}>+{stats.rawEarned}</span>
                      <span className="text-[11px] font-semibold" style={{ color: "rgba(52,211,153,0.55)" }}>marks earned</span>
                    </div>
                  </div>
                </div>

                {/* WRONG */}
                <div className="flex-1 rounded-xl overflow-hidden" style={{ background: "rgba(28,20,8,0.8)", border: "1px solid rgba(251,146,60,0.2)" }}>
                  <div className="flex items-center gap-2 px-3 pt-2.5 pb-0">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full shrink-0" style={{ background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.35)" }}>
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(251,146,60,0.5)" }}>Wrong</span>
                  </div>

                  {/* Mobile: single row */}
                  <div className="flex items-center justify-between gap-2 px-3 pt-1.5 pb-3 sm:hidden">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black" style={{ color: "#fb923c" }}>{stats.incorrectCount}</span>
                      <span className="text-sm font-bold" style={{ color: "rgba(251,146,60,0.6)" }}>{isPlural(stats.incorrectCount) ? "questions" : "question"}</span>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.18)" }}>
                      <span className="text-sm font-black" style={{ color: "#fdba74" }}>-{stats.negativeDeduction}</span>
                      <span className="text-[10px] font-semibold" style={{ color: "rgba(251,146,60,0.5)" }}>marks</span>
                    </div>
                  </div>

                  {/* PC: single row */}
                  <div className="hidden sm:flex items-center justify-between gap-3 px-3 pt-2 pb-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black" style={{ color: "#fb923c" }}>{stats.incorrectCount}</span>
                      <span className="text-sm font-bold" style={{ color: "rgba(251,146,60,0.6)" }}>{isPlural(stats.incorrectCount) ? "questions" : "question"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.18)" }}>
                      <span className="text-base font-black" style={{ color: "#fdba74" }}>-{stats.negativeDeduction}</span>
                      <span className="text-[11px] font-semibold" style={{ color: "rgba(251,146,60,0.55)" }}>marks penalty</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formula Bar */}
              <div className="mx-3 sm:mx-4 mb-3 sm:mb-4 px-4 sm:px-5 py-3.5 sm:py-4 rounded-2xl" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap">

                  <div className="flex flex-col items-center">
                    <span className="text-2xl sm:text-3xl font-black leading-none" style={{ color: "#34d399" }}>+{stats.rawEarned}</span>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: "rgba(52,211,153,0.45)" }}>earned</span>
                  </div>

                  <span className="text-xl sm:text-2xl font-black pb-4" style={{ color: "rgba(255,255,255,0.18)" }}>−</span>

                  <div className="flex flex-col items-center">
                    <span className="text-2xl sm:text-3xl font-black leading-none" style={{ color: "#fb923c" }}>{stats.negativeDeduction}</span>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: "rgba(251,146,60,0.45)" }}>penalty</span>
                  </div>

                  <span className="text-xl sm:text-2xl font-black pb-4" style={{ color: "rgba(255,255,255,0.18)" }}>=</span>

                  <div className="flex flex-col items-center px-4 sm:px-5 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <span className="text-3xl sm:text-4xl font-black leading-none text-white" style={{ letterSpacing: "-1px" }}>{finalScore}</span>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>final marks</span>
                  </div>

                </div>
              </div>

            </div>
          );
        })()}

        <br />

        {/* Question Review Section with Filters */}
        <div className="rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 p-5 sm:p-6 lg:p-8 xl:p-10 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 sm:mb-6 lg:mb-8">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative shrink-0">
                <div className="relative flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 rounded-xl sm:rounded-2xl bg-slate-800 dark:bg-slate-900 border border-slate-700/60 shadow-lg p-2 sm:p-2.5">
                  <BookOpen className="w-full h-full text-blue-400" />
                </div>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  Question Review
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {filteredQuestions.length} of {test?.questions?.length || myResult?.totalQuestions || 0} questions
                </p>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setFilterType('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterType === 'all'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
              >
                <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
                All ({test?.questions?.length || myResult?.totalQuestions || 0})
              </button>
              <button
                onClick={() => setFilterType('correct')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterType === 'correct'
                  ? 'bg-emerald-500 text-white shadow-lg'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
              >
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                Correct ({correctAnswers})
              </button>
              <button
                onClick={() => setFilterType('incorrect')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterType === 'incorrect'
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
              >
                <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                Wrong ({stats?.incorrect || 0})
              </button>
              <button
                onClick={() => setFilterType('skipped')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filterType === 'skipped'
                  ? 'bg-amber-500 text-white shadow-lg'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
              >
                <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                Skipped ({stats?.skipped || 0})
              </button>
            </div>
          </div>

          {/* Expand/Collapse All */}
          <div className="mb-4">
            <button
              onClick={toggleAllQuestions}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
            >
              {expandedQuestions.size === filteredQuestions.length ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Collapse All
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Expand All
                </>
              )}
            </button>
          </div>

          <div className="space-y-4 sm:space-y-5 lg:space-y-6">
            {filteredQuestions.map(({ question, index: qIdx }) => {
              const safeAnswers = myResult.answers || [];
              const userAns = safeAnswers[qIdx];
              const correctAns = question.correctAnswer;
              const isCorrect = userAns === correctAns;
              const isSkipped = userAns === undefined || userAns === null || userAns === -1;
              const isExpanded = expandedQuestions.has(qIdx);

              return (
                <div key={qIdx} className="group rounded-xl sm:rounded-2xl lg:rounded-[1.25rem] border border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800 overflow-hidden transition-shadow duration-300 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-950/50">
                  {/* Question Header - Always Visible */}
                  <div
                    className="p-4 sm:p-5 lg:p-6 xl:p-7 cursor-pointer"
                    onClick={() => toggleQuestion(qIdx)}
                  >
                    <div className="flex items-start justify-between mb-3 sm:mb-4 lg:mb-5 gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
                            Question {qIdx + 1}
                          </span>
                          {isCorrect && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle className="w-3 h-3" /> Correct
                            </span>
                          )}
                          {!isCorrect && !isSkipped && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold uppercase tracking-wider border border-red-200 dark:border-red-800">
                              <XCircle className="w-3 h-3" /> Incorrect
                            </span>
                          )}
                          {isSkipped && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                              <Clock className="w-3 h-3" /> Skipped
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs lg:text-sm font-bold px-2.5 sm:px-3 lg:px-4 py-1 sm:py-1.5 rounded-lg bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 text-purple-700 dark:text-purple-300 border border-purple-300/60 dark:border-purple-700/60">
                            <span className="hidden sm:inline">Worth</span>
                            <span className="font-extrabold">{question.marks || 1}</span>
                            <span>{(question.marks || 1) === 1 ? 'mark' : 'marks'}</span>
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3 leading-relaxed">
                          <span className="break-words whitespace-pre-wrap">{question.question}</span>
                        </h4>
                      </div>
                      <button className="shrink-0 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Question Options - Expandable */}
                  {isExpanded && (
                    <div className="px-4 sm:px-5 lg:px-6 xl:px-7 pb-4 sm:pb-5 lg:pb-6 xl:pb-7 space-y-2 sm:space-y-3 lg:space-y-3.5">
                      {isMCQ(question) ? (
                        question.options.map((option, optIdx) => {
                          const isCorrectOption = optIdx === correctAns;
                          const isUserOption = optIdx === userAns;

                          let className = "relative p-3 sm:p-4 lg:p-5 rounded-lg sm:rounded-xl lg:rounded-[1rem] border-2 transition-colors duration-200 ";

                          if (isCorrectOption) {
                            className += "border-emerald-500 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 shadow-sm";
                          } else if (isUserOption && !isCorrect) {
                            className += "border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/10 shadow-sm";
                          } else {
                            className += "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 opacity-70";
                          }

                          return (
                            <div key={optIdx} className={className}>
                              <div className="flex items-center gap-3">
                                <span className={`flex items-center justify-center w-8 h-8 rounded-lg border-2 shrink-0 text-sm font-bold transition-colors ${isCorrectOption
                                  ? 'border-emerald-500 bg-emerald-500 text-white'
                                  : isUserOption && !isCorrect
                                    ? 'border-red-500 bg-red-500 text-white'
                                    : 'border-slate-300 dark:border-slate-600 text-slate-500'
                                  }`}>
                                  {String.fromCharCode(65 + optIdx)}
                                </span>

                                <span className={`flex-1 font-medium text-sm sm:text-base ${isCorrectOption ? 'text-emerald-900 dark:text-emerald-100' :
                                  isUserOption && !isCorrect ? 'text-red-900 dark:text-red-100' :
                                    'text-slate-700 dark:text-slate-300'
                                  }`}>
                                  {option}
                                </span>

                                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                                  {isUserOption && (
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold shadow-sm whitespace-nowrap ${isCorrect
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800'
                                      }`}>
                                      {isCorrect ? '✓ Your Answer' : '✗ Your Answer'}
                                    </span>
                                  )}
                                  {isCorrectOption && !isCorrect && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 shadow-sm whitespace-nowrap">
                                      ✓ Correct Answer
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                          <p className="text-slate-300 mb-2">Detailed answer view for Short Answer not yet implemented.</p>
                          <div className="text-emerald-400">Correct Answer: {question.correctAnswer}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredQuestions.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400 text-lg">No questions match this filter</p>
            </div>
          )}
        </div>

        {/* Performance Summary */}
        <div className="rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 p-5 sm:p-6 lg:p-8 xl:p-10">
          <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6 lg:mb-8">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl sm:rounded-2xl blur-lg opacity-50"></div>
              <div className="relative flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
              </div>
            </div>
            <h3 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              Performance Summary
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:gap-6 xl:gap-8">
            {/* Score Breakdown */}
            <div className="rounded-xl sm:rounded-2xl lg:rounded-[1.25rem] border border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800 p-4 sm:p-5 lg:p-6">
              <h4 className="font-bold text-base sm:text-lg lg:text-xl text-slate-900 dark:text-white mb-4 sm:mb-5 lg:mb-6 flex items-center gap-2 sm:gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/30 rounded-lg blur-md"></div>
                  <CheckCircle className="relative h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                </div>
                <span>Score Breakdown</span>
              </h4>
              <div className="space-y-2.5 sm:space-y-3 lg:space-y-4">
                <div className="flex justify-between items-center p-3 sm:p-3.5 lg:p-4 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200/40 dark:border-slate-700/60 shadow-sm">
                  <span className="text-xs sm:text-sm lg:text-base text-slate-700 dark:text-slate-300 font-semibold">Correct Answers</span>
                  <span className="font-bold text-base sm:text-lg lg:text-xl text-emerald-600 dark:text-emerald-400">{correctAnswers}</span>
                </div>
                <div className="flex justify-between items-center p-3 sm:p-3.5 lg:p-4 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200/40 dark:border-slate-700/60 shadow-sm">
                  <span className="text-xs sm:text-sm lg:text-base text-slate-700 dark:text-slate-300 font-semibold">Incorrect Answers</span>
                  <span className="font-bold text-base sm:text-lg lg:text-xl text-red-600 dark:text-red-400">{stats?.incorrect || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 sm:p-3.5 lg:p-4 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200/40 dark:border-slate-700/60 shadow-sm">
                  <span className="text-xs sm:text-sm lg:text-base text-slate-700 dark:text-slate-300 font-semibold">Skipped</span>
                  <span className="font-bold text-base sm:text-lg lg:text-xl text-amber-600 dark:text-amber-400">{stats?.skipped || 0}</span>
                </div>

                {/* Negative Marking Breakdown (if enabled) */}
                {test?.negativeMarkingEnabled && (
                  <>
                    <div className="flex justify-between items-center p-3 sm:p-3.5 lg:p-4 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200/40 dark:border-slate-700/60 shadow-sm">
                      <span className="text-xs sm:text-sm lg:text-base text-slate-700 dark:text-slate-300 font-semibold">Marks from Correct</span>
                      <span className="font-bold text-base sm:text-lg lg:text-xl text-emerald-600 dark:text-emerald-400">+{stats?.rawEarned || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 sm:p-3.5 lg:p-4 rounded-lg sm:rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40 shadow-sm">
                      <span className="text-xs sm:text-sm lg:text-base text-red-800 dark:text-red-300 font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-80" />
                        Negative Marking Deduction
                      </span>
                      <span className="font-bold text-base sm:text-lg lg:text-xl text-red-600 dark:text-red-400">-{stats?.negativeDeduction || 0}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between items-center p-3 sm:p-3.5 lg:p-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200/60 dark:border-blue-800/60 shadow-sm">
                  <span className="text-xs sm:text-sm lg:text-base text-blue-900 dark:text-blue-100 font-bold">Accuracy</span>
                  <span className="font-bold text-base sm:text-lg lg:text-xl text-blue-900 dark:text-blue-100">{displayScore.toFixed(1)}%</span>
                </div>
              </div>
            </div>


          </div>

          {/* Recommendations Section */}
          {displayScore < 70 && (
            <div className="mt-6 sm:mt-8 rounded-xl sm:rounded-2xl border border-amber-200/60 dark:border-amber-800/60 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 p-4 sm:p-5 lg:p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
                  <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-base sm:text-lg text-amber-900 dark:text-amber-100 mb-2">Recommendations</h4>
                  <ul className="space-y-2 text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                      <span>Review the questions you got wrong and understand the correct answers</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                      <span>Practice similar questions to strengthen your understanding</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                      <span>Consider retaking the test after reviewing the material</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TestResults;