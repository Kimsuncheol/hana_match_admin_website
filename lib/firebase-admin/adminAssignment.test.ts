import { describe, expect, it } from "vitest";
import { resolveAdminAssignment } from "./adminAssignment";

describe("resolveAdminAssignment", () => {
  it("grants admin when no domain restriction is configured", () => {
    expect(resolveAdminAssignment("new-user@anything.com", "")).toEqual({
      admin: true,
      role: "admin",
      reason: "no-domain-restriction",
    });
  });

  it("grants admin when the email domain is on the allowlist", () => {
    const result = resolveAdminAssignment("staff@hanamatch.com", "hanamatch.com,partner-hanamatch.jp");
    expect(result).toMatchObject({ admin: true, role: "admin", reason: "domain-allowed" });
  });

  it("matches allowlist domains case-insensitively", () => {
    expect(resolveAdminAssignment("Staff@HanaMatch.COM", "hanamatch.com").admin).toBe(true);
  });

  it("denies admin when the email domain is not on the allowlist", () => {
    expect(resolveAdminAssignment("random@gmail.com", "hanamatch.com")).toEqual({
      admin: false,
      role: "unassigned",
      reason: "domain-not-allowed",
    });
  });

  it("denies admin when there is no email on the account", () => {
    expect(resolveAdminAssignment(undefined, "hanamatch.com")).toEqual({
      admin: false,
      role: "unassigned",
      reason: "no-email",
    });
  });

  it("ignores blank/whitespace entries in the allowlist", () => {
    expect(resolveAdminAssignment("staff@hanamatch.com", " hanamatch.com , ,partner.jp ").admin).toBe(true);
  });
});
