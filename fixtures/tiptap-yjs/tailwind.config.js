// @ts-nocheck

import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  // ...
  // The rest of the tailwindcss configuration
  // For more, see: https://tailwindcss.com/docs/configuration

  plugins: [typography(), forms()]
};
