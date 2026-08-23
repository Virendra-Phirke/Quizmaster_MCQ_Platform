
import { useEffect, useState, useRef } from 'react';

interface TimeWarningProps {
    questionTimeLeftRef: React.MutableRefObject<number>;
    currentQuestion: number;
    hasPerQuestionTimer?: boolean;
}

export function TimeWarning({ questionTimeLeftRef, currentQuestion, hasPerQuestionTimer = true }: TimeWarningProps) {
    const [showWarning, setShowWarning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const isMountedRef = useRef(true);

    // Sync state immediately when question changes
    useEffect(() => {
        if (!hasPerQuestionTimer) return;
        const time = questionTimeLeftRef.current;
        if (time > 10) {
            setShowWarning(false);
        } else if (time > 0) {
            setShowWarning(true);
            setTimeLeft(time);
        }
    }, [currentQuestion, questionTimeLeftRef]);

    useEffect(() => {
        isMountedRef.current = true;
        if (!hasPerQuestionTimer) return;

        const interval = setInterval(() => {
            if (!isMountedRef.current) return;

            const time = questionTimeLeftRef.current;
            const shouldShow = time <= 10 && time > 0;

            // Update state if visibility changes or if visible and time changes
            if (shouldShow) {
                setShowWarning(true);
                setTimeLeft(time);
            } else {
                setShowWarning(false);
            }
        }, 1000);

        return () => {
            isMountedRef.current = false;
            clearInterval(interval);
        };
    }, [questionTimeLeftRef, hasPerQuestionTimer]);

    if (!hasPerQuestionTimer || !showWarning) return null;

    return (
        <div className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl border border-rose-300/50 bg-rose-500/10 p-3 sm:p-4 animate-pulse">
            <p className="text-xs sm:text-sm font-semibold text-rose-300 text-center">
                ⏰ Only {timeLeft} seconds left for this question!
            </p>
        </div>
    );
}
