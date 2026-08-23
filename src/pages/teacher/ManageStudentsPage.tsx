import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  Users,
  Search,
  Award,
  Clock,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  Check,
  BarChart3,
  Target,
  Activity
} from 'lucide-react';
import { useTest } from '../../hooks/useTest';
import { LegacyTest, LegacyTestResult } from '../../contexts/TestContext';
import { getCachedUUIDFromClerkId } from '../../lib/clerkUtils';
import { Skeleton } from '../../components/shared/Skeleton';
import { PremiumDialog } from '../../components/shared/PremiumDialog';
import { LightswindPagination } from '../../components/shared/LightswindPagination';
import { TeacherLayout } from '../../components/layouts/TeacherLayout';

interface StudentStats {
  studentId: string;
  studentName: string;
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  lastAttempt: string;
  testsCompleted: number;
}

function ManageStudentsPage() {
  const { user } = useUser();
  const { tests, results } = useTest();
  const [userUUID, setUserUUID] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'attempts' | 'recent'>('recent');
  const [filterScore, setFilterScore] = useState<'all' | 'passing' | 'failing'>('all');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 10;

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
    if (selectedTests.length === 0) {
      return myResults;
    }
    return myResults.filter((result: LegacyTestResult) =>
      selectedTests.includes(result.testId)
    );
  }, [myResults, selectedTests]);

  const studentStats: StudentStats[] = useMemo(() => {
    const studentMap = new Map<string, LegacyTestResult[]>();

    filteredResults.forEach((result: LegacyTestResult) => {
      const existing = studentMap.get(result.studentId) || [];
      existing.push(result);
      studentMap.set(result.studentId, existing);
    });

    return Array.from(studentMap.entries()).map(([studentId, studentResults]) => {
      const scores = studentResults.map(r => r.score);
      const testsSet = new Set(studentResults.map(r => r.testId));

      return {
        studentId,
        studentName: studentResults[0]?.studentName || `Student ${studentId.slice(0, 8)}`,
        totalAttempts: studentResults.length,
        averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        bestScore: Math.max(...scores),
        lastAttempt: studentResults.sort((a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        )[0]?.completedAt || '',
        testsCompleted: testsSet.size
      };
    });
  }, [filteredResults]);

  const filteredStudents = useMemo(() => {
    let filtered = [...studentStats];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.studentName.toLowerCase().includes(query) ||
        s.studentId.toLowerCase().includes(query)
      );
    }

    if (filterScore === 'passing') {
      filtered = filtered.filter(s => s.averageScore >= 50);
    } else if (filterScore === 'failing') {
      filtered = filtered.filter(s => s.averageScore < 50);
    }

    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.studentName.localeCompare(b.studentName));
        break;
      case 'score':
        filtered.sort((a, b) => b.averageScore - a.averageScore);
        break;
      case 'attempts':
        filtered.sort((a, b) => b.totalAttempts - a.totalAttempts);
        break;
      case 'recent':
        filtered.sort((a, b) => new Date(b.lastAttempt).getTime() - new Date(a.lastAttempt).getTime());
        break;
    }

    return filtered;
  }, [studentStats, searchQuery, sortBy, filterScore]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, filterScore, selectedTests]);

  const handleTestSelection = (testId: string) => {
    setSelectedTests(prev => {
      if (prev.includes(testId)) {
        return prev.filter(id => id !== testId);
      } else {
        return [...prev, testId];
      }
    });
  };

  const clearTestFilters = () => {
    setSelectedTests([]);
  };

  const selectAllTests = () => {
    if (selectedTests.length === myTests.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests(myTests.map(t => t.id));
    }
  };

  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * studentsPerPage;
    const endIndex = startIndex + studentsPerPage;
    return filteredStudents.slice(startIndex, endIndex);
  }, [filteredStudents, currentPage, studentsPerPage]);

  const getScoreColor = (score: number): { color: string; bgColor: string; label: string } => {
    if (score >= 81) {
      return {
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20 border-emerald-500/30',
        label: 'Excellent'
      };
    } else if (score >= 61) {
      return {
        color: 'text-green-400',
        bgColor: 'bg-green-500/20 border-green-500/30',
        label: 'Good'
      };
    } else if (score >= 41) {
      return {
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20 border-amber-500/30',
        label: 'Average'
      };
    } else if (score >= 21) {
      return {
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20 border-orange-500/30',
        label: 'Below Average'
      };
    } else {
      return {
        color: 'text-red-400',
        bgColor: 'bg-red-500/20 border-red-500/30',
        label: 'Poor'
      };
    }
  };

  const showToast = (message: string) => {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 right-6 bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 animate-slide-up';
    toast.innerHTML = `
      <div class="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>
      <span class="font-medium">${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slide-down 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const exportToExcel = () => {
    const formatDate = (dateString: string): string => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const rows = filteredStudents.map(s => ({
      'Student ID': s.studentId,
      'Name': s.studentName,
      'Total Attempts': s.totalAttempts,
      'Average Score (%)': parseFloat(s.averageScore.toFixed(1)),
      'Best Score (%)': parseFloat(s.bestScore.toFixed(1)),
      'Tests Completed': s.testsCompleted,
      'Last Attempt': formatDate(s.lastAttempt)
    }));

    import('xlsx').then(XLSX => {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
      XLSX.writeFile(workbook, `students_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
    showToast('Report exported successfully!');
  };

  if (loading) {
    return (
      <TeacherLayout activeNav="students" title="Students" subtitle="Track and analyze student performance">
        {/* CHANGED: wider max-w + smaller padding */}
        <div className="p-3 sm:p-4 lg:p-6 max-w-[1600px] mx-auto space-y-6">
          <Skeleton className="h-20 w-full rounded-3xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-3xl" />)}
          </div>
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </TeacherLayout>
    );
  }

  const exportButton = (
    <button
      onClick={exportToExcel}
      className="group relative flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/30 text-white rounded-xl font-semibold text-xs sm:text-sm transition-[color,background-color,border-color,box-shadow,transform] overflow-hidden shadow-lg hover:shadow-xl active:scale-95"
    >
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
      <Download className="h-3.5 w-3.5 relative z-10" />
      <span className="relative z-10 hidden sm:inline">Export</span>
    </button>
  );

  return (
    <TeacherLayout
      activeNav="students"
      // CHANGED: smaller title/subtitle passed via props — update TeacherLayout if it accepts className props,
      // otherwise use the title string as-is and control size via the layout's internal classes.
      title="Manage Students"
      subtitle="Track and analyze student performance"
      headerActions={exportButton}
    >
      {/* Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none" />

      {/* CHANGED: wider container — max-w-[1600px] instead of max-w-7xl, tighter px on mobile */}
      <div className="relative max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">

        {/* Page heading (inline, not from TeacherLayout) — smaller sizes on mobile/desktop */}
        {/* If TeacherLayout renders the title internally, skip this block.
            Add this only if you want an in-page title with reduced size: */}
        {/* 
        <div className="mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Students</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Track and analyze student performance</p>
        </div>
        */}

        {/* Stats Grid */}
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
                  {studentStats.length}
                </p>
                <p className="text-[10px] sm:text-xs font-medium text-slate-400 leading-none">
                  Total Students
                </p>
              </div>
            </div>
          </div>

          {/* Passing Students */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-2xl p-3 sm:p-4 hover:border-emerald-500/50 transition-[color,background-color,border-color,transform] duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 rounded-lg flex-shrink-0">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-400 leading-none mb-0.5">
                  {studentStats.filter(s => s.averageScore >= 50).length}
                </p>
                <p className="text-[10px] sm:text-xs font-medium text-slate-400 leading-none">
                  Passing
                </p>
              </div>
            </div>
          </div>

          {/* Needs Improvement */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-2xl p-3 sm:p-4 hover:border-red-500/50 transition-[color,background-color,border-color,transform] duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-500/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 rounded-lg flex-shrink-0">
                <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-400" />
              </div>
              <div>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-400 leading-none mb-0.5">
                  {studentStats.filter(s => s.averageScore < 50).length}
                </p>
                <p className="text-[10px] sm:text-xs font-medium text-slate-400 leading-none">
                  At Risk
                </p>
              </div>
            </div>
          </div>

          {/* Total Attempts */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-2xl p-3 sm:p-4 hover:border-purple-500/50 transition-[color,background-color,border-color,transform] duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-lg flex-shrink-0">
                <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-400" />
              </div>
              <div>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-none mb-0.5">
                  {myResults.length}
                </p>
                <p className="text-[10px] sm:text-xs font-medium text-slate-400 leading-none">
                  Total Attempts
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-3xl p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="text"
                placeholder="Search students by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 sm:py-4 bg-slate-800/50 border border-white/5 rounded-2xl text-sm sm:text-base text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/10 transition-[color,background-color,border-color,box-shadow] duration-300 outline-none"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap">
              {/* Test Filter Button */}
              <button
                onClick={() => setIsTestModalOpen(true)}
                className="relative flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-800/50 border border-white/5 hover:border-indigo-500/50 rounded-xl text-white text-xs sm:text-sm font-medium transition-colors duration-300 hover:bg-slate-800 flex-1 sm:flex-none"
              >
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-400" />
                <span>Filter by Tests</span>
                {selectedTests.length > 0 && (
                  <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-lg">
                    {selectedTests.length}
                  </span>
                )}
              </button>

              {/* Score Filter */}
              <div className="relative group flex-1 sm:max-w-[180px]">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 pointer-events-none" />
                <select
                  title="Filter by score"
                  value={filterScore}
                  onChange={(e) => setFilterScore(e.target.value as 'all' | 'passing' | 'failing')}
                  className="w-full pl-9 pr-8 py-2.5 sm:py-3 bg-slate-800/50 border border-white/5 rounded-xl text-white text-xs sm:text-sm focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-[color,background-color,border-color,box-shadow] duration-300 outline-none appearance-none cursor-pointer"
                >
                  <option value="all">All Students</option>
                  <option value="passing">Passing (≥50%)</option>
                  <option value="failing">At Risk (&lt;50%)</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Sort */}
              <div className="relative group flex-1 sm:max-w-[180px]">
                <BarChart3 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 pointer-events-none" />
                <select
                  title="Sort students"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'score' | 'attempts' | 'recent')}
                  className="w-full pl-9 pr-8 py-2.5 sm:py-3 bg-slate-800/50 border border-white/5 rounded-xl text-white text-xs sm:text-sm focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-[color,background-color,border-color,box-shadow] duration-300 outline-none appearance-none cursor-pointer"
                >
                  <option value="recent">Most Recent</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="score">Highest Score</option>
                  <option value="attempts">Most Attempts</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Students Table - Desktop */}
        <div className="hidden lg:block bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-white/10">
                <tr>
                  {/* CHANGED: smaller header text + tighter padding */}
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-wider">Student</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-wider">Attempts</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Score</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-wider">Best Score</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-wider">Tests Done</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-wider">Last Active</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-3xl flex items-center justify-center mb-4">
                          <Users className="h-10 w-10 text-slate-500" />
                        </div>
                        <p className="text-slate-400 text-lg">
                          {searchQuery ? 'No students match your search' : 'No students have attempted your tests yet'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map((student) => {
                    const scoreInfo = getScoreColor(student.averageScore);
                    const bestScoreInfo = getScoreColor(student.bestScore);

                    return (
                      <tr key={student.studentId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              {/* CHANGED: smaller avatar on non-xl screens */}
                              <div className="h-9 w-9 lg:h-12 lg:w-12 rounded-2xl bg-gray-800/80 border border-gray-700/60 flex items-center justify-center text-gray-200 font-bold text-base lg:text-lg shadow-lg">
                                {student.studentName.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-white text-sm lg:text-base">{student.studentName}</div>
                              <div className="text-xs text-slate-400">
                                ID: {student.studentId.slice(0, 12)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                          <span className="text-white font-medium text-sm">{student.totalAttempts}</span>
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${scoreInfo.bgColor} ${scoreInfo.color} font-bold text-xs lg:text-sm`}>
                            {student.averageScore.toFixed(1)}%
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Award className="h-3.5 w-3.5 text-amber-400" />
                            <span className={`font-bold text-sm ${bestScoreInfo.color}`}>
                              {student.bestScore.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                          <span className="text-slate-300 font-medium text-sm">
                            {student.testsCompleted} / {myTests.length}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-xs lg:text-sm">
                              {student.lastAttempt ? new Date(student.lastAttempt).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                          {student.averageScore >= 50 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] lg:text-xs font-bold rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                              <Check className="h-3 w-3" />
                              Passing
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] lg:text-xs font-bold rounded-xl bg-red-500/20 border border-red-500/30 text-red-400">
                              <Target className="h-3 w-3" />
                              At Risk
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredStudents.length > studentsPerPage && (
            <LightswindPagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredStudents.length / studentsPerPage)}
              onPageChange={setCurrentPage}
              showInfo
              totalItems={filteredStudents.length}
              itemsPerPage={studentsPerPage}
              itemLabel="students"
              className="border-t border-white/10 bg-slate-800/30"
            />
          )}
        </div>

        {/* Students Cards - Mobile/Tablet */}
        <div className="lg:hidden space-y-3 sm:space-y-4">
          {paginatedStudents.length === 0 ? (
            <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-3xl p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-10 w-10 text-slate-500" />
              </div>
              <p className="text-slate-400">
                {searchQuery ? 'No students match your search' : 'No students have attempted your tests yet'}
              </p>
            </div>
          ) : (
            <>
              {paginatedStudents.map((student) => {
                const scoreInfo = getScoreColor(student.averageScore);
                const bestScoreInfo = getScoreColor(student.bestScore);

                return (
                  <div
                    key={student.studentId}
                    className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-3xl p-4 sm:p-5 hover:border-white/20 transition-colors duration-300"
                  >
                    {/* Student Header */}
                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-white/10">
                      <div className="relative flex-shrink-0">
                        {/* CHANGED: smaller avatar on mobile */}
                        <div className="h-11 w-11 sm:h-14 sm:w-14 rounded-2xl bg-gray-800/80 border border-gray-700/60 flex items-center justify-center text-gray-200 font-bold text-lg sm:text-xl shadow-lg">
                          {student.studentName.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-base sm:text-lg mb-0.5">{student.studentName}</h3>
                        <p className="text-xs text-slate-400 truncate">
                          ID: {student.studentId.slice(0, 12)}...
                        </p>
                      </div>
                      {student.averageScore >= 50 ? (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                          <Check className="h-3 w-3" />
                          Pass
                        </span>
                      ) : (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-xl bg-red-500/20 border border-red-500/30 text-red-400">
                          <Target className="h-3 w-3" />
                          Risk
                        </span>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div className="bg-slate-800/50 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                        <p className="text-[10px] sm:text-xs text-slate-400 mb-1">Avg Score</p>
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border ${scoreInfo.bgColor} ${scoreInfo.color} font-bold text-xs sm:text-sm`}>
                          {student.averageScore.toFixed(1)}%
                        </div>
                      </div>

                      <div className="bg-slate-800/50 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                        <p className="text-[10px] sm:text-xs text-slate-400 mb-1">Best Score</p>
                        <div className="flex items-center gap-1">
                          <Award className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-400" />
                          <span className={`font-bold text-xs sm:text-sm ${bestScoreInfo.color}`}>
                            {student.bestScore.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-800/50 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                        <p className="text-[10px] sm:text-xs text-slate-400 mb-1">Attempts</p>
                        <p className="text-white font-bold text-sm">{student.totalAttempts}</p>
                      </div>

                      <div className="bg-slate-800/50 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                        <p className="text-[10px] sm:text-xs text-slate-400 mb-1">Tests Done</p>
                        <p className="text-white font-bold text-sm">
                          {student.testsCompleted} / {myTests.length}
                        </p>
                      </div>
                    </div>

                    {/* Last Active */}
                    <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-white/10 flex items-center gap-2 text-slate-400 text-xs sm:text-sm">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Last active: {student.lastAttempt ? new Date(student.lastAttempt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                );
              })}

              {/* Mobile Pagination */}
              {filteredStudents.length > studentsPerPage && (
                <LightswindPagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredStudents.length / studentsPerPage)}
                  onPageChange={setCurrentPage}
                  className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-3xl"
                />
              )}
            </>
          )}
        </div>

        {/* Test Filter Modal */}
        <PremiumDialog
          isOpen={isTestModalOpen}
          onClose={() => setIsTestModalOpen(false)}
          title="Filter Tests"
          subtitle="Select tests to analyze"
          maxWidth="max-w-2xl"
          hideIcon
        >
          <div className="max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-transparent">
            {/* Quick Actions */}
            <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-emerald-500/10">
              <span className="text-xs font-medium text-emerald-400">
                {selectedTests.length}/{myTests.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllTests}
                  className="px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg transition-colors"
                >
                  {selectedTests.length === myTests.length ? 'Clear' : 'All'}
                </button>
                {selectedTests.length > 0 && (
                  <button
                    onClick={clearTestFilters}
                    className="px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Search */}
            <div className="mb-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500/50" />
              <input
                type="text"
                placeholder="Search tests..."
                value={testSearchQuery}
                onChange={(e) => setTestSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border border-emerald-500/20 rounded-lg text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-[color,background-color,border-color,box-shadow] outline-none"
              />
            </div>

            {/* Tests List */}
            {myTests.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-800/50 flex items-center justify-center border border-emerald-500/20">
                  <BookOpen className="h-6 w-6 text-emerald-500/40" />
                </div>
                <p className="text-sm text-slate-400 font-medium">No tests available</p>
                <p className="text-xs text-slate-500 mt-1">Create a test to start</p>
              </div>
            ) : (() => {
              const filteredTests = myTests.filter(test =>
                test.title.toLowerCase().includes(testSearchQuery.toLowerCase()) ||
                test.description.toLowerCase().includes(testSearchQuery.toLowerCase())
              );

              if (filteredTests.length === 0) {
                return (
                  <div className="text-center py-8">
                    <Search className="h-8 w-8 mx-auto mb-3 text-slate-600" />
                    <p className="text-sm text-slate-400 mb-2">No matches</p>
                    <button
                      onClick={() => setTestSearchQuery('')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      Clear search
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {filteredTests.map((test) => {
                    const isSelected = selectedTests.includes(test.id);
                    const testResults = myResults.filter(r => r.testId === test.id);
                    const studentCount = new Set(testResults.map(r => r.studentId)).size;

                    return (
                      <button
                        key={test.id}
                        onClick={() => handleTestSelection(test.id)}
                        className={`group w-full p-3 rounded-lg border transition-colors text-left ${isSelected
                          ? 'border-emerald-500/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/5'
                          : 'border-slate-700/50 hover:border-emerald-500/40 bg-slate-800/30 hover:bg-slate-800/50'
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors ${isSelected
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-slate-600 group-hover:border-emerald-500/50 bg-slate-900'
                            }`}>
                            {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className={`font-semibold text-sm leading-tight truncate ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                                }`}>
                                {test.title}
                              </h3>
                              <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold ${test.isPublic
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
                                }`}>
                                {test.isPublic ? 'Public' : 'Private'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-400 mb-2 line-clamp-1">
                              {test.description}
                            </p>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3 text-emerald-500/60" />
                                {studentCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <BookOpen className="h-3 w-3 text-emerald-500/60" />
                                {test.questions.length}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-emerald-500/60" />
                                {test.duration}m
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-emerald-500/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
              <span className="hidden sm:inline">
                {selectedTests.length === 0
                  ? 'All students'
                  : `${selectedTests.length} test${selectedTests.length > 1 ? 's' : ''}`
                }
              </span>
              <span className="sm:hidden">
                {selectedTests.length === 0 ? 'All' : selectedTests.length}
              </span>
            </div>
            <button
              onClick={() => setIsTestModalOpen(false)}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-semibold rounded-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-[box-shadow,transform] active:scale-95"
            >
              Apply
            </button>
          </div>
        </PremiumDialog>
      </div>
    </TeacherLayout>
  );
}

export default ManageStudentsPage;