import { describe, expect, it } from "vitest";
import { isAdminClaim } from "./claims";

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
