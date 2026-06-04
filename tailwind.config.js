/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          // Vodical brand purple — matches the main app's `hsl(267 100% 33%)`.
          DEFAULT: '#5400A8',
          50:  '#F5EBFF', // very light purple — hover backgrounds, subtle accents
          100: '#E6D1FF', // light purple — hover row backgrounds
          500: '#5400A8', // brand — primary buttons / active states
          600: '#430085', // darker — hover on primary buttons
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#10B981',
          500: '#10B981',
          foreground: '#0a0a0a',
        },
        // shadcn-style tokens used by ported editor components
        border: 'hsl(214 32% 91%)',
        input: 'hsl(214 32% 91%)',
        ring: 'hsl(215 20% 65%)',
        background: 'hsl(0 0% 100%)',
        foreground: 'hsl(222 47% 11%)',
        muted: {
          DEFAULT: 'hsl(210 40% 96%)',
          foreground: 'hsl(215 16% 47%)',
        },
        popover: {
          DEFAULT: 'hsl(0 0% 100%)',
          foreground: 'hsl(222 47% 11%)',
        },
        destructive: {
          DEFAULT: 'hsl(0 84% 60%)',
          foreground: 'hsl(0 0% 100%)',
        },
        'accent-foreground': 'hsl(222 47% 11%)',
        secondary: {
          DEFAULT: 'hsl(210 40% 96%)',
          foreground: 'hsl(222 47% 11%)',
        },
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};