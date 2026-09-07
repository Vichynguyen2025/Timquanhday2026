/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
        sos: { 500: '#ef4444', 600: '#dc2626' },
        success: { 500: '#22c55e' },
      },
    },
  },
  plugins: [],
};