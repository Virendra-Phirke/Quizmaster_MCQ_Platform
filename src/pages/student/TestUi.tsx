/**
 * TestUi.tsx — Redesigned · Performance Edition
 *
 * Perf rules applied:
 *  ✕ No backdrop-filter / backdrop-blur (forces layer compositing)
 *  ✕ No blur-* decorative glow divs (expensive paint)
 *  ✕ No keyframe animations (dot-pulse, q-in, etc.)
 *  ✕ No hover:translate / hover:scale on frequent elements
 *  ✕ No transition-all (broad style recalc) → transition-colors only
 *  ✓ active:scale on buttons is GPU-composited (transform only) — kept
 *  ✓ progress bar width transition — single cheap property — kept
 *  ✓ Solid opaque header/footer backgrounds (no alpha compositing)
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertCircle, CheckCircle, AlertTriangle, X,
    RotateCcw, Flag, ArrowLeft, ArrowRight, Clock
} from 'lucide-react';
import { Skeleton } from '../../components/shared/Skeleton';
import { ModernAuthCard } from '../../components/shared/ModernAuthCard';
import { PremiumDialog } from '../../components/shared/PremiumDialog';
import { TimeWarning } from '../../components/test/TimeWarning';
import { TestStickyFooter } from '../../components/test/TestStickyFooter';
import { TestHeader } from '../../components/test/TestHeader';
import { LegacyTest } from '../../contexts/TestContext';

/* ─────────────────────────── Font injection ─────────────────────────── */
const FontStyle: React.FC = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

        .test-root, .test-root * {
            font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        }
        .mono {
            font-family: 'JetBrains Mono', monospace;
        }
        .test-root {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        /* Single-property — no broad recalc */
        .progress-fill {
            transition: width 300ms ease-out;
        }

        /* Modal appear — transform + opacity only (GPU composited, zero paint) */
        @keyframes modal-appear {
            from { opacity: 0; transform: scale(0.93); }
            to   { opacity: 1; transform: scale(1); }
        }
        .modal-appear {
            animation: modal-appear 180ms cubic-bezier(0.22,1,0.36,1) both;
        }
    `}</style>
);

/* ─────────────────────────── Types (unchanged) ─────────────────────────── */
export interface TestUiProps {
    isGlobalLoading: boolean;
    needsAuth: boolean;
    needsRole: boolean;
    testError: string | null;
    testId?: string;
    test: LegacyTest | null;
    alreadySubmitted: boolean;
    isAttemptLoading: boolean;
    testStarted: boolean;
    userFirstName?: string | null;
    isStudent: boolean;
    handleRoleSetup: (role: 'teacher' | 'student') => void;
    enterFullscreen: () => Promise<void>;
    currentQuestion: number;
    setCurrentQuestion: (index: number) => void;
    displayQuestions: any[];
    shuffledIndices: number[];
    answers: number[];
    handleAnswerSelect: (idx: number) => void;
    clearSelection: () => void;
    flagged: Record<number, boolean>;
    toggleFlag: () => void;
    timedOutQuestions: Set<number>;
    violations: number;
    showWarning: boolean;
    setShowWarning: (show: boolean) => void;
    warningMessage: string;
    attemptStatus?: string;
    submitting: boolean;
    handleSubmit: () => void;
    userInitiatedSubmitRef: React.MutableRefObject<boolean>;
    currentQuestionData: any;
    getDisplayOptions: (q: any) => string[];
    timeLeftRef: React.MutableRefObject<number>;
    questionTimeLeftRef: React.MutableRefObject<number>;
    timePerQuestion: number;
    hasPerQuestionTimer: boolean;
    handlePrevious: () => void;
    handleNext: () => void;
}

/* ─────────────────────────── Sub-components ─────────────────────────── */

/** Compact timer pill — no animation, color swap only */
const TimerPill: React.FC<{ seconds: number; label?: string }> = ({ seconds, label }) => {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    const isUrgent = seconds <= 60 && seconds > 0;
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${isUrgent ? 'bg-rose-500/10 border-rose-500/30' : 'bg-[#1a2636] border-white/[0.09]'
            }`}>
            <Clock className={`w-3 h-3 flex-shrink-0 ${isUrgent ? 'text-rose-400' : 'text-teal-400'}`} />
            <span className={`mono text-xs font-bold tracking-widest ${isUrgent ? 'text-rose-200' : 'text-slate-200'}`}>
                {mins}:{secs}
            </span>
            {label && <span className="text-[10px] text-slate-500 ml-0.5">{label}</span>}
        </div>
    );
};

