/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  theme: {
    colors: {
      Likha: '#f7f8ea',
      hehe: '#92fec2',
      sign: '#f8ecdc',
      outline: '#f17d55',
    },
    fontFamily: {
      libre: ['Libre Baskerville'],
      Montagu: ['Montagu Slab'],
      Inter: ['Inter'],
      Montserrat: ['Montserrat'],
      Sheppards: ['Mrs Sheppards'],
      Inria: ['Inria Serif'],
      Princess_Sofia: ['Princess Sofia'],
    },
    extend: {
      textShadow: {
        sm: '1px 1px 2px rgba(0, 0, 0, 0.5)',
        md: '2px 2px 4px rgba(0, 0, 0, 0.5)',
        lg: '3px 3px 6px rgba(0, 0, 0, 0.5)',
        none: 'none',
      },
    },
  },
  plugins: [
    require('tailwindcss-textshadow'),
  ],
};
