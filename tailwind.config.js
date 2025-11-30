/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Easy-on-the-eyes palette - Soft, muted, high contrast for readability
        primary: {
          50: '#f0f7fa',
          100: '#e0eff5',
          200: '#b8d9e8',
          300: '#8bbdd9',
          400: '#5da3c8',
          500: '#3d8bb5', // Main primary - soft blue
          600: '#2f6f96',
          700: '#275778',
          800: '#24465f',
          900: '#223b4f',
        },
        success: {
          50: '#f0f9f4',
          100: '#dcf2e6',
          200: '#b8e5cd',
          300: '#8dd3b0',
          400: '#5fbd8f',
          500: '#3da570', // Soft green
          600: '#2d8559',
          700: '#256a48',
          800: '#21563c',
          900: '#1d4833',
        },
        warning: {
          50: '#fef8f0',
          100: '#fdeee0',
          200: '#fbd9c0',
          300: '#f8be96',
          400: '#f49d66',
          500: '#f17f3f', // Warm orange
          600: '#d6632a',
          700: '#b34d24',
          800: '#904023',
          900: '#76381f',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef5a5a', // Softer red
          600: '#dc3d3d',
          700: '#b82d2d',
          800: '#992727',
          900: '#7f2525',
        },
        // Neutral grays - easy to read
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
