import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

// eslint-config-prettier last, to turn off ESLint rules that would fight Prettier.
const eslintConfig = [
  // Vendored design system (web/vendor/seakim) is upstream source — conformance
  // -checked in its own repo; don't lint or format it here.
  { ignores: ["vendor/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
];

export default eslintConfig;
