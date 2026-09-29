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
  // Cloudflare Flexible terminates TLS; Traefik often forwards as http and
  // overwrites X-Forwarded-Proto, so Origin (https) ≠ request URL (http).
  // Trust the public host for forwarded headers, and skip the brittle CSRF
  // Origin===URL check (edge already enforces HTTPS for browsers).
  security: {
    checkOrigin: false,
    allowedDomains: [
      { hostname: "connect.kioskpay.co.ke", protocol: "https" },
      { hostname: "connect.kioskpay.co.ke", protocol: "http" },
    ],
  },
});
