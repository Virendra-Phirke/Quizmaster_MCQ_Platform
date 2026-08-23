import React from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';

interface ModernAuthCardProps {
  mode?: 'signin' | 'signup';
}

/**
 * Auth card with Clerk authentication - role selection happens after sign-in.
 * Uses Clerk's appearance prop for consistent theming.
 */
export const ModernAuthCard: React.FC<ModernAuthCardProps> = ({ mode = 'signin' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-slate-800/30 rounded-xl shadow-2xl border border-slate-900/50 p-8 animate-fade-in-up">
        <div className="mb-6 text-center">
          <p className="text-sm text-gray-400 animate-fade-in-up-200">
            {mode === 'signin' ? (
              <span className="inline-block">
                Sign in to access your{' '}
                <span className="text-purple-400 font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
                  dashboard
                </span>
              </span>
            ) : (
              <span className="inline-block">
                Get started with{' '}
                <span className="text-purple-400 font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
                  QuizMaster
                </span>
              </span>
            )}
          </p>
        </div>
        
        <div className="mt-4">
          {mode === 'signin' ? (
            <SignIn 
              appearance={{
                variables: {
                  colorPrimary: '#a855f7',
                },
                elements: {
                  rootBox: 'w-full',
                  card: 'bg-transparent shadow-none p-0 w-full',
                  form: 'w-full',
                  formFieldInput: 'w-full bg-slate-700 text-white border-slate-600',
                  formButtonPrimary: 'w-full bg-gradient-to-r from-purple-500 to-purple-600',
                  footerActionLink: 'text-purple-400 hover:text-purple-300',
                  footer: 'hidden',
                  footerAction: 'hidden',
                  footerActionText: 'hidden',
                  footerActionLink__signUp: 'hidden'
                }
              }}
              signUpUrl="/#/auth/signup"
            />
          ) : (
            <SignUp 
              appearance={{
                variables: {
                  colorPrimary: '#a855f7',
                },
                elements: {
                  rootBox: 'w-full',
                  card: 'bg-transparent shadow-none p-0 w-full',
                  form: 'w-full',
                  formFieldInput: 'w-full bg-slate-700 text-white border-slate-600',
                  formButtonPrimary: 'w-full bg-gradient-to-r from-purple-500 to-purple-600',
                  footerActionLink: 'text-purple-400 hover:text-purple-300',
                  footer: 'hidden',
                  footerAction: 'hidden',
                  footerActionText: 'hidden',
                  footerActionLink__signIn: 'hidden'
                }
              }}
              signInUrl="/#/auth/signin"
            />
          )}
        </div>
      </div>
    </div>
  );
};
