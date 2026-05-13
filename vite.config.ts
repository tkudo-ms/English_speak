/// <reference types="vitest" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "/English_speak/",
  plugins: [vue()],
  test: {
    environment: "happy-dom",
  },
});
