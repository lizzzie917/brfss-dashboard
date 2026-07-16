/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // This overrides Tailwind's default 'sans' font stack
        sans: ['Sen', 'sans-serif'], 
      },
    },
  },
  plugins: [],
}