
import { useEffect, useState, useRef } from 'react';
import { Clock } from 'lucide-react';

interface TestStickyFooterProps {
    questionTimeLeftRef: React.MutableRefObject<number>;
    currentQuestion: number;
    hasPerQuestionTimer?: boolean;
}

export function TestStickyFooter({ questionTimeLeftRef, currentQuestion, hasPerQuestionTimer = true }: TestStickyFooterProps) {
    const [questionTimeLeft, setQuestionTimeLeft] = useState(questionTimeLeftRef.current);
    const isMountedRef = useRef(true);

    // Sync state immediately when question changes
    useEffect(() => {
        setQuestionTimeLeft(questionTimeLeftRef.current);
    }, [currentQuestion, questionTimeLeftRef]);

    useEffect(() => {
        isMountedRef.current = true;

        // Poll for updates
        const interval = setInterval(() => {
            if (!isMountedRef.current) return;
            const time = questionTimeLeftRef.current;
            setQuestionTimeLeft(prev => prev !== time ? time : prev);
        }, 1000);

        return () => {
            isMountedRef.current = false;
            clearInterval(interval);
        };
    }, [questionTimeLeftRef]);

    if (!hasPerQuestionTimer) return null;

    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-white/10 px-4 py-3 safe-area-bottom">
            <div className="flex items-center space-x-3 max-w-7xl mx-auto">
                <Clock className="w-5 h-5 text-teal-500" />
                <div>
                    <div className="text-[10px] text-slate-300 dark:text-slate-400 uppercase font-medium leading-tight">Question Time</div>
                    <div className={`text-xl font-bold font-display leading-tight ${questionTimeLeft <= 10 ? 'text-rose-400 animate-pulse' :
                        questionTimeLeft <= 20 ? 'text-amber-400' :
                            'text-teal-300'
                        }`}>
                        {questionTimeLeft}s
                    </div>
                </div>
            </div>
        </div>
    );
}
