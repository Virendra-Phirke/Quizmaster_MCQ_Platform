import { useState, useEffect, useMemo, memo } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useTest } from '../../hooks/useTest';
import { LegacyTest, LegacyTestResult } from '../../contexts/TestContext';
import { BookOpen, Search, CheckCircle, Zap } from 'lucide-react';
import { getCachedUUIDFromClerkId } from '../../lib/clerkUtils';
import { Skeleton } from '../../components/shared/Skeleton';
import { useTestsQuery, useResultsQuery } from '../../hooks/quizQueries';
import { StudentLayout } from '../../components/layouts/StudentLayout';
import { SGL, SGLToggle } from '../../components/student/SGL';
import { LightswindPagination } from '../../components/shared/LightswindPagination';

type FilterStatus = 'all' | 'available' | 'completed';

function AllTestsPage() {
  const { user } = useUser();
  const { tests: legacyTests, results: legacyResults } = useTest();
  const testsQuery = useTestsQuery();
  const resultsQuery = useResultsQuery((Array.isArray(testsQuery.data) ? testsQuery.data : legacyTests) || []);
  const loading = testsQuery.isLoading || resultsQuery.isLoading;
  const [userUUID, setUserUUID] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 18;
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('preferredViewMode');
    if (saved) return saved as 'grid' | 'list';
    const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 640;
    return isSmallScreen ? 'list' : 'grid';
  });

  // Save view mode preference
  useEffect(() => {
    localStorage.setItem('preferredViewMode', viewMode);
  }, [viewMode]);

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

  // Memoized data
  const availableTests = useMemo(() =>
    legacyTests.filter((test: LegacyTest) => test.isPublic),
    [legacyTests]
  );

  const myResults = useMemo(() =>
    legacyResults.filter((result: LegacyTestResult) => result.studentId === userUUID),
    [legacyResults, userUUID]
  );

  const completedTestIds = useMemo(() =>
    myResults.map((result: LegacyTestResult) => result.testId),
    [myResults]
  );

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
    const testsToFilter = filterStatus === 'completed' ? legacyTests : availableTests;

    return testsToFilter.filter((test: LegacyTest) => {
      // Status filter
      if (filterStatus === 'available' && completedTestIds.includes(test.id)) return false;
      if (filterStatus === 'completed' && !completedTestIds.includes(test.id)) return false;

      // Only filter by active status if NOT showing all or completed tests
      if (filterStatus !== 'all' && filterStatus !== 'completed') {
        const now = new Date();
        const startDate = test.startDate ? new Date(test.startDate) : new Date(0);
        const endDate = test.endDate ? new Date(test.endDate) : new Date();
        const isTestActive = now >= startDate && now <= endDate;
        if (!isTestActive) return false;
      }

      // Search filter
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return test.title.toLowerCase().includes(query) ||
        test.description.toLowerCase().includes(query);
    });
  }, [availableTests, legacyTests, searchQuery, filterStatus, completedTestIds]);

  // Reset to page 1 whenever filters/search change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredTests.length / PAGE_SIZE));
  const pagedTests = filteredTests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) {
    return (
      <StudentLayout activeNav="tests" title="All Tests" subtitle="Browse all available tests">
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl bg-slate-800/50" />
            ))}
          </div>
        </div>
      </StudentLayout>
    );
  }

  const filterOptions: { value: FilterStatus; label: string; activeColor: string }[] = [
    {
      value: 'all',
      label: 'All',
      activeColor: 'bg-slate-600/40 text-slate-200 border-slate-500/50',
    },
    {
      value: 'available',
      label: 'Available',
      activeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    },
    {
      value: 'completed',
      label: 'Completed',
      activeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    },
  ];

  return (
    <StudentLayout activeNav="tests" title="All Tests" subtitle="Browse all available tests">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.03),transparent_50%)] pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">

        {/* Search, Filter and View Controls */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl shadow-xl mb-4 sm:mb-6">
          <div className="p-3 sm:p-5 space-y-3">
            {/* Top row: Search + View Toggle */}
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
              {/* Search Bar - Compact */}
              <div className="relative flex-1 lg:max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search tests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 sm:pl-9 pr-3 py-2 border border-slate-700/50 rounded-lg bg-slate-900 text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-[color,background-color,border-color,box-shadow] text-xs sm:text-sm"
                />
              </div>

              {/* View Toggle */}
              <SGLToggle
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                className="w-fit mx-auto lg:mx-0"
              />
            </div>

            {/* Filter Pills Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                Filter:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {filterOptions.map(({ value, label, activeColor }) => (
                  <button
                    key={value}
                    onClick={() => setFilterStatus(value)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold border transition-all duration-200 ${filterStatus === value
                      ? activeColor
                      : 'bg-transparent text-slate-500 border-slate-700/50 hover:text-slate-300 hover:border-slate-600/60'
                      }`}
                  >
                    {value === 'completed' && <CheckCircle className="h-3 w-3" />}
                    {value === 'available' && <Zap className="h-3 w-3" />}
                    {label}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black leading-none ${filterStatus === value
                      ? value === 'all'
                        ? 'bg-slate-500/30 text-slate-300'
                        : value === 'available'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-700/50 text-slate-500'
                      }`}>
                      {filterCounts[value]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tests Grid/List */}
        {filteredTests.length === 0 ? (
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl shadow-xl p-8 sm:p-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-700/50 mb-3 sm:mb-4">
                <BookOpen className="h-7 w-7 sm:h-8 sm:w-8 text-slate-500" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-200 mb-1.5 sm:mb-2">
                {searchQuery || filterStatus !== 'all' ? 'No tests found' : 'No tests available'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                {searchQuery
                  ? 'Try different search terms.'
                  : filterStatus === 'completed'
                    ? "You haven't completed any tests yet."
                    : filterStatus === 'available'
                      ? 'All tests have been completed!'
                      : 'New tests will appear here.'}
              </p>
              {(searchQuery || filterStatus !== 'all') && (
                <button
                  onClick={() => { setSearchQuery(''); setFilterStatus('all'); }}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/50 hover:border-slate-600/60 transition-colors duration-200"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <SGL
              tests={pagedTests}
              allTests={legacyTests}
              completedTestIds={completedTestIds}
              results={myResults}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              hideToggle
              gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
            />
            <LightswindPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              showInfo
              totalItems={filteredTests.length}
              itemsPerPage={PAGE_SIZE}
              itemLabel="tests"
              className="mt-4"
            />
          </>
        )}
      </div>
    </StudentLayout>
  );
}

export default memo(AllTestsPage);