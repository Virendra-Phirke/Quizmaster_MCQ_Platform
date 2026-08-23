
import { useEffect, useState, useRef } from 'react';
import { Flag } from 'lucide-react';
import { LegacyTest } from '../../contexts/TestContext';

interface TestHeaderProps {
    test: LegacyTest;
    currentQuestion: number;
    displayQuestions: any[];
    violations: number;
    flagged: Record<number, boolean>;
    isCurrentFlagged: boolean;
    toggleFlag: () => void;
    answers: number[];
    timeLeftRef: React.MutableRefObject<number>;
    questionTimeLeftRef: React.MutableRefObject<number>;
    timePerQuestion: number;
    hasPerQuestionTimer: boolean;
}

export function TestHeader({
    test,
    currentQuestion,
    displayQuestions,
    violations,
    flagged,
    isCurrentFlagged,
    toggleFlag,
    answers,
    timeLeftRef,
    questionTimeLeftRef,
    timePerQuestion,
    hasPerQuestionTimer
}: TestHeaderProps) {
    // Local state for timer display to prevent parent re-renders
    const [timeLeft, setTimeLeft] = useState(timeLeftRef.current);
    const [questionTimeLeft, setQuestionTimeLeft] = useState(questionTimeLeftRef.current);

    // Ref to track if component is mounted
    const isMountedRef = useRef(true);
    const progressBarRef = useRef<HTMLDivElement>(null);

    // Sync state immediately when question changes
    useEffect(() => {
        setQuestionTimeLeft(questionTimeLeftRef.current);
        setTimeLeft(timeLeftRef.current);
    }, [currentQuestion, questionTimeLeftRef, timeLeftRef]);

    useEffect(() => {
        isMountedRef.current = true;

        // Sync with refs every 100ms for smooth updates, but only trigger re-render if value changed deeply?
        // Actually, just 1s interval is enough for seconds display.
        // We use a slightly faster interval to catch updates and keeping UI snappy, 
        // but React batching handles it.
        const interval = setInterval(() => {
            if (!isMountedRef.current) return;

            const newTimeLeft = Math.max(0, timeLeftRef.current);
            const newQuestionTime = Math.max(0, questionTimeLeftRef.current);

            // Only update state if changed (React does this check anyway but good to be explicit)
            setTimeLeft(prev => prev !== newTimeLeft ? newTimeLeft : prev);
            setQuestionTimeLeft(prev => prev !== newQuestionTime ? newQuestionTime : prev);
        }, 1000);

        return () => {
            isMountedRef.current = false;
            clearInterval(interval);
        };
    }, [timeLeftRef, questionTimeLeftRef]);

    // Derived state for progress
    const answeredCount = answers.filter(a => a !== -1).length;

    // Update progress bar direct DOM manipulation for performance
    useEffect(() => {
        if (progressBarRef.current && displayQuestions.length > 0) {
            const pct = (answeredCount / displayQuestions.length) * 100;
            progressBarRef.current.style.width = `${pct}%`;
        }
    }, [answeredCount, displayQuestions.length]);

    return (
        <header className="max-w-7xl mx-auto px-4 sm:px-6 py-0 pt-0">
            {/* Mobile Header - Stacked Layout */}
            <div className="lg:hidden space-y-3 mb-4">
                {/* Title and Progress */}
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-800 border border-slate-700/60 flex items-center justify-center shadow-lg flex-shrink-0 p-2 sm:p-2.5">
                        <img src="/favicon.svg" alt="QuizMaster" className="w-full h-full object-contain" loading="lazy" decoding="async" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-display text-base sm:text-lg font-bold tracking-tight truncate" id="test-title">{test.title}</h1>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide" aria-live="polite">
                            Q {currentQuestion + 1}/{displayQuestions.length}
                        </p>
                    </div>
                </div>

                {/* Mobile Timer Bar and Stats */}
                <div className="flex items-center justify-between space-x-2">
                    {/* Compact Per-Question Timer */}
                    {hasPerQuestionTimer && (
                        <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center flex-shrink-0">
                            <svg className="w-full h-full">
                                <circle className="text-white/10" cx="28" cy="28" fill="transparent" r="24" stroke="currentColor" strokeWidth="3" />
                                <circle
                                    className={`transition-[stroke-dashoffset] duration-300 ease-linear ${questionTimeLeft <= 10 ? 'text-rose-500' : questionTimeLeft <= 20 ? 'text-amber-400' : 'text-teal-600'}`}
                                    cx="28" cy="28" fill="transparent" r="24" stroke="currentColor" strokeLinecap="round" strokeWidth="3"
                                    strokeDashoffset={150.8 - (150.8 * (timePerQuestion > 0 ? questionTimeLeft / timePerQuestion : 0))}
                                    strokeDasharray="150.8"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-base sm:text-lg font-bold font-display">{questionTimeLeft}</span>
                                <span className="text-[7px] text-slate-400 uppercase">Q</span>
                            </div>
                        </div>
                    )}

                    {/* Mobile Stats Grid */}
                    <div className="flex-1 grid grid-cols-2 gap-2">
                        {/* Violation Counter */}
                        <div className={`px-2 py-1.5 rounded-lg border ${violations === 0
                            ? 'border-emerald-500/30 bg-emerald-500/10'
                            : violations === 1
                                ? 'border-yellow-500/50 bg-yellow-500/20 animate-pulse'
                                : 'border-red-500/50 bg-red-500/20'
                            }`}>
                            <div className="text-center">
                                <div className="text-[9px] text-slate-400 uppercase leading-tight">Violations</div>
                                <div className={`text-base font-bold leading-tight ${violations === 0
                                    ? 'text-emerald-400'
                                    : violations === 1
                                        ? 'text-yellow-400'
                                        : 'text-red-400'
                                    }`}>
                                    {violations}/2
                                </div>
                            </div>
                        </div>

                        {/* Progress */}
                        <div className="px-2 py-1.5 rounded-lg border border-teal-500/20 bg-teal-500/5">
                            <div className="text-center">
                                <div className="text-[9px] text-slate-400 uppercase leading-tight">Done</div>
                                <div className="text-base font-bold text-teal-300 leading-tight">
                                    {answeredCount}/{displayQuestions.length}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Flag Button */}
                    <button
                        onClick={toggleFlag}
                        title={isCurrentFlagged ? 'Unflag this question' : 'Flag this question'}
                        aria-label={isCurrentFlagged ? 'Unflag this question' : 'Flag this question'}
                        className={`px-2.5 py-2 rounded-lg border transition-colors flex items-center justify-center text-xs font-medium flex-shrink-0 ${isCurrentFlagged
                            ? 'border-amber-400/50 bg-amber-400/20 text-amber-300'
                            : 'border-white/20 hover:bg-white/10 text-slate-300'
                            }`}
                    >
                        <Flag className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Desktop Header - Original Horizontal Layout */}
            <div className="hidden lg:flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700/60 flex items-center justify-center shadow-lg p-2.5">
                        <img src="/favicon.svg" alt="QuizMaster" className="w-full h-full object-contain" loading="lazy" decoding="async" />
                    </div>
                    <div>
                        <h1 className="font-display text-2xl font-bold tracking-tight" id="test-title-desktop">{test.title}</h1>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest" aria-live="polite">
                            Question {currentQuestion + 1} of {displayQuestions.length}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-6">
                    {/* Question Timer */}
                    {hasPerQuestionTimer && (
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <svg className="w-full h-full">
                                <circle className="text-white/10" cx="48" cy="48" fill="transparent" r="38" stroke="currentColor" strokeWidth="4" />
                                <circle
                                    className={`transition-[stroke-dashoffset] duration-300 ease-linear ${questionTimeLeft <= 10 ? 'text-rose-500' : questionTimeLeft <= 20 ? 'text-amber-400' : 'text-teal-600'}`}
                                    cx="48" cy="48" fill="transparent" r="38" stroke="currentColor" strokeLinecap="round" strokeWidth="4"
                                    strokeDashoffset={238.76 - (238.76 * (timePerQuestion > 0 ? questionTimeLeft / timePerQuestion : 0))}
                                    strokeDasharray="238.76"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold font-display">{questionTimeLeft}s</span>
                                <span className="text-[10px] text-slate-400 uppercase">Per Q</span>
                            </div>
                        </div>
                    )}

                    {/* Total Timer (Optional? It was not clearly in original desktop view but assumed) */}
                    <div className="flex flex-col items-center px-4">
                        <div className="text-[10px] text-slate-400 uppercase mb-1">Total Time</div>
                        <div className="text-xl font-mono font-bold text-white">
                            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
                    </div>

                    {/* Violation Counter */}
                    <div className={`px-4 py-2 rounded-xl border-2 ${violations === 0
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : violations === 1
                            ? 'border-yellow-500/50 bg-yellow-500/20 animate-pulse'
                            : 'border-red-500/50 bg-red-500/20'
                        }`}>
                        <div className="text-center">
                            <div className="text-xs text-rose-100 uppercase tracking-wide">Violations</div>
                            <div className={`text-2xl font-bold ${violations === 0
                                ? 'text-emerald-400'
                                : violations === 1
                                    ? 'text-yellow-400'
                                    : 'text-red-400'
                                }`}>
                                {violations}/2
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={toggleFlag}
                        className={`px-6 py-2.5 rounded-full border transition-colors flex items-center space-x-2 text-sm font-medium ${isCurrentFlagged
                            ? 'border-amber-400/50 bg-amber-400/20 text-amber-300'
                            : 'border-white/20 hover:bg-white/10 text-slate-300'
                            }`}
                    >
                        <Flag className="w-4 h-4" />
                        <span>{isCurrentFlagged ? 'Unflag' : 'Flag'}</span>
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-10">
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div
                        ref={progressBarRef}
                        className="gradient-progress-bar h-full transition-[width] duration-500 ease-out will-change-transform"
                        style={{ width: '0%' }}
                    />
                </div>
                <div className="flex justify-between mt-3 text-xs font-medium text-slate-500">
                    <span>Answered: {answeredCount}/{displayQuestions.length}</span>
                    <span>Flagged: {Object.values(flagged).filter(Boolean).length}</span>
                </div>
            </div>
        </header>
    );
}