/** Per-question timer bar — width-only transition, cheap */
const QTimerBar: React.FC<{ pct: number }> = ({ pct }) => {
    const color = pct > 50 ? 'bg-teal-500' : pct > 20 ? 'bg-amber-400' : 'bg-rose-500';
    return (
        <div className="h-0.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
            <div className={`h-full rounded-full progress-fill ${color}`} style={{ width: `${pct}%` }} />
        </div>
    );
};

/** Answer option button */
const OptionButton: React.FC<{
    idx: number; label: string; selected: boolean; disabled: boolean; onClick: () => void;
}> = ({ idx, label, selected, disabled, onClick }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm border
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]
            ${selected
                ? 'bg-emerald-500/[0.10] border-emerald-500/50'
                : 'bg-white/[0.025] border-white/[0.08] hover:bg-white/[0.055] hover:border-white/[0.17]'
            }`}
    >
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${selected ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/[0.07] text-slate-400'
            }`}>
            {String.fromCharCode(65 + idx)}
        </span>
        <span className={`flex-1 leading-snug ${selected ? 'text-white font-semibold' : 'text-slate-300'}`}>
            {label}
        </span>
        {selected && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
    </button>
);

/** Question palette dot */
const PaletteDot: React.FC<{
    i: number; current: boolean; answered: boolean; flagged: boolean;
    timedOut: boolean; onClick: () => void;
}> = ({ i, current, answered, flagged, timedOut, onClick }) => (
    <button
        onClick={onClick}
        disabled={timedOut}
        aria-label={`Q${i + 1}`}
        className={`relative w-8 h-8 rounded-lg font-bold text-[11px] flex items-center justify-center
            transition-colors
            ${timedOut
                ? 'bg-rose-500/[0.12] text-rose-500/50 border border-rose-500/20 cursor-not-allowed'
                : current
                    ? 'bg-teal-500/20 text-white border-2 border-teal-400/60'
                    : answered
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25'
                        : 'bg-white/[0.04] text-slate-500 border border-white/[0.08] hover:bg-white/[0.09] hover:text-slate-300'
            }`}
    >
        {i + 1}
        {flagged && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full border border-[#0f1923]" />
        )}
        {timedOut && (
            <span className="absolute -bottom-0.5 -right-0.5 text-[7px] leading-none">🔒</span>
        )}
    </button>
);

