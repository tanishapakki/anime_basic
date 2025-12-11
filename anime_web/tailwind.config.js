// tailwind.config.js
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        'maroon': '#800000', // You can name it anything you like
      },
    }
    },
      plugins: [
    require('@tailwindcss/line-clamp')
  ],
};
