import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Portul 8000 este permis de CORS in backend (cors_origins).
export default defineConfig({
  plugins: [react()],
  server: { port: 8000, strictPort: true },
});
