/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'login-spin-reverse': {
          '0%': { transform: 'translate(-50%, -50%) rotate(0deg)' },
          '100%': { transform: 'translate(-50%, -50%) rotate(-360deg)' },
        },
      },
      animation: {
        'login-spin-reverse': 'login-spin-reverse 3.333s linear infinite',
      },
    },
  },
  plugins: [
    function({ addComponents }) {
      addComponents({
        '.input-style': {
          '@apply mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm': {},
        },
        '.btn-primary': {
          '@apply inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed': {},
        },
        '.btn-secondary': {
          '@apply inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-700 bg-white rounded-md border border-slate-300 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed': {},
        },
        '.login-wrapper': {
          position: 'relative',
        },
        '.login-wrapper::before': {
          content: "''",
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '120vw',
          maxWidth: 'none',
          /* give a visible height so pseudo-element shows */
          height: '120vh',
          transform: 'translate(-50%, -50%)',
          backgroundImage: 'var(--login-bg)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          /* Hide the pseudo-element and disable animation to remove background motion */
          opacity: '0',
          willChange: 'transform',
          pointerEvents: 'none',
          userSelect: 'none',
          filter: 'saturate(0.85) brightness(1.05)',
          animation: 'none',
          zIndex: '0',
        },
        '.text-shadow-md': {
          textShadow: '0 2px 6px rgba(0,0,0,0.12)'
        },
        '.text-shadow-lg': {
          textShadow: '0 4px 12px rgba(0,0,0,0.18)'
        },
      })
    }
  ],
}