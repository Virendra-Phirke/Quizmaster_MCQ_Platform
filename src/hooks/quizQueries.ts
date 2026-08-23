import { useQuery, QueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useUser } from '@clerk/clerk-react';
import { getCachedUUIDFromClerkId, ensureUserProfile } from '../lib/clerkUtils';
import { canonicalizeRole } from '../lib/roleUtils';
import type { LegacyTest, LegacyTestResult } from '../contexts/TestContext';
import type { Question } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

interface TestRow {
  id: string; title: string; description: string; duration: number; time_per_question?: number; negative_marking_enabled?: boolean; created_by: string; start_date: string; end_date: string; is_active: boolean; questions: Question[]; default_marks?: number; negative_marks?: number;
}
interface ResultRow {
  id: string; test_id: string; student_id: string; score: number; earned_marks?: number | null; total_marks?: number | null; total_questions: number; time_taken: number; answers: number[]; completed_at: string; student?: { name?: string } | null;
}

// Helper to convert DB test -> LegacyTest shape
async function fetchTests(user: ReturnType<typeof useUser>['user']): Promise<LegacyTest[]> {
  if (!user) return [];
  const role = canonicalizeRole(user.unsafeMetadata?.role as string | undefined) || 'student';

  // Non-blocking profile ensure — don't let profile creation errors block test listing
  try { await ensureUserProfile(user, role as 'teacher' | 'student'); } catch (e) { console.warn('⚠️ Profile ensure failed (non-blocking):', e); }

  // For students taking tests: Don't fetch questions at all (fetch on-demand per question)
  // For teachers: include all question data with correct answers
  if (role === 'student') {
    // Students: Use server-side RPC that aggregates question_count and total_marks
    // in a single query (no need to fetch raw question rows to client)
    const mapRpcRow = (t: any): LegacyTest => ({
      id: t.id,
      title: t.title,
      description: t.description,
      duration: t.duration,
      timePerQuestion: t.time_per_question,
      negativeMarkingEnabled: t.negative_marking_enabled,
      createdBy: t.created_by,
      startDate: t.start_date,
      endDate: t.end_date,
      isPublic: t.is_active,
      questions: [],
      questionCount: t.question_count || 0,
      totalMarks: t.total_marks || 0,
      defaultMarks: t.default_marks,
      negativeMarks: t.negative_marks
    });

    // Primary: SECURITY DEFINER RPC — single query, server-side aggregation
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_student_tests');
      if (!rpcError && Array.isArray(rpcData)) {
        return (rpcData as any[]).map(mapRpcRow);
      }
      if (rpcError) console.warn('⚠️ RPC get_student_tests failed, falling back:', rpcError.message);
    } catch (rpcErr) {
      console.warn('⚠️ RPC get_student_tests threw, falling back:', rpcErr);
    }

    // Fallback: two separate queries (for when RPC hasn't been deployed yet)
    const { data: testsData, error: testsError } = await supabase
      .from('tests')
      .select(`id, title, description, duration, time_per_question, negative_marking_enabled, negative_marks, default_marks, created_by, start_date, end_date, is_active`)
      .order('created_at', { ascending: false });

    if (testsError) throw testsError;
    if (!testsData || testsData.length === 0) return [];

    // Fetch question stats with pagination (Supabase defaults to 1000-row limit)
    const testIds = testsData.map((t: any) => t.id);
    let allQuestionData: Array<{ test_id: string; marks: number }> = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    while (true) {
      const { data: page, error: qError } = await supabase
        .from('questions')
        .select('test_id, marks')
        .in('test_id', testIds)
        .range(from, from + PAGE_SIZE - 1);

      if (qError) throw qError;
      if (!page || page.length === 0) break;
      allQuestionData = allQuestionData.concat(page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const countMap = new Map<string, number>();
    const marksMap = new Map<string, number>();
    allQuestionData.forEach(q => {
      countMap.set(q.test_id, (countMap.get(q.test_id) || 0) + 1);
      marksMap.set(q.test_id, (marksMap.get(q.test_id) || 0) + (q.marks || 1));
    });

    return testsData.map((test: any) => ({
      id: test.id,
      title: test.title,
      description: test.description,
      duration: test.duration,
      timePerQuestion: test.time_per_question,
      negativeMarkingEnabled: test.negative_marking_enabled,
      createdBy: test.created_by,
      startDate: test.start_date,
      endDate: test.end_date,
      isPublic: test.is_active,
      questions: [],
      questionCount: countMap.get(test.id) || 0,
      totalMarks: marksMap.get(test.id) || 0,
      defaultMarks: test.default_marks,
      negativeMarks: test.negative_marks
    })) as LegacyTest[];
  } else {
    // Teachers: Fetch full test data with questions created by this teacher
    const userUUID = await getCachedUUIDFromClerkId(user.id);
    const questionFields = 'id, question_text, options, correct_answer, marks, order_index, section';
    const testFields = 'id, title, description, duration, time_per_question, negative_marking_enabled, default_marks, negative_marks, created_by, start_date, end_date, is_active, created_at';

    const query = supabase
      .from('tests')
      .select(`${testFields}, questions ( ${questionFields} )`)
      .eq('created_by', userUUID);

    const { data: testsData, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    const legacyTests: LegacyTest[] = (testsData as unknown as TestRow[])?.map((test) => ({
      id: test.id,
      title: test.title,
      description: test.description,
      duration: test.duration,
      timePerQuestion: test.time_per_question,
      negativeMarkingEnabled: test.negative_marking_enabled,
      createdBy: test.created_by,
      startDate: test.start_date,
      endDate: test.end_date,
      isPublic: test.is_active,
      defaultMarks: test.default_marks,
      negativeMarks: test.negative_marks,
      questions: test.questions
        ?.sort((a: Question, b: Question) => a.order_index - b.order_index)
        .map((q: Question) => ({
          id: q.id,
          type: 'mcq',
          question: q.question_text,
          options: q.options,
          correctAnswer: q.correct_answer,
          marks: q.marks || 1,
          section: q.section || 'General'
        })) || []
    })) || [];
    return legacyTests;
  }
}

async function fetchResults(user: ReturnType<typeof useUser>['user'], tests: LegacyTest[] | undefined): Promise<LegacyTestResult[]> {
  if (!user) return [];
  const role = canonicalizeRole(user.unsafeMetadata?.role as string | undefined) || 'student';
  const userUUID = await getCachedUUIDFromClerkId(user.id);

  // Helper: map raw result row → LegacyTestResult (works for both RPC and direct-query shapes)
  const mapRow = (r: any): LegacyTestResult => ({
    id: r.id,
    testId: r.test_id,
    studentId: r.student_id,
    studentName: r.student_name || (r.student as any)?.name || 'Unknown Student',
    score: r.score,
    earnedMarks: r.earned_marks ?? undefined,
    totalMarks: r.total_marks ?? undefined,
    totalQuestions: r.total_questions,
    timeTaken: r.time_taken,
    answers: r.answers,
    completedAt: r.completed_at
  });

  // Helper: recompute scores for results where DB stored score=0 but answers exist
  // Fetches question correct_answer + test negative marking config, then recomputes locally
  const recomputeZeroScores = async (results: LegacyTestResult[]): Promise<LegacyTestResult[]> => {
    // Find results that need recomputation (score=0 or earnedMarks=0 but answers exist)
    const needsRecompute = results.filter(r =>
      r.answers?.length > 0 &&
      (r.score === 0 || r.score == null) &&
      (r.earnedMarks === 0 || r.earnedMarks == null)
    );

    if (needsRecompute.length === 0) return results;

    // Get unique test IDs that need question data
    const testIdsToFetch = [...new Set(needsRecompute.map(r => r.testId))];

    // Fetch questions AND test negative marking config in parallel
    const [questionsResp, testsResp] = await Promise.all([
      supabase
        .from('questions')
        .select('test_id, correct_answer, marks, order_index')
        .in('test_id', testIdsToFetch)
        .order('order_index', { ascending: true }),
      supabase
        .from('tests')
        .select('id, negative_marking_enabled, negative_marks')
        .in('id', testIdsToFetch)
    ]);

    if (questionsResp.error || !questionsResp.data) {
      console.warn('⚠️ Could not fetch questions for score recomputation:', questionsResp.error?.message);
      return results;
    }

    // Build lookups
    const questionsByTest = new Map<string, Array<{ correct_answer: number; marks: number; order_index: number }>>();
    questionsResp.data.forEach((q: any) => {
      if (!questionsByTest.has(q.test_id)) questionsByTest.set(q.test_id, []);
      questionsByTest.get(q.test_id)!.push(q);
    });

    // Negative marking config per test: { enabled, penaltyPerWrong }
    const negMarkByTest = new Map<string, { enabled: boolean; penalty: number }>();
    (testsResp.data || []).forEach((t: any) => {
      negMarkByTest.set(t.id, {
        enabled: !!t.negative_marking_enabled,
        penalty: t.negative_marks ?? 1
      });
    });

    // Recompute scores with negative marking
    return results.map(r => {
      if (
        r.answers?.length > 0 &&
        (r.score === 0 || r.score == null) &&
        (r.earnedMarks === 0 || r.earnedMarks == null)
      ) {
        const questions = questionsByTest.get(r.testId);
        if (questions?.length) {
          const negConfig = negMarkByTest.get(r.testId) ?? { enabled: false, penalty: 1 };
          const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
          let earnedMarks = 0;
          questions.forEach((q, idx) => {
            const userAnswer = r.answers[idx];
            if (userAnswer == null || userAnswer < 0) return; // unanswered — no change
            if (userAnswer === q.correct_answer) {
              earnedMarks += (q.marks || 1);
            } else if (negConfig.enabled) {
              earnedMarks -= negConfig.penalty; // deduct penalty for wrong answer
            }
          });
          earnedMarks = Math.max(0, earnedMarks); // floor at 0
          const score = totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0;
          return { ...r, score, earnedMarks, totalMarks, totalQuestions: questions.length };
        }
      }
      return r;
    });
  };

  // ─── STUDENT PATH ───────────────────────────────────────────────────────────
  if (role === 'student') {
    // Primary: SECURITY DEFINER RPC — bypasses RLS (auth.uid() = NULL with Clerk auth)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_student_results', {
        p_student_id: userUUID
      });
      if (!rpcError && Array.isArray(rpcData)) {
        const mapped = (rpcData as any[]).map(mapRow);
        return recomputeZeroScores(mapped);
      }
      if (rpcError) console.warn('⚠️ RPC get_student_results failed, trying direct query:', rpcError.message);
    } catch (rpcErr) {
      console.warn('⚠️ RPC get_student_results threw, trying direct query:', rpcErr);
    }

    // Fallback: direct table query (works if RLS is open or Supabase auth is active)
    const { data, error } = await supabase
      .from('test_results')
      .select('id, test_id, student_id, score, earned_marks, total_marks, total_questions, time_taken, answers, completed_at, created_at, student:profiles(name)')
      .eq('student_id', userUUID)
      .order('completed_at', { ascending: false });
    if (error) throw error;
    const mapped = ((data as unknown as ResultRow[]) || []).map(mapRow);
    return recomputeZeroScores(mapped);
  }

  // ─── TEACHER PATH ───────────────────────────────────────────────────────────
  const teacherTests = (tests || []).filter(t => t.createdBy === userUUID);
  if (teacherTests.length === 0) return [];
  const testIds = teacherTests.map(t => t.id);

  // Primary: SECURITY DEFINER RPC — bypasses RLS
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_teacher_results', {
      p_test_ids: testIds
    });
    if (!rpcError && Array.isArray(rpcData)) {
      const mapped = (rpcData as any[]).map(mapRow);
      return recomputeZeroScores(mapped);
    }
    if (rpcError) console.warn('⚠️ RPC get_teacher_results failed, trying direct query:', rpcError.message);
  } catch (rpcErr) {
    console.warn('⚠️ RPC get_teacher_results threw, trying direct query:', rpcErr);
  }

  // Fallback: direct table query
  const { data, error } = await supabase
    .from('test_results')
    .select('id, test_id, student_id, score, earned_marks, total_marks, total_questions, time_taken, answers, completed_at, created_at, student:profiles(name)')
    .in('test_id', testIds)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  const mapped = ((data as unknown as ResultRow[]) || []).map(mapRow);
  return recomputeZeroScores(mapped);
}

