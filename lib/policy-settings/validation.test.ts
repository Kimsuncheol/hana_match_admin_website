import { describe, expect, it } from "vitest";
import type { PolicyConfig } from "./types";
import { validatePolicyDraft } from "./validation";

const valid: PolicyConfig = {
  moderationThresholds: { autoHideConfidence: 0.95, escalationConfidence: 0.8, criticalRiskScore: 90 },
  ruleVersions: { harassment: "harassment-v2", spam: "spam-v3", safety: "safety-v1" },
  reversibleActionExpiryHours: { hiddenContent: 72, talkRateLimit: 24, warning: 168 },
  talkRateLimits: { messagesPerMinute: 20, burst: 8, restrictionMinutes: 60 },
  escalationRoutes: [{ severity: "critical", destination: "on-call", slaMinutes: 15, enabled: true }],
  featureFlags: { aiSuggestions: true, automatedHiding: false, talkRateLimiting: true, enhancedAudit: true },
  rollout: { mode: "shadow", percentage: 0 },
};

describe("validatePolicyDraft", () => {
  it("accepts a valid draft and reason", () => {
    expect(validatePolicyDraft(valid, "정책 검토 회의 결과를 반영합니다.")).toEqual([]);
  });

  it("rejects invalid cross-field values before confirmation", () => {
    const config = structuredClone(valid);
    config.moderationThresholds.autoHideConfidence = 0.7;
    config.moderationThresholds.escalationConfidence = 0.8;
    config.talkRateLimits.burst = 30;
    expect(validatePolicyDraft(config, "short").length).toBeGreaterThanOrEqual(3);
  });
});
