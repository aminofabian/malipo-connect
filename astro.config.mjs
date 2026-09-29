// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  // host: true → 0.0.0.0 so Coolify/Docker proxies can reach the process
  server: { host: true, port: 4322 },
});