export function useTestsQuery() {
  const { user } = useUser();
  const role = user?.unsafeMetadata?.role;
  return useQuery({
    queryKey: ['tests', user?.id, role],
    queryFn: () => fetchTests(user),
    enabled: !!user && !!role,
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
    refetchOnMount: true,
    retry: 1,
  });
}

export function useResultsQuery(tests: LegacyTest[] | undefined) {
  const { user } = useUser();
  const role = user?.unsafeMetadata?.role;
  const testIds = useMemo(() => (tests || []).map(t => t.id).join(','), [tests]);

  return useQuery({
    queryKey: ['results', user?.id, role, testIds],
    queryFn: () => fetchResults(user, tests),
    enabled: !!user && !!role && !!tests && tests.length > 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
    refetchOnMount: true,
    retry: 1,
  });
}

// Fetch a single result quickly, bypassing the need for a full LegacyTest object
// Uses SECURITY DEFINER RPC to bypass RLS (Clerk auth != Supabase Auth, so auth.uid() is always NULL)
export function useSingleTestResultQuery(testId: string | undefined, studentIdParam?: string | null) {
  const { user } = useUser();
  const role = user?.unsafeMetadata?.role;

  return useQuery({
    queryKey: ['single-result', testId, user?.id, role, studentIdParam],
    queryFn: async () => {
      if (!user || !testId) return null;
      const role = canonicalizeRole(user.unsafeMetadata?.role as string | undefined) || 'student';

      // Non-blocking profile ensure — don't let profile creation errors block results
      try { await ensureUserProfile(user, role as 'teacher' | 'student'); } catch (e) { console.warn('⚠️ Profile ensure failed (non-blocking):', e); }

      const userUUID = await getCachedUUIDFromClerkId(user.id);
      const targetStudentId = (role === 'teacher' && studentIdParam) ? studentIdParam : (role === 'student' ? userUUID : null);
      if (!targetStudentId) return null;

      // Primary: Use SECURITY DEFINER RPC (bypasses RLS)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_student_test_result', {
          p_test_id: testId,
          p_student_id: targetStudentId
        });

        if (!rpcError && rpcData) {
          return {
            id: rpcData.id,
            testId: rpcData.test_id,
            studentId: rpcData.student_id,
            studentName: rpcData.student_name || 'Unknown Student',
            score: rpcData.score,
            earnedMarks: rpcData.earned_marks || undefined,
            totalMarks: rpcData.total_marks || undefined,
            totalQuestions: rpcData.total_questions,
            timeTaken: rpcData.time_taken,
            answers: rpcData.answers,
            completedAt: rpcData.completed_at
          } as LegacyTestResult;
        }
        if (rpcError) console.warn('⚠️ RPC get_student_test_result failed, trying direct query:', rpcError.message);
      } catch (rpcErr) {
        console.warn('⚠️ RPC get_student_test_result threw, trying direct query:', rpcErr);
      }

      // Fallback: Direct table query (works if RLS is disabled or user has Supabase auth)
      const query = supabase
        .from('test_results')
        .select(`
          id, test_id, student_id, score, earned_marks, total_marks, total_questions, time_taken, answers, completed_at, created_at,
          student:profiles(name)
        `)
        .eq('test_id', testId)
        .eq('student_id', targetStudentId);

      const { data, error } = await query.order('completed_at', { ascending: false }).limit(1).single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      if (!data) return null;

      const result = data as unknown as ResultRow;
      return {
        id: result.id,
        testId: result.test_id,
        studentId: result.student_id,
        studentName: (result.student as any)?.name || 'Unknown Student',
        score: result.score,
        earnedMarks: result.earned_marks || undefined,
        totalMarks: result.total_marks || undefined,
        totalQuestions: result.total_questions,
        timeTaken: result.time_taken,
        answers: result.answers,
        completedAt: result.completed_at
      } as LegacyTestResult;
    },
    enabled: !!user && !!testId,
    staleTime: 0,  // Always refetch on mount — prevents serving cached null from failed Android fetch
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });
}

