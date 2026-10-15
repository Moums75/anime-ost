// En local, les secrets viennent du fichier .env à la racine du projet (ignoré par Git).
// Dans Docker, ils sont fournis par docker-compose : le fichier n'existe pas et on l'ignore.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // pas de .env : valeurs par défaut de développement
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  authServiceUrl: process.env.AUTH_SERVICE_URL ?? "http://localhost:8001",
  ostServiceUrl: process.env.OST_SERVICE_URL ?? "http://localhost:8002",
  internalApiKey: process.env.INTERNAL_API_KEY ?? "dev-internal-key",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};

if (config.internalApiKey === "dev-internal-key") {
  console.warn("INTERNAL_API_KEY utilise sa valeur de développement : définis-la dans .env");
}
