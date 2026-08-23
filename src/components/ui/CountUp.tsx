import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  from?: number;
  to: number;
  separator?: string;
  direction?: "up" | "down";
  duration?: number;
  delay?: number;
  decimals?: number;
  className?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

export default function CountUp({
  from = 0,
  to,
  separator = "",
  direction = "up",
  duration = 2,
  delay = 0,
  decimals = 0,
  className = "",
  onStart,
  onEnd,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | null>(null);
  const [inView, setInView] = useState(false);

  const startVal = direction === "down" ? to : from;
  const endVal = direction === "down" ? from : to;

  const [displayValue, setDisplayValue] = useState(startVal);

  // Step 1: watch for element entering the viewport (fires once)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Step 2: run animation when BOTH in-view AND `to` has a real non-zero value.
  // This handles the race condition where data loads after the element is visible.
  useEffect(() => {
    if (!inView || to === 0) return;

    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const runAnimation = () => {
      onStart?.();
      let startTime: number | null = null;

      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / (duration * 1000), 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startVal + (endVal - startVal) * eased;
        setDisplayValue(parseFloat(current.toFixed(decimals)));

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(step);
        } else {
          setDisplayValue(endVal);
          onEnd?.();
        }
      };

      animationRef.current = requestAnimationFrame(step);
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (delay > 0) {
      timer = setTimeout(runAnimation, delay * 1000);
    } else {
      runAnimation();
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, to]);

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : separator
        ? Math.round(displayValue).toLocaleString()
        : Math.round(displayValue).toString();

  return (
    <span ref={ref} className={className}>
      {formatted}
    </span>
  );
}
