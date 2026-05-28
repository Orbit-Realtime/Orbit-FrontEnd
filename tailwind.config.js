/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        orbit: {
          bg:              '#030712',
          sidebar:         '#07111F',
          surface:         '#0B1525',
          surface2:        '#111C2E',
          elevated:        '#162235',

          text:            '#F3F7FF',
          secondary:       '#C7D2E4',
          muted:           '#8A97AD',
          subtle:          '#617089',

          cyan:            '#43D9FF',
          blue:            '#3B82F6',

          border:          'rgba(255,255,255,0.08)',
          'border-strong': 'rgba(255,255,255,0.12)',

          glow:            'rgba(67,217,255,0.18)',
        },
      },
      boxShadow: {
        'card-orbit': '0 2px 6px rgba(0, 0, 0, 0.30), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      },
    },
  },
  plugins: [],
};