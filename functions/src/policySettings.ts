export type RolloutMode = "off" | "shadow" | "percentage" | "full";
export type EscalationSeverity = "medium" | "high" | "critical";

export type PolicyConfig = {
  moderationThresholds: {
    autoHideConfidence: number;
    escalationConfidence: number;
    criticalRiskScore: number;
  };
  ruleVersions: {
    harassment: string;
    spam: string;
    safety: string;
  };
  reversibleActionExpiryHours: {
    hiddenContent: number;
    talkRateLimit: number;
    warning: number;
  };
  talkRateLimits: {
    messagesPerMinute: number;
    burst: number;
    restrictionMinutes: number;
  };
  escalationRoutes: Array<{
    severity: EscalationSeverity;
    destination: string;
    slaMinutes: number;
    enabled: boolean;
  }>;
  featureFlags: {
    aiSuggestions: boolean;
    automatedHiding: boolean;
    talkRateLimiting: boolean;
    enhancedAudit: boolean;
  };
  rollout: {
    mode: RolloutMode;
    percentage: number;
  };
};

export type PolicyMutationInput =
  | { operation: "publish"; expectedVersion: number; reason: string; config: PolicyConfig }
  | { operation: "rollback"; expectedVersion: number; reason: string; targetVersionId: string };

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: string[] };

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  moderationThresholds: { autoHideConfidence: 0.96, escalationConfidence: 0.82, criticalRiskScore: 85 },
  ruleVersions: { harassment: "harassment-v1", spam: "spam-v1", safety: "safety-v1" },
  reversibleActionExpiryHours: { hiddenContent: 72, talkRateLimit: 24, warning: 168 },
  talkRateLimits: { messagesPerMinute: 20, burst: 8, restrictionMinutes: 60 },
  escalationRoutes: [
    { severity: "high", destination: "trust-safety", slaMinutes: 60, enabled: true },
    { severity: "critical", destination: "on-call", slaMinutes: 15, enabled: true },
  ],
  featureFlags: { aiSuggestions: true, automatedHiding: false, talkRateLimiting: true, enhancedAudit: true },
  rollout: { mode: "shadow", percentage: 0 },
};

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min: number, max: number) => finite(value, min, max) && Number.isInteger(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const versionName = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
const destinationName = (value: unknown) =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{1,47}$/.test(value);

export function canManagePolicy(token: Record<string, unknown> | null | undefined): boolean {
  return token?.admin === true && token.role === "superAdmin";
}

export function parsePolicyConfig(value: unknown): ValidationResult<PolicyConfig> {
  const issues: string[] = [];
  if (!object(value) || !exactKeys(value, ["moderationThresholds", "ruleVersions", "reversibleActionExpiryHours", "talkRateLimits", "escalationRoutes", "featureFlags", "rollout"])) {
    return { ok: false, issues: ["Policy configuration has an invalid shape."] };
  }

  const thresholds = value.moderationThresholds;
  if (!object(thresholds) || !exactKeys(thresholds, ["autoHideConfidence", "escalationConfidence", "criticalRiskScore"])) {
    issues.push("Moderation thresholds have an invalid shape.");
  } else {
    if (!finite(thresholds.autoHideConfidence, 0.5, 1)) issues.push("Auto-hide confidence must be between 0.5 and 1.");
    if (!finite(thresholds.escalationConfidence, 0.5, 1)) issues.push("Escalation confidence must be between 0.5 and 1.");
    if (!integer(thresholds.criticalRiskScore, 1, 100)) issues.push("Critical risk score must be an integer from 1 to 100.");
    if (finite(thresholds.autoHideConfidence, 0.5, 1) && finite(thresholds.escalationConfidence, 0.5, 1) && Number(thresholds.autoHideConfidence) < Number(thresholds.escalationConfidence)) {
      issues.push("Auto-hide confidence cannot be lower than escalation confidence.");
    }
  }

  const rules = value.ruleVersions;
  if (!object(rules) || !exactKeys(rules, ["harassment", "spam", "safety"]) || !versionName(rules.harassment) || !versionName(rules.spam) || !versionName(rules.safety)) {
    issues.push("Every rule version must be a valid version identifier.");
  }

  const expiry = value.reversibleActionExpiryHours;
  if (!object(expiry) || !exactKeys(expiry, ["hiddenContent", "talkRateLimit", "warning"]) || !integer(expiry.hiddenContent, 1, 2160) || !integer(expiry.talkRateLimit, 1, 720) || !integer(expiry.warning, 1, 8760)) {
    issues.push("Reversible-action expiry values are outside their allowed ranges.");
  }

  const limits = value.talkRateLimits;
  if (!object(limits) || !exactKeys(limits, ["messagesPerMinute", "burst", "restrictionMinutes"]) || !integer(limits.messagesPerMinute, 1, 120) || !integer(limits.burst, 1, 120) || !integer(limits.restrictionMinutes, 5, 43200)) {
    issues.push("Talk rate limits are outside their allowed ranges.");
  } else if (typeof limits.burst === "number" && typeof limits.messagesPerMinute === "number" && limits.burst > limits.messagesPerMinute) {
    issues.push("Talk burst cannot exceed messages per minute.");
  }

  const routes = value.escalationRoutes;
  if (!Array.isArray(routes) || routes.length < 1 || routes.length > 10) {
    issues.push("Provide between 1 and 10 escalation routes.");
  } else {
    const destinations = new Set<string>();
    let criticalEnabled = false;
    for (const route of routes) {
      if (!object(route) || !exactKeys(route, ["severity", "destination", "slaMinutes", "enabled"]) || !["medium", "high", "critical"].includes(String(route.severity)) || !destinationName(route.destination) || !integer(route.slaMinutes, 5, 10080) || typeof route.enabled !== "boolean") {
        issues.push("One or more escalation routes are invalid.");
        break;
      }
      if (destinations.has(route.destination as string)) issues.push("Escalation destinations must be unique.");
      destinations.add(route.destination as string);
      if (route.severity === "critical" && route.enabled) criticalEnabled = true;
    }
    if (!criticalEnabled) issues.push("At least one critical escalation route must be enabled.");
  }

  const flags = value.featureFlags;
  if (!object(flags) || !exactKeys(flags, ["aiSuggestions", "automatedHiding", "talkRateLimiting", "enhancedAudit"]) || Object.values(flags).some((flag) => typeof flag !== "boolean")) {
    issues.push("Feature flags have an invalid shape.");
  }

  const rollout = value.rollout;
  if (!object(rollout) || !exactKeys(rollout, ["mode", "percentage"]) || !["off", "shadow", "percentage", "full"].includes(String(rollout.mode)) || !integer(rollout.percentage, 0, 100)) {
    issues.push("Rollout configuration is invalid.");
  } else if ((rollout.mode === "off" || rollout.mode === "shadow") && rollout.percentage !== 0) {
    issues.push("Off and shadow rollout modes require 0 percent.");
  } else if (rollout.mode === "full" && rollout.percentage !== 100) {
    issues.push("Full rollout mode requires 100 percent.");
  } else if (rollout.mode === "percentage" && (!integer(rollout.percentage, 1, 99))) {
    issues.push("Percentage rollout mode requires a value from 1 to 99.");
  }

  return issues.length ? { ok: false, issues: [...new Set(issues)] } : { ok: true, value: value as PolicyConfig };
}

export function parsePolicyMutationInput(value: unknown): ValidationResult<PolicyMutationInput> {
  if (!object(value)) return { ok: false, issues: ["Invalid mutation request."] };
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  const expectedVersion = value.expectedVersion;
  const commonIssues: string[] = [];
  if (reason.length < 10 || reason.length > 500) commonIssues.push("Reason must contain 10 to 500 characters.");
  if (!integer(expectedVersion, 0, Number.MAX_SAFE_INTEGER)) commonIssues.push("Expected version is invalid.");

  if (value.operation === "publish") {
    if (!exactKeys(value, ["operation", "expectedVersion", "reason", "config"])) commonIssues.push("Publish request contains unsupported fields.");
    const parsed = parsePolicyConfig(value.config);
    if (!parsed.ok) commonIssues.push(...parsed.issues);
    return commonIssues.length || !parsed.ok
      ? { ok: false, issues: [...new Set(commonIssues)] }
      : { ok: true, value: { operation: "publish", expectedVersion: expectedVersion as number, reason, config: parsed.value } };
  }

  if (value.operation === "rollback") {
    if (!exactKeys(value, ["operation", "expectedVersion", "reason", "targetVersionId"])) commonIssues.push("Rollback request contains unsupported fields.");
    if (typeof value.targetVersionId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value.targetVersionId)) commonIssues.push("Rollback target is invalid.");
    return commonIssues.length
      ? { ok: false, issues: [...new Set(commonIssues)] }
      : { ok: true, value: { operation: "rollback", expectedVersion: expectedVersion as number, reason, targetVersionId: value.targetVersionId as string } };
  }

  return { ok: false, issues: ["Unsupported policy operation."] };
}
