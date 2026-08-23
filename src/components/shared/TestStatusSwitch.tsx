import React from 'react';
import { Globe, Lock } from 'lucide-react';

interface TestStatusSwitchProps {
  isPublic: boolean;
  onChange: (isPublic: boolean) => void;
}

const TestStatusSwitch: React.FC<TestStatusSwitchProps> = React.memo(({ isPublic, onChange }) => {
  return (
    <div
      className="inline-flex items-center p-1 rounded-xl gap-0.5"
      style={{
        background: 'rgba(8,12,24,0.95)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      {/* Public */}
      <button
        onClick={() => onChange(true)}
        type="button"
        className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 overflow-hidden"
        style={{
          background: isPublic
            ? 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.12) 100%)'
            : 'transparent',
          border: isPublic
            ? '1px solid rgba(16,185,129,0.28)'
            : '1px solid transparent',
          color: isPublic ? '#6ee7b7' : 'rgba(148,163,184,0.55)',
          boxShadow: isPublic
            ? '0 2px 12px rgba(16,185,129,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
            : 'none',
        }}
      >
        {isPublic && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%)',
            }}
          />
        )}
        <Globe
          className="w-3.5 h-3.5 relative z-10 transition-colors duration-200"
          style={{ color: isPublic ? '#10b981' : 'rgba(148,163,184,0.4)' }}
        />
        <span className="relative z-10">Public</span>
      </button>

      {/* Private */}
      <button
        onClick={() => onChange(false)}
        type="button"
        className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 overflow-hidden"
        style={{
          background: !isPublic
            ? 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(79,70,229,0.12) 100%)'
            : 'transparent',
          border: !isPublic
            ? '1px solid rgba(99,102,241,0.28)'
            : '1px solid transparent',
          color: !isPublic ? '#c7d2fe' : 'rgba(148,163,184,0.55)',
          boxShadow: !isPublic
            ? '0 2px 12px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
            : 'none',
        }}
      >
        {!isPublic && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%)',
            }}
          />
        )}
        <Lock
          className="w-3.5 h-3.5 relative z-10 transition-colors duration-200"
          style={{ color: !isPublic ? '#818cf8' : 'rgba(148,163,184,0.4)' }}
        />
        <span className="relative z-10">Private</span>
      </button>
    </div>
  );
});

export default TestStatusSwitch;