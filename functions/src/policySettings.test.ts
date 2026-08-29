import { describe, expect, it } from "vitest";
import { canManagePolicy, DEFAULT_POLICY_CONFIG, parsePolicyConfig, parsePolicyMutationInput } from "./policySettings";

const config = () => structuredClone(DEFAULT_POLICY_CONFIG);

describe("policy settings authorization", () => {
  it("allows only an exact superAdmin claim", () => {
    expect(canManagePolicy({ admin: true, role: "superAdmin" })).toBe(true);
    expect(canManagePolicy({ admin: true, role: "admin" })).toBe(false);
    expect(canManagePolicy({ admin: true, role: "moderator" })).toBe(false);
    expect(canManagePolicy({ admin: false, role: "superAdmin" })).toBe(false);
  });
});

describe("policy config validation", () => {
  it("accepts the safe default configuration", () => {
    expect(parsePolicyConfig(config())).toEqual({ ok: true, value: DEFAULT_POLICY_CONFIG });
  });

  it("rejects unsafe threshold ordering and an invalid rollout", () => {
    const value = config();
    value.moderationThresholds.autoHideConfidence = 0.7;
    value.moderationThresholds.escalationConfidence = 0.8;
    value.rollout = { mode: "full", percentage: 50 };
    const result = parsePolicyConfig(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toEqual(expect.arrayContaining([
      "Auto-hide confidence cannot be lower than escalation confidence.",
      "Full rollout mode requires 100 percent.",
    ]));
  });

  it("requires an enabled critical escalation route", () => {
    const value = config();
    value.escalationRoutes = [{ severity: "high", destination: "trust-safety", slaMinutes: 30, enabled: true }];
    const result = parsePolicyConfig(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContain("At least one critical escalation route must be enabled.");
  });
});

describe("policy mutation contract", () => {
  it("requires a meaningful reason and optimistic version", () => {
    expect(parsePolicyMutationInput({ operation: "publish", expectedVersion: -1, reason: "short", config: config() }).ok).toBe(false);
  });

  it("rejects extra client-controlled fields", () => {
    expect(parsePolicyMutationInput({ operation: "rollback", expectedVersion: 2, reason: "Restore known stable policy", targetVersionId: "v1", actorRole: "superAdmin" }).ok).toBe(false);
  });

  it("accepts a constrained rollback request", () => {
    expect(parsePolicyMutationInput({ operation: "rollback", expectedVersion: 2, reason: "Restore known stable policy", targetVersionId: "version_1" })).toEqual({
      ok: true,
      value: { operation: "rollback", expectedVersion: 2, reason: "Restore known stable policy", targetVersionId: "version_1" },
    });
  });
});
