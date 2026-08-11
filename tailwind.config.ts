import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7dc8fb',
          400: '#38aaf6',
          500: '#0e8ee7',
          600: '#026fc5',
          700: '#0358a0',
          800: '#074b84',
          900: '#0b3f6e',
          950: '#07274a',
        },
      },
    },
  },
  plugins: [],
}

export default config
