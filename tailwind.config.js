/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f8ef',
          100: '#e7efd9',
          200: '#cedfb8',
          300: '#a9c58a',
          400: '#82a75e',
          500: '#638943',
          600: '#4d6f34',
          700: '#3f5a2c',
          800: '#344927',
          900: '#2b3d22',
        },
        field: {
          cream: '#fbf7ec',
          linen: '#f5eddc',
          straw: '#d8b35e',
          wheat: '#f1d487',
          soil: '#6f5138',
          bark: '#3f3024',
          moss: '#314d2a',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
    },
  },
  plugins: [],
}
