import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useUser } from '@clerk/clerk-react';
import { ensureUserProfile, getCachedUUIDFromClerkId } from '../lib/clerkUtils';
import { canonicalizeRole } from '../lib/roleUtils';
import type { LegacyTest } from '../contexts/TestContext';
import type { AttemptState } from './quizQueries';

// Utility ensures role & returns UUID
async function prep(user: ReturnType<typeof useUser>['user']) {
  if (!user) throw new Error('Not authenticated');
  const role = canonicalizeRole(user.unsafeMetadata?.role as string | undefined) || 'student';
  // Non-blocking: profile ensure can fail (RLS may block upsert for anon role)
  try { await ensureUserProfile(user, role as 'teacher' | 'student'); } catch (e) { console.warn('⚠️ Profile ensure failed (non-blocking):', e); }
  const userUUID = await getCachedUUIDFromClerkId(user.id);
  return { role, userUUID };
}

export function useCreateTestMutation() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (testData: Omit<LegacyTest, 'id'>) => {
      if (!user) throw new Error('Not authenticated');

      const { userUUID } = await prep(user);
      const { data: testInsert, error: testError } = await supabase
        .from('tests')
        .insert({
          title: testData.title,
          description: testData.description,
          duration: testData.duration,
          time_per_question: testData.timePerQuestion === undefined ? null : testData.timePerQuestion, // Store exact time per question or null
          start_date: testData.startDate,
          end_date: testData.endDate,
          is_active: testData.isPublic,
          negative_marking_enabled: testData.negativeMarkingEnabled || false,
          default_marks: testData.defaultMarks,
          negative_marks: testData.negativeMarks,
          created_by: userUUID
        })
        .select()
        .single();
      if (testError) throw testError;
      if (testData.questions.length > 0) {
        const toInsert = testData.questions.map((q, i) => {
          const baseData = {
            test_id: testInsert.id,
            question_text: q.question,
            correct_answer: q.type === 'short_answer' ? q.correctAnswer : (q as any).correctAnswer,
            marks: q.marks || testData.defaultMarks || 1,
            section: q.section || 'General',
            order_index: i
          };
          // Only add options if it's an MCQ
          if (q.type === 'mcq' || q.type === 'true_false') {
            return { ...baseData, options: (q as any).options };
          }
          return { ...baseData, options: null };
        });
        const { error: qErr } = await supabase.from('questions').insert(toInsert);
        if (qErr) throw qErr;
      }
      return testInsert.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
    },
    onError: (error) => {
      console.error('Error creating test:', error);
    }
  });
}

export function useUpdateTestMutation() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Omit<LegacyTest, 'id'> }) => {
      const { userUUID } = await prep(user);

      // Update test metadata first
      const { error: updErr } = await supabase
        .from('tests')
        .update({
          title: data.title,
          description: data.description,
          duration: data.duration,
          time_per_question: data.timePerQuestion === undefined ? null : data.timePerQuestion, // Store exact time per question or null
          start_date: data.startDate,
          end_date: data.endDate,
          is_active: data.isPublic,
          negative_marking_enabled: data.negativeMarkingEnabled || false,
          default_marks: data.defaultMarks,
          negative_marks: data.negativeMarks
        })
        .eq('id', id)
        .eq('created_by', userUUID);
      if (updErr) throw updErr;

      // Fetch existing questions for diffing
      const { data: existing, error: existingErr } = await supabase
        .from('questions')
        .select('id, question_text, options, correct_answer, marks, order_index, section')
        .eq('test_id', id)
        .order('order_index', { ascending: true });
      if (existingErr) throw existingErr;

      const existingMap = new Map<string, { question_text: string; options: string[]; correct_answer: number; marks: number; order_index: number; section: string }>();
      (existing || []).forEach(q => existingMap.set(q.id as string, {
        question_text: q.question_text as string,
        options: q.options as string[],
        correct_answer: q.correct_answer as number,
        marks: (q.marks as number) || 1,
        order_index: q.order_index as number,
        section: (q.section as string) || 'General'
      }));

      const isUUID = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

      const toInsert: Array<{ test_id: string; question_text: string; options: string[]; correct_answer: number; marks: number; order_index: number; section: string }> = [];
      const toUpsert: Array<{ id: string; test_id: string; question_text: string; options: string[]; correct_answer: number; marks: number; order_index: number; section: string }> = [];
      const referenced = new Set<string>();

      data.questions.forEach((q, idx) => {
        const desired = {
          question_text: q.question,
          options: (q as any).options || null,
          correct_answer: q.correctAnswer,
          marks: q.marks || 1,
          order_index: idx,
          section: q.section || 'General'
        };
        const prev = existingMap.get(q.id);
        if (!prev || !isUUID(q.id)) {
          if (desired.correct_answer !== undefined) {
            toInsert.push({ test_id: id, ...desired } as any);
          }
        } else {
          const changed = prev.question_text !== desired.question_text ||
            JSON.stringify(prev.options) !== JSON.stringify(desired.options) ||
            prev.correct_answer !== desired.correct_answer ||
            prev.marks !== desired.marks ||
            prev.order_index !== desired.order_index ||
            prev.section !== desired.section;
          if (changed) {
            if (desired.correct_answer !== undefined) {
              toUpsert.push({ id: q.id, test_id: id, ...desired } as any);
            }
          }
          referenced.add(q.id);
        }
      });

      const toDelete = (existing || []).map(q => q.id as string).filter(oldId => !referenced.has(oldId));

      if (toDelete.length > 0) {
        const { error: delErr } = await supabase.from('questions').delete().in('id', toDelete);
        if (delErr) throw delErr;
      }
      if (toUpsert.length > 0) {
        const { error: upErr } = await supabase.from('questions').upsert(toUpsert, { onConflict: 'id' });
        if (upErr) throw upErr;
      }
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('questions').insert(toInsert);
        if (insErr) throw insErr;
      }

      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['test', id] });
      queryClient.invalidateQueries({ queryKey: ['question-stats', id] });
    }
  });
}

