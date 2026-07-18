import { defineConfig } from "astro/config";

export default defineConfig({
  devToolbar: {
    enabled: false
  },
  server: {
    host: "0.0.0.0",
    port: 3000
  }
});
