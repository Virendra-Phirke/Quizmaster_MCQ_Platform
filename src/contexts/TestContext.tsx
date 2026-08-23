import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTestsQuery, useResultsQuery, getQuestionStatsQueryOptions, useAttemptQuery } from '../hooks/quizQueries';
import { useCreateTestMutation, useUpdateTestMutation, useDeleteTestMutation, useToggleTestStatusMutation, useStartAttemptMutation, useSubmitResultMutation } from '../hooks/quizMutations';
import { supabase } from '../lib/supabase';
import { useUser } from '@clerk/clerk-react';
import { getCachedUUIDFromClerkId, ensureUserProfile } from '../lib/clerkUtils';
import { canonicalizeRole } from '../lib/roleUtils';
import { useQueryClient } from '@tanstack/react-query';

// Legacy interface for backward compatibility
import { Question } from '../types/question';

// Re-export specific question types for convenience
export type { Question, MCQQuestion, ShortAnswerQuestion, QuestionType } from '../types/question';

// Legacy compatibility for now - alias Question to LegacyQuestion
// In a full migration we'd phase this out, but for now we map new structure to old where possible
export type LegacyQuestion = Question;

export interface LegacyTest {
  id: string;
  title: string;
  description: string;
  questions: LegacyQuestion[];
  duration: number;
  timePerQuestion?: number; // Optional: seconds allocated per question
  negativeMarkingEnabled?: boolean; // When true, students lose marks for wrong answers
  defaultMarks?: number; // Default marks for new questions
  negativeMarks?: number; // Marks to deduct for wrong answers
  createdBy: string;
  startDate: string;
  endDate: string;
  isPublic: boolean;
  questionCount?: number; // Metadata: total number of questions (for students)
  totalMarks?: number; // Metadata: total marks for all questions (for students)
}

export interface LegacyTestResult {
  id: string;
  testId: string;
  studentId: string;
  studentName: string;
  score: number;
  earnedMarks?: number; // Marks earned by the student
  totalMarks?: number; // Total marks possible for the test
  totalQuestions: number;
  timeTaken: number;
  answers: number[];
  completedAt: string;
}

// Added richer attempt metadata types
export interface AttemptState {
  attemptId?: string;
  startedAt?: string;
  status?: string;
  questionOrder?: string[]; // ordered list of question UUIDs
  optionOrders?: Record<string, number[]>; // question_id -> array mapping display index -> original option index
}

interface TestContextType {
  tests: LegacyTest[];
  results: LegacyTestResult[];
  createTest: (test: Omit<LegacyTest, 'id'>) => Promise<void>;
  updateTest: (id: string, test: Omit<LegacyTest, 'id'>) => Promise<void>;
  deleteTest: (id: string) => Promise<void>;
  toggleTestStatus: (id: string) => Promise<void>;
  submitTestResult: (result: Omit<LegacyTestResult, 'id'>) => Promise<void>; // legacy
  getTestById: (id: string) => LegacyTest | undefined;
  getResultsByTestId: (testId: string) => LegacyTestResult[];
  getResultsByStudentId: (studentId: string) => LegacyTestResult[];
  generateTestLink: (testId: string) => string;
  loading: boolean;
  refreshTests: () => Promise<void>;
  refreshResults: () => Promise<void>;
  startTestAttempt: (testId: string) => Promise<AttemptState | null>;
  submitTestResultServer: (params: { testId: string; answers: number[] }) => Promise<void>;
  attempt: AttemptState | null;
  fetchQuestionStats: (testId: string) => Promise<Array<{ questionId: string; correct: number; total: number; accuracy: number }>>;
}

const TestContext = createContext<TestContextType | undefined>(undefined);

export { TestContext };

