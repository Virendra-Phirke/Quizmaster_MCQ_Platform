import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTestQuery, useAttemptQuery, useSingleQuestionQuery, getQuestionCount, fetchAllQuestionsForTest } from '../../hooks/quizQueries';
import { canonicalizeRole } from '../../lib/roleUtils';
import { getCachedUUIDFromClerkId } from '../../lib/clerkUtils';
import { supabase } from '../../lib/supabase';
import { useStartAttemptMutation, useSubmitResultMutation } from '../../hooks/quizMutations';
import { useTest } from '../../hooks/useTest';
import { LegacyTest } from '../../contexts/TestContext';
import { useLoading } from '../../hooks/useLoading';
import { useToast } from '../../components/ui/Toast';
import { TestUi } from './TestUi';

// Type definitions for cross-browser fullscreen APIs
interface DocumentWithPrefix extends Document {
  webkitFullscreenElement?: Element;
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

interface ElementWithPrefix extends Element {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

// Auto-submit safeguard configuration has been removed to prevent premature submissions


function TakeTest() {
  const { testId } = useParams<{ testId: string }>();
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const { loading } = useTest();
  const startAttemptMutation = useStartAttemptMutation();
  const submitResultMutation = useSubmitResultMutation();
  const navigate = useNavigate();
  const { start: startLoading, stop: stopLoading, isLoading } = useLoading();
  const { addToast } = useToast();

  // Removed local test state in favor of React Query
  // const [test, setTest] = useState<LegacyTest | null>(null);
  // const [testLoading, setTestLoading] = useState(true);
  const [testError, setTestError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const answersRef = useRef<number[]>([]); // Always-current answers for async submit paths

  const [testStarted, setTestStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  // authMode was previously used to toggle SignIn/SignUp UI; we now use Clerk's default SignIn only
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Anti-cheating measures
  const [violations, setViolations] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const violationTimeoutRef = useRef<NodeJS.Timeout>();
  const isLegitimateExitRef = useRef(false); // Track legitimate fullscreen exits
  const lastViolationTimesRef = useRef<Record<string, number>>({}); // Violation cooldown tracking

  const lastGlobalViolationTimeRef = useRef(0); // Track last violation time globally
  // Increased cooldowns specifically to prevent Android from double-triggering (fullscreenchange + blur)
  const violationCooldownMs = 5000; // 5 seconds cooldown between same violations
  const GLOBAL_VIOLATION_COOLDOWN_MS = 10000; // 10 seconds cooldown between ANY violations to group simultaneous events
  const detectedStorageViolationRef = useRef(false); // Flag for storage violation


  // Per-question timer system

  const [timedOutQuestions, setTimedOutQuestions] = useState<Set<number>>(new Set());
  const timedOutQuestionsRef = useRef<Set<number>>(new Set()); // Ref mirror for timer loop access
  const [timePerQuestion, setTimePerQuestion] = useState(30); // Default 30 seconds
  const questionTimerInitialized = useRef(false); // Track if timer has been initialized
  const questionTimerRef = useRef<NodeJS.Timeout | null>(null); // Track the interval
  const currentQuestionRef = useRef(0); // Track current question for stable reference
  const totalTestTimerRef = useRef<NodeJS.Timeout | null>(null); // Track main test timer


  // Track time remaining for each question individually
  const questionTimesRef = useRef<Record<number, number>>({}); // Store remaining time per question
  const questionTimeLeftRef = useRef(0); // Track current question time left
  const lastQuestionRef = useRef<number>(-1); // Track last viewed question

  // Auto-submit safeguard state (removed lastAutoSubmitRef)
  const backupIntervalRef = useRef<NodeJS.Timeout>();
  // CRITICAL: Initialize to -1 (sentinel) to prevent race condition with timer loop
  // -1 means "not initialized" — timer loop skips until init effect sets a positive value
  const timeLeftRef = useRef<number>(-1); // -1 = not initialized, prevents premature auto-submit
  const totalDurationSecondsRef = useRef<number>(0); // Track exact total duration for elapsed time calculations

  // Submit function ref for use in timers
  const handleSubmitRef = useRef<() => Promise<void>>(async () => { });

  // Track component mount state
  const isMountedRef = useRef(true);
  // Track if we've already attempted to auto-start the test
  const autoStartAttemptedRef = useRef(false);
  // Track initial fullscreen dimensions for DevTools detection
  const fullscreenDimensionsRef = useRef<{ width: number; height: number; ratio: number } | null>(null);
  // Flag to allow submission even if already submitting (for violation auto-submit)
  const forceSubmitOnViolationRef = useRef(false);
  // One-shot guard: prevents repeated user.update() Clerk API calls.
  // Clerk re-emits a new user object after every metadata update, which would
  // otherwise re-trigger the auto-role effect  // Question Shuffle Mapping
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const shuffledIndicesRef = useRef<number[]>([]);

  // Prevent multiple role-set attempts
  const hasAutoSetRoleRef = useRef(false);

  // Check if user needs authentication or role setup
  const needsAuth = !isLoaded || !user;
  const userRole = user?.unsafeMetadata?.role as string | undefined;
  const needsRole = !!user && !canonicalizeRole(userRole);

  // Note: localStorage redirect is handled by ProtectedTestRoute in App.tsx
  // No need to store it here - TakeTest only renders when user IS authenticated

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;

    // Remove body padding-top when test page loads (navbar is hidden)
    document.body.style.paddingTop = '0';

    // Initialize security measures on mount

    // Detect browser type for logging/debugging
    const detectBrowser = () => {
      const ua = navigator.userAgent;
      if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edge') === -1) return 'Chrome';
      if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) return 'Safari';
      if (ua.indexOf('Firefox') > -1) return 'Firefox';
      if (ua.indexOf('Edge') > -1 || ua.indexOf('Edg') > -1) return 'Edge';
      return 'Unknown';
    };
    detectBrowser();

    // Disable common keyboard shortcuts immediately (BEFORE test starts)
    // Works on all browsers - uses standard keyboard events
    const blockShortcuts = (e: KeyboardEvent) => {
      // Block all DevTools shortcuts regardless of test state
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Ctrl/Cmd + Shift + I (DevTools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Ctrl/Cmd + Shift + J (Console)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Ctrl/Cmd + U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Ctrl/Cmd + Shift + C (Inspect Element)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    document.addEventListener('keydown', blockShortcuts, true); // Use capture phase for priority

    return () => {
      isMountedRef.current = false;
      document.removeEventListener('keydown', blockShortcuts, true);
      // Body padding was set to '0' on mount; no need to restore
    };
  }, []);

  // 1. Fullscreen Enforcement - Cross-browser compatible
  const enterFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement as ElementWithPrefix;
      const docWithPrefix = document as DocumentWithPrefix;
      // Check if already fullscreen (works on all modern browsers)
      const isCurrentlyFullscreen = !!docWithPrefix.fullscreenElement ||
        !!docWithPrefix.webkitFullscreenElement ||
        !!docWithPrefix.mozFullScreenElement ||
        !!docWithPrefix.msFullscreenElement;

      if (isCurrentlyFullscreen) {
        return;
      }

      // Try standard API first (Chrome, Firefox, Edge, Safari 16+)
      if (elem.requestFullscreen) {
        await elem.requestFullscreen({ navigationUI: 'hide' }).catch((err: Error) => {
          if (err.name !== 'NotSupportedError') {
            addToast({
              type: 'warning',
              title: 'Fullscreen Unavailable',
              message: 'Fullscreen mode could not be enabled. Test will continue.'
            });
          }
        });
      }
      // Fallback to webkit (Safari, older Chrome)
      else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen().catch((_err: Error) => {
          addToast({
            type: 'warning',
            title: 'Fullscreen Unavailable',
            message: 'Fullscreen mode could not be enabled. Test will continue.'
          });
        });
      }
      // Fallback to mozilla (older Firefox)
      else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen().catch((_err: Error) => {
          // Silently handle Mozilla API errors
        });
      }
      // Fallback to ms (IE/old Edge)
      else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen().catch((_err: Error) => {
          // Silently handle MS API errors
        });
      }
    } catch (_error) {
      // Silently handle any other fullscreen errors
    }
  }, [addToast]);

  const exitFullscreen = useCallback(async () => {
    try {
      // Mark this as a legitimate exit to prevent violation
      isLegitimateExitRef.current = true;

      const docWithPrefix = document as DocumentWithPrefix;

      // Try standard API first
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
      // Fallback to webkit
      else if (docWithPrefix.webkitExitFullscreen) {
        await docWithPrefix.webkitExitFullscreen();
      }
      // Fallback to mozilla
      else if (docWithPrefix.mozCancelFullScreen) {
        await docWithPrefix.mozCancelFullScreen();
      }
      // Fallback to ms
      else if (docWithPrefix.msExitFullscreen) {
        await docWithPrefix.msExitFullscreen();
      }

    } catch (error) {
      console.warn('Exit fullscreen error (safe to ignore on mobile):', error);
    } finally {
      // Always reset the flag after a short delay, even on failure
      setTimeout(() => {
        isLegitimateExitRef.current = false;
      }, 100);
    }
  }, []);

  // Handle role setup for authenticated users without a role
  const handleRoleSetup = async (selectedRole: 'teacher' | 'student') => {
    if (!user) return;

    try {
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          role: selectedRole
        }
      });
      // Role is now set, component will re-render and show the test
    } catch (error) {
      console.error('Error setting role:', error);
    }
  };

  const testQuery = useTestQuery(testId);
  const test = testQuery.data || null;

  // Test query status monitoring (silent in production)

  // Track negative marking status for scoring
  const [negativeMarkingEnabled, setNegativeMarkingEnabled] = useState(false);

  // Update negative marking status when test data is loaded
  useEffect(() => {
    if (test) {
      setNegativeMarkingEnabled(test.negativeMarkingEnabled || false);
    }
  }, [test]);

  // Auto-set student role when accessing test via link.
  // Guards against Clerk rate limits: every user.update() causes Clerk to re-emit
  // the user object, which would re-trigger an effect depending on `user`. The
  // hasAutoSetRoleRef flag ensures the API call happens at most once per mount.
  useEffect(() => {
    if (needsRole && user && testId && !hasAutoSetRoleRef.current) {
      hasAutoSetRoleRef.current = true; // prevent re-entry
      (async () => {
        try {
          await user.update({
            unsafeMetadata: {
              ...user.unsafeMetadata,
              role: 'student'
            }
          });
          // Refetch test data after role is set
          testQuery.refetch();
        } catch (error) {
          console.error('Error auto-setting role:', error);
          hasAutoSetRoleRef.current = false; // allow retry on error
        }
      })();
    }
    // user?.id is stable (doesn't change after metadata update), unlike the user
    // object reference which Clerk replaces after every update — using user?.id
    // prevents the effect from re-firing when only metadata changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsRole, user?.id, testId]);

  // Get user role to determine if we need single question fetching
  const canonicalizedRole = user ? canonicalizeRole(userRole) : null;
  const isStudent = canonicalizedRole === 'student';

  // Use React Query for attempt state
  const attemptQuery = useAttemptQuery(testId);
  const attempt = attemptQuery.data || null;

  // For students: fetch question count and current question dynamically
  const [questionCount, setQuestionCount] = useState<number>(0);

  // Fetch question count for students (teachers get full test.questions array)
  useEffect(() => {
    if (isStudent && testId && test) {
      getQuestionCount(testId).then(count => {
        setQuestionCount(count);
      });
    } else if (!isStudent && test) {
      setQuestionCount(test.questions.length);
      // Teachers don't use shuffling, just 1-to-1 mapping
      const sequential = Array.from({ length: test.questions.length }, (_, i) => i);
      setShuffledIndices(sequential);
      shuffledIndicesRef.current = sequential;
    }
  }, [isStudent, testId, test]);

  // Shuffling logic moved into loadAllQuestions since we need section data

  // Questions are seamlessly randomized for students.
  // We fetch the question corresponding to the underlying original order_index via the shuffle map.
  const actualNextQuestionIndex = shuffledIndices.length > currentQuestion ? shuffledIndices[currentQuestion] : currentQuestion;

  const currentQuestionQuery = useSingleQuestionQuery(
    testId || '',
    actualNextQuestionIndex,
    isStudent && testStarted && shuffledIndices.length > 0
  );

  // Current question data
  const currentQuestionData = useMemo(() => {
    if (!isStudent) {
      // Teachers: use full test.questions array
      return null; // Will use displayQuestions instead
    }

    // Students: use dynamically fetched question
    if (!currentQuestionQuery.data) return null;

    return {
      id: currentQuestionQuery.data.id,
      type: (currentQuestionQuery.data as any).type || 'mcq',
      question: currentQuestionQuery.data.question,
      options: currentQuestionQuery.data.options,
      correctAnswer: undefined as any, // Students never see correct answer
      marks: currentQuestionQuery.data.marks || 1, // Include marks field
      section: currentQuestionQuery.data.section || 'General'
    };
  }, [isStudent, currentQuestionQuery.data]);

  // PERFORMANCE & SUFFLE: Fetch ALL questions at once, group by section, shuffle, and prepopulate cache
  useEffect(() => {
    if (!isStudent || !testStarted || !testId || !user) return;

    const loadAllQuestionsAndShuffle = async () => {
      try {
        // Fetch all questions in parallel
        const questions = await fetchAllQuestionsForTest(user, testId);

        // Pre-populate React Query cache with all questions for instant access
        questions.forEach((question) => {
          queryClient.setQueryData(
            ['single-question', testId, question.orderIndex, user.id],
            question
          );
        });

        console.log(`✅ Preloaded ${questions.length} questions into cache`);

        // Generate or load shuffled indices grouped by SECTION
        const storageKey = `quizmaster_shuffle_${testId}_${user.id}`;
        const stored = localStorage.getItem(storageKey);

        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length === questions.length) {
              setShuffledIndices(parsed);
              shuffledIndicesRef.current = parsed;
              return;
            }
          } catch (e) {
            console.warn('Failed to parse stored shuffle indices', e);
          }
        }

        // Generate section-grouped shuffle
        // 1. Group by section
        const groups = new Map<string, number[]>();
        questions.forEach((q) => {
          const section = q.section || 'General';
          if (!groups.has(section)) groups.set(section, []);
          groups.get(section)!.push(q.orderIndex);
        });

        // 2. Sort sections (Optional: to keep things deterministic)
        const sortedSections = Array.from(groups.keys()).sort();

        // 3. Shuffle each group individually and flatMap
        const newShuffledIndices: number[] = [];
        sortedSections.forEach((section) => {
          const indices = groups.get(section)!;
          // Fisher-Yates shuffle within the section
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
          }
          newShuffledIndices.push(...indices);
        });

        localStorage.setItem(storageKey, JSON.stringify(newShuffledIndices));
        setShuffledIndices(newShuffledIndices);
        shuffledIndicesRef.current = newShuffledIndices;

      } catch (error) {
        console.error('Error preloading questions or shuffling:', error);
      }
    };

    loadAllQuestionsAndShuffle();
  }, [testStarted, testId, user, isStudent, queryClient]);

  // Sync global loading context with query status
  useEffect(() => {
    if (testQuery.isFetching) startLoading('test:load'); else stopLoading('test:load');
  }, [testQuery.isFetching, startLoading, stopLoading]);

  // Validate test when loaded
  useEffect(() => {
    if (!testId) {
      console.error('❌ No testId in URL parameters!');
      setTestError('Invalid test link - missing test ID');
      return;
    }
    if (testQuery.isLoading) return; // still loading
    if (testQuery.error) {
      console.error('❌ Test query error:', testQuery.error);
      setTestError('Failed to load test');
      return;
    }
    const testData = test;
    if (!testData) {
      console.error('❌ Test not found for ID:', testId);
      setTestError('Test not found');
      return;
    }

    // Allow access to inactive tests via shared links
    // Removed: if (!testData.isActive) check
    const now = new Date();
    const startDate = new Date(testData.startDate);
    const endDate = new Date(testData.endDate);
    if (now < startDate) {
      setTestError('This test has not started yet');
      return;
    }
    if (now > endDate) {
      setTestError('This test has ended');
      return;
    }
    setTestError(null);
  }, [testQuery.isLoading, testQuery.error, test, testId]);

  // DevTools detection before test starts (silent, no toasts to avoid loops)
  useEffect(() => {
    if (!attempt || !test || testStarted) return;

    if (attempt.status === 'submitted') {
      // Show the "already submitted" screen — let the student decide:
      // they can view their existing results OR retake the test.
      // Do NOT auto-navigate; the results page may not load if migrations aren't applied.
      setAlreadySubmitted(true);
      return;
    }

    if (attempt.status === 'in_progress') {
      setTestStarted(true);
    }
  }, [attempt, test, testStarted, testId, navigate]);

  useEffect(() => {
    if (test && testStarted) {
      // Compute remaining time — use the sum of per-question times so it matches exactly
      const totalQuestions = isStudent ? questionCount : test.questions.length;
      const calculatedTimePerQuestion = test.timePerQuestion
        ? test.timePerQuestion
        : Math.floor((test.duration * 60) / (totalQuestions || 1));

      // Total time = sum of all per-question timers (not the rounded-up test.duration)
      const exactTotalTime = calculatedTimePerQuestion * (totalQuestions || 1);
      let remaining = exactTotalTime;
      if (attempt?.startedAt) {
        const startedTs = new Date(attempt.startedAt).getTime();
        const nowTs = Date.now();
        const elapsed = Math.max(0, Math.floor((nowTs - startedTs) / 1000));
        remaining = Math.max(0, remaining - elapsed);
      }
      timeLeftRef.current = remaining; // Initialize ref
      totalDurationSecondsRef.current = exactTotalTime; // Store exact total for elapsed calculations
      setTimePerQuestion(calculatedTimePerQuestion);

      // Initialize all question timers with full time (only once)
      if (!questionTimerInitialized.current && totalQuestions > 0) {
        const initialTimes: Record<number, number> = {};
        for (let i = 0; i < totalQuestions; i++) {
          initialTimes[i] = calculatedTimePerQuestion;
        }
        questionTimesRef.current = initialTimes;
        questionTimeLeftRef.current = calculatedTimePerQuestion;
        questionTimerInitialized.current = true; // Mark as initialized
      }

      // answers length should match displayQuestions length (deferred until we know mapping)
    }
  }, [test, testStarted, attempt, isStudent, questionCount]);

  // Display questions in original order - NO RANDOMIZATION
  // OPTIMIZED: Only recompute when test or currentQuestionData changes, not on currentQuestion
  const displayQuestions = useMemo(() => {
    if (!test) return [] as Array<LegacyTest['questions'][number]>;

    // For teachers: use questions in original order (sorted by order_index)
    if (!isStudent) {
      return test.questions;
    }

    // For students: create lightweight placeholder array
    // Only the current question needs real data, rest are just for navigation
    const placeholders = Array.from({ length: questionCount }, (_, idx) => {
      // If this is the current question and we have data, use it
      if (idx === currentQuestion && currentQuestionData) {
        return currentQuestionData as any;
      }
      // Otherwise, minimal placeholder
      return {
        id: `placeholder-${idx}`,
        question: '',
        options: [],
        correctAnswer: undefined,
        marks: 1
      };
    });

    return placeholders as Array<LegacyTest['questions'][number]>;
  }, [test, isStudent, questionCount, currentQuestionData, currentQuestion]);

  const getDisplayOptions = useCallback((q: LegacyTest['questions'][number]): string[] => {
    // NO SHUFFLING - return options in original order
    // Safeguard: check if options exist (for non-MCQ types)
    if ('options' in q && q.options) {
      return q.options;
    }
    return [];
  }, []);

  // Initialize / resize answers when displayQuestions known
  useEffect(() => {
    if (testStarted && displayQuestions.length > 0) {
      setAnswers(prev => {
        // Keep existing answers if length matches, don't reset
        if (prev.length === displayQuestions.length) return prev;
        // If length changed, create new array but preserve existing answers
        const newAnswers = new Array(displayQuestions.length).fill(-1);
        if (prev.length > 0) {
          // Use for-loop to handle sparse arrays correctly (forEach skips holes)
          for (let i = 0; i < prev.length && i < newAnswers.length; i++) {
            if (prev[i] !== undefined) newAnswers[i] = prev[i];
          }
        }
        // CRITICAL: keep answersRef in sync so submit always sees the full array
        answersRef.current = newAnswers;
        return newAnswers;
      });
    }
  }, [testStarted, displayQuestions.length]); // Only depend on length, not the entire array

  const handleAnswerSelect = useCallback((optionIndex: number) => {
    // Fall back to sequential index if shuffle map not yet loaded.
    // This is consistent with actualNextQuestionIndex which also falls back to currentQuestion.
    const actualIndex = (shuffledIndicesRef.current.length > 0 && shuffledIndicesRef.current[currentQuestion] !== undefined)
      ? shuffledIndicesRef.current[currentQuestion]
      : currentQuestion;

    setAnswers(prev => {
      // Safety: if answers array not yet initialized, skip silently
      if (prev.length === 0) return prev;
      const newAnswers = [...prev];
      if (actualIndex < newAnswers.length) {
        newAnswers[actualIndex] = prev[actualIndex] === optionIndex ? -1 : optionIndex;
        answersRef.current = newAnswers;
      }
      return newAnswers;
    });
  }, [currentQuestion]);

  const handleNext = useCallback(() => {
    if (displayQuestions.length && currentQuestion < displayQuestions.length - 1) {
      setCurrentQuestion(q => q + 1);
      // Timer will be restored from saved time by the effect watching currentQuestion
    }
  }, [displayQuestions.length, currentQuestion]);

  const handlePrevious = useCallback(() => {
    // Prevent navigating back to timed-out questions
    if (currentQuestion > 0 && !timedOutQuestions.has(currentQuestion - 1)) {
      setCurrentQuestion(q => q - 1);
      // Timer will be restored from saved time by the effect watching currentQuestion
    }
  }, [currentQuestion, timedOutQuestions]);

  const toggleFlag = () => {
    const actualIndex = shuffledIndicesRef.current[currentQuestion] !== undefined
      ? shuffledIndicesRef.current[currentQuestion]
      : currentQuestion;
    setFlagged(f => ({ ...f, [actualIndex]: !f[actualIndex] }));
  };
  const clearSelection = () => handleAnswerSelect(answersRef.current[
    shuffledIndicesRef.current[currentQuestion] !== undefined ? shuffledIndicesRef.current[currentQuestion] : currentQuestion
  ] || -1);
  const testRef = useRef(test);
  const userRef = useRef(user);
  const testIdRef = useRef(testId);
  const attemptRef = useRef(attempt);
  const userInitiatedSubmitRef = useRef(false); // Flag for user-initiated vs auto-submit
  const submissionInProgressRef = useRef(false); // Ref-based guard against double-tap on mobile
  useEffect(() => {
    testRef.current = test;
    userRef.current = user;
    testIdRef.current = testId;
    attemptRef.current = attempt;
  }, [test, user, testId, attempt]);

  // When submitting, we must send answers in the display order (server maps back using ordering metadata)
  // OPTIMIZED: Reduced dependencies from 11 to 4 by using refs for stable values
  const handleSubmit = useCallback(async () => {
    if (!testRef.current || !userRef.current) return;

    // REF-BASED double-submit guard (immune to React batching, critical for Android)
    if (submissionInProgressRef.current) return;

    // Don't submit if already submitting (unless forced by violation or user click)
    if (submitting && !forceSubmitOnViolationRef.current && !userInitiatedSubmitRef.current) return;

    if (attemptRef.current?.status === 'submitted') {
      // Exit fullscreen before navigating to results (non-blocking)
      exitFullscreen().catch(e => console.warn(e));
      navigate(`/results/${testIdRef.current}`, { replace: true });
      return;
    }

    // Lock submission immediately via ref (synchronous, before any async work)
    submissionInProgressRef.current = true;

    // If user explicitly clicked submit button, allow it even if submitting
    userInitiatedSubmitRef.current = false; // Reset flag

    setSubmitting(true);
    forceSubmitOnViolationRef.current = false; // Reset flag

    try {
      // Calculate elapsed time: totalDuration - timeLeft = elapsed
      const totalDurationSeconds = totalDurationSecondsRef.current;
      // Use the ref for the most up-to-date time left
      const currentTimeLeft = timeLeftRef.current;
      const elapsedTime = Math.max(0, totalDurationSeconds - currentTimeLeft);

      console.log('⏱️ TIME CALCULATION:', {
        totalDuration: totalDurationSeconds,
        timeLeft: currentTimeLeft,
        elapsedTime,
        formatted: `${Math.floor(elapsedTime / 60)}:${(elapsedTime % 60).toString().padStart(2, '0')}`
      });

      // Apply a strict 5000ms timeout so slow Android networks do not hang the UI indefinitely
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SUBMIT_TIMEOUT')), 5000)
      );

      const submitResult = await Promise.race([
        submitResultMutation.mutateAsync({
          testId: testRef.current.id,
          answers: answersRef.current, // Use ref for always-current answers (prevents stale closure on rapid submit)
          testData: test || undefined,
          timeTaken: elapsedTime,
          negativeMarkingEnabled
        }),
        timeoutPromise
      ]);

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      // Cache result in localStorage for instant display on results page
      // This bypasses Android cache/RLS/network issues — results show immediately
      try {
        localStorage.setItem(`quizmaster_result_${testId}`, JSON.stringify({
          testId,
          score: submitResult.score ?? 0,
          earnedMarks: submitResult.earnedMarks,
          totalMarks: submitResult.totalMarks,
          totalQuestions: submitResult.totalQuestions ?? answersRef.current.length,
          timeTaken: elapsedTime,
          answers: answersRef.current,
          completedAt: new Date().toISOString(),
          studentName: userRef.current?.fullName || userRef.current?.firstName || 'Student'
        }));
      } catch (cacheErr) { /* localStorage may be full or blocked */ }

      // Exit fullscreen after successful submission (non-blocking)
      exitFullscreen().catch(e => console.warn(e));

      addToast({
        type: 'success',
        title: 'Test Submitted!',
        message: 'Your answers have been submitted successfully.'
      });

      navigate(`/results/${testId}`, { replace: true });
    } catch (error: unknown) {
      console.error('Error submitting test (server RPC):', error);

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      const msg = isErrorWithMessage(error) ? error.message.toUpperCase() : '';
      const errorDetail = isErrorWithMessage(error) ? error.message : String(error);
      if (msg.includes('ALREADY_SUBMITTED') || msg.includes('RESULT_ALREADY_EXISTS') ||
        msg.includes('DUPLICATE') || msg.includes('UNIQUE') || msg.includes('23505') || msg.includes('SUBMIT_TIMEOUT')) {

        // Force background cache save so result page has immediate data
        try {
          localStorage.setItem(`quizmaster_result_${testId}`, JSON.stringify({
            testId,
            score: 0,
            earnedMarks: 0,
            totalMarks: test?.totalMarks || 0,
            totalQuestions: test?.questions?.length || answersRef.current.length,
            timeTaken: Math.max(0, totalDurationSecondsRef.current - timeLeftRef.current),
            answers: answersRef.current,
            completedAt: new Date().toISOString(),
            studentName: userRef.current?.fullName || userRef.current?.firstName || 'Student'
          }));
        } catch (e) { /* ignore */ }

        // Navigate immediately as fallback
        exitFullscreen().catch(e => console.warn(e));
        navigate(`/results/${testId}`, { replace: true });
      } else {
        // Show actual error for diagnosis
        addToast({
          type: 'error',
          title: 'Submission Failed',
          message: `${errorDetail.slice(0, 150)}. Retrying...`
        });

        // Auto-retry once after a short delay
        submissionInProgressRef.current = false;
        setSubmitting(false);
        setTimeout(async () => {
          if (!isMountedRef.current) return;
          try {
            submissionInProgressRef.current = true;
            setSubmitting(true);
            const userUUID = await getCachedUUIDFromClerkId(user!.id);
            const elapsedTime = Math.max(0, totalDurationSecondsRef.current - timeLeftRef.current);
            // Force contiguous array to prevent mobile JSON serialization holes
            const maxLen = test?.questions?.length || answersRef.current.length;
            const retryAnswers = Array.from({ length: Math.max(answersRef.current.length, maxLen) }, (_, i) => {
              const a = answersRef.current[i];
              return (a === undefined || a === null || isNaN(a)) ? -1 : Math.round(a);
            });

            // Wait max 5000ms for retry
            const retryTimeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('SUBMIT_TIMEOUT')), 5000)
            );

            const { data: retryData, error: retryError } = await Promise.race([
              supabase.rpc('submit_test_result', {
                p_test_id: testId!,
                p_student_id: userUUID,
                p_answers: retryAnswers,
                p_time_taken: elapsedTime
              }),
              retryTimeoutPromise
            ]) as { data: any, error: any };
            if (retryError) throw retryError;
            if (!isMountedRef.current) return;

            // Cache retry result in localStorage for instant display on results page
            try {
              localStorage.setItem(`quizmaster_result_${testId}`, JSON.stringify({
                testId,
                score: retryData?.score ?? 0,
                earnedMarks: retryData?.earned_marks,
                totalMarks: retryData?.total_marks,
                totalQuestions: retryData?.total_questions ?? answersRef.current.length,
                timeTaken: elapsedTime,
                answers: answersRef.current,
                completedAt: new Date().toISOString(),
                studentName: userRef.current?.fullName || userRef.current?.firstName || 'Student'
              }));
            } catch (cacheErr) { /* ignore */ }

            exitFullscreen().catch(e => console.warn(e));
            addToast({ type: 'success', title: 'Test Submitted!', message: 'Your answers have been submitted successfully.' });
            navigate(`/results/${testId}`, { replace: true });
          } catch (retryErr: unknown) {
            console.error('Retry also failed:', retryErr);
            if (!isMountedRef.current) return;
            const retryMsg = isErrorWithMessage(retryErr) ? retryErr.message : String(retryErr);
            const retryMsgUpper = retryMsg.toUpperCase();
            if (retryMsgUpper.includes('DUPLICATE') || retryMsgUpper.includes('UNIQUE') ||
              retryMsgUpper.includes('23505') || retryMsgUpper.includes('ALREADY') || retryMsgUpper.includes('SUBMIT_TIMEOUT')) {

              // Force background cache save so result page has immediate data
              try {
                localStorage.setItem(`quizmaster_result_${testId}`, JSON.stringify({
                  testId,
                  score: 0,
                  earnedMarks: 0,
                  totalMarks: test?.totalMarks || 0,
                  totalQuestions: test?.questions?.length || answersRef.current.length,
                  timeTaken: Math.max(0, totalDurationSecondsRef.current - timeLeftRef.current),
                  answers: answersRef.current,
                  completedAt: new Date().toISOString(),
                  studentName: userRef.current?.fullName || userRef.current?.firstName || 'Student'
                }));
              } catch (e) { /* ignore */ }

              exitFullscreen().catch(e => console.warn(e));
              navigate(`/results/${testId}`, { replace: true });
            } else {
              addToast({
                type: 'error',
                title: 'Submission Failed',
                message: `Error: ${retryMsg.slice(0, 200)}`
              });
            }
          } finally {
            if (isMountedRef.current) setSubmitting(false);
            submissionInProgressRef.current = false;
          }
        }, 2000);
        return; // Skip the finally block's reset since we handle it in the retry
      }
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
      submissionInProgressRef.current = false; // Always release the ref guard
    }
  }, [submitting, submitResultMutation, navigate, addToast, exitFullscreen, test, negativeMarkingEnabled, testId, user]);

  // Update handleSubmitRef
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Anti-cheating violation handler (must be before keyboard handler that depends on it)
  // OPTIMIZED: Uses refs to be referentially stable, preventing event listener churn
  const violationsRef = useRef(0);
  const testStartedRef = useRef(testStarted);

  // Keep refs in sync with state
  useEffect(() => {
    violationsRef.current = violations;
    testStartedRef.current = testStarted;
  }, [violations, testStarted]);

  // Stable violation handler that doesn't change when state changes
  const handleViolation = useCallback(async (reason: string) => {
    if (!testStartedRef.current) return;

    // Check cooldown for this specific violation type to prevent spam
    const now = Date.now();

    // Check global cooldown - if another violation happened recently, ignore this one
    // This groups simultaneous events (e.g. blur + visibility hidden) into a single violation
    if (now - lastGlobalViolationTimeRef.current < GLOBAL_VIOLATION_COOLDOWN_MS) {
      console.log(`⚠️ Violation grouped: ${reason} (within ${GLOBAL_VIOLATION_COOLDOWN_MS}ms of last violation)`);
      return;
    }

    const lastViolationTime = lastViolationTimesRef.current[reason] || 0;
    if (now - lastViolationTime < violationCooldownMs) {
      return; // Still in cooldown period for this violation type
    }
    lastViolationTimesRef.current[reason] = now;
    lastGlobalViolationTimeRef.current = now;

    // Use ref to get current count without adding dependency
    const currentCount = violationsRef.current;
    const newViolationCount = currentCount + 1;

    // Update ref immediately
    violationsRef.current = newViolationCount;
    // Update state to trigger UI update
    setViolations(newViolationCount);

    if (newViolationCount === 1) {
      // First violation - show warning ONLY, do NOT auto-submit
      setWarningMessage(`⚠️ Warning: ${reason}. This is your first warning. Another violation will terminate the test.`);
      setShowWarning(true);

      // Hide warning after 5 seconds ONLY if it's NOT a fullscreen violation
      // Fullscreen violations must be clicked by the user to re-enter fullscreen
      if (!reason.includes('fullscreen')) {
        if (violationTimeoutRef.current) clearTimeout(violationTimeoutRef.current);
        violationTimeoutRef.current = setTimeout(() => {
          setShowWarning(false);
        }, 5000);
      } else {
        // Clear any existing timeout so it doesn't accidentally dismiss this warning
        if (violationTimeoutRef.current) {
          clearTimeout(violationTimeoutRef.current);
          violationTimeoutRef.current = undefined;
        }
      }

      addToast({
        type: 'error',
        title: 'Security Warning',
        message: `${reason}. One more violation will end the test.`
      });
      // IMPORTANT: Do NOT set submitting to true on 1st violation
    } else if (newViolationCount >= 2) {
      // Second violation - terminate test and auto-submit
      // Clear the 5-second auto-dismiss timeout set by the 1st violation.
      // Without this, it would fire 1-4 seconds later and close the
      // "Test Terminated" blocking dialog unexpectedly.
      if (violationTimeoutRef.current) {
        clearTimeout(violationTimeoutRef.current);
        violationTimeoutRef.current = undefined;
      }
      setWarningMessage(`🚫 Test Terminated: ${reason}. Multiple violations detected.`);
      setShowWarning(true);

      addToast({
        type: 'error',
        title: 'Test Terminated',
        message: 'Multiple security violations detected. Submitting test...'
      });

      // Wait briefly then submit with proper async handling
      setTimeout(async () => {
        try {
          // Force submit even if already submitting
          forceSubmitOnViolationRef.current = true;
          // Use ref to call latest submit function
          if (handleSubmitRef.current) {
            await handleSubmitRef.current();
          }
        } catch (error) {
          // Silent error - still try to navigate
          if (isMountedRef.current) {
            await exitFullscreen();
            // Use ref for testId
            if (testIdRef.current) {
              navigate(`/results/${testIdRef.current}`, { replace: true });
            }
          }
        }
      }, 2000);
    }
  }, [addToast, exitFullscreen, navigate]); // Removed unstable dependencies: violations, testStarted, handleSubmit

  // Keyboard navigation effect with Alt+Tab/Window switching prevention
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!testStarted) return;

      // CRITICAL: Block Alt+Tab (window switching) - ACTIVELY PREVENTED
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('⛔ Alt+Tab blocked - Window switching not allowed');
        return;
      }

      // Block Windows key to prevent Start menu / Command center
      if (e.key === 'Meta' || e.key === 'OS') {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('⛔ Windows/Meta key blocked');
        return;
      }

      // Block Alt key alone (could trigger menu)
      if (e.altKey && e.key === 'Alt') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Allow navigation keys
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < displayQuestions.length && !timedOutQuestions.has(idx)) {
          setCurrentQuestion(idx);
        }
      } else if (/^[a-dA-D]$/.test(e.key)) {
        const optionIdx = e.key.toLowerCase().charCodeAt(0) - 97;
        const optLength = getDisplayOptions(displayQuestions[currentQuestion]).length;
        if (optionIdx >= 0 && optionIdx < optLength) {
          handleAnswerSelect(optionIdx);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        const actualIndex = shuffledIndicesRef.current[currentQuestion] !== undefined
          ? shuffledIndicesRef.current[currentQuestion]
          : currentQuestion;
        setFlagged(f => ({ ...f, [actualIndex]: !f[actualIndex] }));
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [testStarted, displayQuestions, currentQuestion, getDisplayOptions, handleNext, handlePrevious, handleAnswerSelect, timedOutQuestions, handleViolation]);

  // Monitor fullscreen changes - works on all browsers
  useEffect(() => {
    if (!testStarted) return;

    const handleFullscreenChange = () => {
      // Check fullscreen status using all possible APIs (cross-browser)
      const docWithPrefix = document as DocumentWithPrefix;
      const isCurrentlyFullscreen = !!docWithPrefix.fullscreenElement ||
        !!docWithPrefix.webkitFullscreenElement ||
        !!docWithPrefix.mozFullScreenElement ||
        !!docWithPrefix.msFullscreenElement;

      // If exited fullscreen, re-enter immediately
      if (!isCurrentlyFullscreen && testStarted && !isLegitimateExitRef.current) {
        handleViolation('Exited fullscreen mode');

        // ANDROID FIX: Aggressive re-entry with multiple retry attempts
        let retryCount = 0;
        const maxRetries = 5; // Try up to 5 times

        const attemptReentry = () => {
          enterFullscreen()
            .then(() => {
              // Success - stop retrying
              retryCount = maxRetries;
            })
            .catch(() => {
              retryCount++;
              if (retryCount < maxRetries) {
                // Exponential backoff: 0ms, 50ms, 150ms, 300ms, 500ms
                const delay = retryCount === 1 ? 0 : retryCount * 50;
                setTimeout(attemptReentry, delay);
              }
            });
        };

        // Use requestAnimationFrame for faster first execution
        requestAnimationFrame(attemptReentry);
      }
    };

    // Add listeners for all fullscreen APIs (cross-browser compatibility)
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [testStarted, handleViolation, enterFullscreen]);

  // 2 & 3. Tab Switching & Window Focus Monitoring - ENHANCED with Prevention
  // Actively prevents window switching, refocuses window, and warns user
  useEffect(() => {
    if (!testStarted) return;

    // Track window focus state and attempt refocus
    let hasBlurred = false;
    let blurTimeRef = 0;

    const handleBlur = () => {
      hasBlurred = true;
      blurTimeRef = Date.now();

      // Try to refocus the window immediately
      const refocusAttempts = setInterval(() => {
        try {
          window.focus();
        } catch {
          // Browser may prevent programmatic focus
        }
      }, 100);

      // Stop refocus attempts after 2 seconds
      setTimeout(() => clearInterval(refocusAttempts), 2000);
    };

    const handleFocus = () => {
      if (hasBlurred) {
        const blurDuration = Date.now() - blurTimeRef;

        // If blur was brief (< 500ms), student tried Alt+Tab or clicked window button
        if (blurDuration < 500) {
          handleViolation('⛔ Window switch attempt detected (Alt+Tab or window button)');
        }
        hasBlurred = false;
      }
    };

    const handleVisibilityChange = () => {
      // Flag if tab becomes hidden
      if (document.hidden) {
        handleViolation('⛔ Window/tab minimized or switched');
      }
    };

    // Block trackpad swipe gestures (3-finger left/right swipe to go back/forward)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 3) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 3) {
        // Prevent 3-finger swipe back/forward
        e.preventDefault();
        handleViolation('⛔ Trackpad gesture blocked (3-finger swipe)');
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [testStarted, handleViolation]);

  // Window Close/Minimize Prevention - Warns user and blocks close attempts
  useEffect(() => {
    if (!testStarted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Prevent window close/refresh
      e.preventDefault();
      e.returnValue = '';

      handleViolation('⛔ Attempted to close window or refresh page');

      return '';
    };

    // Try to intercept window resize attempts (minimize)
    const handleWindowResize = () => {
      // If window was minimized/changed size drastically
      if (window.outerHeight < 100 || window.outerWidth < 100) {
        handleViolation('⛔ Window minimized');

        // Try to restore window (may not work in all browsers)
        try {
          window.resizeTo(window.screen.availWidth, window.screen.availHeight);
          window.moveTo(0, 0);
        } catch {
          // Some browsers block programmatic resizing
          console.warn('Cannot resize window - browser security policy');
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [testStarted, handleViolation]);

  // 4. Right-Click & Keyboard Shortcuts Restriction (during test only)
  useEffect(() => {
    if (!testStarted) return;

    const handleContextMenu = (e: MouseEvent) => {
      // Silently block the context menu during the test.
      // Right-click is disabled but does NOT count as a cheating violation.
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Keyboard shortcut cooldown (prevent spam F12/DevTools keybinds)
    let lastKeyboardViolationTime = 0;
    const keyboardCooldownMs = 500;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const inCooldown = now - lastKeyboardViolationTime < keyboardCooldownMs;

      // Try to block Alt+Tab (Windows/Linux) - won't work in all browsers but attempt anyway
      if ((e.altKey && e.key === 'Tab') || (e.ctrlKey && e.key === 'Tab')) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch {
          // Some browsers block this for security
        }
        if (!inCooldown) {
          lastKeyboardViolationTime = now;
          handleViolation('Attempted to switch windows with Alt+Tab');
        }
        return false;
      }

      // Block F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        if (!inCooldown) {
          lastKeyboardViolationTime = now;
          handleViolation('Attempted to open developer tools (F12)');
        }
        return false;
      }

      // Block Ctrl/Cmd + Shift + I (DevTools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        e.stopPropagation();
        if (!inCooldown) {
          lastKeyboardViolationTime = now;
          handleViolation('Attempted to open developer tools (Ctrl+Shift+I)');
        }
        return false;
      }

      // Block Ctrl/Cmd + Shift + J (Console)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
        e.stopPropagation();
        if (!inCooldown) {
          lastKeyboardViolationTime = now;
          handleViolation('Attempted to open developer console');
        }
        return false;
      }

      // Block Ctrl/Cmd + U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        if (!inCooldown) {
          lastKeyboardViolationTime = now;
          handleViolation('Attempted to view page source');
        }
        return false;
      }

      // Block Ctrl/Cmd + Shift + C (Inspect Element)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        if (!inCooldown) {
          lastKeyboardViolationTime = now;
          handleViolation('Attempted to inspect element');
        }
        return false;
      }

      // Block Alt+F4 (Close window) - Windows
      if (e.altKey && e.key === 'F4') {
        e.preventDefault();
        e.stopPropagation();
        if (!inCooldown) {
          lastKeyboardViolationTime = now;
          handleViolation('Attempted to close window with Alt+F4');
        }
        return false;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [testStarted, handleViolation]);

  // 8. Trackpad Gesture & Multi-touch Prevention
  // OPTIMIZED: Use passive listeners where safe to improve scrolling performance
  useEffect(() => {
    if (!testStarted) return;

    // Block multi-touch gestures (trackpad swipe to switch windows)

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        // Multi-touch detected (pinch, two-finger swipe)
        // Violation trigger disabled: causes false positives on phones/tablets 
        // when users tap two places by accident or type fast.
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        // Prevent pinch zoom and multi-touch gestures
        e.preventDefault();
      }

      // Single touch horizontal movement is allowed for native scrolling (e.g., question palette)
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Prevent native gesture handling
      if (e.touches.length === 0) {
        e.preventDefault();
      }
    };

    const handleGestureStart = (e: Event) => {
      // Safari-specific gesture events
      e.preventDefault();
      // Violation disabled to prevent false positives on iOS devices
    };

    // Prevent pinch-zoom on trackpad - use non-passive for preventDefault to work
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true }); // Can be passive - no preventDefault needed
    document.addEventListener('gesturestart', handleGestureStart, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('gesturestart', handleGestureStart);
    };
  }, [testStarted, handleViolation]);

  // 5. Developer Tools Detection (Size-Based) — DISABLED
  // The outerWidth-innerWidth approach produces false positives on normal PC setups
  // due to browser chrome, DPI scaling, taskbar, scrollbar, Windows display scaling, etc.
  // Keeping the ref so other code referencing fullscreenDimensionsRef doesn't break.
  useEffect(() => {
    if (!testStarted) return;
    if (!fullscreenDimensionsRef.current) {
      fullscreenDimensionsRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
        ratio: window.innerWidth / window.innerHeight
      };
    }
  }, [testStarted]);

  // 5b. Console Override & Disable (REMOVED - was blocking internal security logs)
  // Note: Console override was preventing security handlers from logging violations
  // Removed to allow proper violation tracking and debugging

  // 6. Additional DevTools Prevention via IDB/Performance API
  // Performance timing check REMOVED — false-positives on slow networks/mobile
  // Only localStorage size check retained with higher threshold
  useEffect(() => {
    if (!testStarted) return;

    const detectionInterval = setInterval(() => {
      // Check if localStorage size exceeds normal test size
      try {
        let totalSize = 0;
        for (const key in localStorage) {
          if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
            totalSize += localStorage[key].length;
          }
        }

        // If someone is trying to store/analyze data, size will be abnormal
        // Normal test should be < 500KB. Raised from 500K to 1MB to reduce false positives.
        if (totalSize > 1000000 && !detectedStorageViolationRef.current) {
          detectedStorageViolationRef.current = true;
          handleViolation('Abnormal storage activity detected');
        }
      } catch (e) {
        // Ignore errors
      }
    }, 15000);

    return () => clearInterval(detectionInterval);
  }, [testStarted, handleViolation]);

  // 7. Copy/Paste Prevention
  useEffect(() => {
    if (!testStarted) return;

    // Cooldown tracking for clipboard events (prevent spam)
    let lastClipboardViolationTime = 0;
    const clipboardCooldownMs = 500; // 500ms cooldown between clipboard violations

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - lastClipboardViolationTime > clipboardCooldownMs) {
        lastClipboardViolationTime = now;
        handleViolation('Attempted to copy test content');
      }
      return false;
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - lastClipboardViolationTime > clipboardCooldownMs) {
        lastClipboardViolationTime = now;
        handleViolation('Attempted to cut test content');
      }
      return false;
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - lastClipboardViolationTime > clipboardCooldownMs) {
        lastClipboardViolationTime = now;
        handleViolation('Attempted to paste content during test');
      }
      return false;
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
    };
  }, [testStarted, handleViolation]);

  // 8. Screen Resize Monitoring - DISABLED (too sensitive)
  // This was triggering false positives from legitimate browser behavior:
  // - Mobile keyboard show/hide
  // - Browser address bar auto-hide
  // - Zoom level changes
  // - Window maximize/minimize
  /*
  useEffect(() => {
    if (!testStarted) return;
    let initialWidth = window.innerWidth;
    let initialHeight = window.innerHeight;
    const handleResize = () => {
      const widthChange = Math.abs(window.innerWidth - initialWidth);
      const heightChange = Math.abs(window.innerHeight - initialHeight);
      if (widthChange > 100 || heightChange > 100) {
        handleViolation('Screen resized (possible split-screen usage)');
        initialWidth = window.innerWidth;
        initialHeight = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [testStarted, handleViolation]);
  */

  // 9. Alt+Tab and Window Switching Prevention
  useEffect(() => {
    if (!testStarted) return;

    let lastAltTabViolationTime = 0;
    const altTabCooldownMs = 1000;

    // Detect Alt+Tab (Windows/Linux) - Cannot prevent but we can warn
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && e.key === 'Tab') || (e.ctrlKey && e.key === 'Tab')) {
        const now = Date.now();
        if (now - lastAltTabViolationTime > altTabCooldownMs) {
          lastAltTabViolationTime = now;
          handleViolation('⛔ Alt+Tab pressed - window switching attempt detected');
        }
      }

      // Block Alt+F4 (close window)
      if (e.altKey && e.key === 'F4') {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastAltTabViolationTime > altTabCooldownMs) {
          lastAltTabViolationTime = now;
          handleViolation('⛔ Alt+F4 pressed - attempted to close window');
        }
        return false;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [testStarted, handleViolation]);

  // 10. Window Close/Minimize Prevention & Detection
  useEffect(() => {
    if (!testStarted) return;

    let lastWindowViolationTime = 0;
    const windowCooldownMs = 1000;

    // Prevent page unload (close/refresh)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      handleViolation('⛔ Attempted to close or refresh window');
      return '';
    };

    // Detect window blur (focus loss to another window)
    const handleBlur = () => {
      const now = Date.now();
      if (now - lastWindowViolationTime > windowCooldownMs) {
        lastWindowViolationTime = now;
        handleViolation('⛔ Window lost focus - switched to another application');
      }
    };

    // Try to regain focus
    const handleFocus = () => {
      // Re-enter fullscreen if available when window regains focus
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        // Already in fullscreen, just log focus
      }
    };

    // Detect window resize (minimize/restore)
    const handleResize = () => {
      const now = Date.now();

      // If window height becomes very small, likely minimized
      if (window.outerHeight < 100) {
        if (now - lastWindowViolationTime > windowCooldownMs) {
          lastWindowViolationTime = now;
          handleViolation('⛔ Window minimized');
        }

        // Try to restore window (may not work in all browsers)
        try {
          window.resizeTo(window.screen.availWidth, window.screen.availHeight);
          window.moveTo(0, 0);
        } catch {
          // Some browsers block programmatic resizing for security
          console.warn('Browser blocked window restore attempt');
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('blur', handleBlur, false);
    window.addEventListener('focus', handleFocus, false);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('resize', handleResize);
    };
  }, [testStarted, handleViolation]);

  // 11. Scheduled DevTools Check (Start, 3s, 7s) — DISABLED
  // The outerWidth-innerWidth size check produces false positives on normal PC setups.
  // Browser chrome, DPI scaling, taskbar, and OS-level window decoration all add to the diff.
  // Other anti-cheating measures (fullscreen enforcement, tab switch detection, copy prevention)
  // remain active and effective.

  // Cleanup violation timeout on unmount
  useEffect(() => {
    return () => {
      if (violationTimeoutRef.current) {
        clearTimeout(violationTimeoutRef.current);
      }
    };
  }, []);



  // Keep currentQuestionRef in sync
  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  // Handle question change - save current question's time and restore new question's time
  useEffect(() => {
    if (!testStarted || displayQuestions.length === 0) return;

    // Save the current question's remaining time BEFORE switching
    // Skip saving for timed-out questions — their time is already 0
    if (lastQuestionRef.current >= 0 && lastQuestionRef.current !== currentQuestion
      && !timedOutQuestions.has(lastQuestionRef.current)) {
      // Use the current ref value
      questionTimesRef.current[lastQuestionRef.current] = questionTimeLeftRef.current;
    }

    // Load the new question's remaining time
    const savedTime = questionTimesRef.current[currentQuestion];
    if (savedTime !== undefined) {
      questionTimeLeftRef.current = savedTime;
    }

    // Update last question tracker
    lastQuestionRef.current = currentQuestion;
  }, [currentQuestion, testStarted, displayQuestions.length, timedOutQuestions]);

  // Auto-navigate when current question times out — find next available question (ascending order)
  useEffect(() => {
    if (!testStarted || displayQuestions.length === 0) return;

    // Keep ref in sync with state so the interval timer can read it
    timedOutQuestionsRef.current = timedOutQuestions;

    // Only act if the current question is timed out
    if (!timedOutQuestions.has(currentQuestion)) return;

    // Find the first question that still has time remaining (ascending order)
    for (let i = 0; i < displayQuestions.length; i++) {
      if (!timedOutQuestions.has(i)) {
        setCurrentQuestion(i);
        return;
      }
    }
    // All questions are timed out — stay put, Submit button will appear via JSX condition
  }, [timedOutQuestions, currentQuestion, testStarted, displayQuestions.length]);



  // Auto-submit when all questions have timed out
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (!testStarted || displayQuestions.length === 0 || autoSubmittedRef.current) return;

    // Check if all questions have timed out
    if (timedOutQuestions.size === displayQuestions.length) {
      autoSubmittedRef.current = true;

      addToast({
        type: 'info',
        title: "Time's Up!",
        message: 'All question time has ended. Submitting your test now...'
      });

      // Small delay to show the message
      setTimeout(() => {
        handleSubmit();
      }, 1500);
    }
  }, [timedOutQuestions, displayQuestions.length, testStarted, handleSubmit, addToast]);

  // Auto-submit safeguard: periodic backup submission
  // OPTIMIZED: Use refs for stable test/attempt context instead of adding to dependencies
  useEffect(() => {
    if (!testStarted || !test || attempt?.status === 'submitted') return;

    // Periodic backup submit is DISABLED because submitResultMutation currently completes the test 
    // permanently in the backend instead of just saving progress.

    const intervalId = backupIntervalRef.current;
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [testStarted, test, attempt?.status, answers, testId, submitResultMutation, navigate, exitFullscreen]);

  // Note: Force-submit timeout is intentionally disabled.
  // The main timer loop (setInterval) already handles total-time-expiry via timeLeftRef <= 0.
  // A FORCE_SUBMIT_BUFFER > 0 caused premature submission on short per-question tests.

  // Timer effect - ROBUST: Runs continuous interval, handles cleanup correctly & Updates Refs
  useEffect(() => {
    // Only start timer when test is active
    if (!testStarted) return;

    // Clear any existing timer first just in case
    if (totalTestTimerRef.current) {
      clearInterval(totalTestTimerRef.current);
    }

    // Also clear question timer if exist
    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
    }

    // Main Test Timer & Question Timer Combined Loop
    // Running one loop for both is more efficient
    totalTestTimerRef.current = setInterval(() => {
      // CRITICAL GUARD: Skip if timer hasn't been initialized yet (-1 sentinel value)
      // This prevents race condition where timer loop fires before init effect sets the time
      if (timeLeftRef.current < 0) {
        return; // Not initialized yet — wait for timer init effect
      }

      // 1. Update Total Time (Ref only)
      if (timeLeftRef.current > 0) {
        timeLeftRef.current -= 1;
      }

      // Auto-submit when total time runs out (only when actually 0, not sentinel -1)
      if (timeLeftRef.current === 0) {
        if (totalTestTimerRef.current) clearInterval(totalTestTimerRef.current);
        if (handleSubmitRef.current) handleSubmitRef.current();
        return;
      }

      // 2. Update Question Time (Ref only - ONLY if timePerQuestion is active)
      // Skip if current question is already timed out (prevents race condition during navigation)
      const currentQ = currentQuestionRef.current;
      if (timedOutQuestionsRef.current.has(currentQ)) {
        return; // This question is locked — don't decrement or re-lock
      }

      // ONLY decrement and lock if test actually has timePerQuestion > 0
      if (test && test.timePerQuestion && test.timePerQuestion > 0) {
        if (questionTimeLeftRef.current > 0) { // Check ref directly
          questionTimeLeftRef.current -= 1;
        }

        // Handle Question Timeout Logic
        if (questionTimeLeftRef.current <= 0) {
          // Mark the current question's saved time as 0 so the navigate effect picks the right target
          questionTimesRef.current[currentQ] = 0;

          // Update ref immediately so next tick knows this question is locked
          const newRefSet = new Set(timedOutQuestionsRef.current);
          newRefSet.add(currentQ);
          timedOutQuestionsRef.current = newRefSet;

          // Update state (triggers re-render → auto-navigate effect)
          setTimedOutQuestions(prev => {
            if (prev.has(currentQ)) return prev;
            const newSet = new Set(prev);
            newSet.add(currentQ);
            return newSet;
          });
        }
      }
    }, 1000);

    return () => {
      if (totalTestTimerRef.current) {
        clearInterval(totalTestTimerRef.current);
        totalTestTimerRef.current = null;
      }
    };
  }, [testStarted, test]);

  // Auto-submit safeguard: handle page visibility changes and beforeunload
  // OPTIMIZED: Reduced dependencies by using refs and checking conditions inside handlers
  useEffect(() => {
    if (!testStarted || !test || attempt?.status === 'submitted') return;

    // Note: visibilitychange handler was REMOVED because it prematurely completed the test
    // on Android when the browser was momentarily hidden.

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Try to submit synchronously (best effort)
      if (isMountedRef.current) {
        try {
          // Calculate elapsed time using exact total duration
          const totalDurationSeconds = totalDurationSecondsRef.current;
          const elapsedTime = Math.max(0, totalDurationSeconds - timeLeftRef.current);
          // Use answersRef.current for fresh answers (beforeUnload fires asynchronously)
          submitResultMutation.mutateAsync({ testId: test.id, answers: answersRef.current, testData: test, timeTaken: elapsedTime, negativeMarkingEnabled });
        } catch (error) {
          console.warn('Before unload submit failed:', error);
        }
      }

      // Show warning to user
      e.preventDefault();
      e.returnValue = 'Your test progress may be lost if you leave this page.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [testStarted, test, attempt?.status, answers, testId, submitResultMutation, negativeMarkingEnabled]);

  // Utility functions
  const startTest = useCallback(async () => {
    if (!testId) return;

    try {
      const result = await startAttemptMutation.mutateAsync({ testId });
      if (result.attempt) {
        setTestStarted(true);
        // Force fullscreen immediately - even if DevTools is open
        // The fullscreen will override DevTools positioning
        for (let i = 0; i < 3; i++) {
          await enterFullscreen();
          // Small delay between retries to ensure fullscreen is properly applied
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        addToast({
          type: 'error',
          title: 'Failed to Start Test',
          message: 'Could not create test attempt. Please try again.'
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to Start Test',
        message: error instanceof Error ? error.message : 'Could not start test attempt. Please try again.'
      });
    }
  }, [testId, startAttemptMutation, enterFullscreen, addToast, setTestStarted]);



  // Auto-start test when component mounts if no existing attempt
  useEffect(() => {
    // Only attempt auto-start once
    if (autoStartAttemptedRef.current) {
      return;
    }

    // Don't auto-start if:
    // - We're still loading attempt data
    // - We're still loading test data
    // - Test data hasn't loaded yet
    // - Test has already been started
    // - An attempt already exists
    if (attemptQuery.isLoading || testQuery.isLoading || !test || testStarted || attempt) {
      return;
    }

    // Mark that we've attempted to start
    autoStartAttemptedRef.current = true;

    // Auto-start the test
    startTest();
  }, [test, attempt, attemptQuery.isLoading, testQuery.isLoading, testStarted, startTest]);

  const isErrorWithMessage = (e: unknown): e is { message: string } => {
    return typeof e === 'object' && e !== null && 'message' in (e as Record<string, unknown>) && typeof (e as Record<string, unknown>).message === 'string';
  };

  const answeredCount = useMemo(() => answers.filter(a => a !== -1).length, [answers]);

  useEffect(() => {
    if (progressBarRef.current && displayQuestions.length > 0) {
      const pct = (answeredCount / displayQuestions.length) * 100;
      progressBarRef.current.style.width = pct + '%';
    }
  }, [answeredCount, displayQuestions.length]);

  return (
    <TestUi
      isGlobalLoading={testQuery.isLoading || loading || !isLoaded || isLoading('test:load')}
      needsAuth={needsAuth}
      needsRole={needsRole}
      testError={testError}
      testId={testId}
      test={test}
      alreadySubmitted={alreadySubmitted}
      isAttemptLoading={attemptQuery.isLoading || (isStudent && attempt === undefined)}
      testStarted={testStarted}
      userFirstName={user?.firstName}
      isStudent={isStudent}
      handleRoleSetup={handleRoleSetup}
      enterFullscreen={enterFullscreen}
      currentQuestion={currentQuestion}
      setCurrentQuestion={setCurrentQuestion}
      displayQuestions={displayQuestions}
      shuffledIndices={shuffledIndices}
      answers={answers}
      handleAnswerSelect={handleAnswerSelect}
      clearSelection={clearSelection}
      flagged={flagged}
      toggleFlag={toggleFlag}
      timedOutQuestions={timedOutQuestions}
      violations={violations}
      showWarning={showWarning}
      setShowWarning={setShowWarning}
      warningMessage={warningMessage}
      attemptStatus={attempt?.status}
      submitting={submitting}
      handleSubmit={handleSubmit}
      userInitiatedSubmitRef={userInitiatedSubmitRef}
      currentQuestionData={currentQuestionData}
      getDisplayOptions={getDisplayOptions}
      timeLeftRef={timeLeftRef}
      questionTimeLeftRef={questionTimeLeftRef}
      timePerQuestion={timePerQuestion}
      hasPerQuestionTimer={!!(test?.timePerQuestion && test.timePerQuestion > 0)}
      handlePrevious={handlePrevious}
      handleNext={handleNext}
    />
  );
}

export default TakeTest;
