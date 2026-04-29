/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        // Legacy aliases (kept pointed at the new palette so existing pages remain readable)
        primary: "#3D4743",          // ink-700 — calm, used for primary-button hovers/links
        "primary-hover": "#1F2622",  // ink-900
        "primary-light": "#EEF1EC",  // sage-tint
        dark: "#1F2622",             // ink-900
        light: "#FBF8F2",            // paper
        grayish: "#6B7570",          // ink-500
        sand: "#E1DBCC",             // line

        // CareData redesign palette
        cream: "#F6F2EB",
        paper: "#FBF8F2",
        ink: {
          900: "#1F2622",
          700: "#3D4743",
          500: "#6B7570",
          400: "#8A928C",
          300: "#B4BAB4",
        },
        line: {
          soft: "#ECE6D9",
          DEFAULT: "#E1DBCC",
          strong: "#CFC6B2",
        },
        sage: {
          DEFAULT: "#9FB4A0",
          ink: "#4B6A55",
          tint: "#EEF1EC",
        },
        clay: {
          DEFAULT: "#C8B89B",
          ink: "#836B47",
          tint: "#F1ECE1",
        },
        "dusty-blue": {
          DEFAULT: "#A6B6C4",
          ink: "#4B6178",
          tint: "#E9EEF2",
        },
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(to bottom, #F6F2EB, #FBF8F2)",
      },
      borderRadius: {
        card: "16px",
      },
      keyframes: {
        gradient: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        gradient: "gradient 6s ease infinite",
      },
    },
  },
  plugins: [],
};
