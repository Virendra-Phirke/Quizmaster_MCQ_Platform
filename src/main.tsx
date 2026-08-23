import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key. Please add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file. Get your key from https://clerk.com dashboard.");
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/#/auth/signin"
      signUpFallbackRedirectUrl="/#/auth/signin"
      appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: '#a855f7',
          colorBackground: '#1e293b',
          colorText: '#ffffff',
          colorInputBackground: '#334155',
          colorInputText: '#ffffff',
          colorNeutral: '#94a3b8',
          colorTextSecondary: '#94a3b8',
          colorDanger: '#ef4444',
          colorSuccess: '#22c55e',
          colorWarning: '#f59e0b',
        },
        elements: {
          rootBox: 'w-full',
          card: 'bg-slate-800 shadow-xl text-white',
          modalContent: 'bg-slate-800 text-white',
          modalBackdrop: 'bg-black/70',
          navbar: 'bg-slate-900',
          navbarButton: 'text-gray-300 hover:bg-slate-800',
          profilePage: 'bg-slate-800',
          profileSection: 'bg-slate-800',
          profileSectionTitle: 'text-white',
          profileSectionContent: 'text-gray-300',
          formFieldLabel: 'text-gray-300',
          formFieldInput: 'bg-slate-700 text-white border-slate-600',
          formButtonPrimary: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700',
          badge: 'bg-blue-900 text-blue-200',
          identityPreviewText: 'text-white',
          accordionTriggerButton: 'text-white hover:bg-slate-700'
        }
      }}
    >
      <App />
    </ClerkProvider>
  </StrictMode>
);
