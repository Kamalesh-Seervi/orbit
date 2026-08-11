import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The `base` path must match the GitHub Pages repo name so asset URLs resolve
// correctly at https://<user>.github.io/connections/. Change it if you rename
// the repository. For a custom domain or user/organization page, set to '/'.
export default defineConfig({
  base: '/connections/',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    // Allow requests coming through a tunnel (e.g. *.trycloudflare.com) so the
    // app can be opened on a phone with a real, trusted HTTPS certificate.
    allowedHosts: true,
  },
});
