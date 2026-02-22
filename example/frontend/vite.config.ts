import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.PORT || "3000"),
    strictPort: true,
  },
  resolve: {
    alias: {
      "@backend": path.resolve(__dirname, "../backend"),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: [
          "import",
          "global-builtin",
          "color-functions",
          "if-function",
        ],
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
