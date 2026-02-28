/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pickleball: {
          blue: '#3B82F6',
          green: '#22C55E',
          yellow: '#FFEB3B',
          court: '#1E40AF',
        }
      }
    },
  },
  plugins: [],
}
