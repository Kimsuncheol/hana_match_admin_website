import { describe, expect, it } from "vitest";
import { authorizeRequest, type IdTokenVerifier } from "./authorize";

function requestWith(header: string | null): Request {
  const headers = new Headers();
  if (header !== null) headers.set("authorization", header);
  return new Request("https://example.com/api/admin/dashboard", { headers });
}

function fakeVerifier(
  responses: Record<string, { uid: string; email?: string; admin?: boolean; role?: string }>,
): IdTokenVerifier {
  return {
    async verifyIdToken(idToken: string) {
      const decoded = responses[idToken];
      if (!decoded) throw new Error("invalid token");
      return decoded;
    },
  };
}

describe("authorizeRequest", () => {
  it("rejects a request with no Authorization header", async () => {
    const result = await authorizeRequest(requestWith(null), fakeVerifier({}), ["admin"]);
    expect(result).toEqual({ ok: false, status: 401, error: "missing-id-token" });
  });

  it("rejects a header that isn't a Bearer token", async () => {
    const result = await authorizeRequest(requestWith("Basic abc123"), fakeVerifier({}), ["admin"]);
    expect(result).toEqual({ ok: false, status: 401, error: "missing-id-token" });
  });

  it("rejects a token that fails verification", async () => {
    const verifier = fakeVerifier({});
    const result = await authorizeRequest(requestWith("Bearer garbage"), verifier, ["admin"]);
    expect(result).toEqual({ ok: false, status: 401, error: "invalid-id-token" });
  });

  it("rejects a verified token with no admin claim at all", async () => {
    const verifier = fakeVerifier({ "tok-1": { uid: "u1", admin: false } });
    const result = await authorizeRequest(requestWith("Bearer tok-1"), verifier, ["admin", "moderator"]);
    expect(result).toEqual({ ok: false, status: 403, error: "insufficient-role" });
  });

  it("rejects a moderator calling an admin-only route", async () => {
    const verifier = fakeVerifier({ "tok-1": { uid: "u1", admin: true, role: "moderator" } });
    const result = await authorizeRequest(requestWith("Bearer tok-1"), verifier, ["admin"]);
    expect(result).toEqual({ ok: false, status: 403, error: "insufficient-role" });
  });

  it("accepts an admin on a route open to admin and moderator", async () => {
    const verifier = fakeVerifier({
      "tok-1": { uid: "u1", email: "boss@hanamatch.com", admin: true, role: "admin" },
    });
    const result = await authorizeRequest(requestWith("Bearer tok-1"), verifier, ["admin", "moderator"]);
    expect(result).toEqual({ ok: true, uid: "u1", email: "boss@hanamatch.com", role: "admin" });
  });

  it("treats an admin-claimed token with an unrecognized role string as moderator (least privilege), never as admin", async () => {
    const verifier = fakeVerifier({ "tok-1": { uid: "u1", admin: true, role: "superuser-typo" } });
    const adminOnly = await authorizeRequest(requestWith("Bearer tok-1"), verifier, ["admin"]);
    expect(adminOnly).toEqual({ ok: false, status: 403, error: "insufficient-role" });

    const modOk = await authorizeRequest(requestWith("Bearer tok-1"), verifier, ["moderator"]);
    expect(modOk).toEqual({ ok: true, uid: "u1", email: undefined, role: "moderator" });
  });

  it("treats an admin-claimed token with no role string as moderator", async () => {
    const verifier = fakeVerifier({ "tok-1": { uid: "u1", admin: true } });
    const result = await authorizeRequest(requestWith("Bearer tok-1"), verifier, ["moderator"]);
    expect(result).toMatchObject({ ok: true, role: "moderator" });
  });
});
