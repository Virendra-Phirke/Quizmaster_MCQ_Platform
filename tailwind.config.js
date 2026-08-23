/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Existing dark palette
        dark: {
          bg: {
            primary: '#0f0f0f',
            secondary: '#1a1a1a',
            tertiary: '#262626',
          },
          text: {
            primary: '#ffffff',
            secondary: '#d1d5db',
            tertiary: '#9ca3af',
          },
          border: '#374151',
        },
        accent: {
          red: {
            50: '#fef2f2',
            100: '#fee2e2',
            200: '#fecaca',
            300: '#fca5a5',
            400: '#f87171',
            500: '#ef4444',
            600: '#dc2626',
            700: '#b91c1c',
            800: '#991b1b',
            900: '#7f1d1d',
          },
          purple: {
            50: '#faf5ff',
            100: '#f3e8ff',
            200: '#e9d5ff',
            300: '#d8b4fe',
            400: '#c084fc',
            500: '#a855f7',
            600: '#9333ea',
            700: '#7c3aed',
            800: '#6b21a8',
            900: '#581c87',
          },
        },
        // Premium brand gradients (base tokens)
        brand: {
          pink: '#ec4899',
            fuchsia: '#d946ef',
            purple: '#8b5cf6',
            indigo: '#6366f1',
            blue: '#3b82f6',
            teal: '#14b8a6'
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-premium': 'radial-gradient(circle at 20% 20%, rgba(236,72,153,0.15), transparent 60%), radial-gradient(circle at 80% 30%, rgba(139,92,246,0.15), transparent 60%), radial-gradient(circle at 30% 80%, rgba(20,184,166,0.12), transparent 60%)'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.05), 0 4px 24px -2px rgba(139,92,246,0.35), 0 10px 40px -4px rgba(236,72,153,0.25)',
        'inner-glow': 'inset 0 1px 2px rgba(255,255,255,0.1), inset 0 0 0 1px rgba(255,255,255,0.05)',
      },
      borderRadius: {
        '4xl': '2.25rem',
        pill: '999px'
      },
      spacing: {
        18: '4.5rem'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'fade-in-down': 'fadeInDown 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.3s ease-out',
        shimmer: 'shimmer 2s linear infinite',
        'gradient-shift': 'gradientShift 12s ease infinite',
        'scale-in': 'scaleIn 0.4s cubic-bezier(.4,0,.2,1)',
        'fade-slide': 'fadeSlide .6s cubic-bezier(.4,0,.2,1)',
        'pulse-soft': 'pulseSoft 4s ease-in-out infinite',
        'ring-timer': 'ringTimer 1s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-700px 0' },
          '100%': { backgroundPosition: '700px 0' }
        },
        gradientShift: {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        fadeSlide: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pulseSoft: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '.6' }
        },
        ringTimer: {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '1000' }
        }
      },
      transitionTimingFunction: {
        'swift-out': 'cubic-bezier(.4,0,.2,1)'
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [
    require('lightswind/plugin'),],
};
