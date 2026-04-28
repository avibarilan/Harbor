/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        harbor: {
          50:  '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fb',
          400: '#36aaf6',
          500: '#0c8fe7',
          600: '#0170c5',
          700: '#0259a0',
          800: '#064c84',
          900: '#0b406e',
          950: '#072849',
        },
        // CSS-variable-backed design tokens (usable as Tailwind classes)
        hb: {
          base:          'var(--color-bg-base)',
          surface:       'var(--color-bg-surface)',
          elevated:      'var(--color-bg-elevated)',
          hover:         'var(--color-bg-hover)',
          border:        'var(--color-border)',
          'border-sub':  'var(--color-border-subtle)',
          'text-1':      'var(--color-text-primary)',
          'text-2':      'var(--color-text-secondary)',
          'text-3':      'var(--color-text-tertiary)',
          accent:        'var(--color-accent)',
          'accent-h':    'var(--color-accent-hover)',
          'accent-s':    'var(--color-accent-subtle)',
          success:       'var(--color-success)',
          'success-s':   'var(--color-success-subtle)',
          warning:       'var(--color-warning)',
          'warning-s':   'var(--color-warning-subtle)',
          danger:        'var(--color-danger)',
          'danger-s':    'var(--color-danger-subtle)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