export function useDeleteTestMutation() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { userUUID } = await prep(user);
      const { error } = await supabase.from('tests').delete().eq('id', id).eq('created_by', userUUID);
      if (error) throw error;
      return id;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['tests'] });
      const key = ['tests', user?.id];
      const previous = queryClient.getQueryData<LegacyTest[]>(key);
      if (previous) {
        queryClient.setQueryData<LegacyTest[]>(key, previous.filter(t => t.id !== id));
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      const key = ['tests', user?.id];
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
    }
  });
}

export function useToggleTestStatusMutation() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, current }: { id: string; current: boolean }) => {
      const { userUUID } = await prep(user);
      const { error } = await supabase
        .from('tests')
        .update({ is_active: !current })
        .eq('id', id)
        .eq('created_by', userUUID);
      if (error) throw error;
      return { id, newStatus: !current };
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['tests'] });
      await queryClient.cancelQueries({ queryKey: ['test', id] });

      const testsKey = ['tests', user?.id];
      const previousTests = queryClient.getQueryData<LegacyTest[]>(testsKey);
      if (previousTests) {
        queryClient.setQueryData<LegacyTest[]>(testsKey, previousTests.map(t => t.id === id ? { ...t, isPublic: !t.isPublic } : t));
      }

      const testKey = ['test', id];
      const previousTest = queryClient.getQueryData<LegacyTest | LegacyTest[]>(testKey);
      if (previousTest) {
        if (Array.isArray(previousTest)) {
          queryClient.setQueryData<LegacyTest[]>(testKey, previousTest.map(t => t.id === id ? { ...t, isPublic: !t.isPublic } : t));
        } else {
          queryClient.setQueryData<LegacyTest>(testKey, { ...previousTest, isPublic: !previousTest.isPublic });
        }
      }
      return { previousTests, previousTest };
    },
    onError: (_err, { id }, ctx) => {
      if (ctx?.previousTests) queryClient.setQueryData(['tests', user?.id], ctx.previousTests);
      if (ctx?.previousTest) queryClient.setQueryData(['test', id], ctx.previousTest);
    },
    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['test', id] });
    }
  });
}

export function useStartAttemptMutation() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ testId }: { testId: string }) => {
      if (!user) throw new Error('Not authenticated');
      const role = canonicalizeRole(user.unsafeMetadata?.role as string | undefined) || 'student';
      if (role !== 'student') throw new Error('Only students can start attempts');
      // Non-blocking: profile ensure can fail (RLS may block)
      try { await ensureUserProfile(user, role as 'teacher' | 'student'); } catch (e) { console.warn('⚠️ Profile ensure failed (non-blocking):', e); }
      const userUUID = await getCachedUUIDFromClerkId(user.id);
      const { data, error } = await supabase.rpc('start_test_attempt', { p_test_id: testId, p_student_id: userUUID });
      if (error) throw error;
      const attempt: AttemptState = {
        attemptId: data.attempt_id as string,
        startedAt: data.started_at as string,
        status: data.status as string,
        questionOrder: Array.isArray(data.question_order) ? (data.question_order as string[]).map(q => String(q)) : undefined,
        optionOrders: data.option_orders ? (Object.fromEntries(Object.entries(data.option_orders as Record<string, unknown>).map(([k, v]) => {
          const arr = Array.isArray(v) ? v : [];
          return [k, arr.map(x => Number(x))];
        })) as Record<string, number[]>) : undefined
      };
      return { testId, attempt };
    },
    onSuccess: ({ testId, attempt }) => {
      // Invalidate to force fresh fetch, then set the new data
      queryClient.invalidateQueries({ queryKey: ['attempt', testId, user?.id] });
      queryClient.setQueryData<AttemptState | undefined>(['attempt', testId, user?.id], attempt);
    }
  });
}

