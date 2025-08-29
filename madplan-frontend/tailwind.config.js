/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Enhanced Ghibli-inspired color palette
        primary: {
          50: '#f0f9f4',
          100: '#dcf2e4',
          200: '#bce5cd',
          300: '#8dd3ab',
          400: '#5bb880',
          500: '#369b5f',
          600: '#277d4b',
          700: '#20633d',
          800: '#1c4f33',
          900: '#18422b',
        },
        accent: {
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
        natural: {
          50: '#faf9f7',
          100: '#f4f2ed',
          200: '#e8e3d7',
          300: '#d9d1c1',
          400: '#c8bb9f',
          500: '#b8a47d',
          600: '#a58d5b',
          700: '#8b7346',
          800: '#745e3b',
          900: '#614f32',
        },
        // Additional Ghibli atmosphere colors
        forest: {
          50: '#f6f8f6',
          100: '#e9f0e9',
          200: '#d3e1d3',
          300: '#b3cab3',
          400: '#8bb08b',
          500: '#6b936b',
          600: '#547754',
          700: '#456145',
          800: '#3a503a',
          900: '#324232',
        },
        sky: {
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
        earth: {
          50: '#faf8f3',
          100: '#f4f0e6',
          200: '#e6dcc7',
          300: '#d2c2a0',
          400: '#bea677',
          500: '#a68c56',
          600: '#8f7548',
          700: '#755f3e',
          800: '#614f36',
          900: '#52422f',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          'Fira Sans',
          'Droid Sans',
          'Helvetica Neue',
          'sans-serif',
        ],
        display: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        // Hand-crafted feel typography
        heading: [
          'Inter',
          'Georgia',
          'Times New Roman',
          'serif',
        ],
      },
      animation: {
        // Enhanced animations for Ghibli feel
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'bounce-gentle': 'bounceGentle 0.6s ease-in-out',
        'float': 'float 3s ease-in-out infinite',
        'float-delayed': 'float 3s ease-in-out 1s infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'pulse-gentle': 'pulseGentle 2s ease-in-out infinite',
        'gradient-shift': 'gradientShift 3s ease infinite',
        'rotate-gentle': 'rotateGentle 20s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-5px)' },
          '60%': { transform: 'translateY(-3px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        pulseGentle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        gradientShift: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        rotateGentle: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      boxShadow: {
        // Enhanced Ghibli-inspired shadows
        ghibli: '0 4px 6px -1px rgba(16, 185, 129, 0.1), 0 2px 4px -1px rgba(16, 185, 129, 0.06)',
        'ghibli-sm': '0 1px 2px 0 rgba(16, 185, 129, 0.05)',
        'ghibli-lg': '0 10px 15px -3px rgba(16, 185, 129, 0.1), 0 4px 6px -2px rgba(16, 185, 129, 0.05)',
        'ghibli-xl': '0 20px 25px -5px rgba(16, 185, 129, 0.1), 0 10px 10px -5px rgba(16, 185, 129, 0.04)',
        'ghibli-2xl': '0 25px 50px -12px rgba(16, 185, 129, 0.25)',
        'ghibli-inner': 'inset 0 2px 4px 0 rgba(16, 185, 129, 0.06)',
        // Atmospheric shadows
        'dream': '0 8px 30px rgba(16, 185, 129, 0.12), 0 4px 15px rgba(16, 185, 129, 0.08)',
        'float': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 20px 40px -10px rgba(0, 0, 0, 0.1)',
        'magical': '0 0 20px rgba(16, 185, 129, 0.3), 0 0 40px rgba(16, 185, 129, 0.1)',
      },
      borderRadius: {
        ghibli: '0.75rem',
        'ghibli-sm': '0.5rem',
        'ghibli-lg': '1rem',
        'ghibli-xl': '1.25rem',
        'ghibli-2xl': '1.5rem',
        'ghibli-3xl': '2rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '100': '25rem',
        '112': '28rem',
        '128': '32rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      backgroundImage: {
        // Ghibli-inspired gradients
        'ghibli-sky': 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 25%, #7dd3fc 50%, #38bdf8 75%, #0ea5e9 100%)',
        'ghibli-forest': 'linear-gradient(135deg, #f0f9f4 0%, #dcf2e4 25%, #bce5cd 50%, #8dd3ab 75%, #5bb880 100%)',
        'ghibli-earth': 'linear-gradient(135deg, #faf8f3 0%, #f4f0e6 25%, #e6dcc7 50%, #d2c2a0 75%, #bea677 100%)',
        'ghibli-magical': 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 20%, #bbf7d0 40%, #86efac 60%, #4ade80 80%, #22c55e 100%)',
        'ghibli-dream': 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 20%, #bae6fd 40%, #7dd3fc 60%, #38bdf8 80%, #0ea5e9 100%)',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'ease-out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        'ease-in-quart': 'cubic-bezier(0.5, 0, 0.75, 0)',
      }
    },
  },
  plugins: [
    // Add any Tailwind plugins here if needed
  ],
}
