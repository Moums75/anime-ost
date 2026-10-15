import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Le front ne parle qu'au BFF
    // xfwd : transmet l'adresse du client au BFF (limite de tentatives de connexion par IP)
    proxy: { "/api": { target: "http://localhost:3000", xfwd: true } },
  },
});