export function useSubmitResultMutation() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      testId,
      answers,
      testData,
      timeTaken = 0,
      integrityCheck = true,
      integrityErrors = [],
      negativeMarkingEnabled = false
    }: {
      testId: string;
      answers: number[];
      testData?: Omit<LegacyTest, 'id'>;
      timeTaken?: number;
      integrityCheck?: boolean;
      integrityErrors?: string[];
      negativeMarkingEnabled?: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const role = canonicalizeRole(user.unsafeMetadata?.role as string | undefined) || 'student';

      // Non-blocking profile ensure — don't let profile creation errors block submission
      // The RPC is SECURITY DEFINER and works regardless of profile existence
      try {
        await ensureUserProfile(user, role as 'teacher' | 'student');
      } catch (profileError) {
        console.warn('⚠️ Profile ensure failed (non-blocking, submission continues):', profileError);
      }

      const userUUID = await getCachedUUIDFromClerkId(user.id);

      // Sanitize answers: ensure contiguous array without holes! (Android WebView safety)
      const maxLen = testData?.questions?.length || answers.length;
      const sanitizedAnswers = Array.from({ length: Math.max(answers.length, maxLen) }, (_, i) => {
        const a = answers[i];
        if (a === undefined || a === null || isNaN(a)) return -1;
        return Math.round(a);
      });

      // ALWAYS fetch the latest negative marking configuration from DB to ensure accuracy
      // This prevents stale data from the frontend (e.g. if user started test before config change) from causing incorrect scoring
      const { data: fetchedTest, error: fetchError } = await supabase
        .from('tests')
        .select('id, negative_marking_enabled, negative_marks, questions(id, correct_answer, marks, order_index)')
        .eq('id', testId)
        .single();

      let testInfo = testData;

      if (!fetchError && fetchedTest) {
        // Map fetched questions to minimal LegacyQuestion format for calculation
        // IMPORTANT: We must sort by order_index to match answers array
        const sortedQuestions = (fetchedTest.questions || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((q: any) => ({
            id: q.id,
            marks: q.marks || 1,
            correctAnswer: q.correct_answer,
            // Minimal dummy fields to satisfy interface if needed
            question: '',
            options: []
          }));

        // If we have testInfo (from params), merge the authoritative DB values. 
        // If not, build it from scratch.
        if (testInfo) {
          testInfo = {
            ...testInfo,
            // Overwrite with DB values to be safe
            negativeMarkingEnabled: fetchedTest.negative_marking_enabled,
            negativeMarks: fetchedTest.negative_marks,
            questions: sortedQuestions as any[] // Replace partial/no-answer questions with full data
          };
        } else {
          testInfo = {
            title: fetchedTest.id,
            description: '',
            duration: 0,
            timePerQuestion: 0,
            negativeMarkingEnabled: fetchedTest.negative_marking_enabled || false,
            createdBy: '',
            startDate: '',
            endDate: '',
            isPublic: false,
            questions: sortedQuestions as any[],
            questionCount: 0,
            totalMarks: 0,
            negativeMarks: fetchedTest.negative_marks
          };
        }
      }

      // Use the parameter if explicitly passed, otherwise use testInfo
      const effectiveNegativeMarkingEnabled = negativeMarkingEnabled || testInfo?.negativeMarkingEnabled || false;

      // Log integrity violations if any
      if (!integrityCheck || integrityErrors.length > 0) {
        console.warn('⚠️ INTEGRITY VIOLATION SUBMITTED:', {
          testId,
          integrityCheck,
          errorCount: integrityErrors.length,
          errors: integrityErrors,
          submissionTime: new Date().toISOString()
        });
      }

      // Send sanitized answers - Supabase will handle JSONB conversion
      // Integrity metadata is logged but not sent to RPC (logged locally for now)
      console.log('📤 SUBMITTING:', { testId, userUUID, answersLength: sanitizedAnswers.length, timeTaken });
      const { data, error } = await supabase.rpc('submit_test_result', {
        p_test_id: testId,
        p_student_id: userUUID,
        p_answers: sanitizedAnswers,
        p_time_taken: timeTaken
      });

      if (error) {
        console.error('❌ MUTATION: Error from server:', error);
        // Handle duplicate submission gracefully (ON CONFLICT or unique violation)
        const errMsg = (error.message || '').toUpperCase();
        const errCode = error.code || '';
        if (errCode === '23505' || errMsg.includes('DUPLICATE') || errMsg.includes('UNIQUE') ||
          errMsg.includes('ALREADY_SUBMITTED') || errMsg.includes('CONFLICT')) {
          console.warn('⚠️ Duplicate submission detected, treating as success');
          return { testId, status: 'submitted', score: undefined as number | undefined, earnedMarks: undefined as number | undefined, totalMarks: undefined as number | undefined, totalQuestions: undefined as number | undefined, resultId: undefined as string | undefined };
        }
        throw error;
      }

      // NON-BLOCKING: Fire-and-forget negative marking correction.
      // The RPC already calculates scores correctly (including negative marking).
      // This correction is a safety net and should NOT block navigation on mobile.
      if (effectiveNegativeMarkingEnabled && data?.result_id && testInfo?.questions) {
        // Run correction asynchronously - don't await
        (async () => {
          try {
            const wrongAnswers = testInfo.questions.length - sanitizedAnswers.filter((ans, idx) =>
              ans === testInfo!.questions[idx]?.correctAnswer
            ).length;

            const blankAnswers = sanitizedAnswers.filter((ans) => ans === -1).length;
            const answeredWrong = wrongAnswers - blankAnswers;

            const negativeMarksVal = testInfo.negativeMarks || 1;
            const deduction = answeredWrong * negativeMarksVal;

            const totalPossibleMarks = testInfo.questions.reduce((sum, q) => sum + (q.marks || 1), 0);

            const rawEarned = testInfo.questions.reduce((sum, q, idx) => {
              if (sanitizedAnswers[idx] === q.correctAnswer) {
                return sum + (q.marks || 1);
              }
              return sum;
            }, 0);

            const correctEarnedMarks = Math.max(0, rawEarned - deduction);
            const correctScore = totalPossibleMarks > 0
              ? (correctEarnedMarks / totalPossibleMarks) * 100
              : 0;

            if (Math.abs(correctScore - data.score) > 1) {
              const { error: updateError } = await supabase
                .from('test_results')
                .update({
                  earned_marks: correctEarnedMarks,
                  score: correctScore
                })
                .eq('id', data.result_id);

              if (updateError) {
                console.error('❌ Failed to update test_results with correct score:', updateError);
              }
            }
          } catch (correctionError) {
            console.error('❌ Error applying negative marking correction:', correctionError);
          }
        })();
      }

      return {
        testId,
        status: data?.status || 'submitted',
        score: data?.score as number | undefined,
        earnedMarks: data?.earned_marks as number | undefined,
        totalMarks: data?.total_marks as number | undefined,
        totalQuestions: data?.total_questions as number | undefined,
        resultId: data?.result_id as string | undefined
      };
    },
    onSuccess: ({ testId, status }) => {
      const key = ['attempt', testId, user?.id];
      const prev = queryClient.getQueryData<AttemptState | undefined>(key);
      queryClient.setQueryData<AttemptState | undefined>(key, { ...(prev || {}), status });

      // Invalidate everything related to this test's results to ensure the next page load is fresh
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['single-result', testId] });
      queryClient.invalidateQueries({ queryKey: ['test-for-results', testId] });
      queryClient.invalidateQueries({ queryKey: ['question-stats', testId] });
    }
  });
}

export function useDeleteResultMutation() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ resultId, studentId, testId }: { resultId: string; studentId: string; testId: string }) => {
      if (!user) throw new Error('Not authenticated');

      // Delete the test result
      const { error: resultError } = await supabase
        .from('test_results')
        .delete()
        .eq('id', resultId);

      if (resultError) throw resultError;

      // Delete the test attempt to allow retake
      const { error: attemptError } = await supabase
        .from('test_attempts')
        .delete()
        .eq('test_id', testId)
        .eq('student_id', studentId);

      if (attemptError) throw attemptError;

      return { resultId, studentId, testId };
    },
    onSuccess: ({ testId, studentId }) => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['test', testId] });
      queryClient.invalidateQueries({ queryKey: ['question-stats', testId] });
      // Clear the attempt cache for this student
      queryClient.removeQueries({ queryKey: ['attempt', testId, studentId] });
    }
  });
}
