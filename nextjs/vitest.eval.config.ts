import { defineConfig } from "vitest/config";
import path from "path";
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
process.env.NODE_ENV = "development";
loadEnvConfig(projectDir);

export default defineConfig({
  test: {
    environment: "node", // No need for jsdom for API logic evals
    globals: true,
    include: ["src/evals/**/*.eval.ts"],
    testTimeout: 30000, // Evals can take longer due to DB/AI calls
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
