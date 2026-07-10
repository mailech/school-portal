import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        sheet: 'var(--sheet)',
        raised: 'var(--raised)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        rule: 'var(--rule)',
        'rule-strong': 'var(--rule-strong)',
        margin: 'var(--margin)',
        seal: 'var(--seal)',
        'seal-ink': 'var(--seal-ink)',
        'seal-soft': 'var(--seal-soft)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(30,42,48,.05), 0 8px 24px -14px rgba(30,42,48,.18)',
        pop: '0 4px 12px -2px rgba(30,42,48,.12), 0 12px 32px -12px rgba(30,42,48,.24)',
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
