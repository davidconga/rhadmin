/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F6E56',
          50: '#e6f4ef',
          100: '#c9e9dd',
          200: '#9FE1CB',
          300: '#5DCAA5',
          400: '#2bae83',
          500: '#1D9E75',
          600: '#0F6E56',
          700: '#0c5a47',
          800: '#085041',
          900: '#063a2f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Manrope', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
