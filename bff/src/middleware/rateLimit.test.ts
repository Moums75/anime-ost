import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../services.js";
import { rateLimit } from "./rateLimit.js";

const fakeReq = (ip: string) => ({ ip }) as Request;
const fakeRes = () => ({ setHeader() {} }) as unknown as Response;

describe("rateLimit", () => {
  it("bloque au-delà de la limite, adresse par adresse", () => {
    const limit = rateLimit({ max: 3, windowMs: 60_000, message: "trop" });
    let passed = 0;
    const next: NextFunction = () => passed++;

    for (let i = 0; i < 3; i++) limit(fakeReq("1.1.1.1"), fakeRes(), next);
    assert.equal(passed, 3);
    assert.throws(() => limit(fakeReq("1.1.1.1"), fakeRes(), next), (err) => err instanceof HttpError && err.status === 429);

    limit(fakeReq("2.2.2.2"), fakeRes(), next); // une autre adresse n'est pas concernée
    assert.equal(passed, 4);
  });

  it("libère l'adresse quand la fenêtre est passée", async () => {
    const limit = rateLimit({ max: 1, windowMs: 50, message: "trop" });
    let passed = 0;
    limit(fakeReq("3.3.3.3"), fakeRes(), () => passed++);
    assert.throws(() => limit(fakeReq("3.3.3.3"), fakeRes(), () => passed++));
    await new Promise((r) => setTimeout(r, 70));
    limit(fakeReq("3.3.3.3"), fakeRes(), () => passed++);
    assert.equal(passed, 2);
  });
});
