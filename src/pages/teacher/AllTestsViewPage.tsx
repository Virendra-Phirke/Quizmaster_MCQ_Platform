import { useState, useMemo, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { getCachedUUIDFromClerkId } from '../../lib/clerkUtils';
import { Search, Filter } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { TeacherLayout } from '../../components/layouts/TeacherLayout';
import { useDeleteTestMutation, useToggleTestStatusMutation } from '../../hooks/quizMutations';
import { useToast } from '../../components/ui/Toast';
import { PremiumDialog } from '../../components/shared/PremiumDialog';
import { useTestsQuery, useResultsQuery } from '../../hooks/quizQueries';
import { TGL, TGLToggle } from '../../components/teacher/TGL';
import { LegacyTest } from '../../contexts/TestContext';
import { LightswindPagination } from '../../components/shared/LightswindPagination';

interface TestData {
  id: string;
  title: string;
  description: string;
  isPublic: boolean;
  questions: any[];
  totalMarks?: number;
  timePerQuestion?: number;
  duration?: number;
  questionCount?: number;
  createdBy?: string;
  startDate?: string;
  endDate?: string;
}

const AllTestsViewPage = () => {
  const { user } = useUser();
  const [userUUID, setUserUUID] = useState<string>('');
  const [viewMode, setViewMode] = useState<'tile' | 'list'>(() => {
    const saved = localStorage.getItem('teacherPreferredViewMode');
    if (saved) return saved as 'tile' | 'list';
    return 'list';
  });
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsPhone(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const effectiveViewMode = isPhone ? 'list' : viewMode;
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testToDelete, setTestToDelete] = useState<{ id: string; title: string } | null>(null);
  const [copiedTestId, setCopiedTestId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'scheduled' | 'ended'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 18;

  const testsQuery = useTestsQuery();
  const resultsQuery = useResultsQuery(testsQuery.data as LegacyTest[] | undefined);
  const navigate = useNavigate();
  const deleteTestMutation = useDeleteTestMutation();
  const toggleTestStatusMutation = useToggleTestStatusMutation();
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

  // Save view mode preference
  useEffect(() => {
    localStorage.setItem('teacherPreferredViewMode', viewMode);
  }, [viewMode]);

  // Get tests from react-query
  const allTests = (testsQuery.data || []) as TestData[];
  const allResults = (resultsQuery.data || []) as any[];

  // Only show tests created by the current teacher
  const userTests = useMemo(() =>
    (Array.isArray(allTests) ? allTests : []).filter((test: TestData) => test.createdBy === userUUID),
    [allTests, userUUID]
  );

  // Filter tests based on search query, status, visibility and sort
  const filteredTests = useMemo(() => {
    let filtered = userTests.filter((test: TestData) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return test.title.toLowerCase().includes(query) ||
        test.description.toLowerCase().includes(query);
    });

    // Apply status filter
    if (statusFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter((test: TestData) => {
        const startDate = test.startDate ? new Date(test.startDate) : new Date(0);
        const endDate = test.endDate ? new Date(test.endDate) : new Date(0);

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
      filtered = filtered.filter((test: TestData) => {
        if (visibilityFilter === 'public') return test.isPublic === true;
        if (visibilityFilter === 'private') return test.isPublic === false;
        return true;
      });
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        filtered = [...filtered].sort((a: any, b: any) => {
          const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
          const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case 'oldest':
        filtered = [...filtered].sort((a: any, b: any) => {
          const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
          const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
          return dateA - dateB;
        });
        break;
      case 'name':
        filtered = [...filtered].sort((a: TestData, b: TestData) =>
          a.title.localeCompare(b.title)
        );
        break;
    }

    return filtered;
  }, [userTests, searchQuery, sortBy, statusFilter, visibilityFilter]);

  // Reset to page 1 whenever filters/search/sort change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, sortBy, statusFilter, visibilityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTests.length / PAGE_SIZE));
  const pagedTests = filteredTests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleEdit = (testId: string) => {
    navigate(`/teacher/edit-test/${testId}`);
  };

  const handleDeleteTest = (testId: string, testTitle: string) => {
    setTestToDelete({ id: testId, title: testTitle });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTest = async () => {
    if (!testToDelete) return;

    try {
      await deleteTestMutation.mutateAsync({ id: testToDelete.id });
      addToast({
        type: 'success',
        title: 'Test Deleted',
        message: 'The test has been deleted successfully.'
      });
      setDeleteDialogOpen(false);
      setTestToDelete(null);
    } catch (error) {
      console.error('Error deleting test:', error);
      addToast({
        type: 'error',
        title: 'Failed to Delete',
        message: error instanceof Error ? error.message : 'Could not delete test'
      });
    }
  };

  const handleToggleStatus = async (testId: string) => {
    const testsArray = Array.isArray(allTests) ? allTests : [];
    const test = testsArray.find((t: TestData) => t.id === testId);
    if (!test) return;

    try {
      await toggleTestStatusMutation.mutateAsync({
        id: testId,
        current: test.isPublic
      });
      addToast({
        type: 'success',
        title: 'Status Updated',
        message: `Test is now ${!test.isPublic ? 'public' : 'private'}`
      });
    } catch (error) {
      console.error('Error toggling status:', error);
      addToast({
        type: 'error',
        title: 'Failed to Update',
        message: error instanceof Error ? error.message : 'Could not update status'
      });
    }
  };

  const handleShare = (testId: string) => {
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
    const shareUrl = `${baseUrl}/#/test/${testId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedTestId(testId);
    setTimeout(() => setCopiedTestId(null), 2000);
    addToast({
      type: 'success',
      title: 'Link Copied',
      message: 'Test link copied to clipboard'
    });
  };


  return (
    <TeacherLayout
      activeNav="tests"
      title="All Tests"
      subtitle="Manage and view all your quizzes"
    >
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

        {/* Search and View Controls */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl shadow-xl mb-4 sm:mb-6">
          <div className="p-3 sm:p-5">
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

              {/* Filter Button and View Toggle */}
              <div className="flex gap-2 items-center justify-center lg:justify-end">
                {/* Filter Button */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="group relative flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-white/5 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white rounded-lg transition-[color,background-color,border-color,box-shadow] text-xs sm:text-sm overflow-hidden shadow-lg hover:shadow-2xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 relative z-10" />
                  <span className="hidden sm:inline relative z-10">Filters</span>
                </button>

                {/* View Toggle */}
                <TGLToggle viewMode={viewMode} onViewModeChange={setViewMode} className="hidden sm:flex" />
              </div>
            </div>

            {/* Filter/Sort Options - Collapsible */}
            {showFilters && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 sm:p-4 space-y-4 mt-3 shadow-lg">
                {/* Sort By */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">Sort By</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setSortBy('newest')}
                      className={`group relative px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors overflow-hidden ${sortBy === 'newest'
                        ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-white shadow-lg shadow-amber-500/20 border border-amber-500/40'
                        : 'bg-white/5 text-slate-300 hover:text-white border border-white/10 hover:border-white/20'
                        }`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 to-yellow-500/0 group-hover:from-amber-500/10 group-hover:to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <span className="relative z-10">Newest</span>
                    </button>
                    <button
                      onClick={() => setSortBy('oldest')}
                      className={`group relative px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors overflow-hidden ${sortBy === 'oldest'
                        ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-white shadow-lg shadow-amber-500/20 border border-amber-500/40'
                        : 'bg-white/5 text-slate-300 hover:text-white border border-white/10 hover:border-white/20'
                        }`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 to-yellow-500/0 group-hover:from-amber-500/10 group-hover:to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <span className="relative z-10">Oldest</span>
                    </button>
                    <button
                      onClick={() => setSortBy('name')}
                      className={`group relative px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors overflow-hidden ${sortBy === 'name'
                        ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-white shadow-lg shadow-amber-500/20 border border-amber-500/40'
                        : 'bg-white/5 text-slate-300 hover:text-white border border-white/10 hover:border-white/20'
                        }`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 to-yellow-500/0 group-hover:from-amber-500/10 group-hover:to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <span className="relative z-10">A-Z</span>
                    </button>
                  </div>
                </div>

                {/* Test Status Filter */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">Test Status</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['all', 'available', 'scheduled', 'ended'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setStatusFilter(opt)}
                        className={`group relative px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors overflow-hidden capitalize ${statusFilter === opt
                          ? 'bg-gradient-to-r from-blue-500/30 to-cyan-500/30 text-white shadow-lg shadow-blue-500/20 border border-blue-500/40'
                          : 'bg-white/5 text-slate-300 hover:text-white border border-white/10 hover:border-white/20'
                          }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/10 group-hover:to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="relative z-10">{opt === 'all' ? 'All Tests' : opt}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visibility Filter */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">Visibility</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['all', 'public', 'private'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setVisibilityFilter(opt)}
                        className={`group relative px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors overflow-hidden capitalize ${visibilityFilter === opt
                          ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-white shadow-lg shadow-purple-500/20 border border-purple-500/40'
                          : 'bg-white/5 text-slate-300 hover:text-white border border-white/10 hover:border-white/20'
                          }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/10 group-hover:to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="relative z-10">{opt === 'all' ? 'All Visibility' : opt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="animate-fadeIn">
          {filteredTests.length === 0 ? (
            <div className="bg-slate-900 border border-slate-700/50 rounded-xl sm:rounded-2xl shadow-xl p-8 sm:p-12">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-700/50 mb-3 sm:mb-4">
                  <Search className="h-7 w-7 sm:h-8 sm:w-8 text-slate-500" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-200 mb-1.5 sm:mb-2">
                  {searchQuery ? 'No tests found' : 'No tests available'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-4">
                  {searchQuery ? 'Try different search terms.' : 'Create your first test to get started.'}
                </p>
                {!searchQuery && (
                  <Link
                    to="/teacher/create-test"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl overflow-hidden bg-gradient-to-br from-white/20 to-white/10 hover:from-white/30 hover:to-white/15 text-white font-bold text-xs sm:text-sm shadow-lg shadow-white/10 hover:shadow-xl hover:shadow-white/20 transition-[color,background-color,border-color,box-shadow,transform] duration-300 hover:scale-[1.02] active:scale-[0.98] border border-white/30 hover:border-white/50"
                  >
                    Create Your First Test
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <>
              <TGL
                tests={pagedTests as LegacyTest[]}
                results={allResults}
                copiedTestId={copiedTestId}
                onShare={handleShare}
                onToggleStatus={handleToggleStatus}
                onEdit={handleEdit}
                onDelete={handleDeleteTest}
                viewMode={effectiveViewMode}
                onViewModeChange={setViewMode}
                hideToggle
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
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>

      {/* Delete Dialog */}
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
    </TeacherLayout>
  );
};

export default AllTestsViewPage;