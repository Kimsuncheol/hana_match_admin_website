import { describe, expect, it } from "vitest";
import { isAdminClaim, roleFromClaims } from "./claims";

describe("isAdminClaim", () => {
  it("returns true only when admin is exactly true", () => {
    expect(isAdminClaim({ admin: true })).toBe(true);
  });

  it("returns false when admin is false", () => {
    expect(isAdminClaim({ admin: false })).toBe(false);
  });

  it("returns false when admin is missing", () => {
    expect(isAdminClaim({})).toBe(false);
  });

  it("returns false for null/undefined claims", () => {
    expect(isAdminClaim(null)).toBe(false);
    expect(isAdminClaim(undefined)).toBe(false);
  });

  it("rejects truthy-but-not-boolean-true values (no coercion)", () => {
    // @ts-expect-error deliberately passing a malformed claim shape
    expect(isAdminClaim({ admin: "true" })).toBe(false);
  });
});

describe("roleFromClaims", () => {
  it("returns null when there is no admin claim at all", () => {
    expect(roleFromClaims({ admin: false, role: "admin" })).toBeNull();
    expect(roleFromClaims({})).toBeNull();
    expect(roleFromClaims(null)).toBeNull();
  });

  it("returns 'admin' only when role is exactly the string 'admin'", () => {
    expect(roleFromClaims({ admin: true, role: "admin" })).toBe("admin");
  });

  it("returns the explicit superAdmin role without widening unknown roles", () => {
    expect(roleFromClaims({ admin: true, role: "superAdmin" })).toBe("superAdmin");
  });

  it("falls back to 'moderator' for a missing or unrecognized role string, as long as admin is true", () => {
    expect(roleFromClaims({ admin: true })).toBe("moderator");
    expect(roleFromClaims({ admin: true, role: "superuser-typo" })).toBe("moderator");
  });
});
