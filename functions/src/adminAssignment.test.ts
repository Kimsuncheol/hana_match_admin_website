import { describe, expect, it } from "vitest";
import { resolveAdminAssignment } from "./adminAssignment";

describe("resolveAdminAssignment", () => {
  it("grants admin when no domain restriction is configured", () => {
    const result = resolveAdminAssignment("new-user@anything.com", "");
    expect(result).toEqual({
      admin: true,
      role: "admin",
      reason: "no-domain-restriction",
    });
  });

  it("grants admin when the email domain is on the allowlist", () => {
    const result = resolveAdminAssignment(
      "staff@hanamatch.com",
      "hanamatch.com,partner-hanamatch.jp",
    );
    expect(result.admin).toBe(true);
    expect(result.role).toBe("admin");
    expect(result.reason).toBe("domain-allowed");
  });

  it("matches allowlist domains case-insensitively", () => {
    const result = resolveAdminAssignment("Staff@HanaMatch.COM", "hanamatch.com");
    expect(result.admin).toBe(true);
  });

  it("denies admin when the email domain is not on the allowlist", () => {
    const result = resolveAdminAssignment("random@gmail.com", "hanamatch.com");
    expect(result).toEqual({
      admin: false,
      role: "unassigned",
      reason: "domain-not-allowed",
    });
  });

  it("denies admin when there is no email on the account", () => {
    const result = resolveAdminAssignment(undefined, "hanamatch.com");
    expect(result).toEqual({
      admin: false,
      role: "unassigned",
      reason: "no-email",
    });
  });

  it("ignores blank/whitespace entries in the allowlist", () => {
    const result = resolveAdminAssignment("staff@hanamatch.com", " hanamatch.com , ,partner.jp ");
    expect(result.admin).toBe(true);
  });
});
