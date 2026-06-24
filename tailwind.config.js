/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-bricolage)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Satoshi', 'var(--font-bricolage)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-space)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Greenhouse Stone — matches the marketing site / main app.
        primary: {
          50: '#e9f6ef',
          100: '#cdeeda',
          200: '#9fdcbb',
          300: '#66c694',
          400: '#33ad72',
          500: '#1fa866',
          600: '#138a52',
          700: '#0e7a47',
          800: '#0b5e38',
          900: '#0a4e30',
        },
        // field-* remapped to Greenhouse tones (keys kept so components are
        // untouched): cream/linen→stone, wheat→sand, straw→honey, moss→emerald,
        // soil→warm ink-soft, bark→evergreen ink.
        field: {
          cream: '#eceee7',
          linen: '#f3f4ee',
          straw: '#e0913c',
          wheat: '#ecdcc2',
          soil: '#353b31',
          bark: '#16231c',
          moss: '#0e7a47',
        },
        slate: {
          50: '#f7f8f3',
          100: '#eef0e8',
          200: '#e0e3d8',
          300: '#c8ccbd',
          400: '#969c8c',
          500: '#686e60',
          600: '#4b5145',
          700: '#353b31',
          800: '#232820',
          900: '#141a14',
        },
      },
    },
  },
  plugins: [],
}