export async function fetchQuestionStatsRaw(testId: string) {
  const { data, error } = await supabase
    .from('test_question_answers')
    .select('question_id, is_correct')
    .eq('test_id', testId);

  // Handle 404 or other errors gracefully - return empty stats if no data exists
  if (error) {
    console.warn(`No question stats found for test ${testId}:`, error.message);
    return [];
  }

  const map = new Map<string, { correct: number; total: number }>();
  data?.forEach(row => {
    const qid = row.question_id as string;
    if (!map.has(qid)) map.set(qid, { correct: 0, total: 0 });
    const agg = map.get(qid)!;
    agg.total += 1;
    if (row.is_correct) agg.correct += 1;
  });
  return Array.from(map.entries()).map(([questionId, v]) => ({
    questionId,
    correct: v.correct,
    total: v.total,
    accuracy: v.total ? v.correct / v.total : 0
  }));
}

export function getQuestionStatsQueryOptions(testId: string) {
  return {
    queryKey: ['question-stats', testId],
    queryFn: () => fetchQuestionStatsRaw(testId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  } as const;
}

export function prefetchQuestionStats(queryClient: QueryClient, testId: string) {
  return queryClient.prefetchQuery(getQuestionStatsQueryOptions(testId));
}

export function useQuestionStatsQuery(testId: string | undefined, enabled: boolean = true) {
  return useQuery({
    ...(testId ? getQuestionStatsQueryOptions(testId) : { queryKey: ['question-stats', 'none'], queryFn: async () => [] }),
    enabled: !!testId && enabled
  });
}

async function fetchSingleTest(user: ReturnType<typeof useUser>['user'], testId: string): Promise<LegacyTest | null> {
  if (!user) return null;
  const role = canonicalizeRole(user.unsafeMetadata?.role as string | undefined) || 'student';

  // For test access via shared links, allow fetching without strict profile check
  // This enables students to access tests via magic links without pre-existing profiles
  try {
    await ensureUserProfile(user, role as 'teacher' | 'student');
  } catch (error) {
    // If profile creation fails, continue anyway - student can still access test data
    console.warn('Profile creation failed, continuing with test fetch:', error);
  }

  // For students: Don't fetch questions (they'll fetch on-demand)
  // For teachers: Fetch all question data
  if (role === 'student') {
    // Students: Just get test metadata
    console.log('🔍 Fetching test metadata for student. Test ID:', testId);
    const { data, error } = await supabase
      .from('tests')
      .select('id, title, description, duration, time_per_question, negative_marking_enabled, negative_marks, default_marks, created_by, start_date, end_date, is_active')
      .eq('id', testId)
      .single();

    if (error) {
      console.error('❌ Supabase error fetching test:', error);
      if (error.code === 'PGRST116') {
        console.error('❌ Test not found in database (PGRST116)');
        return null;
      }
      throw error;
    }

    if (!data) {
      console.error('❌ No test data returned from query');
      return null;
    }

    console.log('✅ Test found:', data.title, 'Active:', data.is_active);

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      duration: data.duration,
      timePerQuestion: data.time_per_question,
      negativeMarkingEnabled: data.negative_marking_enabled,
      createdBy: data.created_by,
      startDate: data.start_date,
      endDate: data.end_date,
      isPublic: data.is_active,
      defaultMarks: data.default_marks,
      negativeMarks: data.negative_marks,
      questions: [] // Empty - questions fetched on-demand
    } as LegacyTest;
  } else {
    // Teachers: Fetch full data
    const questionFields = 'id, question_text, options, correct_answer, marks, order_index, section';
    const testFields = 'id, title, description, duration, time_per_question, negative_marking_enabled, default_marks, negative_marks, created_by, start_date, end_date, is_active, created_at';

    const query = supabase
      .from('tests')
      .select(`${testFields}, questions ( ${questionFields} )`)
      .eq('id', testId)
      .limit(1)
      .single();
    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    const test = data as unknown as TestRow;
    return {
      id: test.id,
      title: test.title,
      description: test.description,
      duration: test.duration,
      timePerQuestion: test.time_per_question,
      negativeMarkingEnabled: test.negative_marking_enabled,
      createdBy: test.created_by,
      startDate: test.start_date,
      endDate: test.end_date,
      isPublic: test.is_active,
      defaultMarks: test.default_marks,
      negativeMarks: test.negative_marks,
      questions: test.questions
        ?.sort((a: Question, b: Question) => a.order_index - b.order_index)
        .map((q: Question) => ({
          id: q.id,
          type: 'mcq',
          question: q.question_text,
          options: q.options,
          correctAnswer: q.correct_answer,
          marks: q.marks || 1,
          section: q.section || 'General'
        })) || []
    } as LegacyTest;
  }
}