/* ─────────────────────────── Main component ─────────────────────────── */
export const TestUi: React.FC<TestUiProps> = ({
    isGlobalLoading, needsAuth, needsRole, testError, testId, test,
    alreadySubmitted, isAttemptLoading, testStarted, isStudent,
    enterFullscreen, currentQuestion, setCurrentQuestion,
    displayQuestions, shuffledIndices, answers, handleAnswerSelect, clearSelection,
    flagged, toggleFlag, timedOutQuestions, violations, showWarning, setShowWarning,
    warningMessage, attemptStatus, submitting, handleSubmit, userInitiatedSubmitRef,
    currentQuestionData, getDisplayOptions, timeLeftRef, questionTimeLeftRef,
    timePerQuestion, hasPerQuestionTimer, handlePrevious, handleNext,
}) => {
    const navigate = useNavigate();

    const answeredCount = answers.filter(a => a !== -1).length;
    const flaggedCount = Object.values(flagged).filter(Boolean).length;
    const unansweredCount = displayQuestions.length - answeredCount;

    /* Confirmation dialog state */
    const [showSubmitConfirmation, setShowSubmitConfirmation] = React.useState(false);

    /* Handle submit with confirmation */
    const handleSubmitClick = () => {
        setShowSubmitConfirmation(true);
    };

    const confirmSubmit = () => {
        setShowSubmitConfirmation(false);
        userInitiatedSubmitRef.current = true;
        handleSubmit();
    };

    /* Live timer polling every 500 ms */
    const [displayTime, setDisplayTime] = React.useState(Math.max(0, timeLeftRef.current));
    const [displayQTime, setDisplayQTime] = React.useState(Math.max(0, questionTimeLeftRef.current));

    React.useEffect(() => {
        const id = setInterval(() => {
            setDisplayTime(Math.max(0, timeLeftRef.current ?? 0));
            setDisplayQTime(Math.max(0, questionTimeLeftRef.current ?? 0));
        }, 500);
        return () => clearInterval(id);
    }, [timeLeftRef, questionTimeLeftRef]);

    const qTimePercent = timePerQuestion > 0
        ? Math.max(0, (displayQTime / timePerQuestion) * 100)
        : 100;

    /* ── Guard states ── */
    if (isGlobalLoading) return (
        <div className="min-h-screen bg-[#0f1923] flex items-center justify-center p-4">
            <FontStyle />
            <div className="w-full max-w-xl space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-56 w-full rounded-2xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
            </div>
        </div>
    );

    if (needsAuth) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
            <FontStyle />
            <ModernAuthCard mode="signin" />
        </div>
    );

    if (needsRole) return (
        <div className="min-h-screen bg-[#0f1923] flex items-center justify-center p-4">
            <FontStyle />
            <div className="text-center">
                <div className="animate-spin inline-block w-10 h-10 border-4 border-white/10 border-t-teal-500 rounded-full mb-3" />
                <h2 className="text-lg font-semibold text-white mb-1">Setting up your account…</h2>
                <p className="text-slate-500 text-sm">This will only take a moment</p>
            </div>
        </div>
    );

    if (testError) return (
        <div className="min-h-screen bg-[#0f1923] flex items-center justify-center p-4">
            <FontStyle />
            <div className="text-center bg-[#131f2e] border border-white/10 rounded-2xl p-7 max-w-sm w-full">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                <h1 className="text-xl font-bold text-white mb-1.5">Unable to Load Test</h1>
                <p className="text-slate-400 text-sm mb-3">{testError}</p>
                {testId && (
                    <p className="mono text-[11px] text-slate-500 mb-4 bg-white/5 p-2 rounded-lg">ID: {testId}</p>
                )}
                <button
                    onClick={() => navigate(-1)}
                    className="px-5 py-2 bg-teal-500/20 border border-teal-500/40 text-teal-300 rounded-lg text-sm font-semibold hover:bg-teal-500/30 transition-colors"
                >
                    Go Back
                </button>
            </div>
        </div>
    );

    if (!test) return (
        <div className="min-h-screen bg-[#0f1923] flex items-center justify-center p-4">
            <FontStyle />
            <div className="text-center bg-[#131f2e] border border-white/10 rounded-2xl p-7 max-w-sm">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                <h1 className="text-xl font-bold text-white mb-1.5">Test Not Found</h1>
                <p className="text-slate-400 text-sm">This test doesn't exist or has been removed.</p>
            </div>
        </div>
    );

    if (alreadySubmitted) return (
        <div className="min-h-screen bg-[#0f1923] flex items-center justify-center p-4">
            <FontStyle />
            <div className="text-center bg-[#131f2e] border border-white/10 rounded-2xl p-7 max-w-sm w-full">
                <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                <h1 className="text-xl font-bold text-white mb-1.5">Test Completed</h1>
                <p className="text-slate-400 text-sm mb-6">You've already submitted this test.</p>
                <button
                    onClick={() => navigate(`/results/${testId}`)}
                    className="w-full px-5 py-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg font-semibold text-sm hover:bg-emerald-500/30 transition-colors"
                >
                    View Results
                </button>
            </div>
        </div>
    );

    if (isAttemptLoading || !testStarted) return (
        <div className="min-h-screen bg-[#0f1923] flex items-center justify-center p-4">
            <FontStyle />
            <div className="text-center">
                <div className="animate-spin inline-block w-10 h-10 border-4 border-white/10 border-t-teal-500 rounded-full mb-3" />
                <h2 className="text-lg font-semibold text-white mb-1">
                    {isAttemptLoading ? 'Loading…' : 'Starting Test…'}
                </h2>
                {!testStarted && <p className="text-slate-500 text-sm">Preparing environment</p>}
            </div>
        </div>
    );

    /* ── Derived values ── */
    const currentQ = displayQuestions[currentQuestion];
    const isLoadingCurrentQ = isStudent && (!currentQ || !currentQ.question || currentQ.question === '');
    const actualIndex = shuffledIndices.length > currentQuestion ? shuffledIndices[currentQuestion] : currentQuestion;
    const isCurrentFlagged = flagged[actualIndex];
    const isCurrentTimedOut = hasPerQuestionTimer ? timedOutQuestions.has(currentQuestion) : false;
    const totalQuestions = isStudent ? displayQuestions.length : (test?.questions?.length || 0);
    const progressPct = ((currentQuestion + 1) / Math.max(totalQuestions, 1)) * 100;
    const answeredPct = (answeredCount / Math.max(displayQuestions.length, 1)) * 100;
    const isLastQuestion = currentQuestion === displayQuestions.length - 1;
    const allTimedOut = timedOutQuestions.size === displayQuestions.length;
    const fmtQ = `${String(Math.floor(displayQTime / 60)).padStart(2, '0')}:${String(displayQTime % 60).padStart(2, '0')}`;

    return (
        <div className="test-root min-h-screen bg-[#0f1923] text-white">
            <FontStyle />

            {/* ── Violation Warning Banner ── */}
            {violations === 1 && showWarning && (
                <div className="fixed top-0 left-0 right-0 z-50 p-2.5 flex justify-center pointer-events-none">
                    <div
                        onClick={() => { setShowWarning(false); enterFullscreen().catch(() => { }); }}
                        className="pointer-events-auto w-full max-w-lg flex items-start gap-2.5 px-3.5 py-2.5 bg-amber-950 border border-amber-500/40 rounded-xl shadow-lg cursor-pointer"
                    >
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-amber-200 font-bold text-xs">Security Warning — Violation 1 of 2</p>
                            <p className="text-amber-300/70 text-[11px] mt-0.5 leading-relaxed line-clamp-2">{warningMessage}</p>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowWarning(false); enterFullscreen().catch(() => { }); }}
                            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/20 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            )}

            <PremiumDialog
                isOpen={showWarning && violations >= 2}
                onClose={() => { }} onConfirm={() => { }}
                title="Test Terminated" message={warningMessage}
                type="danger" confirmText="Submitting Test…" cancelText="Dismiss" isLoading
            />

            {/* ════════════════════════════
                MOBILE  (< lg)
            ════════════════════════════ */}
            <div className="lg:hidden flex flex-col min-h-screen">

                {/* Mobile Top Bar — solid bg, zero compositing cost */}
                <header className="sticky top-0 z-40 bg-[#0d1720] border-b border-white/[0.08] px-3 py-2">
                    <div className="flex items-center justify-between gap-1.5">
                        <div className="flex flex-col leading-none min-w-0">
                            <span className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-0.5">Q</span>
                            <span className="text-sm font-extrabold text-white whitespace-nowrap">
                                {currentQuestion + 1}
                                <span className="text-slate-500 font-normal text-xs">/{totalQuestions}</span>
                            </span>
                        </div>

                        <div className="flex flex-col items-center gap-1 flex-1 min-w-0 px-1">
                            <TimerPill seconds={displayTime} />
                            {hasPerQuestionTimer && (
                                <div className="flex items-center gap-1 w-full max-w-[120px]">
                                    <span className="mono text-[9px] text-slate-500 whitespace-nowrap">{fmtQ}</span>
                                    <div className="flex-1"><QTimerBar pct={qTimePercent} /></div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSubmitClick}
                            disabled={attemptStatus === 'submitted' || submitting}
                            className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 font-bold text-[11px] hover:bg-teal-500/25 active:scale-95 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                            {attemptStatus === 'submitted' ? '✓' : submitting ? '…' : 'Submit'}
                        </button>
                    </div>

                    <div className="mt-2 h-[2px] bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full progress-fill"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </header>

                {/* Mobile Question Area */}
                <div className="flex-1 overflow-y-auto pb-24">
                    <TimeWarning questionTimeLeftRef={questionTimeLeftRef} currentQuestion={currentQuestion} hasPerQuestionTimer={hasPerQuestionTimer} />

                    <div className="px-3 pt-3 pb-2">
                        <div className="bg-[#121c28] border border-white/[0.08] rounded-2xl overflow-hidden">
                            {isLoadingCurrentQ ? (
                                <div className="flex flex-col items-center justify-center py-14">
                                    <div className="w-8 h-8 border-4 border-white/10 border-t-teal-400 rounded-full animate-spin mb-2.5" />
                                    <p className="text-slate-500 text-xs">Loading question…</p>
                                </div>
                            ) : (
                                <div className="p-3.5">
                                    {currentQuestionData?.section && (
                                        <div className="flex items-center gap-2 mb-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-0.5 h-3.5 rounded-full bg-indigo-400 flex-shrink-0" />
                                                <span className="text-[11px] text-slate-500 font-medium">
                                                    Section: <span className="text-indigo-300 font-semibold">{currentQuestionData.section}</span>
                                                </span>
                                            </div>
                                            <span className="w-1 h-1 rounded-full bg-slate-600/50" />
                                            <span className="text-[11px] text-slate-400 font-semibold mono">
                                                {currentQ?.marks || 1} {((currentQ?.marks || 1) === 1) ? 'Mark' : 'Marks'}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex items-start gap-2 mb-4">
                                        <h2 className="flex-1 text-[14px] sm:text-[15px] font-bold text-white leading-relaxed whitespace-pre-wrap break-words min-w-0">
                                            {currentQ?.question}
                                        </h2>
                                    </div>

                                    <div className="space-y-2">
                                        {currentQuestionData?.options?.length > 0 ? (
                                            getDisplayOptions(currentQuestionData).map((option, idx) => {
                                                const isSelected = answers[actualIndex] === idx;
                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleAnswerSelect(idx)}
                                                        disabled={isCurrentTimedOut}
                                                        className={`w-full flex items-center p-2.5 rounded-xl text-left min-h-[48px] border
                                                            transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]
                                                            ${isSelected
                                                                ? 'bg-emerald-500/[0.10] border-emerald-500/45'
                                                                : 'bg-white/[0.025] border-white/[0.08] active:bg-white/[0.05]'
                                                            }`}
                                                    >
                                                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold mr-2.5 flex-shrink-0 text-[11px] ${isSelected ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/[0.07] text-slate-500'
                                                            }`}>
                                                            {String.fromCharCode(65 + idx)}
                                                        </span>
                                                        <span className={`text-[13px] leading-snug flex-1 break-words min-w-0 ${isSelected ? 'text-white font-semibold' : 'text-slate-300'}`}>
                                                            {option}
                                                        </span>
                                                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 ml-2 flex-shrink-0" />}
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <p className="text-slate-500 text-center text-sm py-8">No options available.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mobile Palette */}
                    <div className="px-3 pb-2">
                        <div className="bg-[#121c28] border border-white/[0.08] rounded-2xl p-3">
                            <div className="overflow-x-auto pb-0.5">
                                <div className="flex gap-1.5 min-w-max">
                                    {Array.from({ length: totalQuestions }).map((_, i) => {
                                        const ai = isStudent && shuffledIndices.length > 0 ? shuffledIndices[i] : i;
                                        return (
                                            <PaletteDot
                                                key={i} i={i}
                                                current={currentQuestion === i}
                                                answered={answers[ai] !== -1}
                                                flagged={!!flagged[ai]}
                                                timedOut={hasPerQuestionTimer ? timedOutQuestions.has(i) : false}
                                                onClick={() => setCurrentQuestion(i)}
                                            />
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2.5 pt-2.5 border-t border-white/[0.05]">
                                {[
                                    { color: 'bg-emerald-500', label: 'Answered', val: answeredCount },
                                    { color: 'bg-slate-600', label: 'Pending', val: unansweredCount },
                                    { color: 'bg-amber-400', label: 'Flagged', val: flaggedCount },
                                    ...(hasPerQuestionTimer
                                        ? [{ color: 'bg-rose-500', label: 'Locked', val: timedOutQuestions.size }]
                                        : []),
                                ].map(({ color, label, val }) => (
                                    <div key={label} className="flex items-center gap-1.5 text-[10px]">
                                        <span className={`w-2 h-2 rounded-full ${color}`} />
                                        <span className="text-slate-500">{label}</span>
                                        <span className="font-bold text-slate-300 mono">{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Sticky Footer — solid bg */}
                <footer className="sticky bottom-0 z-40 bg-[#0d1720] border-t border-white/[0.08] px-3 py-2">
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={toggleFlag}
                            disabled={!currentQuestionData || !isStudent}
                            className={`flex items-center gap-1 px-2.5 py-2 rounded-lg font-semibold text-xs border transition-colors active:scale-95 min-h-[40px] disabled:opacity-40 ${isCurrentFlagged
                                ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                                : 'bg-white/[0.04] border-white/[0.09] text-slate-400'
                                }`}
                        >
                            <Flag className="w-3.5 h-3.5" />
                            <span className="hidden xs:inline">{isCurrentFlagged ? 'Unflag' : 'Flag'}</span>
                        </button>

                        <button
                            onClick={clearSelection}
                            disabled={!currentQuestionData || answers[actualIndex] === -1 || !isStudent || isCurrentTimedOut}
                            className="flex items-center gap-1 px-2.5 py-2 rounded-lg font-semibold text-xs border border-white/[0.09] bg-white/[0.04] text-slate-400 transition-colors active:scale-95 min-h-[40px] disabled:opacity-40"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="hidden xs:inline">Clear</span>
                        </button>

                        <div className="flex-1" />

                        <button
                            onClick={handlePrevious}
                            disabled={currentQuestion === 0}
                            className="flex items-center justify-center w-10 h-10 rounded-lg border border-white/[0.12] bg-white/[0.05] text-slate-300 transition-colors active:scale-95 disabled:opacity-30"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>

                        {(isLastQuestion || allTimedOut) ? (
                            <button
                                onClick={handleSubmitClick}
                                disabled={attemptStatus === 'submitted' || submitting}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-xs bg-teal-500/20 border border-teal-500/40 text-teal-200 transition-colors active:scale-95 min-h-[40px] disabled:opacity-50"
                            >
                                {submitting ? '…' : '📝 Submit'}
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                disabled={isLastQuestion}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-xs bg-white/[0.10] border border-white/[0.18] text-white transition-colors active:scale-95 min-h-[40px] disabled:opacity-30"
                            >
                                Next <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </footer>
            </div>

            {/* ════════════════════════════
                DESKTOP  (>= lg)
            ════════════════════════════ */}
            <div className="hidden lg:block">
                <TestHeader
                    test={test}
                    currentQuestion={currentQuestion}
                    displayQuestions={displayQuestions}
                    violations={violations}
                    flagged={flagged}
                    isCurrentFlagged={isCurrentFlagged}
                    toggleFlag={toggleFlag}
                    answers={answers}
                    timeLeftRef={timeLeftRef}
                    questionTimeLeftRef={questionTimeLeftRef}
                    timePerQuestion={timePerQuestion}
                    hasPerQuestionTimer={hasPerQuestionTimer}
                />

                <div className="max-w-[1320px] mx-auto px-5 xl:px-7 py-5" role="main">
                    <div className="grid grid-cols-12 gap-5 xl:gap-6 items-start">

                        {/* ── Sidebar ── */}
                        <aside className="col-span-3 space-y-3 sticky top-5">

                            {/* Navigation Palette */}
                            <div className="bg-[#131f2e] border border-white/[0.09] p-4 rounded-2xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                    <h3 className="font-bold text-sm text-white tracking-tight">Questions</h3>
                                    <span className="ml-auto mono text-[10px] text-slate-500">{answeredCount}/{totalQuestions}</span>
                                </div>
                                <div className="grid grid-cols-6 gap-1.5 max-h-[280px] overflow-y-auto">
                                    {Array.from({ length: totalQuestions }).map((_, i) => {
                                        const ai = isStudent && shuffledIndices.length > 0 ? shuffledIndices[i] : i;
                                        return (
                                            <PaletteDot
                                                key={i} i={i}
                                                current={currentQuestion === i}
                                                answered={answers[ai] !== -1}
                                                flagged={!!flagged[ai]}
                                                timedOut={hasPerQuestionTimer ? timedOutQuestions.has(i) : false}
                                                onClick={() => setCurrentQuestion(i)}
                                            />
                                        );
                                    })}
                                </div>

                                {/* Completion bar */}
                                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                                    <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                                        <span>Completion</span>
                                        <span className="mono">{Math.round(answeredPct)}%</span>
                                    </div>
                                    <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full progress-fill"
                                            style={{ width: `${answeredPct}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="bg-[#131f2e] border border-white/[0.09] p-4 rounded-2xl">
                                <h3 className="font-bold text-sm text-white mb-3 tracking-tight">Status</h3>
                                <div className="space-y-2">
                                    {[
                                        { color: 'bg-emerald-500', label: 'Answered', value: answeredCount },
                                        { color: 'bg-slate-600', label: 'Unanswered', value: unansweredCount },
                                        { color: 'bg-amber-400', label: 'Flagged', value: flaggedCount },
                                        ...(hasPerQuestionTimer
                                            ? [{ color: 'bg-rose-500', label: 'Locked', value: timedOutQuestions.size }]
                                            : []),
                                    ].map(({ color, label, value }) => (
                                        <div key={label} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span className={`w-2 h-2 rounded-full ${color}`} />
                                                {label}
                                            </div>
                                            <span className="mono text-xs font-bold text-slate-300">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                onClick={handleSubmitClick}
                                disabled={attemptStatus === 'submitted' || submitting}
                                className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-400/40 active:scale-[0.98]"
                            >
                                {attemptStatus === 'submitted' ? '✓ Submitted' : submitting ? 'Submitting…' : '📝 Submit Test'}
                            </button>
                        </aside>

                        {/* ── Main Question Area — solid bg, no blur/glow ── */}
                        <main className="col-span-9">
                            <TimeWarning questionTimeLeftRef={questionTimeLeftRef} currentQuestion={currentQuestion} hasPerQuestionTimer={hasPerQuestionTimer} />

                            <div className="bg-[#131f2e] border border-white/[0.09] rounded-2xl p-6 xl:p-8">
                                {isLoadingCurrentQ ? (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <div className="w-10 h-10 border-4 border-white/10 border-t-teal-400 rounded-full animate-spin mb-3" />
                                        <p className="text-slate-500 text-sm">Loading question…</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Question header */}
                                        <div className="flex flex-col gap-2 mb-6">
                                            <div className="flex items-center gap-3">
                                                {currentQuestionData?.section && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-1 h-4 rounded-full bg-indigo-400 flex-shrink-0" />
                                                        <span className="text-xs font-semibold text-slate-500 tracking-wide">
                                                            Section: <span className="text-indigo-300">{currentQuestionData.section}</span>
                                                        </span>
                                                    </div>
                                                )}
                                                {currentQuestionData?.section && <span className="w-1 h-1 rounded-full bg-slate-600/50" />}
                                                <div className="flex-shrink-0 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.09]">
                                                    <p className="mono text-[11px] text-slate-400 font-semibold whitespace-nowrap">
                                                        {currentQ?.marks || 1} {((currentQ?.marks || 1) === 1) ? 'Mark' : 'Marks'}
                                                    </p>
                                                </div>
                                            </div>
                                            <h2 className="text-lg xl:text-xl font-bold text-white leading-relaxed whitespace-pre-wrap">
                                                {currentQ?.question}
                                            </h2>
                                        </div>

                                        {/* Options */}
                                        <div className="space-y-2 mb-7">
                                            {currentQuestionData?.options?.length > 0 ? (
                                                getDisplayOptions(currentQuestionData).map((option, idx) => (
                                                    <OptionButton
                                                        key={idx} idx={idx} label={option}
                                                        selected={answers[actualIndex] === idx}
                                                        disabled={isCurrentTimedOut}
                                                        onClick={() => handleAnswerSelect(idx)}
                                                    />
                                                ))
                                            ) : (
                                                <p className="text-slate-500 text-center py-10 text-sm">No options available.</p>
                                            )}
                                        </div>

                                        {/* Action row */}
                                        <div className="flex items-center gap-2.5 pb-6">
                                            <button
                                                onClick={clearSelection}
                                                disabled={!currentQuestionData || answers[actualIndex] === -1 || !isStudent || isCurrentTimedOut}
                                                className="flex items-center gap-1.5 px-3.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 rounded-lg font-medium transition-colors text-xs border border-white/[0.09] disabled:opacity-40"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                                Clear
                                            </button>
                                            <button
                                                onClick={toggleFlag}
                                                disabled={!currentQuestionData || !isStudent}
                                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium text-xs border transition-colors ${isCurrentFlagged
                                                    ? 'bg-amber-500/15 border-amber-500/25 text-amber-300 hover:bg-amber-500/25'
                                                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 border-white/[0.09]'
                                                    } disabled:opacity-40`}
                                            >
                                                <Flag className="w-3.5 h-3.5" />
                                                {isCurrentFlagged ? 'Unflag' : 'Flag'}
                                            </button>
                                        </div>

                                        {/* Navigation */}
                                        <div className="pt-5 border-t border-white/[0.07] flex items-center gap-3">
                                            <button
                                                onClick={handlePrevious}
                                                disabled={currentQuestion === 0}
                                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.14] text-slate-400 hover:bg-white/[0.05] hover:text-white transition-colors font-semibold text-sm disabled:opacity-30 active:scale-[0.98]"
                                            >
                                                <ArrowLeft className="w-4 h-4" /> Prev
                                            </button>

                                            <div className="flex-1 flex items-center justify-center">
                                                <span className="mono text-slate-600 text-xs">
                                                    {currentQuestion + 1} / {totalQuestions}
                                                </span>
                                            </div>

                                            {(isLastQuestion || allTimedOut) ? (
                                                <button
                                                    onClick={handleSubmitClick}
                                                    disabled={attemptStatus === 'submitted' || submitting}
                                                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-200 font-bold text-sm hover:bg-teal-500/30 transition-colors disabled:opacity-50 active:scale-[0.98]"
                                                >
                                                    {submitting ? 'Submitting…' : 'Submit Test'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleNext}
                                                    disabled={isLastQuestion}
                                                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/[0.10] border border-white/[0.20] text-white font-bold text-sm hover:bg-white/[0.16] transition-colors disabled:opacity-30 active:scale-[0.98]"
                                                >
                                                    Next <ArrowRight className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </main>
                    </div>
                </div>
            </div>

            <div className="hidden lg:block">
                <TestStickyFooter questionTimeLeftRef={questionTimeLeftRef} currentQuestion={currentQuestion} hasPerQuestionTimer={hasPerQuestionTimer} />
            </div>

           {/* ── Submit Confirmation Dialog ── */}
{showSubmitConfirmation && (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Solid opaque overlay — no compositing cost */}
        <div
            className="absolute inset-0 bg-[#060b12]"
            style={{ opacity: 0.92 }}
            onClick={() => setShowSubmitConfirmation(false)}
        />

        {/* Modal */}
        <div className="relative w-full max-w-[360px] bg-[#0f1923] border border-white/[0.10] rounded-2xl overflow-hidden">

            {/* Top accent bar — teal left, amber right to signal "final action" */}
            <div className="h-1 w-full flex">
                <div className="flex-1 bg-teal-500" />
                <div className="w-16 bg-amber-400" />
            </div>

            <div className="p-5">

                {/* Header row */}
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Final Step</p>
                        <h2 className="text-[20px] font-extrabold text-white tracking-tight leading-tight">
                            Submit Test?
                        </h2>
                    </div>
                    {/* Close button */}
                    <button
                        onClick={() => setShowSubmitConfirmation(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.09] text-slate-400 hover:text-white hover:bg-white/[0.09] transition-colors flex-shrink-0"
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                    </button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                    <div className="bg-[#131f2e] border border-white/[0.07] rounded-xl p-3 flex flex-col items-center gap-0.5">
                        <span className="mono text-xl font-extrabold text-emerald-400 leading-none">{answeredCount}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mt-1">Done</span>
                        <span className="w-4 h-0.5 bg-emerald-500/50 rounded-full mt-1" />
                    </div>
                    <div className="bg-[#131f2e] border border-white/[0.07] rounded-xl p-3 flex flex-col items-center gap-0.5">
                        <span className="mono text-xl font-extrabold text-rose-400 leading-none">{unansweredCount}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mt-1">Skipped</span>
                        <span className="w-4 h-0.5 bg-rose-500/50 rounded-full mt-1" />
                    </div>
                    <div className="bg-[#131f2e] border border-white/[0.07] rounded-xl p-3 flex flex-col items-center gap-0.5">
                        <span className="mono text-xl font-extrabold text-amber-400 leading-none">{flaggedCount}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mt-1">Flagged</span>
                        <span className="w-4 h-0.5 bg-amber-400/50 rounded-full mt-1" />
                    </div>
                </div>

                {/* Progress bar */}
                <div className="mb-1 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">Completion</span>
                    <span className="mono text-[10px] font-bold text-slate-300">
                        {Math.round((answeredCount / Math.max(answeredCount + unansweredCount, 1)) * 100)}%
                    </span>
                </div>
                <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden mb-5">
                    <div
                        className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full"
                        style={{ width: `${Math.round((answeredCount / Math.max(answeredCount + unansweredCount, 1)) * 100)}%`, transition: 'width 400ms ease-out' }}
                    />
                </div>

                {/* Warning note — only if unanswered questions exist */}
                {unansweredCount > 0 && (
                    <div className="flex items-start gap-2.5 p-3 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl mb-5">
                        <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4.5zm0 7.25a.875.875 0 110-1.75.875.875 0 010 1.75z"/>
                        </svg>
                        <p className="text-[11px] text-amber-300/80 leading-relaxed">
                            You have <span className="font-bold text-amber-300">{unansweredCount} unanswered</span> {unansweredCount === 1 ? 'question' : 'questions'}. Once submitted you cannot go back.
                        </p>
                    </div>
                )}

                {/* CTA buttons */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={confirmSubmit}
                        className="w-full py-3 rounded-xl bg-teal-500 text-[#07101a] font-extrabold text-[14px] tracking-wide hover:bg-teal-400 active:scale-[0.98] transition-colors"
                    >
                        Yes, Submit Test
                    </button>
                    <button
                        onClick={() => setShowSubmitConfirmation(false)}
                        className="w-full py-3 rounded-xl font-bold text-[14px] text-slate-400 hover:text-white bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.07] active:scale-[0.98] transition-colors"
                    >
                        Keep Reviewing
                    </button>
                </div>

            </div>
        </div>
    </div>
)}
        </div>
    );
};