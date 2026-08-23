import { CSSProperties } from 'react';

interface LetterStyle extends CSSProperties {
  '--delay': string;
}

const d = (delay: string): LetterStyle => ({ '--delay': delay } as LetterStyle);

interface QuizMasterLoaderProps {
  compact?: boolean;
}

const QuizMasterLoader = ({ compact = false }: QuizMasterLoaderProps) => {
  const lh = compact ? 38 : 64;
  const lw = compact ? 36 : 64;
  const liw = compact ? 24 : 44;
  const ltw = compact ? 30 : 56;

  return (
    <div
      className="qml-wrapper"
      style={compact ? undefined : { minHeight: '100vh', background: '#09090f' }}
    >
      <style>{`
        .qml-wrapper { display:flex; align-items:center; justify-content:center; }
        .qml-container { display:flex; align-items:center; }
        .qml-word { display:flex; align-items:center; gap:2px; }
        .qml-compact .qml-word { gap:0px; }
        /* letter: base (compact mode - no animation) */
        .letter { animation-delay: var(--delay); }
        /* letter: full-loader mode - fade-in + glow */
        .qml-container:not(.qml-compact) .letter {
          animation: qmlLetterFadeIn 0.6s ease-out both;
          animation-delay: var(--delay);
          filter: drop-shadow(0 0 6px rgba(150, 100, 255, 0.3));
        }
        .dash {
          animation: qmlDashArray 2s ease-in-out infinite, qmlDashOffset 2s linear infinite;
          animation-delay: var(--delay), var(--delay);
        }
        .dash-tail {
          animation: qmlDashArrayTail 2s ease-in-out infinite, qmlDashOffset 2s linear infinite;
          animation-delay: var(--delay), var(--delay);
        }
        .spin {
          animation: qmlSpinDashArray 2s ease-in-out infinite, qmlSpin 8s ease-in-out infinite, qmlDashOffset 2s linear infinite;
          animation-delay: var(--delay), var(--delay), var(--delay);
          transform-origin: center;
        }
        .qml-compact {
          zoom: 0.58;
        }
        @media (min-width: 400px) { .qml-compact { zoom: 0.68; } }
        @media (min-width: 480px) { .qml-compact { zoom: 0.78; } }
        @media (min-width: 640px) { .qml-compact { zoom: 1; } }
        @keyframes qmlLetterFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes qmlDashArray {
          0%   { stroke-dasharray: 0 1 359 0; }
          50%  { stroke-dasharray: 0 359 1 0; }
          100% { stroke-dasharray: 359 1 0 0; }
        }
        @keyframes qmlDashArrayTail {
          0%   { stroke-dasharray: 0 1 359 0; }
          50%  { stroke-dasharray: 0 359 1 0; }
          100% { stroke-dasharray: 359 1 0 0; }
        }
        @keyframes qmlSpinDashArray {
          0%   { stroke-dasharray: 270 90; }
          50%  { stroke-dasharray: 0 360; }
          100% { stroke-dasharray: 270 90; }
        }
        @keyframes qmlDashOffset {
          0%   { stroke-dashoffset: 365; }
          100% { stroke-dashoffset: 5; }
        }
        @keyframes qmlSpin {
          0%           { rotate: 0deg; }
          12.5%, 25%   { rotate: 270deg; }
          37.5%, 50%   { rotate: 540deg; }
          62.5%, 75%   { rotate: 810deg; }
          87.5%, 100%  { rotate: 1080deg; }
        }
      `}</style>
      <div
        className={`qml-container${compact ? ' qml-compact' : ''}`}
        style={{
          flexDirection: compact ? 'row' : 'column',
          gap: compact ? '2px' : '6px',
        }}
      >
        {/* Hidden SVG defs for gradients */}
        <svg height={0} width={0} viewBox="0 0 64 64" className="absolute">
          <defs xmlns="http://www.w3.org/2000/svg">
            {/* Q gradient - purple to blue */}
            <linearGradient gradientUnits="userSpaceOnUse" y2={2} x2={0} y1={62} x1={0} id="grad-q">
              <stop stopColor="#973BED" />
              <stop stopColor="#007CFF" offset={1} />
            </linearGradient>
            {/* U gradient - rotating yellow/magenta */}
            <linearGradient gradientUnits="userSpaceOnUse" y2={0} x2={0} y1={64} x1={0} id="grad-u">
              <stop stopColor="#FFC800" />
              <stop stopColor="#FF00FF" offset={1} />
              <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
            </linearGradient>
            {/* I gradient - cyan to green */}
            <linearGradient gradientUnits="userSpaceOnUse" y2={2} x2={0} y1={62} x1={0} id="grad-i">
              <stop stopColor="#00E0ED" />
              <stop stopColor="#00DA72" offset={1} />
            </linearGradient>
            {/* Z gradient - pink to orange */}
            <linearGradient gradientUnits="userSpaceOnUse" y2={2} x2={0} y1={62} x1={0} id="grad-z">
              <stop stopColor="#FF6B6B" />
              <stop stopColor="#FFB347" offset={1} />
            </linearGradient>
            {/* M gradient - teal to indigo */}
            <linearGradient gradientUnits="userSpaceOnUse" y2={2} x2={0} y1={62} x1={0} id="grad-m">
              <stop stopColor="#00C9FF" />
              <stop stopColor="#6C63FF" offset={1} />
            </linearGradient>
            {/* A gradient - green to cyan */}
            <linearGradient gradientUnits="userSpaceOnUse" y2={2} x2={0} y1={62} x1={0} id="grad-a">
              <stop stopColor="#43E97B" />
              <stop stopColor="#38F9D7" offset={1} />
            </linearGradient>
            {/* S gradient - rose to purple */}
            <linearGradient gradientUnits="userSpaceOnUse" y2={2} x2={0} y1={62} x1={0} id="grad-s">
              <stop stopColor="#F953C6" />
              <stop stopColor="#B91D73" offset={1} />
            </linearGradient>
            {/* T gradient - gold to red */}
            <linearGradient gradientUnits="userSpaceOnUse" y2={2} x2={0} y1={62} x1={0} id="grad-t">
              <stop stopColor="#F7971E" />
              <stop stopColor="#FFD200" offset={1} />
            </linearGradient>
            {/* E gradient - blue to teal */}
            <linearGradient gradientUnits="userSpaceOnUse" y2={2} x2={0} y1={62} x1={0} id="grad-e">
              <stop stopColor="#4776E6" />
              <stop stopColor="#8E54E9" offset={1} />
            </linearGradient>
            {/* R gradient - purple to blue */}
            <linearGradient gradientUnits="userSpaceOnUse" y2={2} x2={0} y1={62} x1={0} id="grad-r">
              <stop stopColor="#DA22FF" />
              <stop stopColor="#9733EE" offset={1} />
            </linearGradient>
          </defs>
        </svg>

        {/* ── QUIZ ── */}
        <div className="qml-word">
          {/* Q */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height={lh} width={lw} className="letter" style={d('0s')}>
            {/* Q outer circle */}
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-q)"
              d="M 32 10 a 22 22 0 1 1 0 44 a 22 22 0 1 1 0 -44"
              className="dash" pathLength={360} />
            {/* Q tail */}
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-q)"
              d="M 46 46 L 56 56"
              className="dash-tail" pathLength={360} />
          </svg>

          {/* U */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height={lh} width={lw} className="letter" style={d('0.1s')}>
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-u)"
              d="M 12,10 v 28 c 0,11 8.5,16 20,16 c 11.5,0 20,-5 20,-16 V 10"
              className="dash" pathLength={360} />
          </svg>

          {/* I */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height={lh} width={liw} className="letter" style={d('0.2s')}>
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-i)"
              d="M 22,10 H 22 V 54"
              className="dash" pathLength={360} />
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-i)"
              d="M 10,10 H 34"
              className="dash-tail" pathLength={360} />
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-i)"
              d="M 10,54 H 34"
              className="dash-tail" pathLength={360} />
          </svg>

          {/* Z */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height={lh} width={lw} className="letter" style={d('0.3s')}>
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-z)"
              d="M 10,10 H 54 L 10,54 H 54"
              className="dash" pathLength={360} />
          </svg>
        </div>

        <div className={compact ? undefined : 'qml-spacer'} style={compact ? { display: 'none' } : { height: '8px' }} />

        {/* ── MASTER ── */}
        <div className="qml-word">
          {/* M */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height={lh} width={lw} className="letter" style={d('0.45s')}>
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-m)"
              d="M 8,54 V 10 L 32,40 L 56,10 V 54"
              className="dash" pathLength={360} />
          </svg>

          {/* A */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height={lh} width={lw} className="letter" style={d('0.55s')}>
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-a)"
              d="M 8,54 L 32,10 L 56,54"
              className="dash" pathLength={360} />
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-a)"
              d="M 17,36 H 47"
              className="dash-tail" pathLength={360} />
          </svg>

          {/* S */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height={lh} width={lw} className="letter" style={d('0.65s')}>
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-s)"
              d="M 52,18 C 52,13 46,10 32,10 C 18,10 12,14 12,22 C 12,30 22,32 32,34 C 42,36 52,38 52,46 C 52,54 44,54 32,54 C 20,54 12,50 12,46"
              className="spin" pathLength={360} />
          </svg>

          {/* T */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height={lh} width={ltw} className="letter" style={d('0.75s')}>
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-t)"
              d="M 28,10 V 54"
              className="dash" pathLength={360} />
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-t)"
              d="M 6,10 H 50"
              className="dash-tail" pathLength={360} />
          </svg>

          {/* E */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height={lh} width={ltw} className="letter" style={d('0.85s')}>
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-e)"
              d="M 46,10 H 10 V 54 H 46"
              className="dash" pathLength={360} />
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-e)"
              d="M 10,32 H 40"
              className="dash-tail" pathLength={360} />
          </svg>

          {/* R */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height={lh} width={lw} className="letter" style={d('0.95s')}>
            <path strokeLinejoin="round" strokeLinecap="round" strokeWidth={7} stroke="url(#grad-r)"
              d="M 12,54 V 10 H 38 C 50,10 52,18 52,22 C 52,30 46,34 38,34 H 12 L 52,54"
              className="dash" pathLength={360} />
          </svg>
        </div>
      </div>
    </div>
  );
};
export default QuizMasterLoader;
