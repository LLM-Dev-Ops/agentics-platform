/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // ADR-010 brand tokens. Do not hard-code #28caeb or #010101 elsewhere.
        brand: {
          cyan: '#28caeb',
          'cyan-soft': 'rgba(40, 202, 235, 0.15)',
          'cyan-glow': 'rgba(40, 202, 235, 0.45)',
        },
        surface: {
          base: '#010101',
          panel: '#0a0a0c',
          'panel-2': '#121214',
          'panel-3': '#18181b',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      boxShadow: {
        panel: 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -20px 40px rgba(0,0,0,0.45), 0 18px 40px rgba(0,0,0,0.45)',
        'panel-inner': 'inset 0 2px 10px rgba(0,0,0,0.8)',
        'cyan-glow': '0 0 12px rgba(40,202,235,0.5)',
        'cyan-glow-sm': '0 0 8px rgba(40,202,235,0.6)',
      },
      backgroundImage: {
        'panel-gradient': 'linear-gradient(180deg, rgba(18,18,20,0.92), rgba(10,10,12,0.92))',
        'panel-header-gradient': 'linear-gradient(180deg, rgba(24,24,27,0.9), rgba(10,10,12,0.6))',
      },
    },
  },
  plugins: [],
}
