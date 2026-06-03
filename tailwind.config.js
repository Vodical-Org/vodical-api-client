/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0A3B62', 50: '#EBF5FF', 100: '#D6EAFF', 500: '#0A3B62', 600: '#082F4E' },
        accent: { DEFAULT: '#10B981', 500: '#10B981' },
      },
    },
  },
  plugins: [],
};