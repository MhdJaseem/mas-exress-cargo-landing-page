import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single-page app: index.html is the only HTML entry; React Router handles every URL.
// Vite's default `appType: 'spa'` serves index.html for unknown paths in dev and preview,
// so deep links such as /air-freight work locally. Production hosts need the same
// fallback — see public/_redirects (Netlify / Cloudflare Pages) and vercel.json.
export default defineConfig({
  plugins: [react()],
  // Only env vars starting with these prefixes reach browser code (import.meta.env).
  // 'API_BASE' (not 'API_') so a future API_KEY / API_SECRET can never leak into the bundle.
  envPrefix: ['VITE_', 'API_BASE'],
  server: { port: 5173 },
  preview: { port: 4173 },
});
