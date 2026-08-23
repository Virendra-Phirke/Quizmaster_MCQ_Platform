interface NegativeMarkingToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  showDescription?: boolean;
  negativeMarks?: number;
}

export default function NegativeMarkingToggle({
  enabled,
  onChange,
  showDescription = true,
  negativeMarks = 1,
}: NegativeMarkingToggleProps) {
  return (
    <div className="w-full">
      <div
        className="relative flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 cursor-pointer select-none"
        style={{
          background: enabled
            ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.04) 100%)'
            : 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.8) 100%)',
          border: enabled
            ? '1px solid rgba(16,185,129,0.25)'
            : '1px solid rgba(51,65,85,0.6)',
          boxShadow: enabled
            ? '0 0 24px rgba(16,185,129,0.06), inset 0 1px 0 rgba(255,255,255,0.04)'
            : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
        onClick={() => onChange(!enabled)}
      >
        {/* Left */}
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300"
            style={{
              background: enabled
                ? 'rgba(16,185,129,0.15)'
                : 'rgba(100,116,139,0.15)',
              border: enabled
                ? '1px solid rgba(16,185,129,0.3)'
                : '1px solid rgba(100,116,139,0.2)',
            }}
          >
            <svg
              className="w-4 h-4 transition-colors duration-300"
              style={{ color: enabled ? '#10b981' : '#64748b' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 12H4"
              />
            </svg>
          </div>

          {/* Text */}
          <div>
            <p className="text-sm font-semibold text-slate-100 leading-tight">
              Negative Marking
            </p>
            <p
              className="text-[11px] mt-0.5 transition-colors duration-300"
              style={{ color: enabled ? 'rgba(16,185,129,0.8)' : '#64748b' }}
            >
              {enabled
                ? `−${negativeMarks} mark${negativeMarks !== 1 ? 's' : ''} per wrong answer`
                : 'No penalty for wrong answers'}
            </p>
          </div>
        </div>

        {/* Toggle */}
        <div
          className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-300"
          style={{
            background: enabled
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'rgba(30,41,59,1)',
            border: enabled
              ? '1px solid rgba(16,185,129,0.5)'
              : '1px solid rgba(51,65,85,0.8)',
            boxShadow: enabled
              ? '0 0 12px rgba(16,185,129,0.3)'
              : 'none',
          }}
          onClick={(e) => { e.stopPropagation(); onChange(!enabled); }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-all duration-300 shadow-md"
            style={{
              background: enabled ? '#fff' : '#475569',
              transform: enabled ? 'translateX(20px)' : 'translateX(0)',
              boxShadow: enabled
                ? '0 1px 6px rgba(0,0,0,0.25)'
                : '0 1px 4px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      </div>

      {/* Description Panel */}
      {showDescription && (
        <div
          className="overflow-hidden transition-all duration-500 ease-in-out"
          style={{
            maxHeight: enabled ? '80px' : '0px',
            opacity: enabled ? 1 : 0,
            marginTop: enabled ? '8px' : '0px',
          }}
        >
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
            style={{
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)',
            }}
          >
            <svg
              className="w-3.5 h-3.5 flex-shrink-0 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-xs text-slate-400 leading-relaxed">
              Each wrong answer deducts{' '}
              <span
                className="font-bold px-1.5 py-0.5 rounded text-red-300 text-[10px]"
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.25)',
                }}
              >
                −{negativeMarks}
              </span>{' '}
              mark{negativeMarks !== 1 ? 's' : ''} from your total score.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}