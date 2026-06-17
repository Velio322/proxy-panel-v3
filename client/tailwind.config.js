/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
    },
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--surface)',
          hover:   'var(--surface-hover)',
          glass:   'var(--surface-glass)',
        },
        bg: {
          DEFAULT: 'var(--bg)',
          raised:  'var(--bg-raised)',
          sunken:  'var(--bg-sunken)',
          glass:   'var(--bg-glass)',
        },
        fg: {
          DEFAULT: 'var(--fg)',
          muted:   'var(--fg-muted)',
          subtle:  'var(--fg-subtle)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          '2':     'var(--accent-2)',
          hover:   'var(--accent-hover)',
          muted:   'var(--accent-muted)',
          fg:      'var(--accent-fg)',
          glow:    'var(--accent-glow)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          muted:   'var(--danger-muted)',
          border:  'var(--danger-border)',
        },
        success: {
          DEFAULT: 'var(--success)',
          muted:   'var(--success-muted)',
          border:  'var(--success-border)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          muted:   'var(--warning-muted)',
          border:  'var(--warning-border)',
        },
        info: {
          DEFAULT: 'var(--info)',
          muted:   'var(--info-muted)',
        },
        border: {
          DEFAULT: 'var(--border)',
          subtle:  'var(--border-subtle)',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm:      'var(--radius-sm)',
        md:      'var(--radius-md)',
        lg:      'var(--radius-lg)',
        xl:      'var(--radius-xl)',
      },
      boxShadow: {
        'sm':   'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        'md':   'var(--shadow-md)',
        'lg':   'var(--shadow-lg)',
        'glow': 'var(--shadow-glow)',
      },
      keyframes: {
        'fade-in':   { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up':  { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in':  { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'shimmer':   { '0%': { backgroundPosition: '-1000px 0' }, '100%': { backgroundPosition: '1000px 0' } },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px var(--accent-glow)' },
          '50%':       { boxShadow: '0 0 20px var(--accent-glow)' },
        },
        'in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in':    'fade-in 0.2s ease-out',
        'slide-up':   'slide-up 0.25s ease-out',
        'scale-in':   'scale-in 0.2s ease-out',
        'shimmer':    'shimmer 1.5s infinite linear',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'in':         'in 0.2s ease-out',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
        'glass-gradient':  'linear-gradient(135deg, var(--surface-glass), var(--bg-glass))',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
