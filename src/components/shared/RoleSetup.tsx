import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { BookOpen, Users, ArrowRight, Loader2, AlertCircle, GraduationCap } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const STUDENT_FEATURES = [
  'Take tests & quizzes assigned by teachers',
  'View detailed results & feedback instantly',
  'Track your progress over time',
  'Access study materials & resources',
];

const TEACHER_FEATURES = [
  'Create & customize tests and quizzes',
  'Manage your student roster easily',
  'Analyze class-wide performance data',
  'Export reports & grade analytics',
];

function RoleSetup() {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const intendedRole = user?.unsafeMetadata?.intendedRole as 'teacher' | 'student' | undefined;
  const [role, setRole] = useState<'teacher' | 'student'>(intendedRole || 'student');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const returnTo = location.state?.returnTo;

  useEffect(() => {
    setMounted(true);
    if (intendedRole) setRole(intendedRole);
  }, [intendedRole]);

  const handleRoleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { ensureUserProfile } = await import('../../lib/clerkUtils');
      await Promise.all([
        user.update({
          unsafeMetadata: { ...user.unsafeMetadata, role }
        }),
        ensureUserProfile(user, role)
      ]);
      if (returnTo) {
        navigate(returnTo, { replace: true });
      } else {
        navigate(role === 'teacher' ? '/teacher' : '/student', { replace: true });
      }
    } catch (error) {
      console.error('Error setting role:', error);
      navigate(role === 'teacher' ? '/teacher' : '/student', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* Ambient background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 -left-32 w-[480px] h-[480px] rounded-full bg-amber-500/10 blur-[100px] animate-pulse" />
        <div className="absolute -bottom-48 -right-24 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[100px] animate-pulse [animation-delay:2s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-purple-500/5 blur-[80px] animate-pulse [animation-delay:1s]" />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-100"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)',
        }}
      />

      {/* Card */}
      <div
        className={`relative w-full max-w-[520px] transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      >
        <div className="relative bg-[#13151a] border border-white/[0.07] rounded-3xl p-10 shadow-[0_32px_64px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.03)] overflow-hidden">

          {/* Card inner gradient */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500/[0.03] via-transparent to-blue-500/[0.03] pointer-events-none" />

          {/* Logo */}
          <div className="flex items-center gap-3 mb-9 relative z-10">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-[0_4px_16px_rgba(201,168,76,0.35)]">
              <GraduationCap className="w-5 h-5 text-amber-950" strokeWidth={2} />
            </div>
            <span className="text-white text-[17px] font-semibold tracking-tight">QuizMaster</span>
          </div>

          {/* Header */}
          <div className="mb-8 relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-5 bg-amber-500/60" />
              <span className="text-amber-500 text-[10px] font-bold tracking-[2px] uppercase">Account Setup</span>
            </div>
            <h1 className="text-[30px] font-bold text-white leading-tight tracking-tight mb-2">
              How will you use{' '}
              <span className="italic font-normal text-amber-400">QuizMaster?</span>
            </h1>
            <p className="text-[14px] text-white/40 leading-relaxed">
              Welcome, <span className="text-white/70 font-medium">{user?.firstName || 'there'}</span>. Choose the role that best describes you — this shapes your entire experience.
            </p>
          </div>

          {/* Role label */}
          <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-white/20 mb-3 relative z-10">I am a</p>

          {/* Role Cards */}
          <div className="flex flex-col gap-3 mb-6 relative z-10">

            {/* Student Card */}
            <button
              onClick={() => setRole('student')}
              className={`group relative w-full text-left rounded-2xl border p-5 transition-all duration-250 outline-none overflow-hidden
                ${role === 'student'
                  ? 'border-blue-500 bg-blue-500/[0.06] shadow-[0_0_0_1px_rgba(74,158,255,0.2),0_8px_24px_rgba(74,158,255,0.08)]'
                  : 'border-white/[0.07] bg-[#1a1d24] hover:border-white/15 hover:-translate-y-px'
                }`}
            >
              {/* Hover shimmer */}
              {role !== 'student' && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />
              )}

              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 border
                  ${role === 'student'
                    ? 'bg-blue-500/15 border-blue-500/25 text-blue-400 shadow-[0_4px_12px_rgba(0,0,0,0.3)]'
                    : 'bg-white/[0.04] border-white/[0.06] text-white/40'
                  }`}
                >
                  <Users className="w-5 h-5" strokeWidth={1.75} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-white tracking-tight leading-tight mb-0.5">Student</p>
                  <p className="text-[13px] text-white/40 leading-snug">Take tests, view results, track progress</p>
                </div>

                {/* Check */}
                <div className={`w-[22px] h-[22px] rounded-full flex-shrink-0 flex items-center justify-center border transition-all duration-200
                  ${role === 'student'
                    ? 'bg-blue-500 border-blue-500 scale-110'
                    : 'border-white/15'
                  }`}
                >
                  {role === 'student' && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 12 12">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Feature list */}
              {role === 'student' && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  {STUDENT_FEATURES.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 py-[3px] text-[12.5px] text-white/45"
                      style={{ animation: `slideIn 0.3s ease ${i * 0.05 + 0.05}s both` }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400/70 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </button>

            {/* Teacher Card */}
            <button
              onClick={() => setRole('teacher')}
              className={`group relative w-full text-left rounded-2xl border p-5 transition-all duration-250 outline-none overflow-hidden
                ${role === 'teacher'
                  ? 'border-amber-500 bg-amber-500/[0.06] shadow-[0_0_0_1px_rgba(201,168,76,0.2),0_8px_24px_rgba(201,168,76,0.08)]'
                  : 'border-white/[0.07] bg-[#1a1d24] hover:border-white/15 hover:-translate-y-px'
                }`}
            >
              {role !== 'teacher' && (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />
              )}

              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 border
                  ${role === 'teacher'
                    ? 'bg-amber-500/15 border-amber-500/25 text-amber-400 shadow-[0_4px_12px_rgba(0,0,0,0.3)]'
                    : 'bg-white/[0.04] border-white/[0.06] text-white/40'
                  }`}
                >
                  <BookOpen className="w-5 h-5" strokeWidth={1.75} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-white tracking-tight leading-tight mb-0.5">Teacher</p>
                  <p className="text-[13px] text-white/40 leading-snug">Create tests, manage students, analyze performance</p>
                </div>

                <div className={`w-[22px] h-[22px] rounded-full flex-shrink-0 flex items-center justify-center border transition-all duration-200
                  ${role === 'teacher'
                    ? 'bg-amber-500 border-amber-500 scale-110'
                    : 'border-white/15'
                  }`}
                >
                  {role === 'teacher' && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 12 12">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </div>
              </div>

              {role === 'teacher' && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  {TEACHER_FEATURES.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 py-[3px] text-[12.5px] text-white/45"
                      style={{ animation: `slideIn 0.3s ease ${i * 0.05 + 0.05}s both` }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400/70 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </button>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleRoleSubmit}
            disabled={loading || !role}
            className={`relative w-full h-[52px] rounded-xl font-semibold text-[15px] tracking-tight flex items-center justify-center gap-2 overflow-hidden transition-all duration-250 group
              disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
              ${role === 'student'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-[0_4px_20px_rgba(74,158,255,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(74,158,255,0.4)]'
                : 'bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 shadow-[0_4px_20px_rgba(201,168,76,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(201,168,76,0.4)]'
              }`}
            aria-label={loading ? 'Setting up your account...' : `Continue as ${role}`}
          >
            {/* Shine sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500 pointer-events-none" />

            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                <span>Setting up your workspace…</span>
              </>
            ) : (
              <>
                <span>Continue as {role === 'student' ? 'Student' : 'Teacher'}</span>
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </>
            )}
          </button>

          {/* Footer warning */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-white/20 relative z-10">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
            <p className="text-[12px]">Your role cannot be changed after this step.</p>
          </div>
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

export default RoleSetup;