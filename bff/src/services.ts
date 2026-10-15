import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { config } from "./config.js";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

// FastAPI renvoie { detail: "..." } ou, en cas d'erreur de validation, { detail: [{ loc, msg }] }
function formatDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => `${d.loc?.at(-1) ?? "champ"} : ${d.msg}`).join(", ");
  }
  return undefined;
}

async function send(url: string, init: RequestInit & { duplex?: "half" }): Promise<Response> {
  try {
    return await fetch(url, { ...init, headers: { "X-Internal-Key": config.internalApiKey, ...init.headers } });
  } catch {
    throw new HttpError(503, "Service momentanément indisponible");
  }
}

async function throwIfError(res: Response): Promise<void> {
  if (res.ok) return;
  const data = await res.json().catch(() => null);
  throw new HttpError(res.status, formatDetail(data?.detail) ?? res.statusText);
}

async function request<T>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(baseUrl + path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  await throwIfError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const authService = <T>(path: string, options?: RequestOptions) =>
  request<T>(config.authServiceUrl, path, options);

export const ostService = <T>(path: string, options?: RequestOptions) =>
  request<T>(config.ostServiceUrl, path, options);

const STREAMED_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];

/**
 * Relaie un fichier (audio, pochette) du service OST vers le navigateur, sans le
 * charger en mémoire. L'en-tête Range est transmis pour permettre le seek dans l'audio.
 */
export async function streamFromOstService(path: string, req: ExpressRequest, res: ExpressResponse) {
  const headers: Record<string, string> = {};
  if (req.headers.range) headers.Range = req.headers.range;

  const upstream = await send(config.ostServiceUrl + path, { headers });
  await throwIfError(upstream);

  res.status(upstream.status);
  for (const name of STREAMED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  // L'URL contient une version (?v=...) qui change à chaque nouveau fichier : on peut cacher longtemps
  res.setHeader("Cache-Control", "public, max-age=604800");
  if (!upstream.body) return res.end();

  // pipeline() coupe le flux amont si le navigateur abandonne (ex. quand on change de piste)
  await pipeline(Readable.fromWeb(upstream.body as NodeReadableStream), res).catch(() => undefined);
}

/** Transmet tel quel un upload multipart (fichier) au service OST. */
export async function forwardUploadToOstService<T>(path: string, req: ExpressRequest): Promise<T> {
  const upstream = await send(config.ostServiceUrl + path, {
    method: "PUT",
    headers: { "Content-Type": req.headers["content-type"] ?? "application/octet-stream" },
    body: Readable.toWeb(req) as ReadableStream,
    duplex: "half",
  });
  await throwIfError(upstream);
  return (await upstream.json()) as T;
}
