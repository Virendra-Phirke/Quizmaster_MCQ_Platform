import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useTestQuery, useResultsQuery } from '../../hooks/quizQueries';
import { useDeleteResultMutation, useToggleTestStatusMutation, useDeleteTestMutation } from '../../hooks/quizMutations';
import { useToast } from '../../components/ui/Toast';
import { LegacyTest, LegacyTestResult } from '../../contexts/TestContext';
import {
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Calendar,
  Award,
  BarChart3,
  Download,
  Trash2,
  Trophy,
  Target,
  Zap,
  Share2,
  Search,
  X
} from 'lucide-react';
import { getCachedUUIDFromClerkId } from '../../lib/clerkUtils';
import { Skeleton, CardSkeleton } from '../../components/shared/Skeleton';
import { PremiumDialog } from '../../components/shared/PremiumDialog';
import { TeacherLayout } from '../../components/layouts/TeacherLayout';
import { LightswindPagination } from '../../components/shared/LightswindPagination';

interface StudentSubmission extends LegacyTestResult {
  studentName: string;
  rank: number;
  grade: string;
  marksBasedScore: number;
}

function TestDetailPage() {
  const { testId } = useParams<{ testId: string }>();
  const { user } = useUser();
  const navigate = useNavigate();
  const testQuery = useTestQuery(testId);
  const resultsQuery = useResultsQuery(testQuery.data ? [testQuery.data] : undefined);
  const deleteResultMutation = useDeleteResultMutation();
  const toggleTestStatusMutation = useToggleTestStatusMutation();
  const deleteTestMutation = useDeleteTestMutation();
  const { addToast } = useToast();
  const loading = testQuery.isLoading || resultsQuery.isLoading;
  const [userUUID, setUserUUID] = useState<string>('');
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'time'>('score');
  const [deletingResultId, setDeletingResultId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [submissionToDelete, setSubmissionToDelete] = useState<{
    resultId: string;
    studentId: string;
    studentName: string;
  } | null>(null);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTestDialogOpen, setDeleteTestDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const PAGE_SIZE = 20;

  useEffect(() => {
    const generateUserUUID = async () => {
      if (user?.id) {
        const uuid = await getCachedUUIDFromClerkId(user.id);
        setUserUUID(uuid);
      }
    };
    generateUserUUID();
  }, [user?.id]);

  const test: LegacyTest | undefined = (Array.isArray(testQuery.data) ? testQuery.data[0] : testQuery.data) || undefined;
  const testResults: LegacyTestResult[] = (Array.isArray(resultsQuery.data) ? resultsQuery.data.filter((r: any) => r.testId === testId) : []) || [];

  const isTestCreator = test?.createdBy === userUUID;

  useEffect(() => {
    // If we've finished checking the test and either there isn't one (because of RLS blocking access or deletion),
    // or the teacher didn't create it, we bounce them to their own dashboard.
    if (!loading && userUUID) {
      if (!test || !isTestCreator) {
        navigate('/teacher', { replace: true });
      }
    }
  }, [loading, test, isTestCreator, navigate, userUUID]);

  const isStillLoading = !user || testQuery.isLoading || (!!test && resultsQuery.isLoading);

  // Recompute score from raw answers + test questions locally
  // The DB may store score=0 due to a SQL function timing issue; this provides a reliable fallback
  const recomputeScore = useCallback((result: LegacyTestResult): number => {
    // 1. Try DB-stored values first (only trust non-zero earnedMarks)
    if (result.earnedMarks != null && result.totalMarks != null && result.totalMarks > 0 && result.earnedMarks > 0) {
      return (result.earnedMarks / result.totalMarks) * 100;
    }
    if (result.score != null && result.score > 0) return result.score;

    // 2. Recompute from raw answers + test question data (teacher always has full question data)
    if (test?.questions?.length && result.answers?.length) {
      const negEnabled = !!test.negativeMarkingEnabled;
      const penalty = test.negativeMarks ?? 1;
      const totalMarks = test.questions.reduce((sum: number, q: any) => sum + (q.marks || 1), 0);
      let earnedMarks = 0;
      test.questions.forEach((q: any, idx: number) => {
        const userAnswer = result.answers[idx];
        if (userAnswer == null || userAnswer < 0) return; // unanswered
        if (userAnswer === q.correctAnswer) {
          earnedMarks += (q.marks || 1);
        } else if (negEnabled) {
          earnedMarks -= penalty;
        }
      });
      earnedMarks = Math.max(0, earnedMarks);
      return totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0;
    }

    return result.score ?? 0;
  }, [test]);

  const getStatistics = useCallback(() => {
    if (testResults.length === 0) {
      return {
        totalSubmissions: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        averageTime: 0,
        passRate: 0,
        passingStudents: 0
      };
    }

    const scores = testResults.map(r => recomputeScore(r));
    const times = testResults.map(r => r.timeTaken);
    const passingScore = 50;

    const passingStudents = scores.filter(s => s >= passingScore).length;

    return {
      totalSubmissions: testResults.length,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      passRate: (passingStudents / testResults.length) * 100,
      passingStudents
    };
  }, [testResults, recomputeScore]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getScoreColor = useCallback((score: number): { color: string; bgColor: string; label: string; ring: string } => {
    if (score >= 81) return { color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', label: 'Excellent', ring: 'ring-emerald-500/20' };
    if (score >= 61) return { color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', label: 'Good', ring: 'ring-cyan-500/20' };
    if (score >= 41) return { color: 'text-amber-400', bgColor: 'bg-amber-500/10', label: 'Average', ring: 'ring-amber-500/20' };
    if (score >= 21) return { color: 'text-orange-400', bgColor: 'bg-orange-500/10', label: 'Below Average', ring: 'ring-orange-500/20' };
    return { color: 'text-red-400', bgColor: 'bg-red-500/10', label: 'Poor', ring: 'ring-red-500/20' };
  }, []);

  const handleDeleteResult = (resultId: string, studentId: string, studentName: string) => {
    if (!testId) return;
    setSubmissionToDelete({ resultId, studentId, studentName });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteResult = async () => {
    if (!submissionToDelete || !testId) return;
    const { resultId, studentId } = submissionToDelete;
    setDeletingResultId(resultId);
    try {
      await deleteResultMutation.mutateAsync({ resultId, studentId, testId });
      setDeleteDialogOpen(false);
      setSubmissionToDelete(null);
    } catch (error) {
      console.error('Error deleting result:', error);
    } finally {
      setDeletingResultId(null);
    }
  };

  const toggleSelectResult = (resultId: string) => {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(resultId)) newSelected.delete(resultId);
    else newSelected.add(resultId);
    setSelectedResults(newSelected);
  };

  const toggleSelectAll = () => {
    const pageIds = new Set(pagedSubmissions.map(s => s.id));
    const allPageSelected = pagedSubmissions.every(s => selectedResults.has(s.id)) && pagedSubmissions.length > 0;
    if (allPageSelected) {
      const newSelected = new Set(selectedResults);
      pageIds.forEach(id => newSelected.delete(id));
      setSelectedResults(newSelected);
    } else {
      const newSelected = new Set(selectedResults);
      pageIds.forEach(id => newSelected.add(id));
      setSelectedResults(newSelected);
    }
  };

  const handleBulkDelete = () => {
    if (selectedResults.size === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (!testId || selectedResults.size === 0) return;
    try {
      for (const resultId of Array.from(selectedResults)) {
        const result = testResults.find(r => r.id === resultId);
        if (result) {
          await deleteResultMutation.mutateAsync({ resultId, studentId: result.studentId, testId });
        }
      }
      setSelectedResults(new Set());
      setBulkDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error bulk deleting results:', error);
    }
  };

  const exportToExcel = () => {
    if (!test || submissions.length === 0) return;
    const rows = submissions.map((submission) => {
      const marksBasedScore = submission.earnedMarks != null && submission.totalMarks != null && submission.totalMarks > 0
        ? (submission.earnedMarks / submission.totalMarks) * 100
        : submission.score;
      return {
        'Rank': submission.rank,
        'Student Name': submission.studentName,
        'Score (%)': parseFloat(marksBasedScore.toFixed(1)),
        'Earned Marks': submission.earnedMarks != null ? submission.earnedMarks : Math.round((marksBasedScore / 100) * submission.totalQuestions),
        'Total Marks': submission.totalMarks != null ? submission.totalMarks : submission.totalQuestions,
        'Time Taken': formatTime(submission.timeTaken),
        'Completed At': new Date(submission.completedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      };
    });
    import('xlsx').then(XLSX => {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions');
      const fileName = `${test?.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'test'}_submissions_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    });
  };

  const handleToggleStatus = async () => {
    if (!test || !testId) return;
    try {
      await toggleTestStatusMutation.mutateAsync({ id: testId, current: test.isPublic });
      addToast({
        title: 'Status Updated',
        message: `Test is now ${!test.isPublic ? 'public' : 'private'}`,
        type: 'success'
      });
    } catch (error) {
      addToast({
        title: 'Error',
        message: 'Failed to update test status',
        type: 'error'
      });
    }
  };

  const confirmDeleteTest = async () => {
    if (!testId) return;
    try {
      await deleteTestMutation.mutateAsync({ id: testId });
      addToast({ title: 'Test Deleted', message: 'The test has been permanently deleted.', type: 'success' });
      navigate('/teacher', { replace: true });
    } catch (error) {
      addToast({ title: 'Error', message: 'Failed to delete the test.', type: 'error' });
    }
  };

  const handleShareLink = async () => {
    if (!testId) return;
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
    const shareUrl = `${baseUrl}/#/test/${testId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      addToast({
        title: 'Link Copied',
        message: 'Test link copied to clipboard',
        type: 'success'
      });
    } catch (error) {
      addToast({
        title: 'Error',
        message: 'Failed to copy link',
        type: 'error'
      });
    }
  };

  const submissions: StudentSubmission[] = testResults
    .map((result) => ({
      ...result,
      studentName: result.studentName || 'Anonymous',
      rank: 0,
      grade: '',
      marksBasedScore: recomputeScore(result)
    }))
    .sort((a, b) => {
      if (b.marksBasedScore !== a.marksBasedScore) return b.marksBasedScore - a.marksBasedScore;
      return a.timeTaken - b.timeTaken;
    })
    .map((result, index) => ({ ...result, rank: index + 1 }));

  const sortedSubmissions = useMemo(() => [...submissions].sort((a, b) => {
    switch (sortBy) {
      case 'score':
        if (b.marksBasedScore !== a.marksBasedScore) return b.marksBasedScore - a.marksBasedScore;
        return a.timeTaken - b.timeTaken;
      case 'date': return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      case 'time': return a.timeTaken - b.timeTaken;
      default: return 0;
    }
  }), [submissions, sortBy]);

  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return sortedSubmissions;
    const q = searchQuery.trim().toLowerCase();
    return sortedSubmissions.filter(s => s.studentName.toLowerCase().includes(q));
  }, [sortedSubmissions, searchQuery]);
  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / PAGE_SIZE));
  const pagedSubmissions = filteredSubmissions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const stats = useMemo(() => getStatistics(), [getStatistics]);

  if (isStillLoading) {
    return (
      <TeacherLayout activeNav="tests" title="Test Detail" subtitle="Loading test data...">
        <div className="p-3 sm:p-5 space-y-3">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} lines={2} />)}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} lines={2} />)}
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (!test && testQuery.isFetched && !testQuery.isLoading) {
    return (
      <TeacherLayout activeNav="tests" title="Test Not Found">
        <div className="flex items-center justify-center p-4 min-h-[60vh]">
          <div className="text-center bg-gray-900/90 border border-gray-800/50 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle className="h-7 w-7 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-100 mb-3">Test Not Found</h2>
            <p className="text-sm text-slate-400 mb-5">The test you're looking for doesn't exist or you don't have permission to view it.</p>
            <Link to="/teacher" className="inline-block px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-600 transition-[box-shadow,transform] shadow-lg hover:shadow-xl active:scale-95">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout
      activeNav="tests"
      title={test?.title || 'Test Detail'}
      subtitle={`${testResults.length} submission${testResults.length !== 1 ? 's' : ''}`}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-500/5 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-indigo-500/5 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Full-width container — no max-w cap, just consistent padding */}
      <div className="w-full px-3 sm:px-5 py-3 sm:py-5 space-y-3 sm:space-y-4 relative">

        {/* Header */}
        <div className="bg-slate-900 border border-slate-800/50 rounded-xl shadow-2xl p-3 sm:p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />


          <div className="relative">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent mb-1 break-words leading-tight">
                  {test?.title || 'Loading...'}
                </h1>
                {test?.description && (
                  <p className="text-xs sm:text-sm text-slate-400 mb-3 line-clamp-1">{test.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg font-medium ring-1 ring-blue-500/20">
                    <Clock className="h-3 w-3" />
                    {test?.timePerQuestion && test.timePerQuestion > 0
                      ? `${test.timePerQuestion}s / Q`
                      : test?.duration && test.duration > 0
                        ? `${test.duration} min (Overall)`
                        : 'No Time Limit'}
                  </span>
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-purple-500/10 text-purple-400 rounded-lg font-medium ring-1 ring-purple-500/20">
                    <CheckCircle className="h-3 w-3" />{test?.questions?.length || 0} questions
                  </span>
                  <button
                    onClick={handleToggleStatus}
                    disabled={toggleTestStatusMutation.isPending}
                    className={`px-2.5 py-1 flex items-center gap-1.5 rounded-lg font-medium ring-1 transition-all ${test?.isPublic ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20 hover:bg-emerald-500/20' : 'bg-slate-500/10 text-slate-400 ring-slate-500/20 hover:bg-slate-500/20'} disabled:opacity-50`}
                    title="Click to toggle status"
                  >
                    {toggleTestStatusMutation.isPending && <div className={`animate-spin h-3 w-3 border-2 border-t-transparent rounded-full ${test?.isPublic ? 'border-emerald-400' : 'border-slate-400'}`} />}
                    {test?.isPublic ? 'Public' : 'Private'}
                  </button>
                  <button
                    onClick={() => setDeleteTestDialogOpen(true)}
                    title="Delete this test"
                    className="p-1.5 flex items-center justify-center bg-red-500/10 text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/20 rounded-lg transition-all active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleShareLink}
                    className="px-2.5 py-1 flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700/80 hover:border-emerald-600 text-slate-400 rounded-lg font-medium transition-all active:scale-95 text-xs shadow-sm"
                    title="Copy test link"
                  >
                    <Share2 className="h-5 w-4 text-teal-400 hover:text-teal-600" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={exportToExcel}
                  disabled={testResults.length === 0}
                  className="inline-flex items-center px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg font-medium transition-[box-shadow,transform] shadow-md hover:shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />Export
                </button>
                <Link
                  to={`/teacher/edit-test/${testId}`}
                  className="inline-flex items-center px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg font-medium transition-[box-shadow,transform] shadow-md hover:shadow-blue-500/20 active:scale-95 text-xs"
                >
                  Edit Test
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'Submissions', value: stats.totalSubmissions, icon: Users, a: 'indigo' },
            { label: 'Avg. Score', value: `${stats.averageScore.toFixed(1)}%`, icon: TrendingUp, a: 'emerald' },
            { label: 'Pass Rate', value: `${stats.passRate.toFixed(1)}%`, icon: Award, a: 'purple' },
            { label: 'Avg. Time', value: formatTime(Math.round(stats.averageTime)), icon: Zap, a: 'orange' },
            { label: 'Highest Score', value: testResults.length > 0 ? `${stats.highestScore.toFixed(1)}%` : '—', icon: Trophy, a: 'teal' },
            { label: 'Lowest Score', value: testResults.length > 0 ? `${stats.lowestScore.toFixed(1)}%` : '—', icon: Target, a: 'red' },
            { label: 'Passing', value: testResults.length > 0 ? `${stats.passingStudents}` : '—', icon: CheckCircle, a: 'cyan' },
          ].map(({ label, value, icon: Icon, a }) => {
            const C: Record<string, { hover: string; glow: string; iconGrad: string; iconBorder: string; ic: string }> = {
              indigo: { hover: 'hover:border-indigo-500/50', glow: 'from-indigo-500/20', iconGrad: 'from-indigo-500/20 to-indigo-600/20', iconBorder: 'border-indigo-500/30', ic: 'text-indigo-400' },
              emerald: { hover: 'hover:border-emerald-500/50', glow: 'from-emerald-500/20', iconGrad: 'from-emerald-500/20 to-emerald-600/20', iconBorder: 'border-emerald-500/30', ic: 'text-emerald-400' },
              purple: { hover: 'hover:border-purple-500/50', glow: 'from-purple-500/20', iconGrad: 'from-purple-500/20 to-purple-600/20', iconBorder: 'border-purple-500/30', ic: 'text-purple-400' },
              orange: { hover: 'hover:border-orange-500/50', glow: 'from-orange-500/20', iconGrad: 'from-orange-500/20 to-orange-600/20', iconBorder: 'border-orange-500/30', ic: 'text-orange-400' },
              teal: { hover: 'hover:border-teal-500/50', glow: 'from-teal-500/20', iconGrad: 'from-teal-500/20 to-teal-600/20', iconBorder: 'border-teal-500/30', ic: 'text-teal-400' },
              red: { hover: 'hover:border-red-500/50', glow: 'from-red-500/20', iconGrad: 'from-red-500/20 to-red-600/20', iconBorder: 'border-red-500/30', ic: 'text-red-400' },
              cyan: { hover: 'hover:border-cyan-500/50', glow: 'from-cyan-500/20', iconGrad: 'from-cyan-500/20 to-cyan-600/20', iconBorder: 'border-cyan-500/30', ic: 'text-cyan-400' },
            };
            const c = C[a];
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

        {/* Submissions List */}
        <div className="bg-slate-900 border border-slate-800/50 rounded-xl shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

          <div className="relative p-3 sm:p-4 border-b border-slate-800/50 space-y-2.5">
            {/* Row 1: Title + bulk-delete */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">Student Submissions</h2>
                <p className="text-[10px] text-slate-500 mt-0.5">View and manage all test submissions</p>
              </div>
              {selectedResults.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex-shrink-0 px-3 py-1.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-lg text-xs font-medium transition-[box-shadow,transform] shadow-md hover:shadow-red-500/20 active:scale-95 flex items-center gap-1.5"
                >
                  <Trash2 className="h-3 w-3" />Delete ({selectedResults.size})
                </button>
              )}
            </div>

            {/* Row 2: Search + Sort — always side-by-side on all screen sizes */}
            <div className="flex items-center gap-2">
              {/* Search — capped width so sort has breathing room */}
              <div className="relative w-full max-w-[160px] sm:max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Search student..."
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Sort — wider fixed width with descriptive labels */}
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as 'score' | 'date' | 'time'); setCurrentPage(1); }}
                className="w-32 sm:w-40 flex-shrink-0 px-3 py-1.5 bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                aria-label="Sort results"
              >
                <option value="score">Sort by Score</option>
                <option value="date">Sort by Date</option>
                <option value="time">Sort by Time</option>
              </select>
            </div>
          </div>


          <div className="relative p-2 sm:p-3">
            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
                  {searchQuery ? <Search className="h-6 w-6 text-slate-500" /> : <Users className="h-6 w-6 text-slate-500" />}
                </div>
                <h3 className="text-sm font-semibold text-slate-100 mb-1">
                  {searchQuery ? `No results for "${searchQuery}"` : 'No submissions yet'}
                </h3>
                <p className="text-xs text-slate-400">
                  {searchQuery ? 'Try a different name.' : 'Students haven\'t taken this test yet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Mobile Cards */}
                <div className="sm:hidden space-y-2">
                  {pagedSubmissions.map((submission) => {
                    const scoreData = getScoreColor(
                      submission.earnedMarks != null && submission.totalMarks != null && submission.totalMarks > 0
                        ? (submission.earnedMarks / submission.totalMarks) * 100
                        : submission.score
                    );
                    return (
                      <div key={submission.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 hover:border-slate-600/50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <label className="block w-4 h-4 cursor-pointer flex-shrink-0">
                              <input type="checkbox" aria-label="Select result" checked={selectedResults.has(submission.id)} onChange={() => toggleSelectResult(submission.id)} className="absolute scale-0" />
                              <span className={`block w-4 h-4 border-2 rounded transition-colors ${selectedResults.has(submission.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                {selectedResults.has(submission.id) && <CheckCircle className="h-full w-full text-white" strokeWidth={3} />}
                              </span>
                            </label>
                            {submission.rank <= 3 ? (
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shadow ${submission.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' : submission.rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' : 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'}`}>{submission.rank}</div>
                            ) : (
                              <span className="text-slate-400 text-xs">#{submission.rank}</span>
                            )}
                            <p className="font-medium text-slate-100 text-sm truncate">{submission.studentName}</p>
                          </div>
                          <div className={`px-2 py-1 rounded-md font-bold text-sm ${scoreData.bgColor} ${scoreData.color} ring-1 ${scoreData.ring}`}>
                            {submission.earnedMarks != null && submission.totalMarks != null && submission.totalMarks > 0 ? ((submission.earnedMarks / submission.totalMarks) * 100).toFixed(1) : submission.score.toFixed(1)}%
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mb-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(submission.timeTaken)}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(submission.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <Link to={`/results/${testId}?student=${submission.studentId}`} className="flex-1 inline-flex items-center justify-center px-2.5 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors ring-1 ring-blue-500/20">
                            <Eye className="h-3 w-3 mr-1" />View
                          </Link>
                          <button onClick={() => handleDeleteResult(submission.id, submission.studentId, submission.studentName)} disabled={deletingResultId === submission.id} className="flex-1 inline-flex items-center justify-center px-2.5 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50 ring-1 ring-red-500/20">
                            {deletingResultId === submission.id ? <div className="animate-spin h-3 w-3 border-2 border-red-400 border-t-transparent rounded-full" /> : <><Trash2 className="h-3 w-3 mr-1" />Delete</>}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <table className="hidden sm:table w-full">
                  <thead>
                    <tr className="border-b border-slate-800/50">
                      <th className="text-left py-2 px-3 w-10">
                        <label className="block w-4 h-4 cursor-pointer">
                          <input type="checkbox" aria-label="Select all" checked={pagedSubmissions.length > 0 && pagedSubmissions.every(s => selectedResults.has(s.id))} onChange={toggleSelectAll} className="absolute scale-0" />
                          <span className={`block w-4 h-4 border-2 rounded transition-colors ${pagedSubmissions.length > 0 && pagedSubmissions.every(s => selectedResults.has(s.id)) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-slate-500'}`}>
                            {pagedSubmissions.length > 0 && pagedSubmissions.every(s => selectedResults.has(s.id)) && <CheckCircle className="h-full w-full text-white" strokeWidth={3} />}
                          </span>
                        </label>
                      </th>
                      {['Rank', 'Student Name', 'Score', 'Time Taken', 'Completed At', 'Actions'].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSubmissions.map((submission) => {
                      const scoreData = getScoreColor(
                        submission.earnedMarks != null && submission.totalMarks != null && submission.totalMarks > 0
                          ? (submission.earnedMarks / submission.totalMarks) * 100
                          : submission.score
                      );
                      return (
                        <tr key={submission.id} className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3">
                            <label className="block w-4 h-4 cursor-pointer">
                              <input type="checkbox" aria-label="Select submission" checked={selectedResults.has(submission.id)} onChange={() => toggleSelectResult(submission.id)} className="absolute scale-0" />
                              <span className={`block w-4 h-4 border-2 rounded transition-colors ${selectedResults.has(submission.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-slate-500'}`}>
                                {selectedResults.has(submission.id) && <CheckCircle className="h-full w-full text-white" strokeWidth={3} />}
                              </span>
                            </label>
                          </td>
                          <td className="py-2.5 px-3">
                            {submission.rank <= 3 ? (
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow ${submission.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' : submission.rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' : 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'}`}>{submission.rank}</div>
                            ) : (
                              <span className="text-slate-400 text-sm">#{submission.rank}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-medium text-slate-100 text-sm">{submission.studentName}</p>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className={`px-2.5 py-1 rounded-lg font-bold text-sm ${scoreData.bgColor} ${scoreData.color} ring-1 ${scoreData.ring}`}>
                                {submission.earnedMarks != null && submission.totalMarks != null && submission.totalMarks > 0 ? ((submission.earnedMarks / submission.totalMarks) * 100).toFixed(1) : submission.score.toFixed(1)}%
                              </div>
                              <span className="text-xs text-slate-500">
                                ({submission.earnedMarks != null && submission.totalMarks != null ? `${submission.earnedMarks}/${submission.totalMarks}` : `${Math.round((submission.score / 100) * submission.totalQuestions)}/${submission.totalQuestions}`})
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center text-slate-400 text-sm gap-1.5">
                              <Clock className="h-3.5 w-3.5" />{formatTime(submission.timeTaken)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center text-slate-400 text-xs gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(submission.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <Link to={`/results/${testId}?student=${submission.studentId}`} className="inline-flex items-center px-2.5 py-1.5 text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors font-medium ring-1 ring-blue-500/20">
                                <Eye className="h-3.5 w-3.5 mr-1" />View
                              </Link>
                              <button onClick={() => handleDeleteResult(submission.id, submission.studentId, submission.studentName)} disabled={deletingResultId === submission.id || deleteResultMutation.isPending} className="inline-flex items-center px-2.5 py-1.5 text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50 font-medium ring-1 ring-red-500/20">
                                {deletingResultId === submission.id ? <><div className="animate-spin h-3.5 w-3.5 mr-1 border-2 border-red-400 border-t-transparent rounded-full" />Deleting...</> : <><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</>}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <LightswindPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              showInfo
              totalItems={filteredSubmissions.length}
              itemsPerPage={PAGE_SIZE}
              itemLabel="students"
              className="border-t border-slate-800/50 mt-2 pt-1"
            />
          </div>
        </div>

        {/* Score Distribution */}
        {testResults.length > 0 && (
          <div className="bg-slate-900 border border-slate-800/50 rounded-xl shadow-2xl p-3 sm:p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

            <div className="relative mb-3 flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-lg border border-blue-500/30">
                <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">Score Distribution</h2>
                <p className="text-[10px] text-slate-500">Performance overview by range</p>
              </div>
            </div>

            {/* Column headers */}
            <div className="relative grid grid-cols-[1fr_56px] gap-2 mb-1.5 px-0.5">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 pl-1">Range · Chart</span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 text-center">Students</span>
            </div>

            <div className="relative space-y-1.5 sm:space-y-2">
              {[
                { range: '81-100%', min: 81, max: 100, barGradient: 'from-emerald-400 via-teal-400 to-cyan-500', trackGradient: 'from-emerald-900/40 to-cyan-900/20', borderColor: 'border-emerald-700/30', labelColor: 'text-emerald-400', pctColor: 'text-emerald-400', countBg: 'bg-emerald-500/10 border-emerald-500/20', countColor: 'text-emerald-300' },
                { range: '61-80%', min: 61, max: 80, barGradient: 'from-blue-500 via-blue-400 to-indigo-400', trackGradient: 'from-blue-900/40 to-indigo-900/20', borderColor: 'border-blue-700/30', labelColor: 'text-blue-300', pctColor: 'text-blue-400', countBg: 'bg-blue-500/10 border-blue-500/20', countColor: 'text-blue-300' },
                { range: '41-60%', min: 41, max: 60, barGradient: 'from-amber-400 via-yellow-400 to-yellow-300', trackGradient: 'from-amber-900/40 to-yellow-900/20', borderColor: 'border-amber-700/30', labelColor: 'text-amber-300', pctColor: 'text-amber-400', countBg: 'bg-amber-500/10 border-amber-500/20', countColor: 'text-amber-300' },
                { range: '21-40%', min: 21, max: 40, barGradient: 'from-orange-500 via-orange-400 to-amber-400', trackGradient: 'from-orange-900/40 to-amber-900/20', borderColor: 'border-orange-700/30', labelColor: 'text-orange-300', pctColor: 'text-orange-400', countBg: 'bg-orange-500/10 border-orange-500/20', countColor: 'text-orange-300' },
                { range: '0-20%', min: 0, max: 20, barGradient: 'from-red-600 via-red-500 to-rose-400', trackGradient: 'from-red-900/40 to-rose-900/20', borderColor: 'border-red-700/30', labelColor: 'text-red-300', pctColor: 'text-red-400', countBg: 'bg-red-500/10 border-red-500/20', countColor: 'text-red-300' },
              ].map((bucket) => {
                const count = submissions.filter(s => s.marksBasedScore >= bucket.min && s.marksBasedScore <= bucket.max).length;
                const percentage = testResults.length > 0 ? (count / testResults.length) * 100 : 0;
                const widthPercentage = Math.max(percentage, 0.5);
                return (
                  <div key={bucket.range} className={`grid grid-cols-[1fr_56px] gap-2 items-center rounded-lg border ${bucket.borderColor} bg-slate-800/50 pl-2.5 pr-2 py-2 hover:bg-slate-800/70 transition-colors`}>

                    {/* Col 1: Label + Bar */}
                    <div className="min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[11px] font-bold ${bucket.labelColor}`}>{bucket.range}</span>
                        <span className={`text-[10px] font-black ${bucket.pctColor}`}>{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="relative h-3 rounded-md overflow-hidden">
                        <div className={`absolute inset-0 bg-gradient-to-r ${bucket.trackGradient} rounded-md`} />
                        <div
                          className={`absolute top-0 left-0 h-full bg-gradient-to-r ${bucket.barGradient} rounded-md transition-[width] duration-700 ease-out`}
                          style={{ width: `${widthPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Col 2: Student Count */}
                    <div className={`flex flex-col items-center justify-center rounded-lg border ${bucket.countBg} py-1.5`}>
                      <span className={`text-base font-black leading-none ${bucket.countColor}`}>{count}</span>
                      <span className="text-[8px] text-slate-500 mt-0.5 font-medium">{count === 1 ? 'student' : 'students'}</span>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <PremiumDialog
        isOpen={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setSubmissionToDelete(null); }}
        onConfirm={confirmDeleteResult}
        title="Delete Student Submission"
        subtitle={submissionToDelete?.studentName}
        message="Are you sure you want to delete this student's test submission? This will allow the student to retake the test. This action cannot be undone."
        confirmText="Delete Submission"
        cancelText="Cancel"
        type="danger"
        infoText="This will permanently delete the student's test result and allow them to retake the test."
        isLoading={deletingResultId !== null}
      />

      <PremiumDialog
        isOpen={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Multiple Submissions"
        subtitle={`${selectedResults.size} selected`}
        message={`Are you sure you want to delete ${selectedResults.size} student submissions? This will allow these students to retake the test. This action cannot be undone.`}
        confirmText={`Delete ${selectedResults.size} Submissions`}
        cancelText="Cancel"
        type="danger"
        infoText="This will permanently delete all selected student test results and allow them to retake the test."
        isLoading={deleteResultMutation.isPending}
      />

      <PremiumDialog
        isOpen={deleteTestDialogOpen}
        onClose={() => setDeleteTestDialogOpen(false)}
        onConfirm={confirmDeleteTest}
        title="Delete Test"
        subtitle={test?.title}
        message="Are you sure you want to permanently delete this test? All student submissions and results will also be deleted. This action cannot be undone."
        confirmText="Delete Test"
        cancelText="Cancel"
        type="danger"
        infoText="This will permanently delete the test and all associated student results."
        isLoading={deleteTestMutation.isPending}
      />
    </TeacherLayout>
  );
}

export default TestDetailPage;