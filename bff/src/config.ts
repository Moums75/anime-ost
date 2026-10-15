export const config = {
  port: Number(process.env.PORT ?? 3000),
  authServiceUrl: process.env.AUTH_SERVICE_URL ?? "http://localhost:8001",
  ostServiceUrl: process.env.OST_SERVICE_URL ?? "http://localhost:8002",
  internalApiKey: process.env.INTERNAL_API_KEY ?? "dev-internal-key",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
