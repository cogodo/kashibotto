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
                aurora: {
                    emerald: '#00BFAE',
                    cyan: '#00E5FF',
                    indigo: '#3F51B5',
                    rose: '#E91E63',
                },
                primary: {
                    50: '#e6fffe',
                    100: '#ccfffe',
                    200: '#9afffe',
                    300: '#67feff',
                    400: '#34fefe',
                    500: '#00E5FF',
                    600: '#00b8cc',
                    700: '#008b99',
                    800: '#005d66',
                    900: '#002e33',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Oswald', 'system-ui', 'sans-serif'],
                body: ['Poppins', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                'glow': '0 0 20px rgba(0, 229, 255, 0.4)',
                'glow-lg': '0 0 40px rgba(0, 229, 255, 0.6)',
                'glow-emerald': '0 0 20px rgba(0, 191, 174, 0.4)',
                'glow-rose': '0 0 20px rgba(233, 30, 99, 0.4)',
                'glow-indigo': '0 0 20px rgba(63, 81, 181, 0.4)',
                'aurora-glow': '0 0 30px rgba(0, 229, 255, 0.3), 0 0 60px rgba(233, 30, 99, 0.2)',
                'neon': '0 0 5px currentColor, 0 0 10px currentColor, 0 0 20px currentColor',
            },
            backdropBlur: {
                'xs': '2px',
            },
            animation: {
                'fade-in': 'fadeIn 0.6s ease-out',
                'slide-up': 'slideUp 0.6s ease-out',
                'pop': 'pop 0.15s ease-out',
                'float': 'float 3s ease-in-out infinite',
                'glow-pulse': 'glowPulse 2s ease-in-out infinite',
                'aurora-pulse': 'auroraPulse 1.5s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                pop: {
                    '0%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.05)' },
                    '100%': { transform: 'scale(1)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                glowPulse: {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)' },
                    '50%': { boxShadow: '0 0 40px rgba(0, 229, 255, 0.6)' },
                },
                auroraPulse: {
                    '0%, 100%': { boxShadow: '0 0 8px rgba(0, 229, 255, 0.4)' },
                    '50%': { boxShadow: '0 0 20px rgba(0, 229, 255, 0.6), 0 0 30px rgba(233, 30, 99, 0.3)' },
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'aurora': 'linear-gradient(to right, #00bfae, #00e5ff 25%, #3f51b5 50%, #e91e63 75%, #00bfae)',
                'hero-gradient': 'linear-gradient(135deg, #00bfae 0%, #00e5ff 30%, #3f51b5 60%, #e91e63 100%)',
                'hero-gradient-dark': 'linear-gradient(135deg, #006b5d 0%, #0099b3 30%, #2e3875 60%, #a6103d 100%)',
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
        require('@tailwindcss/forms'),
    ],
}