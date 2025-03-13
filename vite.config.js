import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import copy from "rollup-plugin-copy";

export default defineConfig({
  plugins: [react()],
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    rollupOptions: {
      plugins: [
        copy({
          targets: [{ src: "data/**/*", dest: "dist/data" }],
          verbose: true,
          hook: "writeBundle",
        }),
      ],
    },
  },
});