export function TestProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const testsQuery = useTestsQuery();
  const resultsQuery = useResultsQuery(testsQuery.data);

  // Use mutations for better error handling and loading states
  const createTestMutation = useCreateTestMutation();
  const updateTestMutation = useUpdateTestMutation();
  const deleteTestMutation = useDeleteTestMutation();
  const toggleStatusMutation = useToggleTestStatusMutation();
  const startAttemptMutation = useStartAttemptMutation();
  const submitResultMutation = useSubmitResultMutation();

  // Stable refs for mutation.mutateAsync — avoids re-creating all useCallback wrappers every render
  const createTestRef = useRef(createTestMutation.mutateAsync);
  createTestRef.current = createTestMutation.mutateAsync;
  const updateTestRef = useRef(updateTestMutation.mutateAsync);
  updateTestRef.current = updateTestMutation.mutateAsync;
  const deleteTestRef = useRef(deleteTestMutation.mutateAsync);
  deleteTestRef.current = deleteTestMutation.mutateAsync;
  const toggleStatusRef = useRef(toggleStatusMutation.mutateAsync);
  toggleStatusRef.current = toggleStatusMutation.mutateAsync;
  const startAttemptRef = useRef(startAttemptMutation.mutateAsync);
  startAttemptRef.current = startAttemptMutation.mutateAsync;
  const submitResultRef = useRef(submitResultMutation.mutateAsync);
  submitResultRef.current = submitResultMutation.mutateAsync;

  // Stable ref for user to avoid re-creating submitTestResult on every user change
  const userRef = useRef(user);
  userRef.current = user;

  const [currentTestId, setCurrentTestId] = useState<string | null>(null);
  const attemptQuery = useAttemptQuery(currentTestId || undefined);
  const attempt = attemptQuery.data || null;

  const tests = useMemo(() => testsQuery.data || [], [testsQuery.data]);
  const results = useMemo(() => resultsQuery.data || [], [resultsQuery.data]);
  const loading = testsQuery.isLoading || resultsQuery.isLoading || createTestMutation.isPending || updateTestMutation.isPending || deleteTestMutation.isPending;

  // Stable ref so the realtime subscription can read latest tests without needing them in deps
  const testsRef = useRef(tests);
  testsRef.current = tests;

  // Legacy refresh functions now just invalidate queries
  const refreshTests = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['tests'] });
  }, [queryClient]);
  const refreshResults = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['results'] });
  }, [queryClient]);

  const createTest = useCallback(async (testData: Omit<LegacyTest, 'id'>) => {
    await createTestRef.current(testData);
  }, []);

  const updateTest = useCallback(async (testId: string, testData: Omit<LegacyTest, 'id'>) => {
    await updateTestRef.current({ id: testId, data: testData });
  }, []);

  const deleteTest = useCallback(async (testId: string) => {
    await deleteTestRef.current({ id: testId });
  }, []);

  const toggleTestStatus = useCallback(async (testId: string) => {
    const currentTest = tests.find(t => t.id === testId);
    if (!currentTest) throw new Error('Test not found');
    await toggleStatusRef.current({ id: testId, current: currentTest.isPublic });
  }, [tests]);

  const submitTestResult = useCallback(async (resultData: Omit<LegacyTestResult, 'id'>) => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    try {
      const userRole = canonicalizeRole(currentUser.unsafeMetadata?.role as string | undefined) || 'student';
      await ensureUserProfile(currentUser, userRole as 'teacher' | 'student');
      const userUUID = await getCachedUUIDFromClerkId(currentUser.id);

      const { error } = await supabase
        .from('test_results')
        .insert({
          test_id: resultData.testId,
          student_id: userUUID,
          score: resultData.score,
          total_questions: resultData.totalQuestions,
          time_taken: resultData.timeTaken,
          answers: resultData.answers,
          completed_at: resultData.completedAt
        });

      if (error) throw error;

      await refreshResults();
      await queryClient.invalidateQueries({ queryKey: ['question-stats', resultData.testId] });
    } catch (error) {
      console.error('Error submitting test result:', error);
      throw error;
    }
  }, [refreshResults, queryClient]);

  const startTestAttempt = useCallback(async (testId: string) => {
    setCurrentTestId(testId);
    const result = await startAttemptRef.current({ testId });
    return result.attempt;
  }, []);

  const submitTestResultServer = useCallback(async ({ testId, answers }: { testId: string; answers: number[] }) => {
    await submitResultRef.current({ testId, answers });
  }, []);

  const fetchQuestionStats = useCallback(async (testId: string) => {
    try {
      return await queryClient.fetchQuery(getQuestionStatsQueryOptions(testId));
    } catch (e) {
      console.error('Failed to fetch question stats', e);
      return [];
    }
  }, [queryClient]);

  const getTestById = useCallback((id: string) => tests.find(test => test.id === id), [tests]);
  const getResultsByTestId = useCallback((testId: string) => results.filter(result => result.testId === testId), [results]);
  const getResultsByStudentId = useCallback((studentId: string) => results.filter(result => result.studentId === studentId), [results]);

  const generateTestLink = useCallback((testId: string) => {
    const baseUrl = window.location.origin;
    const pathname = window.location.pathname;
    return `${baseUrl}${pathname}#/test/${testId}`;
  }, []);

  useEffect(() => {
    if (!user) return;
    const role = canonicalizeRole(user.unsafeMetadata?.role as string | undefined);
    if (role !== 'teacher') return;

    let isCancelled = false;
    (async () => {
      try {
        const teacherUUID = await getCachedUUIDFromClerkId(user.id);
        const channel = supabase
          .channel('test_results_realtime')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'test_results' }, payload => {
            if (isCancelled) return;
            const newRow = payload.new as { test_id: string };
            const isOwnedTest = testsRef.current.some(t => t.id === newRow.test_id && t.createdBy === teacherUUID);
            if (isOwnedTest) {
              queryClient.invalidateQueries({ queryKey: ['results'] });
              queryClient.invalidateQueries({ queryKey: ['question-stats', newRow.test_id] });
            }
          })
          .subscribe(status => {
            if (status === 'SUBSCRIBED') {
              // Connected
            }
          });

        return () => {
          isCancelled = true;
          supabase.removeChannel(channel);
        };
      } catch (e) {
        console.warn('Realtime subscription setup failed:', e);
      }
    })();
  }, [user, queryClient]);

  const value = useMemo<TestContextType>(() => ({
    tests,
    results,
    loading,
    createTest,
    updateTest,
    deleteTest,
    toggleTestStatus,
    submitTestResult,
    getTestById,
    getResultsByTestId,
    getResultsByStudentId,
    refreshTests,
    refreshResults,
    generateTestLink,
    startTestAttempt,
    submitTestResultServer,
    attempt,
    fetchQuestionStats
  }), [
    tests, results, loading, attempt,
    createTest, updateTest, deleteTest, toggleTestStatus,
    submitTestResult, getTestById, getResultsByTestId, getResultsByStudentId,
    refreshTests, refreshResults, generateTestLink,
    startTestAttempt, submitTestResultServer, fetchQuestionStats
  ]);

  return (
    <TestContext.Provider value={value}>
      {children}
    </TestContext.Provider>
  );
}