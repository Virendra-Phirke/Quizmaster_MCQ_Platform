import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, AlertCircle, Home, Clock, XCircle, BookOpen, Bookmark, AlertTriangle, Ban, Keyboard, Flag, ArrowLeft, ArrowRight, MinusCircle, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useUser } from '@clerk/clerk-react';
import { useSingleTestResultQuery } from '../../hooks/quizQueries';

interface TestData {
  negative_marks: number;
  id: string;
  title: string;
  description: string;
  duration: number;
  time_per_question: number;
  negative_marking_enabled?: boolean;
  start_date: string;
  end_date: string;
}

export default function TestInstructions() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { isLoaded } = useUser();
  const [testData, setTestData] = useState<TestData | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [totalMarks, setTotalMarks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeUntilStart, setTimeUntilStart] = useState<string | null>(null);
  const [testExpired, setTestExpired] = useState(false);

  const { data: existingResult, isLoading: loadingResult } = useSingleTestResultQuery(testId);

  useEffect(() => {
    const fetchTestData = async () => {
      if (!testId) { setLoading(false); return; }
      try {
        const [{ data: test, error: testError }, { data: questions, error: questionsError }] = await Promise.all([
          supabase
            .from('tests')
            .select('id, title, description, duration, time_per_question, negative_marking_enabled, negative_marks, start_date, end_date')
            .eq('id', testId)
            .single(),
          supabase.from('questions').select('marks').eq('test_id', testId),
        ]);

        if (testError) throw testError;
        setTestData(test);

        const startDate = new Date(test.start_date);
        const now = new Date();

        if (startDate > now) {
          const diff = startDate.getTime() - now.getTime();
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          let timeString = '';
          if (days > 0) timeString += `${days}d `;
          if (hours > 0) timeString += `${hours}h `;
          if (minutes > 0) timeString += `${minutes}m `;
          timeString += `${seconds}s`;
          setTimeUntilStart(timeString);

          const interval = setInterval(() => {
            const currentNow = new Date();
            const currentDiff = startDate.getTime() - currentNow.getTime();
            if (currentDiff <= 0) { clearInterval(interval); setTimeUntilStart(null); return; }
            const d = Math.floor(currentDiff / (1000 * 60 * 60 * 24));
            const h = Math.floor((currentDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((currentDiff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((currentDiff % (1000 * 60)) / 1000);
            let ts = '';
            if (d > 0) ts += `${d}d `;
            if (h > 0) ts += `${h}h `;
            if (m > 0) ts += `${m}m `;
            ts += `${s}s`;
            setTimeUntilStart(ts);
          }, 1000);

          return () => {
            clearInterval(interval);
          };
        }

        if (questionsError) throw questionsError;
        const count = questions?.length || 0;
        const marks = questions?.reduce((sum, q) => sum + (q.marks || 0), 0) || 0;

        if (test.end_date && new Date(test.end_date) < new Date()) {
          setTestExpired(true);
          return;
        }

        setQuestionCount(count);
        setTotalMarks(marks);
      } catch (err) {
        console.error('Error fetching test data:', err);
      } finally {
        setLoading(false);
      }
    };

    const cleanupPromise = fetchTestData();

    return () => {
      cleanupPromise.then(cleanupFn => {
        if (typeof cleanupFn === 'function') cleanupFn();
      });
    };
  }, [testId, navigate]);



  const handleStartTest = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().then(() => navigate(`/test/${testId}/take`));
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
      setTimeout(() => navigate(`/test/${testId}/take`), 500);
    } else {
      navigate(`/test/${testId}/take`);
    }
  };

  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const calculatedTotalSeconds = testData?.time_per_question && testData.time_per_question > 0 && questionCount
    ? questionCount * testData.time_per_question
    : (testData?.duration || 0) * 60;

  const timePerQuestionDisplay = testData?.time_per_question && testData.time_per_question > 0
    ? formatDuration(testData.time_per_question) : 'Overall Time';

  /* ── Loading ── */
  if (loading || loadingResult || !isLoaded) {
    return (
      <div className="min-h-screen bg-[#080d1f] flex items-center justify-center">
        <div className="flex items-center gap-3 text-teal-400">
          <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-lg font-medium tracking-wide">Loading test…</span>
        </div>
      </div>
    );
  }

  /* ── Already Submitted ── */
  if (existingResult) {
    return (
      <div className="min-h-screen bg-[#080d1f] flex flex-col items-center justify-center p-4">
        <div className="bg-[#0f1530] rounded-2xl p-8 max-w-md w-full text-center border border-emerald-500/30 shadow-2xl">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-2 ring-emerald-500/20">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Test Completed</h2>
          <p className="text-slate-400 mb-6">You have already submitted this test. Retaking is not permitted.</p>
          <button onClick={() => navigate(`/results/${testId}`)}
            className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl transition-all flex items-center justify-center gap-2 font-medium">
            View Your Results
          </button>
        </div>
      </div>
    );
  }

  /* ── Not started ── */
  if (timeUntilStart) {
    return (
      <div className="min-h-screen bg-[#080d1f] flex flex-col items-center justify-center p-4">
        <div className="bg-[#0f1530] rounded-2xl p-8 max-w-md w-full text-center border border-slate-700 shadow-2xl">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-blue-500/30">
            <Clock className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Test Has Not Started</h2>
          <p className="text-slate-400 mb-6">Starts in</p>
          <div className="text-5xl font-mono font-bold text-blue-400 mb-6 tracking-widest">{timeUntilStart}</div>
          <button onClick={() => navigate('/student')}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2 font-medium">
            <Home className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  /* ── Expired ── */
  if (testExpired) {
    return (
      <div className="min-h-screen bg-[#080d1f] flex flex-col items-center justify-center p-4">
        <div className="bg-[#0f1530] rounded-2xl p-8 max-w-md w-full text-center border border-red-500/30 shadow-2xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-2 ring-red-500/20">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Test No Longer Available</h2>
          <p className="text-slate-400 mb-6">The time window for this test has expired.</p>
          <button onClick={() => navigate('/student')}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2 font-medium">
            <Home className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!testData) {
    return (
      <div className="min-h-screen bg-[#080d1f] flex items-center justify-center">
        <p className="text-white text-xl">Test not found</p>
      </div>
    );
  }

  /* ── Main UI ── */
  const hasTimePerQ = Boolean(testData.time_per_question && testData.time_per_question > 0);
  const hasNegMark = Boolean(testData.negative_marking_enabled);
  const totalStats = 3 + (hasTimePerQ ? 1 : 0) + (hasNegMark ? 1 : 0);

  let gridClass = 'grid-cols-2 md:grid-cols-3';
  if (totalStats === 4) gridClass = 'grid-cols-2 md:grid-cols-4';
  if (totalStats === 5) gridClass = 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5';

  return (
    <div className="min-h-screen bg-[#080d1f] relative overflow-hidden font-sans">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-teal-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/5 rounded-full blur-[80px]" />
      </div>

      {/* Home button */}
      <div className="relative z-10 flex justify-end px-4 sm:px-8 pt-5 pb-2 max-w-[90%] mx-auto">
        <button
          onClick={() => navigate('/student')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-teal-400 hover:border-teal-500/40 transition-all duration-200 text-sm font-medium"
          aria-label="Return to dashboard"
        >
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 w-[90%] max-w-7xl mx-auto pb-16">

        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight mb-2">
            {testData.title}
          </h1>
          {testData.description && (
            <p className="text-slate-400 text-base sm:text-lg mt-2 mb-3">{testData.description}</p>
          )}
          <div className="inline-flex items-center gap-2 mt-1">

            <span className="inline-flex items-center gap-1.5 bg-teal-500/15 border border-teal-500/30 text-teal-400 text-xs font-semibold px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Ready to Begin
            </span>
          </div>
        </div>

        {/* Stat tiles */}
        <div className={`grid gap-3 sm:gap-4 mb-5 sm:mb-6 ${gridClass}`}>
          {[
            {
              label: 'Duration',
              value: formatDuration(calculatedTotalSeconds),
              icon: <Clock className="w-4 h-4 sm:w-5 sm:h-5" />,
            },
            {
              label: 'Questions',
              value: String(questionCount),
              icon: (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
            {
              label: 'Total Marks',
              value: String(totalMarks),
              icon: <Bookmark className="w-4 h-4 sm:w-5 sm:h-5" />,
            },
            ...(hasTimePerQ
              ? [{
                label: 'Time/Question',
                value: timePerQuestionDisplay,
                icon: (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              }]
              : []),
            ...(hasNegMark
              ? [{
                label: 'Negative Marking',
                value: `−${testData.negative_marks || 1}/wrong`,
                icon: <MinusCircle className="w-4 h-4 sm:w-5 sm:h-5" />,
                accent: 'red' as const,
              }]
              : []),
          ].map(({ label, value, icon, accent }) => {
            const color = accent === 'red' ? 'text-red-400' : 'text-teal-400';
            const border = accent === 'red'
              ? 'border-red-500/30 hover:border-red-400/50'
              : 'border-slate-700/60 hover:border-teal-500/40';
            return (
              <div key={label}
                className={`bg-[#0f1530]/80 border ${border} rounded-xl px-3 py-3 sm:px-5 sm:py-4 flex items-center gap-2 sm:gap-3 transition-colors duration-200`}>
                <div className={`shrink-0 ${color}`}>{icon}</div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tight sm:tracking-wider mb-0.5 truncate">{label}</div>
                  <div className={`text-sm sm:text-lg font-bold font-mono leading-none ${color}`}>{value}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Three info columns — device-aware */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
          {/* General Instructions */}
          <div className="bg-[#0f1530]/80 border border-slate-700/60 rounded-xl p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">General Instructions</h3>
            </div>
            <ul className="space-y-2.5">
              {[
                { text: 'Read each question carefully', mobileHide: false },
                { text: 'Select the best answer from options', mobileHide: false },
                { text: 'Navigate using Keyboard shortcuts ', mobileHide: true },
                { text: 'Submit before the timer runs out', mobileHide: false },
              ].map(({ text, mobileHide }) => (
                <li key={text} className={`flex items-start gap-2 text-slate-300 text-sm${mobileHide ? ' hidden sm:flex' : ''}`}>
                  <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-teal-400/70" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Screen Rules */}
          <div className="bg-[#0f1530]/80 border border-slate-700/60 rounded-xl p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="text-sm font-bold text-white tracking-wide">Screen Rules</h3>
            </div>
            <ul className="space-y-2.5">
              {[
                'Stay in fullscreen mode',
                'No tab switching',
                'No window resizing',
              ].map(item => (
                <li key={item} className="flex items-start gap-2 text-slate-300 text-sm">
                  <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-teal-400/70" />
                  {item}
                </li>
              ))}
              {/* Desktop-only: key warnings */}
              <li className="hidden md:flex items-start gap-2 text-slate-300 text-sm">
                <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-rose-400/70" />
                Do not press the <kbd className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-700 border border-slate-500 text-rose-300 font-bold text-[11px] font-mono mx-1 shadow-sm">ESC</kbd> key
              </li>
              <li className="hidden md:flex items-start gap-2 text-slate-300 text-sm">
                <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-rose-400/70" />
                Do not press the <kbd className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-700 border border-slate-500 text-rose-300 font-bold text-[11px] font-mono mx-1 shadow-sm">⊞ Win</kbd> key
              </li>
            </ul>
          </div>

          {/* Not Allowed — desktop only */}
          <div className="hidden md:block bg-[#0f1530]/80 border border-slate-700/60 rounded-xl p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Ban className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">Not Allowed</h3>
            </div>
            <ul className="space-y-2.5">
              {['Switching apps', 'Opening developer tools', 'Right-clicking on the page'].map(item => (
                <li key={item} className="flex items-start gap-2 text-slate-300 text-sm">
                  <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-teal-400/70" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Keyboard shortcuts — desktop only */}
        <div className="hidden md:block bg-[#0f1530]/80 border border-teal-500/20 rounded-xl p-5 sm:p-6 mb-5 sm:mb-6">
          <div className="flex items-center gap-2 mb-5">
            <Keyboard className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">Keyboard Shortcuts</h3>

          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Select options */}
            <div className="col-span-2 sm:col-span-2 bg-slate-800/60 rounded-xl p-4 border border-slate-700/60">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Select Answer</p>
              <div className="flex flex-wrap gap-2">
                {['A', 'B', 'C', 'D'].map(key => (
                  <div key={key} className="flex items-center gap-1.5">
                    <kbd className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700 border border-slate-500 text-teal-300 font-bold text-sm shadow-sm shadow-black/40 font-mono">{key}</kbd>
                    <span className="text-slate-400 text-xs">Option {key}</span>
                    {key !== 'D' && <span className="text-slate-600 text-xs mx-1">·</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Navigate</p>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <kbd className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700 border border-slate-500 text-teal-300 shadow-sm shadow-black/40">
                    <ArrowLeft className="w-4 h-4" />
                  </kbd>
                  <span className="text-slate-500 text-[10px]">Prev</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <kbd className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700 border border-slate-500 text-teal-300 shadow-sm shadow-black/40">
                    <ArrowRight className="w-4 h-4" />
                  </kbd>
                  <span className="text-slate-500 text-[10px]">Next</span>
                </div>
              </div>
            </div>

            {/* Flag */}
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Flag</p>
              <div className="flex flex-col items-center gap-1 w-fit">
                <kbd className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700 border border-slate-500 text-teal-300 font-bold text-sm shadow-sm shadow-black/40 font-mono">F</kbd>
                <div className="flex items-center gap-1 mt-0.5">
                  <Flag className="w-3 h-3 text-amber-400" />
                  <span className="text-slate-500 text-[10px]">Toggle flag</span>
                </div>
              </div>
            </div>

            {/* Forbidden Keys — desktop only, full-width row */}
            <div className="col-span-2 sm:col-span-4 bg-rose-500/5 rounded-xl p-4 border border-rose-500/20">
              <p className="text-xs font-bold text-rose-400/80 uppercase tracking-widest mb-3">Do Not Press</p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2.5">
                  <kbd className="inline-flex items-center justify-center min-w-[56px] h-9 px-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 font-bold text-sm shadow-sm shadow-black/40 font-mono">ESC</kbd>
                  <span className="text-slate-400 text-xs leading-tight">Exits fullscreen &amp; counts as a violation</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <kbd className="inline-flex items-center justify-center min-w-[56px] h-9 px-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 font-bold text-sm shadow-sm shadow-black/40 font-mono">⊞ Win</kbd>
                  <span className="text-slate-400 text-xs leading-tight">Minimizes window &amp; triggers violation</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monitoring rules */}
        <div className="bg-[#0f1530]/80 border border-slate-700/60 rounded-xl p-5 sm:p-6 mb-5 sm:mb-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">Important: Test Monitoring Rules</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* 1st violation */}
            <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl p-4 flex items-start gap-3">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black text-amber-300 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-md uppercase tracking-wider">1st Violation</span>
                </div>
                <p className="text-slate-300 text-sm">Warning appears.</p>
              </div>
            </div>
            {/* 2nd violation */}
            <div className="bg-red-500/8 border border-red-500/25 rounded-xl p-4 flex items-start gap-3">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black text-red-300 bg-red-500/15 border border-red-500/25 px-2 py-0.5 rounded-md uppercase tracking-wider">2nd Violation</span>
                </div>
                <p className="text-slate-300 text-sm">Test ends. Your session will be terminated.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleStartTest}
          className="group relative w-full py-4 sm:py-5 rounded-2xl overflow-hidden font-bold text-base sm:text-lg transition-all duration-300 border border-slate-600 hover:border-teal-500/60 bg-slate-900 hover:bg-slate-800 active:scale-[0.99]"
        >
          {/* Subtle top highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />
          {/* Hover glow */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-teal-500/5 via-cyan-500/10 to-teal-500/5" />
          <div className="relative flex items-center justify-center gap-2.5 text-slate-100 group-hover:text-white transition-colors duration-200">
            <svg className="w-4 h-4 text-teal-400 group-hover:text-teal-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span className="tracking-wide">Start Test in Fullscreen</span>
            <ChevronRight className="w-5 h-5 text-teal-400 group-hover:text-teal-300 group-hover:translate-x-1 transition-all duration-200" />
          </div>
        </button>
      </div>
    </div>
  );
}