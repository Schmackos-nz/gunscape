import { defineConfig } from "vite";

export default defineConfig({
  // relative base so the built assets resolve when served under /cityofeyes/
  base: "./",
  server: { open: true },
});
