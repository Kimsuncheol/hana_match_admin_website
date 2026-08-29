export type RolloutMode = "off" | "shadow" | "percentage" | "full";
export type EscalationSeverity = "medium" | "high" | "critical";

export type PolicyConfig = {
  moderationThresholds: { autoHideConfidence: number; escalationConfidence: number; criticalRiskScore: number };
  ruleVersions: { harassment: string; spam: string; safety: string };
  reversibleActionExpiryHours: { hiddenContent: number; talkRateLimit: number; warning: number };
  talkRateLimits: { messagesPerMinute: number; burst: number; restrictionMinutes: number };
  escalationRoutes: Array<{ severity: EscalationSeverity; destination: string; slaMinutes: number; enabled: boolean }>;
  featureFlags: { aiSuggestions: boolean; automatedHiding: boolean; talkRateLimiting: boolean; enhancedAudit: boolean };
  rollout: { mode: RolloutMode; percentage: number };
};

export type PolicyVersionSummary = {
  versionId: string;
  version: number;
  reason: string;
  operation: "publish" | "rollback";
  createdAt: string | null;
  rollbackTargetId: string | null;
};

export type PolicySettingsResponse = {
  current: { version: number; versionId: string | null; config: PolicyConfig; updatedAt: string | null };
  versions: PolicyVersionSummary[];
};

export type PolicyMutationInput =
  | { operation: "publish"; expectedVersion: number; reason: string; config: PolicyConfig }
  | { operation: "rollback"; expectedVersion: number; reason: string; targetVersionId: string };

export type PolicyMutationResult = {
  ok: true;
  correlationId: string;
  version: number;
  versionId: string;
  rollbackTargetId: string | null;
};