export function useTestQuery(testId: string | undefined) {
  const { user } = useUser();
  const role = user?.unsafeMetadata?.role;
  const queryClient = useQueryClient();
  return useQuery<LegacyTest | null>({
    queryKey: ['test', testId, user?.id, role],
    queryFn: () => fetchSingleTest(user, testId as string),
    enabled: !!user && !!testId && !!role,
    initialData: () => {
      if (!testId) return undefined;
      const tests = queryClient.getQueryData<LegacyTest[]>(['tests', user?.id]);
      return tests?.find(t => t.id === testId) ?? undefined;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false
  });
}

// Fetch test with all questions and correct answers for results page
// Uses SECURITY DEFINER RPC to bypass RLS (Clerk auth != Supabase Auth)
async function fetchTestForResults(user: ReturnType<typeof useUser>['user'], testId: string): Promise<LegacyTest | null> {
  if (!user) return null;
  const role = canonicalizeRole(user.unsafeMetadata?.role as string | undefined) || 'student';

  // Non-blocking profile ensure — don't let profile creation errors block results
  try { await ensureUserProfile(user, role as 'teacher' | 'student'); } catch (e) { console.warn('⚠️ Profile ensure failed (non-blocking):', e); }

  // Primary: Use SECURITY DEFINER RPC (bypasses RLS)
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_test_for_results', {
      p_test_id: testId
    });

    if (!rpcError && rpcData) {
      const questions = (rpcData.questions || []) as Array<{
        id: string; question_text: string; options: string[]; correct_answer: number;
        marks: number; order_index: number; section: string;
      }>;

      return {
        id: rpcData.id,
        title: rpcData.title,
        description: rpcData.description,
        duration: rpcData.duration,
        timePerQuestion: rpcData.time_per_question,
        negativeMarkingEnabled: rpcData.negative_marking_enabled,
        createdBy: rpcData.created_by,
        startDate: rpcData.start_date,
        endDate: rpcData.end_date,
        isPublic: rpcData.is_active,
        defaultMarks: rpcData.default_marks,
        negativeMarks: rpcData.negative_marks,
        questions: questions.map((q) => ({
          id: q.id,
          question: q.question_text,
          options: q.options,
          correctAnswer: q.correct_answer,
          marks: q.marks || 1,
          section: q.section || 'General'
        }))
      } as LegacyTest;
    }
    if (rpcError) console.warn('⚠️ RPC get_test_for_results failed, trying direct query:', rpcError.message);
  } catch (rpcErr) {
    console.warn('⚠️ RPC get_test_for_results threw, trying direct query:', rpcErr);
  }

  // Fallback: Direct table query (works if RLS is disabled or user has Supabase auth)
  const questionFields = 'id, question_text, options, correct_answer, marks, order_index, section';
  const testFields = 'id, title, description, duration, time_per_question, negative_marking_enabled, default_marks, negative_marks, created_by, start_date, end_date, is_active, created_at';

  const query = supabase
    .from('tests')
    .select(`${testFields}, questions ( ${questionFields} )`)
    .eq('id', testId)
    .limit(1)
    .single();
  const { data, error } = await query;
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  const test = data as unknown as TestRow;
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    duration: test.duration,
    timePerQuestion: test.time_per_question,
    negativeMarkingEnabled: test.negative_marking_enabled,
    createdBy: test.created_by,
    startDate: test.start_date,
    endDate: test.end_date,
    isPublic: test.is_active,
    defaultMarks: test.default_marks,
    negativeMarks: test.negative_marks,
    questions: test.questions
      ?.sort((a: Question, b: Question) => a.order_index - b.order_index)
      .map((q: Question) => ({
        id: q.id,
        question: q.question_text,
        options: q.options,
        correctAnswer: q.correct_answer,
        marks: q.marks || 1,
        section: q.section || 'General'
      })) || []
  } as LegacyTest;
}

