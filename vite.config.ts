// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// ---------------------------------------------------------------------------
// Deployment target
// ---------------------------------------------------------------------------
// Nitro has to emit a different server bundle depending on where the app runs:
//   - Vercel  -> the Vercel Build Output API (`.vercel/output`), detected via VERCEL=1
//   - Replit / any Node host -> a plain Node server at `.output/server/index.mjs`
// Inside the Lovable sandbox the preset is forced back to Cloudflare, so this
// stays Lovable-compatible too.
const nitroPreset = process.env["VERCEL"] ? "vercel" : "node-server";

// ---------------------------------------------------------------------------
// Dev / preview port
// ---------------------------------------------------------------------------
// Replit (and most PaaS) proxy to a single port. Read it from the environment
// and fall back to 8080 for local runs. `0.0.0.0` keeps it reachable from the
// Replit webview; binding to `::` (the Lovable default) fails on Replit with
// EAFNOSUPPORT.
const port = Number(process.env["PORT"] ?? 8080);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: { preset: nitroPreset },
  vite: {
    server: {
      host: "0.0.0.0",
      port,
      strictPort: true,
      allowedHosts: true,
    },
    preview: {
      host: "0.0.0.0",
      port,
      strictPort: true,
      allowedHosts: true,
    },
  },
});
