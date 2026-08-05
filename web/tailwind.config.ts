import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  // Disable Tailwind's Preflight reset so it doesn't clobber the design system's
  // base styles. Tailwind is being migrated out page-by-page (see tasks/todo.md);
  // until then it coexists as utility classes only, no reset.
  corePlugins: { preflight: false },
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
