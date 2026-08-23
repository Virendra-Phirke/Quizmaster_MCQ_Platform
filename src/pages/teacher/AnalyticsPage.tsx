import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  BarChart3,
  Clock,
  Award,
  Target,
  Activity,
  Zap,
  PieChart,
} from 'lucide-react';
import { useTest } from '../../hooks/useTest';
import { LegacyTest, LegacyTestResult } from '../../contexts/TestContext';
import { getCachedUUIDFromClerkId } from '../../lib/clerkUtils';
import { Skeleton } from '../../components/shared/Skeleton';
import { LightswindPagination } from '../../components/shared/LightswindPagination';
import { TeacherLayout } from '../../components/layouts/TeacherLayout';

function AnalyticsPage() {
  const { user } = useUser();
  const { tests, results } = useTest();
  const [userUUID, setUserUUID] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'week' | 'month' | 'all'>('all');
  const [testPerformancePage, setTestPerformancePage] = useState(1);
  const testsPerPage = 5;

  useEffect(() => {
    const init = async () => {
      if (user?.id) {
        const uuid = await getCachedUUIDFromClerkId(user.id);
        setUserUUID(uuid);
      }
      setLoading(false);
    };
    init();
  }, [user?.id]);

  const myTests = useMemo(() =>
    tests.filter((test: LegacyTest) => test.createdBy === userUUID),
    [tests, userUUID]
  );

  const myResults = useMemo(() =>
    results.filter((result: LegacyTestResult) =>
      myTests.some((test: LegacyTest) => test.id === result.testId)
    ),
    [results, myTests]
  );

  const filteredResults = useMemo(() => {
    const now = new Date();
    return myResults.filter((result: LegacyTestResult) => {
      const resultDate = new Date(result.completedAt);
      if (selectedTimeRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return resultDate >= weekAgo;
      } else if (selectedTimeRange === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return resultDate >= monthAgo;
      }
      return true;
    });
  }, [myResults, selectedTimeRange]);

  const analytics = useMemo(() => {
    const totalStudents = new Set(filteredResults.map((r: LegacyTestResult) => r.studentId)).size;
    const totalAttempts = filteredResults.length;
    const averageScore = totalAttempts > 0
      ? filteredResults.reduce((sum: number, r: LegacyTestResult) => sum + r.score, 0) / totalAttempts
      : 0;
    const passRate = totalAttempts > 0
      ? (filteredResults.filter((r: LegacyTestResult) => r.score >= 50).length / totalAttempts) * 100
      : 0;
    const avgTimePerTest = totalAttempts > 0
      ? filteredResults.reduce((sum: number, r: LegacyTestResult) => sum + (r.timeTaken || 0), 0) / totalAttempts
      : 0;

    const scoreRanges = [
      { label: '81-100%', count: 0, color: 'bg-emerald-500', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/30' },
      { label: '61-80%', count: 0, color: 'bg-blue-500', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
      { label: '41-60%', count: 0, color: 'bg-amber-500', textColor: 'text-amber-400', borderColor: 'border-amber-500/30' },
      { label: '21-40%', count: 0, color: 'bg-orange-500', textColor: 'text-orange-400', borderColor: 'border-orange-500/30' },
      { label: '0-20%', count: 0, color: 'bg-red-500', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
    ];

    filteredResults.forEach((r: LegacyTestResult) => {
      if (r.score >= 81) scoreRanges[0].count++;
      else if (r.score >= 61) scoreRanges[1].count++;
      else if (r.score >= 41) scoreRanges[2].count++;
      else if (r.score >= 21) scoreRanges[3].count++;
      else scoreRanges[4].count++;
    });

    const testPerformance = myTests.map((test: LegacyTest) => {
      const testResults = filteredResults.filter((r: LegacyTestResult) => r.testId === test.id);
      const avgScore = testResults.length > 0
        ? testResults.reduce((sum: number, r: LegacyTestResult) => sum + r.score, 0) / testResults.length
        : 0;
      return {
        id: test.id,
        title: test.title,
        attempts: testResults.length,
        avgScore,
        passRate: testResults.length > 0
          ? (testResults.filter((r: LegacyTestResult) => r.score >= 50).length / testResults.length) * 100
          : 0
      };
    });

    return {
      totalStudents,
      totalAttempts,
      averageScore,
      passRate,
      avgTimePerTest,
      scoreRanges,
      testPerformance
    };
  }, [filteredResults, myTests]);

  const paginatedTestPerformance = useMemo(() => {
    const startIndex = (testPerformancePage - 1) * testsPerPage;
    const endIndex = startIndex + testsPerPage;
    return analytics.testPerformance.slice(startIndex, endIndex);
  }, [analytics.testPerformance, testPerformancePage, testsPerPage]);

  if (loading) {
    return (
      <TeacherLayout activeNav="analytics" title="Test Analytics" subtitle="Track performance and student progress">
        <div className="p-3 sm:p-4 lg:p-6 max-w-[1600px] mx-auto space-y-6">
          <Skeleton className="h-20 w-full rounded-3xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </TeacherLayout>
    );
  }

  const timeRangeFilter = (
    <div className="flex gap-2">
      {([
        { value: 'week', label: 'This Week' },
        { value: 'month', label: 'This Month' },
        { value: 'all', label: 'All Time' },
      ] as const).map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setSelectedTimeRange(value)}
          className={`relative px-3.5 py-2 rounded-xl font-semibold text-xs transition-colors duration-200 overflow-hidden whitespace-nowrap ${selectedTimeRange === value
              ? 'bg-gradient-to-br from-indigo-600/90 to-teal-700/90 text-white shadow-lg shadow-indigo-500/30 border border-indigo-500/50'
              : 'bg-gray-900/60 border border-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-800/80 hover:border-gray-600/60'
            }`}
        >
          {selectedTimeRange === value && (
            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
          )}
          <span className="relative z-10">{label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <TeacherLayout
      activeNav="analytics"
      title="Test Analytics"
      subtitle="Track performance and student progress"
    >
      {/* Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">

        {/* Page Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Performance Overview</h2>
            <p className="text-xs text-gray-500 mt-0.5">Track student results across your tests</p>
          </div>
          {timeRangeFilter}
        </div>

        {/* Stats Grid — compact horizontal tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
          {/* Total Students */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-2xl p-3 sm:p-4 hover:border-indigo-500/50 transition-[color,background-color,border-color,transform] duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 border border-indigo-500/30 rounded-lg flex-shrink-0">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-none mb-0.5">
                  {analytics.totalStudents}
                </p>
                <p className="text-[10px] sm:text-xs font-medium text-slate-400 leading-none">
                  Total Students
                </p>
              </div>
            </div>
          </div>

          {/* Total Attempts */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-2xl p-3 sm:p-4 hover:border-emerald-500/50 transition-[color,background-color,border-color,transform] duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 rounded-lg flex-shrink-0">
                <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-none mb-0.5">
                  {analytics.totalAttempts}
                </p>
                <p className="text-[10px] sm:text-xs font-medium text-slate-400 leading-none">
                  Total Attempts
                </p>
              </div>
            </div>
          </div>

          {/* Average Score */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-2xl p-3 sm:p-4 hover:border-purple-500/50 transition-[color,background-color,border-color,transform] duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-lg flex-shrink-0">
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-400" />
              </div>
              <div>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-none mb-0.5">
                  {analytics.averageScore.toFixed(1)}%
                </p>
                <p className="text-[10px] sm:text-xs font-medium text-slate-400 leading-none">
                  Average Score
                </p>
              </div>
            </div>
          </div>

          {/* Pass Rate */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-2xl p-3 sm:p-4 hover:border-amber-500/50 transition-[color,background-color,border-color,transform] duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 rounded-lg flex-shrink-0">
                <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-none mb-0.5">
                  {analytics.passRate.toFixed(1)}%
                </p>
                <p className="text-[10px] sm:text-xs font-medium text-slate-400 leading-none">
                  Pass Rate
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Score Distribution */}
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-3xl p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 rounded-xl">
                <PieChart className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Score Distribution</h3>
                <p className="text-xs text-slate-400">Performance breakdown</p>
              </div>
            </div>

            <div className="space-y-4">
              {analytics.scoreRanges.map((range, idx) => {
                const percentage = analytics.totalAttempts > 0 ? (range.count / analytics.totalAttempts) * 100 : 0;
                const widthPercentage = Math.max(percentage, 0.5);

                return (
                  <div key={idx} className="group/bar">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-300 group-hover/bar:text-white transition-colors">
                        {range.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${range.textColor}`}>
                          {percentage.toFixed(0)}%
                        </span>
                        <span className="text-xs font-medium text-slate-500 min-w-[2rem] text-right">
                          ({range.count})
                        </span>
                      </div>
                    </div>
                    <div className="h-3 bg-slate-800/50 rounded-full overflow-hidden border border-white/5">
                      <div
                        className={`h-full ${range.color} rounded-full`}
                        style={{ width: `${widthPercentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Performance Overview */}
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-3xl p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 rounded-xl">
                <Zap className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Performance Overview</h3>
                <p className="text-xs text-slate-400">Key metrics</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 hover:border-indigo-500/30 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-indigo-400" />
                  <p className="text-xs font-medium text-slate-400">Avg. Time</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white">
                  {Math.floor(analytics.avgTimePerTest / 60)}m {Math.floor(analytics.avgTimePerTest % 60)}s
                </p>
              </div>

              <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 hover:border-purple-500/30 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-purple-400" />
                  <p className="text-xs font-medium text-slate-400">Total Tests</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white">{myTests.length}</p>
              </div>

              <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 hover:border-emerald-500/30 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <p className="text-xs font-medium text-slate-400">Public</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-400">
                  {myTests.filter((t: LegacyTest) => t.isPublic).length}
                </p>
              </div>

              <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 hover:border-slate-500/30 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-slate-500 rounded-full" />
                  <p className="text-xs font-medium text-slate-400">Private</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-slate-400">
                  {myTests.filter((t: LegacyTest) => !t.isPublic).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Test Performance Table */}
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-3xl overflow-hidden">
          <div className="px-5 sm:px-6 py-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-500/30 rounded-xl">
                <BarChart3 className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Test Performance</h3>
                <p className="text-xs text-slate-400">Individual test analytics</p>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Test</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Attempts</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Score</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Pass Rate</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedTestPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-3xl flex items-center justify-center mb-4">
                          <BarChart3 className="h-10 w-10 text-slate-500" />
                        </div>
                        <p className="text-slate-400 text-lg">No test data available yet</p>
                        <p className="text-slate-500 text-sm mt-1">Create tests and wait for student attempts</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedTestPerformance.map((test) => (
                    <tr key={test.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-white">{test.title}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-300 font-medium">{test.attempts}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold ${test.avgScore >= 70 ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                          test.avgScore >= 50 ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' :
                            'bg-red-500/20 border-red-500/30 text-red-400'
                          }`}>
                          {test.avgScore.toFixed(1)}%
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-300 font-medium">{test.passRate.toFixed(1)}%</span>
                      </td>
                      <td className="px-6 py-4">
                        {test.avgScore >= 50 ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl">
                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400">Good</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-xl">
                            <TrendingDown className="h-4 w-4 text-red-400" />
                            <span className="text-xs font-bold text-red-400">Low</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden p-4 space-y-3">
            {paginatedTestPerformance.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-10 w-10 text-slate-500" />
                </div>
                <p className="text-slate-400">No test data available yet</p>
              </div>
            ) : (
              paginatedTestPerformance.map((test) => (
                <div key={test.id} className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors duration-300">
                  <h4 className="font-bold text-white mb-3">{test.title}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Attempts</p>
                      <p className="text-lg font-bold text-white">{test.attempts}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Pass Rate</p>
                      <p className="text-lg font-bold text-white">{test.passRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Avg Score</p>
                      <div className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-sm font-bold ${test.avgScore >= 70 ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                        test.avgScore >= 50 ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' :
                          'bg-red-500/20 border-red-500/30 text-red-400'
                        }`}>
                        {test.avgScore.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Trend</p>
                      {test.avgScore >= 50 ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-400">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-sm font-bold">Good</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-red-400">
                          <TrendingDown className="h-4 w-4" />
                          <span className="text-sm font-bold">Low</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {analytics.testPerformance.length > testsPerPage && (
            <LightswindPagination
              currentPage={testPerformancePage}
              totalPages={Math.ceil(analytics.testPerformance.length / testsPerPage)}
              onPageChange={setTestPerformancePage}
              showInfo
              totalItems={analytics.testPerformance.length}
              itemsPerPage={testsPerPage}
              itemLabel="tests"
              className="border-t border-white/10 bg-slate-800/30"
            />
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

export default AnalyticsPage;