import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next";

const eslintConfig = defineConfig([
  ...next,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Allow `any` in Transformers.js workers and Qdrant payload access
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow setting state in effects for polling/initialization patterns
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