export function useTestForResultsQuery(testId: string | undefined) {
  const { user } = useUser();
  const role = user?.unsafeMetadata?.role;
  return useQuery<LegacyTest | null>({
    queryKey: ['test-for-results', testId, user?.id, role],
    queryFn: () => fetchTestForResults(user, testId as string),
    enabled: !!user && !!testId && !!role,
    staleTime: 0,  // Always refetch on mount — prevents serving stale/null data
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });
}

// --- Attempt (in-progress) query ---
export interface AttemptState {
  attemptId?: string;
  startedAt?: string;
  status?: string;
  questionOrder?: string[];
  optionOrders?: Record<string, number[]>;
}

async function fetchAttempt(user: ReturnType<typeof useUser>['user'], testId: string): Promise<AttemptState | null> {
  if (!user) return null;
  const role = canonicalizeRole(user.unsafeMetadata?.role as string | undefined) || 'student';

  // Non-blocking profile ensure
  try { await ensureUserProfile(user, role as 'teacher' | 'student'); } catch (e) { console.warn('⚠️ Profile ensure failed (non-blocking):', e); }

  const userUUID = await getCachedUUIDFromClerkId(user.id);

  // Helper: parse option_orders from raw object to Record<string, number[]>
  const parseOptionOrders = (raw: unknown): Record<string, number[]> | undefined => {
    if (!raw || typeof raw !== 'object') return undefined;
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([k, v]) => [
        k,
        (Array.isArray(v) ? v : []).map(x => Number(x))
      ])
    ) as Record<string, number[]>;
  };

  // Primary: SECURITY DEFINER RPC — bypasses RLS (auth.uid() = NULL with Clerk auth)
  // This allows TakeTest to restore in-progress state even after a page refresh.
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_test_attempt', {
      p_test_id: testId,
      p_student_id: userUUID
    });
    if (!rpcError && rpcData) {
      return {
        attemptId: rpcData.attempt_id as string,
        startedAt: rpcData.started_at as string,
        status: rpcData.status as string,
        questionOrder: Array.isArray(rpcData.question_order)
          ? (rpcData.question_order as string[]).map(q => String(q))
          : undefined,
        optionOrders: parseOptionOrders(rpcData.option_orders)
      };
    }
    if (rpcError) console.warn('⚠️ RPC get_test_attempt failed, trying direct query:', rpcError.message);
  } catch (rpcErr) {
    console.warn('⚠️ RPC get_test_attempt threw, trying direct query:', rpcErr);
  }

  // Fallback: direct table query - ONLY fetch in_progress attempts
  // Submitted attempts should be ignored so auto-start can create fresh ones
  const { data, error } = await supabase
    .from('test_attempts')
    .select('id, test_id, student_id, started_at, status, question_order, option_orders')
    .eq('test_id', testId)
    .eq('student_id', userUUID)
    .eq('status', 'in_progress') // Only fetch active attempts, not submitted ones
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data || [])[0];

  if (row) {
    return {
      attemptId: row.id as string,
      startedAt: row.started_at as string,
      status: row.status as string,
      questionOrder: Array.isArray(row.question_order)
        ? (row.question_order as string[]).map(x => String(x))
        : undefined,
      optionOrders: parseOptionOrders(row.option_orders)
    };
  }

  // No in_progress attempt found — student can start fresh
  // Let auto-start create a new attempt via start_test_attempt RPC
  return null;
}

