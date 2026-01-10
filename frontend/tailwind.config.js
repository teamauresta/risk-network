/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        panel: 'var(--panel)',
        border: 'var(--border)',
        text: 'var(--text)',
        muted: 'var(--muted)',
      },
    },
  },
  plugins: [],
}
