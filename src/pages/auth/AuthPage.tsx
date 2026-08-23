import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { ModernAuthCard } from '../../components/shared/ModernAuthCard';
import { canonicalizeRole } from '../../lib/roleUtils';

interface AuthPageProps {
  defaultMode?: 'signin' | 'signup';
}

const AuthPage: React.FC<AuthPageProps> = ({ defaultMode = 'signin' }) => {
  const { mode } = useParams<{ mode?: string }>();
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();

  // Keep the mode limited to signin|signup
  const resolvedMode = mode === 'signup' ? 'signup' : defaultMode === 'signup' ? 'signup' : 'signin';

  // Guard: only run the redirect logic ONCE per mount.
  // Without this, user.update() (role assignment) mutates the Clerk user object,
  // which re-triggers the effect. By then pendingTestLink is gone and the user
  // gets sent to /student instead of the stored test path.
  const hasRedirected = useRef(false);

  // Handle redirect after user is authenticated
  useEffect(() => {
    if (!isLoaded || !user) return;
    // Already handled – skip subsequent effect runs triggered by user object updates
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    const processRedirects = async () => {
      // User is authenticated, check for pending redirect
      let pendingTestLink: string | null = null;

      try {
        pendingTestLink = localStorage.getItem('pendingTestLink');

        // Accept any internal app path (must start with /)
        // Reject obviously bad values like external URLs or empty string
        if (pendingTestLink && !pendingTestLink.startsWith('/')) {
          console.warn('⚠️ Invalid redirect path, ignoring:', pendingTestLink);
          pendingTestLink = null;
        }
      } catch (error) {
        console.error('❌ Error reading localStorage:', error);
      }

      const userRole = canonicalizeRole(user.unsafeMetadata?.role as string | undefined);

      if (pendingTestLink) {
        try {
          // Clear the stored link first to prevent infinite loops
          localStorage.removeItem('pendingTestLink');

          // If the user hasn't chosen a role yet, auto-assign 'student' since they clicked a test link
          if (!userRole) {
            await user.update({
              unsafeMetadata: { ...user.unsafeMetadata, role: 'student' }
            });
            const { ensureUserProfile } = await import('../../lib/clerkUtils');
            await ensureUserProfile(user, 'student');
            // Give clerk a small moment to flush the cache so routing works flawlessly
            await new Promise(resolve => setTimeout(resolve, 300));
          }

          navigate(pendingTestLink!, { replace: true });
        } catch (error) {
          console.error('❌ Error during redirect:', error);
          // Fallback to dashboard if redirect fails
          const fallbackPath = userRole === 'teacher' ? '/teacher' : '/student';
          navigate(fallbackPath, { replace: true });
        }
        return;
      }

      // No pending redirect, go to default dashboard
      if (userRole === 'teacher') {
        setTimeout(() => navigate('/teacher', { replace: true }), 100);
      } else if (userRole === 'student') {
        setTimeout(() => navigate('/student', { replace: true }), 100);
      } else {
        // No role set and no pending test link — send to role picker
        navigate('/setup-role', { replace: true });
      }
    };

    processRedirects();
  }, [user, isLoaded, navigate]);

  // Show loading while Clerk initializes
  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  // If user is already authenticated, show loading while redirect happens
  if (user) {
    return <LoadingSpinner />;
  }

  // Show auth form for unauthenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-slate-900">
      <ModernAuthCard mode={resolvedMode} />
    </div>
  );
};

export default AuthPage;