export function useAttemptQuery(testId: string | undefined) {
  const { user } = useUser();
  return useQuery<AttemptState | null>({
    queryKey: ['attempt', testId, user?.id],
    queryFn: () => fetchAttempt(user, testId as string),
    enabled: !!user && !!testId && (canonicalizeRole(user.unsafeMetadata?.role as string | undefined) === 'student'),
    staleTime: 0, // Always fetch fresh attempt data (was 5_000, causing stale data issues)
    gcTime: 0 // Don't cache attempt data between test attempts
  });
}

// --- Single Question Fetch (for students to prevent seeing all questions) ---
export interface SingleQuestion {
  id: string;
  type?: string;
  question: string;
  options: string[] | null;
  orderIndex: number;
  marks?: number; // Point value for the question
  section?: string;
}

async function fetchSingleQuestion(
  user: ReturnType<typeof useUser>['user'],
  testId: string,
  questionIndex: number
): Promise<SingleQuestion | null> {
  if (!user) return null;
  const role = canonicalizeRole(user.unsafeMetadata?.role as string | undefined) || 'student';

  // Only for students - teachers get full test data
  if (role !== 'student') return null;

  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, options, order_index, marks, section')
    .eq('test_id', testId)
    .eq('order_index', questionIndex)
    .single();

  if (error) {
    console.error('Error fetching question:', error);
    return null;
  }

  return {
    id: data.id,
    question: data.question_text,
    options: data.options,
    orderIndex: data.order_index,
    marks: data.marks || 1,
    section: data.section || 'General'
  };
}

