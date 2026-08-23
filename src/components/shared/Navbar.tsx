import { useState, useEffect, useCallback, memo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useUser, SignedIn, UserButton, SignedOut } from '@clerk/clerk-react';
import { canonicalizeRole } from '../../lib/roleUtils';
import QuizMasterLoader from './QuizMasterloader';

export const Navbar = memo(function Navbar() {
  const { user } = useUser();
  const [scrolled, setScrolled] = useState(false);
  const [activeLink, setActiveLink] = useState('home');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Track active section via IntersectionObserver (only on landing page)
  useEffect(() => {
    if (location.pathname !== '/') return;
    const ids = ['home', 'about', 'features', 'contact'];
    const observers: IntersectionObserver[] = [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveLink(id); },
        { threshold: 0.3 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [location.pathname]);

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      setActiveLink(id);
      if (location.pathname === '/') {
        // Already on landing — smooth scroll
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // Navigate to landing page then scroll after mount
        navigate('/');
        // Small delay to let the page render before scrolling
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
    },
    [location.pathname, navigate]
  );

  const role = canonicalizeRole(user?.unsafeMetadata?.role as string | undefined);
  const dashboardPath = role === 'teacher' ? '/teacher' : role === 'student' ? '/student' : '/setup-role';

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'features', label: 'Features' },
    { id: 'contact', label: 'Contact' },
  ];

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 border-b ${scrolled
        ? ' bg-black/100 shadow-lg shadow-black/30 border-white/10'
        : ' bg-black/80 border-white/5'
        }`}
    >
      <div className="relative w-full px-4 sm:px-6 lg:px-8 flex h-16 sm:h-[70px] items-center justify-between gap-4">

        {/* ── Logo ── */}
        <Link to="/" className="flex-shrink-0 flex items-center">
          <QuizMasterLoader compact />
        </Link>

        {/* ── Nav links — absolutely centered ── */}
        <nav className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
          {navLinks.map(({ id, label }) => (
            <a
              key={id}
              href={`/#${id}`}
              onClick={(e) => handleNavClick(e, id)}
              className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 group
                ${activeLink === id
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
                }`}
            >
              {/* Active/hover pill background */}
              <span
                className={`absolute inset-0 rounded-lg transition-all duration-200
                  ${activeLink === id
                    ? 'bg-white/10 border border-white/15'
                    : 'bg-transparent group-hover:bg-white/5 border border-transparent group-hover:border-white/8'
                  }`}
              />



              <span className="relative z-10">{label}</span>
            </a>
          ))}
        </nav>

        {/* ── Right actions ── */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Signed In */}
          <SignedIn>
            <div className="flex items-center gap-2">
              <Link
                to={dashboardPath}
                className="group/button relative inline-flex items-center justify-center overflow-hidden rounded-lg bg-gray-800/40 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition-[box-shadow,transform] duration-300 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-gray-600/40 border border-white/20"
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="hidden sm:inline">Dashboard</span>
                </span>
                <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover/button:duration-1000 group-hover/button:[transform:skew(-13deg)_translateX(100%)]">
                  <div className="relative h-full w-8 bg-white/20" />
                </div>
              </Link>

              {/* Avatar */}
              <div
                className="flex-shrink-0 rounded-full ring-1 ring-white/25 ring-offset-1 ring-offset-transparent overflow-hidden w-9 h-9"

              >
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      userButtonPopoverCard: 'bg-white shadow-xl',
                      userButtonPopoverActionButton: 'hover:bg-gray-100',
                      userButtonPopoverActionButtonText: 'text-gray-700',
                      userButtonPopoverFooter: 'bg-white border-t border-gray-200',
                      userPreviewMainIdentifier: 'text-gray-900',
                      userPreviewSecondaryIdentifier: 'text-gray-600',
                      userButtonAvatarBox: '!w-9 !h-9',
                      userButtonTrigger: 'focus:shadow-none !p-0 !w-9 !h-9 !block',
                      userButtonBox: '!w-9 !h-9',
                      userButtonOuterIdentifier: 'hidden',
                    },
                  }}
                />
              </div>
            </div>
          </SignedIn>

          {/* Signed Out */}
          <SignedOut>
            <Link
              to="/auth/signin"
              className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-slate-200 hover:text-white bg-slate-800/60 hover:bg-slate-700/70 border border-slate-700/70 hover:border-slate-500/80 transition-all duration-200 overflow-hidden active:scale-95 shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-500 bg-gradient-to-r from-transparent via-white/8 to-transparent skew-x-12 pointer-events-none" />
              <svg
                width="11" height="11"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="relative z-10 flex-shrink-0 text-slate-400 group-hover:text-slate-200 transition-colors duration-150"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span className="relative z-10">Sign In</span>
            </Link>
          </SignedOut>

        </div>
      </div>
    </header>
  );
});