export function useSingleQuestionQuery(testId: string | undefined, questionIndex: number, enabled: boolean = true) {
  const { user } = useUser();
  return useQuery<SingleQuestion | null>({
    queryKey: ['single-question', testId, questionIndex, user?.id],
    queryFn: () => fetchSingleQuestion(user, testId as string, questionIndex),
    enabled: !!user && !!testId && enabled && (canonicalizeRole(user.unsafeMetadata?.role as string | undefined) === 'student'),
    staleTime: 300_000, // 5 minutes - questions don't change during test
    gcTime: 600_000 // 10 minutes cache
  });
}

// Batch fetch all questions for a test at once (for students)
export async function fetchAllQuestionsForTest(
  user: ReturnType<typeof useUser>['user'],
  testId: string
): Promise<SingleQuestion[]> {
  if (!user || !testId) return [];
  const role = canonicalizeRole(user.unsafeMetadata?.role as string | undefined) || 'student';

  // Only for students
  if (role !== 'student') return [];

  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, options, order_index, marks, section')
    .eq('test_id', testId)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching all questions:', error);
    return [];
  }

  return data.map((q: any) => ({
    id: q.id,
    question: q.question_text,
    options: q.options,
    orderIndex: q.order_index,
    marks: q.marks || 1,
    section: q.section || 'General'
  }));
}

// Get total question count for a test
export async function getQuestionCount(testId: string): Promise<number> {
  const { count, error } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('test_id', testId);

  if (error) throw error;
  return count || 0;
}
